/**
 * board.js - [B] BOARD Domain
 * Centralised roster management, 4-column bulk importer, and single-door Full Edit modal.
 * Works with existing DB tables: students, programs, batches, institutions (no schema changes).
 */

import { adminFetchAll, adminInsert, adminUpdate, formatStudentName } from '../api.js?v=4.1.0';
import { showToast } from '../app.js?v=4.1.0';
import { handleExcelRosterImport } from './board_import.js?v=4.1.0';
import { processAndCompressAvatar, getBustedAvatarUrl } from '../utils/avatar-engine.js?v=4.1.0';

// ---- HELPERS ----
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- FULL EDIT MODAL (#modal-student-full-edit) ----
function buildFullEditModal() {
  if (document.getElementById('modal-student-full-edit')) return;
  const modal = document.createElement('div');
  modal.id = 'modal-student-full-edit';
  modal.className = 'modal-overlay hidden';
  modal.style.zIndex = '9999';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;width:95%;max-height:90vh;overflow-y:auto;background:var(--clr-surface-2, #0f172a);border:1px solid var(--clr-border);border-radius:12px;box-shadow:0 20px 40px rgba(0,0,0,0.6);">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.5rem;border-bottom:1px solid var(--clr-border);">
        <h3 id="bfe-title" style="margin:0;font-size:1.15rem;font-weight:800;color:var(--clr-text-1);">Edit Student</h3>
        <button class="btn-icon" id="bfe-close" title="Close" style="background:transparent;border:none;color:var(--clr-text-2);font-size:1.2rem;cursor:pointer;">&#10005;</button>
      </div>
      <div id="bfe-body" style="padding:1.5rem;"></div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:.75rem;padding:1rem 1.5rem;border-top:1px solid var(--clr-border);">
        <button class="btn btn-ghost" id="bfe-cancel">Cancel</button>
        <button class="btn btn-primary" id="bfe-save">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
}

function handleGuardClose(modal, onDiscard) {
  if (window.isProfileDirty) {
    const saveIt = confirm("⚠️ You have unsaved profile changes.\n\nClick OK to SAVE and leave, or CANCEL to discard changes and leave.");
    if (saveIt) {
      document.getElementById('bfe-save')?.click();
      return;
    } else {
      window.isProfileDirty = false;
      if (typeof onDiscard === 'function') onDiscard();
      modal.classList.add('hidden');
      return;
    }
  }
  modal.classList.add('hidden');
}

export async function openStudentFullEdit(student, onSaved) {
  buildFullEditModal();
  const modal   = document.getElementById('modal-student-full-edit');
  const title   = document.getElementById('bfe-title');
  const body    = document.getElementById('bfe-body');
  let   saveBtn = document.getElementById('bfe-save');

  // Reset dirty flag and check for local draft buffer
  window.isProfileDirty = false;
  const draftKey = 'topscore_student_draft_' + (student?.id || 'new');
  let draftData = null;
  try {
    const rawDraft = localStorage.getItem(draftKey);
    if (rawDraft) draftData = JSON.parse(rawDraft);
  } catch (e) { /* ignore */ }

  title.textContent = student ? ('Edit — ' + (student.name || 'Student')) : 'Add New Student';

  // Fetch batches for dropdown
  let batches = [];
  try {
    batches = await adminFetchAll('batches');
  } catch (err) {
    console.warn('Could not load batches for edit modal:', err);
  }

  const initialName = draftData?.name ?? (student?.name || '');
  const initialGender = draftData?.gender ?? (student?.gender || '');
  const initialBirth = draftData?.birth_date ?? (student?.birth_date || '');
  const initialPin = draftData?.pin ?? (student?.pin || '1234');
  const initialBatchId = draftData?.batch_id ?? (student?.batch_id || '');
  const initialActive = draftData?.is_active ?? (student?.is_active !== false);
  let currentPhotoUrl = draftData?.photo_url ?? (student?.photo_url || '');

  body.innerHTML = `
    <div style="display:flex;gap:1.5rem;flex-wrap:wrap;">
      <!-- 3:4 Avatar Center-Crop Upload (Left) -->
      <div style="flex:1;min-width:140px;max-width:180px;text-align:center;">
        <label class="form-label" style="display:block;margin-bottom:0.5rem;font-size:0.8rem;text-transform:uppercase;color:var(--clr-text-3);">3:4 Avatar</label>
        <div style="width:120px;height:160px;margin:0 auto;border-radius:8px;overflow:hidden;border:2px solid var(--clr-border);background:rgba(0,0,0,0.25);position:relative;">
          <img id="bfe-avatar-preview" src="${getBustedAvatarUrl(currentPhotoUrl)}" alt="Avatar" style="width:100%;height:100%;object-fit:cover;" />
          <div id="bfe-avatar-loading" class="hidden" style="position:absolute;inset:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;">
            <div class="spinner" style="width:20px;height:20px;"></div>
          </div>
        </div>
        <div style="margin-top:0.75rem;">
          <label for="bfe-avatar-file" class="btn btn-secondary btn-xs" style="cursor:pointer;font-size:0.75rem;">
            📸 Upload (3:4)
          </label>
          <input type="file" id="bfe-avatar-file" accept="image/*" style="display:none;" />
          <div class="text-xs text-muted mt-1" style="font-size:0.7rem;">240x320 WebP &bull; 35% Top Bias</div>
        </div>
      </div>

      <!-- Main Fields (Right) -->
      <div style="flex:2.5;min-width:260px;display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Full Name *</label>
          <input class="form-control" id="bfe-name" value="${escHtml(initialName)}" placeholder="e.g. Johnathan Doe">
        </div>
        
        <div class="form-group">
          <label class="form-label">Honorific &amp; Gender</label>
          <select class="form-control" id="bfe-gender">
            <option value="">-- Unassigned --</option>
            <option value="male" ${initialGender === 'male' ? 'selected' : ''}>Mr. (Male)</option>
            <option value="female" ${initialGender === 'female' ? 'selected' : ''}>Miss (Female)</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Date of Birth</label>
          <input type="date" class="form-control" id="bfe-birth" value="${escHtml(initialBirth)}">
        </div>

        <div class="form-group">
          <label class="form-label">Assigned Batch</label>
          <select class="form-control" id="bfe-batch">
            <option value="">-- No Batch Assigned --</option>
            ${batches.map(b => `<option value="${b.id}" ${b.id === initialBatchId ? 'selected' : ''}>${escHtml(b.name)}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Personal PIN (Reset)</label>
          <input type="text" class="form-control" id="bfe-pin" value="${escHtml(initialPin)}" placeholder="1234" autocomplete="new-password">
        </div>

        <div class="form-group" style="grid-column:1/-1;">
          <label class="form-label">Account Status</label>
          <select class="form-control" id="bfe-active">
            <option value="true"  ${initialActive ? 'selected' : ''}>Active</option>
            <option value="false" ${!initialActive  ? 'selected' : ''}>Inactive / Suspended</option>
          </select>
        </div>
      </div>
    </div>
  `;

  // Write-Ahead Buffer & Dirty Tracking
  const updateDraft = () => {
    window.isProfileDirty = true;
    const currentDraft = {
      name: document.getElementById('bfe-name').value,
      gender: document.getElementById('bfe-gender').value,
      birth_date: document.getElementById('bfe-birth').value,
      batch_id: document.getElementById('bfe-batch').value,
      pin: document.getElementById('bfe-pin').value,
      is_active: document.getElementById('bfe-active').value === 'true',
      photo_url: currentPhotoUrl
    };
    try {
      localStorage.setItem(draftKey, JSON.stringify(currentDraft));
    } catch (e) { /* ignore */ }
  };

  ['bfe-name', 'bfe-gender', 'bfe-birth', 'bfe-batch', 'bfe-pin', 'bfe-active'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateDraft);
    document.getElementById(id)?.addEventListener('change', updateDraft);
  });

  // Avatar Upload Listener (3:4 Center-Crop Engine)
  const avatarFileInput = document.getElementById('bfe-avatar-file');
  avatarFileInput?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const loading = document.getElementById('bfe-avatar-loading');
    loading?.classList.remove('hidden');

    try {
      const dataUrl = await processAndCompressAvatar(file, 'student');
      currentPhotoUrl = dataUrl;
      document.getElementById('bfe-avatar-preview').src = dataUrl;
      updateDraft();
      showToast('Student avatar cropped to 3:4 WebP format.', 'success');
    } catch (err) {
      showToast('Avatar processing error: ' + err.message, 'error');
    } finally {
      loading?.classList.add('hidden');
      avatarFileInput.value = '';
    }
  });

  // Close & Cancel buttons with Unsaved Changes Guard
  document.getElementById('bfe-close').onclick = () => handleGuardClose(modal, () => localStorage.removeItem(draftKey));
  document.getElementById('bfe-cancel').onclick = () => handleGuardClose(modal, () => localStorage.removeItem(draftKey));

  // Save Changes
  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  newSaveBtn.onclick = async () => {
    const name = document.getElementById('bfe-name').value.trim();
    if (!name) { showToast('Student name is required.', 'error'); return; }

    const payload = {
      name,
      gender:     document.getElementById('bfe-gender').value || null,
      birth_date: document.getElementById('bfe-birth').value  || null,
      batch_id:   document.getElementById('bfe-batch').value    || null,
      is_active:  document.getElementById('bfe-active').value === 'true',
      photo_url:  currentPhotoUrl || null,
    };
    const pinVal = document.getElementById('bfe-pin').value.trim();
    if (pinVal) payload.pin = pinVal;

    newSaveBtn.disabled = true;
    newSaveBtn.textContent = 'Saving...';
    try {
      if (student?.id) {
        await adminUpdate('students', student.id, payload);
        showToast('Student updated successfully.', 'success');
      } else {
        await adminInsert('students', payload);
        showToast('Student created successfully.', 'success');
      }
      window.isProfileDirty = false;
      localStorage.removeItem(draftKey);
      modal.classList.add('hidden');
      if (typeof onSaved === 'function') onSaved();
    } catch (err) {
      showToast(err.message || 'Save failed.', 'error');
    } finally {
      newSaveBtn.disabled = false;
      newSaveBtn.textContent = 'Save Changes';
    }
  };

  modal.classList.remove('hidden');
}

// Expose globally
window.openStudentFullEdit = openStudentFullEdit;

// ---- 4-COLUMN BULK IMPORTER ----
export function renderBulkImporterPanel(container, programId, batchId, onDone) {
  container.innerHTML = `
    <div class="glass-card" style="padding:1.5rem;">
      <h3 style="margin-top:0;font-size:1rem;font-weight:800;">&#x1F4CB; Smart Bulk Importer</h3>
      <p class="text-muted text-sm" style="margin-bottom:1rem;">
        Paste 4-column text (<code>Name | Gender | Birth Date | PIN</code>) OR upload an Excel Roster (<code>INSTITUTION, PROGRAM, BATCH, NAME</code>).
      </p>
      
      <!-- Excel Upload -->
      <div style="margin-bottom: 1rem; padding: 1rem; border: 1px dashed var(--clr-border); border-radius: 8px; text-align: center;">
        <label for="excel-roster-upload" class="btn btn-secondary btn-sm" style="cursor:pointer;">
          &#x1F4C2; Upload Excel Roster
        </label>
        <input type="file" id="excel-roster-upload" accept=".xlsx, .xls" style="display:none;" />
        <div id="excel-upload-status" class="text-sm mt-1"></div>
      </div>

      <textarea id="bulk-import-textarea"
        style="width:100%;height:120px;background:rgba(0,0,0,0.15);border:1px solid var(--clr-border);border-radius:8px;
               padding:.75rem;font-family:monospace;font-size:.85rem;color:var(--clr-text-1);resize:vertical;box-sizing:border-box;"
        placeholder="John Doe | male | 2005-03-15 | 1234"></textarea>
      <div style="display:flex;justify-content:flex-end;gap:.75rem;margin-top:.75rem;">
        <button class="btn btn-ghost btn-sm" id="bulk-preview-btn">Preview Text</button>
        <button class="btn btn-primary btn-sm" id="bulk-import-btn">Import Text</button>
      </div>
      <div id="bulk-preview-area" style="margin-top:1rem;"></div>
    </div>
  `;
  document.getElementById('bulk-preview-btn').onclick = () => _previewBulk();
  document.getElementById('bulk-import-btn').onclick  = () => _executeBulk(programId, batchId, onDone);

  const fileInput = document.getElementById('excel-roster-upload');
  const statusDiv = document.getElementById('excel-upload-status');
  fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    statusDiv.innerHTML = '<span class="text-muted">Importing... Please wait.</span>';
    try {
      const count = await handleExcelRosterImport(file);
      showToast(`Imported ${count} students successfully.`, 'success');
      statusDiv.innerHTML = `<span class="badge badge-success">Success: ${count} imported</span>`;
      if (typeof onDone === 'function') onDone();
    } catch (err) {
      console.error('Excel Import Error:', err);
      showToast(err.message || 'Excel import failed', 'error');
      statusDiv.innerHTML = '<span class="badge badge-danger">Import Failed</span>';
    }
    fileInput.value = '';
  });
}

function _parseBulkRows() {
  const raw = document.getElementById('bulk-import-textarea')?.value || '';
  return raw.split('\n').map(l => l.trim()).filter(Boolean).map((line, idx) => {
    const parts = line.split('|').map(p => p.trim());
    return {
      rowNum: idx + 1,
      name:       parts[0] || '',
      gender:     (parts[1] || '').toLowerCase(),
      birth_date: parts[2] || null,
      pin:        parts[3] || null,
      valid:      !!parts[0],
    };
  });
}

function _previewBulk() {
  const rows = _parseBulkRows();
  const area = document.getElementById('bulk-preview-area');
  if (!rows.length) { area.innerHTML = '<p class="text-muted text-sm">No data to preview.</p>'; return; }
  const v = rows.filter(r => r.valid).length;
  const iv = rows.filter(r => !r.valid).length;
  area.innerHTML = `
    <div style="margin-bottom:.5rem;font-size:.85rem;">
      <span class="badge badge-success">${v} valid</span>
      ${iv ? '<span class="badge badge-danger" style="margin-left:.5rem;">' + iv + ' invalid</span>' : ''}
    </div>
    <div class="table-wrap" style="max-height:240px;overflow-y:auto;">
      <table>
        <thead><tr><th>#</th><th>Name</th><th>Gender</th><th>Birth Date</th><th>PIN</th><th>Status</th></tr></thead>
        <tbody>
          ${rows.map(r => '<tr style="' + (!r.valid ? 'opacity:.5;' : '') + '">'
            + '<td class="text-muted text-xs">' + r.rowNum + '</td>'
            + '<td class="fw-600">' + (escHtml(r.name) || '<em class="text-danger">MISSING</em>') + '</td>'
            + '<td>' + escHtml(r.gender) + '</td>'
            + '<td>' + escHtml(r.birth_date || '--') + '</td>'
            + '<td>' + (r.pin ? '&#x25CF;&#x25CF;&#x25CF;&#x25CF;' : '<span class="text-muted">--</span>') + '</td>'
            + '<td>' + (r.valid ? '<span class="badge badge-success">OK</span>' : '<span class="badge badge-danger">Skip</span>') + '</td>'
            + '</tr>').join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function _executeBulk(programId, batchId, onDone) {
  const rows = _parseBulkRows().filter(r => r.valid);
  if (!rows.length) { showToast('No valid rows to import.', 'error'); return; }
  const btn = document.getElementById('bulk-import-btn');
  btn.disabled = true;
  btn.textContent = 'Importing...';
  let ok = 0, fail = 0;
  for (const row of rows) {
    try {
      const p = {
        name:       row.name,
        gender:     row.gender || null,
        birth_date: row.birth_date || null,
        pin:        row.pin || null,
        is_active:  true,
      };
      if (programId) p.program_id = programId;
      if (batchId)   p.batch_id   = batchId;
      await adminInsert('students', p);
      ok++;
    } catch (e) {
      fail++;
      console.warn('[bulk-import] failed row:', row.name, e);
    }
  }
  btn.disabled = false;
  btn.textContent = 'Import Students';
  if (ok > 0) showToast('Imported ' + ok + ' students' + (fail ? ' (' + fail + ' failed)' : '') + '.', 'success');
  else showToast('Import failed for all ' + fail + ' rows.', 'error');
  if (typeof onDone === 'function' && ok > 0) onDone();
}

// ---- BOARD OVERVIEW (entry point for loadSection('board_overview')) ----
export async function renderBoardOverview(container) {
  container.innerHTML = `
    <div class="header-actions" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:.75rem;margin-bottom:1.5rem;">
      <h2 style="margin:0;">&#x1F4CB; Board Overview</h2>
      <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="window.loadSection('institutions')">&#x1F3E2; Institutions</button>
        <button class="btn btn-secondary btn-sm" onclick="window.loadSection('programs')">&#x1F3EB; Programs</button>
        <button class="btn btn-secondary btn-sm" onclick="window.loadSection('batches')">&#x1F4E6; Batches</button>
        <button class="btn btn-primary btn-sm"   onclick="window.loadSection('students')">&#x1F465; Students</button>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:1rem;margin-bottom:1.5rem;" id="board-kpi-grid">
      <div class="glass-card" style="padding:1.5rem;text-align:center;"><div class="spinner" style="margin:auto;"></div></div>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;" id="board-lower-grid"></div>
  `;

  const [students, programs, batches, institutions] = await Promise.all([
    adminFetchAll('students'),
    adminFetchAll('programs'),
    adminFetchAll('batches'),
    adminFetchAll('institutions'),
  ]);

  const activeStudents = students.filter(s => !s.deleted_at && s.is_active).length;
  const totalStudents  = students.filter(s => !s.deleted_at).length;

  document.getElementById('board-kpi-grid').innerHTML = `
    <div class="glass-card" style="padding:1.5rem;text-align:center;">
      <div style="font-size:2.2rem;font-weight:800;color:var(--clr-primary);">${totalStudents}</div>
      <div class="text-muted text-sm fw-700">Total Students</div>
      <div class="text-xs text-muted mt-1">${activeStudents} active</div>
    </div>
    <div class="glass-card" style="padding:1.5rem;text-align:center;">
      <div style="font-size:2.2rem;font-weight:800;color:var(--clr-accent-1);">${programs.length}</div>
      <div class="text-muted text-sm fw-700">Programs</div>
    </div>
    <div class="glass-card" style="padding:1.5rem;text-align:center;">
      <div style="font-size:2.2rem;font-weight:800;color:#10b981;">${batches.length}</div>
      <div class="text-muted text-sm fw-700">Batches</div>
    </div>
    <div class="glass-card" style="padding:1.5rem;text-align:center;">
      <div style="font-size:2.2rem;font-weight:800;color:#f59e0b;">${institutions.length}</div>
      <div class="text-muted text-sm fw-700">Institutions</div>
    </div>
  `;

  const recent = students
    .filter(s => !s.deleted_at)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5);

  const sortedInstitutions = [...institutions].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  const instsHtml = sortedInstitutions.map(inst => {
    const instProgs = programs.filter(p => p.institution_id === inst.id).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    return `
      <div class="glass-card" style="padding:1rem; margin-bottom:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:0.75rem;">
           <h3 style="margin:0; font-size:1.1rem;">&#x1F3E2; ${escHtml(inst.name)}</h3>
           <div style="display:flex; align-items:center; gap:0.5rem;">
             <span class="badge ${inst.is_active !== false ? 'badge-success' : 'badge-neutral'}">${inst.is_active !== false ? 'Active' : 'Inactive'}</span>
             <button class="btn btn-ghost btn-xs" onclick='window._editRecord("institutions", "${inst.id}", ${JSON.stringify(JSON.stringify(inst))})' title="Edit Institution" style="padding:0 0.4rem; height:auto; min-height:0;">✏️</button>
           </div>
        </div>
        <h4 style="margin:0 0 .5rem 0; font-size:.8rem; text-transform:uppercase; letter-spacing:0.05em; color:var(--fm-text-muted);">Programs</h4>
        <div style="display:flex; flex-direction:column; gap:.25rem;">
          ${instProgs.length === 0 ? '<div class="text-muted text-sm">No programs.</div>' : instProgs.map(p => {
             const progBatches = batches.filter(b => b.program_id === p.id).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
             return `
             <div style="display:flex; justify-content:space-between; background:rgba(255,255,255,0.02); padding:.4rem; border-radius:6px; border:1px solid var(--clr-border);">
                <div>
                   <div class="fw-600 text-sm">${escHtml(p.name)}</div>
                   <div class="text-xs text-muted">${progBatches.length} Batches &bull; ${progBatches.map(b=> `<span style="cursor:pointer; text-decoration:underline;" onclick='window.openCrudModal("batches", ${JSON.stringify(b).replace(/'/g, "&#39;")})' title="Edit Batch">${escHtml(b.name)}</span>`).join(', ')}</div>
                </div>
                <div style="display:flex; align-items:center; gap:0.5rem;">
                  <span class="badge ${p.is_active !== false ? 'badge-success' : 'badge-neutral'}">${p.is_active !== false ? 'Active' : 'Inactive'}</span>
                  <button class="btn btn-ghost btn-xs" onclick='window._editRecord("programs", "${p.id}", ${JSON.stringify(JSON.stringify(p))})' title="Edit Program" style="padding:0 0.4rem; height:auto; min-height:0;">✏️</button>
                </div>
             </div>
             `;
          }).join('')}
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('board-lower-grid').innerHTML = `
    <div id="board-inst-panels" style="display:flex; flex-direction:column; padding-right: 0.5rem;">
      <h3 style="margin:0 0 1rem 0; font-size:1.2rem; font-weight:800; position: sticky; top: 0; background: var(--fm-bg); z-index: 10; padding-bottom: 0.5rem;">Organization Hierarchy</h3>
      ${instsHtml || '<p class="text-muted">No institutions available.</p>'}
    </div>
    <div style="display:flex; flex-direction:column; gap:1rem; padding-right: 0.5rem;">
      <div id="board-bulk-slot"></div>
      <div class="glass-card" style="padding:1rem;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.75rem;">
          <h3 style="margin:0;font-size:1rem;font-weight:800;">&#x1F550; Recently Added</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.loadSection('students')">View All</button>
        </div>
        <div style="display:flex;flex-direction:column;gap:.25rem;">
          ${recent.length === 0 ? '<p class="text-muted text-sm">No students yet.</p>' :
            recent.map(s =>
              '<div style="display:flex;justify-content:space-between;align-items:center;padding:.4rem;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid var(--clr-border);">'
              + '<div>'
              + '<div class="fw-700 text-sm">' + escHtml(formatStudentName(s.name, s.gender)) + '</div>'
              + '<div class="text-xs text-muted">' + new Date(s.created_at).toLocaleDateString() + '</div>'
              + '</div>'
              + '<span class="badge ' + (s.is_active !== false ? 'badge-success' : 'badge-neutral') + '">' + (s.is_active !== false ? 'Active' : 'Inactive') + '</span>'
              + '</div>'
            ).join('')}
        </div>
      </div>
    </div>
  `;

  renderBulkImporterPanel(
    document.getElementById('board-bulk-slot'),
    null, null,
    () => window.loadSection('students')
  );
}