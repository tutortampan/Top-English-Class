/**
 * board.js - [B] BOARD Domain
 * Centralised roster management, 4-column bulk importer, and single-door Full Edit modal.
 * Works with existing DB tables: students, programs, batches, institutions (no schema changes).
 */

import { adminFetchAll, adminInsert, adminUpdate, formatStudentName } from '../api.js?v=4.1.0';
import { showToast } from '../app.js?v=4.1.0';
import { handleExcelRosterImport } from './board_import.js?v=4.1.0';

// ---- HELPERS ----
function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---- FULL EDIT MODAL (single-door for the entire Board domain) ----
function buildFullEditModal() {
  if (document.getElementById('board-full-edit-modal')) return;
  const modal = document.createElement('div');
  modal.id = 'board-full-edit-modal';
  modal.className = 'modal-overlay hidden';
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;width:95%;max-height:90vh;overflow-y:auto;">
      <div class="modal-header" style="display:flex;justify-content:space-between;align-items:center;padding:1.25rem 1.5rem;border-bottom:1px solid var(--clr-border);">
        <h3 id="bfe-title" style="margin:0;font-size:1.15rem;font-weight:800;">Edit Student</h3>
        <button class="btn-icon" id="bfe-close" title="Close">&#10005;</button>
      </div>
      <div id="bfe-body" style="padding:1.5rem;"></div>
      <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:.75rem;padding:1rem 1.5rem;border-top:1px solid var(--clr-border);">
        <button class="btn btn-ghost" id="bfe-cancel">Cancel</button>
        <button class="btn btn-primary" id="bfe-save">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  const closeModal = () => modal.classList.add('hidden');
  document.getElementById('bfe-close').onclick = closeModal;
  document.getElementById('bfe-cancel').onclick = closeModal;
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
}

export function openStudentFullEdit(student, onSaved) {
  buildFullEditModal();
  const modal   = document.getElementById('board-full-edit-modal');
  const title   = document.getElementById('bfe-title');
  const body    = document.getElementById('bfe-body');
  let   saveBtn = document.getElementById('bfe-save');

  title.textContent = student ? ('Edit - ' + (student.name || 'Student')) : 'Add New Student';

  body.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">Full Name *</label>
        <input class="form-control" id="bfe-name" value="${escHtml(student?.name || '')}" placeholder="Student full name">
      </div>
      <div class="form-group">
        <label class="form-label">Gender</label>
        <select class="form-control" id="bfe-gender">
          <option value="">-- Select --</option>
          <option value="male" ${student?.gender === 'male' ? 'selected' : ''}>Male</option>
          <option value="female" ${student?.gender === 'female' ? 'selected' : ''}>Female</option>
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">Birth Date</label>
        <input type="date" class="form-control" id="bfe-birth" value="${escHtml(student?.birth_date || '')}">
      </div>
      <div class="form-group">
        <label class="form-label">PIN</label>
        <input type="text" class="form-control" id="bfe-pin" value="${escHtml(student?.pin || '')}" placeholder="Student login PIN" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label class="form-label">Status</label>
        <select class="form-control" id="bfe-active">
          <option value="true"  ${student?.is_active !== false ? 'selected' : ''}>Active</option>
          <option value="false" ${student?.is_active === false  ? 'selected' : ''}>Inactive</option>
        </select>
      </div>
      <div class="form-group" style="grid-column:1/-1;">
        <label class="form-label">Photo URL</label>
        <input type="url" class="form-control" id="bfe-photo" value="${escHtml(student?.photo_url || '')}" placeholder="https://...">
      </div>
    </div>
  `;

  const newSaveBtn = saveBtn.cloneNode(true);
  saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

  newSaveBtn.onclick = async () => {
    const name = document.getElementById('bfe-name').value.trim();
    if (!name) { showToast('Name is required.', 'error'); return; }
    const payload = {
      name,
      gender:     document.getElementById('bfe-gender').value || null,
      birth_date: document.getElementById('bfe-birth').value  || null,
      is_active:  document.getElementById('bfe-active').value === 'true',
      photo_url:  document.getElementById('bfe-photo').value.trim() || null,
    };
    const pinVal = document.getElementById('bfe-pin').value.trim();
    if (pinVal) payload.pin = pinVal;
    newSaveBtn.disabled = true;
    newSaveBtn.textContent = 'Saving...';
    try {
      if (student?.id) {
        await adminUpdate('students', student.id, payload);
        showToast('Student updated.', 'success');
      } else {
        await adminInsert('students', payload);
        showToast('Student added.', 'success');
      }
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
    .slice(0, 8);

  document.getElementById('board-lower-grid').innerHTML = `
    <div class="glass-card" style="padding:1.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
        <h3 style="margin:0;font-size:1rem;font-weight:800;">&#x1F550; Recently Added</h3>
        <button class="btn btn-ghost btn-sm" onclick="window.loadSection('students')">View All</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:.5rem;">
        ${recent.length === 0 ? '<p class="text-muted text-sm">No students yet.</p>' :
          recent.map(s =>
            '<div style="display:flex;justify-content:space-between;align-items:center;padding:.5rem;background:rgba(255,255,255,0.02);border-radius:8px;border:1px solid var(--clr-border);">'
            + '<div>'
            + '<div class="fw-700 text-sm">' + escHtml(formatStudentName(s.name, s.gender)) + '</div>'
            + '<div class="text-xs text-muted">' + new Date(s.created_at).toLocaleDateString() + '</div>'
            + '</div>'
            + '<span class="badge ' + (s.is_active ? 'badge-success' : 'badge-neutral') + '">' + (s.is_active ? 'Active' : 'Inactive') + '</span>'
            + '</div>'
          ).join('')}
      </div>
    </div>
    <div id="board-bulk-slot"></div>
  `;

  renderBulkImporterPanel(
    document.getElementById('board-bulk-slot'),
    null, null,
    () => window.loadSection('students')
  );
}