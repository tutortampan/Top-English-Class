/**
 * vocab-vault.js
 * Admin Vocabulary Vault Console — Domain C (Class) Section
 * Handles: Word CRUD, Excel Import with Duplicate Resolver, Cascading Assessment Builder
 * Version: 4.6.0
 */
import {
  fetchVaultWords,
  fetchVaultTopics,
  checkVaultDuplicates,
  importVaultWords,
  deleteVaultWord,
  createVocabMasteryAssessment,
  fetchInstitutions,
  fetchPrograms,
  fetchAssessmentDefinitions,
  adminFetchAll
} from '../api.js?v=4.6.2';
import { showToast, showLoading, hideLoading } from '../app.js?v=4.6.2';
import { getSupabase } from '../supabase.js?v=4.6.2';

// ─── Helpers ───────────────────────────────────────────────

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Parse a local datetime string (YYYY-MM-DDTHH:mm) as WITA (UTC+8)
function parseWita(localStr) {
  if (!localStr) return null;
  // Treat input as WITA (+08:00)
  return localStr.replace('T', 'T') + ':00+08:00';
}

// ─── Main Entry Point ──────────────────────────────────────

export async function renderVocabularyVault(area) {
  showLoading();
  try {
    const [words, topics] = await Promise.all([
      fetchVaultWords({ limit: 2500 }),
      fetchVaultTopics()
    ]);
    hideLoading();
    _renderVaultGrid(area, words, topics);
  } catch (e) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><div class="empty-state__icon">&#9888;&#65039;</div><h3>Failed to load Vocabulary Vault</h3><p class="text-muted">${escapeHtml(e.message)}</p></div>`;
  }
}

// ─── Grid View ─────────────────────────────────────────────

function _renderVaultGrid(area, words, topics) {
  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title text-gradient">&#128218; Vocabulary Vault</h2>
        <p class="section-subtitle">Master word repository for Vocabulary Mastery assessments</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-secondary btn-sm" id="btn-import-vault">&#128229; Import Vocab Excel</button>
        <button class="btn btn-primary btn-sm" id="btn-create-vocab-assessment">+ Create Vocab Assessment</button>
      </div>
    </div>

    <!-- Search & Filter -->
    <div class="card p-3 mb-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
      <div class="d-flex align-center gap-3 flex-wrap">
        <input type="search" class="form-control" id="vault-search" placeholder="Search Indonesian, English, or Topic..." style="max-width:320px;" />
        <select class="form-control" id="vault-topic-filter" style="max-width:220px;">
          <option value="">All Topics</option>
          ${topics.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('')}
        </select>
        <span class="text-muted text-sm" id="vault-count">${words.length} words</span>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table id="vault-table">
        <thead>
          <tr>
            <th class="text-center" style="width:48px;">NO</th>
            <th>TOPIC</th>
            <th>INDONESIAN</th>
            <th>ENGLISH</th>
            <th class="text-center">WORD TYPE</th>
            <th class="text-right" style="width:80px;">ACTIONS</th>
          </tr>
        </thead>
        <tbody id="vault-tbody"></tbody>
      </table>
    </div>
  `;

  // Store all words for client-side filtering
  let _allWords = [...words];

  function renderRows(filtered) {
    const tbody = document.getElementById('vault-tbody');
    if (!tbody) return;
    const uniqueIndoCount = new Set(filtered.map(w => w.indonesian.toLowerCase().trim())).size;
    document.getElementById('vault-count').textContent = `${uniqueIndoCount} questions (${filtered.length} entries)`;
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state__icon">&#128218;</div><p>No words found. Import an Excel file to get started.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map((w, i) => `
      <tr>
        <td class="text-center text-muted text-sm">${i + 1}</td>
        <td><span class="badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);font-size:0.75rem;">${escapeHtml(w.topic)}</span></td>
        <td class="fw-600">${escapeHtml(w.indonesian)}</td>
        <td style="color:var(--clr-text-2);">${escapeHtml(w.english)}</td>
        <td class="text-center"><span class="badge badge-info" style="font-size:0.72rem;">${escapeHtml(w.word_type)}</span></td>
        <td class="text-right">
          <button class="btn btn-danger btn-xs" data-del-vault="${escapeHtml(w.id)}" title="Delete word">&#128465;</button>
        </td>
      </tr>
    `).join('');

    // Delete handlers
    tbody.querySelectorAll('[data-del-vault]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Soft-delete this word from Vault?')) return;
        try {
          await deleteVaultWord(btn.dataset.delVault);
          showToast('Word deleted from Vault.', 'success');
          _allWords = _allWords.filter(w => w.id !== btn.dataset.delVault);
          filterAndRender();
        } catch (e) {
          showToast('Delete failed: ' + e.message, 'error');
        }
      });
    });
  }

  function filterAndRender() {
    const search = (document.getElementById('vault-search')?.value || '').toLowerCase().trim();
    const topic = document.getElementById('vault-topic-filter')?.value || '';
    let filtered = _allWords;
    if (topic) filtered = filtered.filter(w => w.topic === topic);
    if (search) filtered = filtered.filter(w =>
      w.indonesian.toLowerCase().includes(search) ||
      w.english.toLowerCase().includes(search) ||
      w.topic.toLowerCase().includes(search)
    );
    renderRows(filtered);
  }

  renderRows(_allWords);

  document.getElementById('vault-search')?.addEventListener('input', filterAndRender);
  document.getElementById('vault-topic-filter')?.addEventListener('change', filterAndRender);
  document.getElementById('btn-import-vault')?.addEventListener('click', () => openImportModal(_allWords, topics, (newWords) => {
    _allWords = [..._allWords, ...newWords];
    filterAndRender();
  }));
  document.getElementById('btn-create-vocab-assessment')?.addEventListener('click', () => openAssessmentBuilderModal(topics));
}

// ─── Import Modal ───────────────────────────────────────────

function openImportModal(existingWords, topics, onSuccess) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'vault-import-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;">
      <div class="d-flex justify-between align-center mb-4">
        <h3 class="fw-700" style="margin:0;">&#128229; Import Vocabulary from Excel</h3>
        <button class="btn btn-ghost btn-sm" id="close-import-modal">&#10005;</button>
      </div>
      <p class="text-muted text-sm mb-4">
        Upload an <strong>.xlsx</strong> file with columns: <code>TOPIC</code>, <code>INDONESIAN</code>, <code>ENGLISH</code>, <code>WORD TYPE</code>
      </p>
      <div class="form-group mb-4">
        <input type="file" id="vault-excel-input" accept=".xlsx,.xls" class="form-control" />
      </div>
      <div id="import-preview-area"></div>
      <div class="d-flex gap-3 justify-end mt-4" id="import-action-row" style="display:none!important;">
        <button class="btn btn-secondary btn-sm" id="close-import-modal-2">Cancel</button>
        <button class="btn btn-primary btn-sm" id="confirm-import-btn">&#10003; Import Words</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const close = () => modal.remove();
  document.getElementById('close-import-modal')?.addEventListener('click', close);
  document.getElementById('close-import-modal-2')?.addEventListener('click', close);

  let _parsedRows = [];
  let _resolutionMap = {};
  let _conflictRows = [];
  let _cleanRows = [];

  document.getElementById('vault-excel-input')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showLoading('Parsing Excel...');
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: '' });
      // Normalize column names
      _parsedRows = raw.map(row => {
        const normalized = {};
        for (const [k, v] of Object.entries(row)) {
          normalized[k.trim().toUpperCase()] = String(v).trim();
        }
        return {
          topic:      normalized.TOPIC || '',
          indonesian: normalized.INDONESIAN || '',
          english:    normalized.ENGLISH || '',
          word_type:  normalized['WORD TYPE'] || normalized.WORD_TYPE || 'Verb'
        };
      }).filter(r => r.topic && r.indonesian && r.english);

      hideLoading();
      if (!_parsedRows.length) {
        showToast('No valid rows found. Check column headers: TOPIC, INDONESIAN, ENGLISH, WORD TYPE', 'error');
        return;
      }

      showLoading('Checking for duplicates...');
      const { cleanRows, duplicateConflicts } = await checkVaultDuplicates(_parsedRows);
      hideLoading();

      _cleanRows = cleanRows;
      _conflictRows = duplicateConflicts;

      // Default: all clean rows have no resolution (will be inserted)
      _resolutionMap = {};

      const previewArea = document.getElementById('import-preview-area');
      if (!previewArea) return;

      const uniqueIndoCount = new Set(_parsedRows.map(r => r.indonesian.trim().toLowerCase())).size;

      if (!duplicateConflicts.length) {
        previewArea.innerHTML = `
          <div class="p-3 rounded mb-3" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);">
            <p class="text-success fw-600 mb-1">&#10003; ${_parsedRows.length} total rows parsed.</p>
            <p class="text-muted text-xs mb-0">(${uniqueIndoCount} unique Indonesian words / potential questions). No conflicts detected.</p>
          </div>
        `;
      } else {
        previewArea.innerHTML = `
          <div class="p-3 rounded mb-3" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);">
            <p class="fw-600 mb-1" style="color:#f59e0b;">&#9888; ${duplicateConflicts.length} conflict(s) detected — choose an action for each:</p>
            <p class="text-muted text-xs mb-2">${cleanRows.length} rows are clean and will be imported automatically.</p>
            <p class="text-muted text-xs mb-2"><strong>Note:</strong> Found ${_parsedRows.length} total rows (${uniqueIndoCount} unique Indonesian words / potential questions).</p>
            <div class="d-flex gap-2 flex-wrap mb-3">
              <button class="btn btn-outline btn-xs" id="bulk-merge-all">Merge All</button>
              <button class="btn btn-outline btn-xs" id="bulk-overwrite-all">Overwrite All</button>
              <button class="btn btn-outline btn-xs" id="bulk-skip-all">Skip All</button>
            </div>
          </div>
          <div class="table-wrap" style="max-height:280px;overflow-y:auto;">
            <table>
              <thead>
                <tr>
                  <th>Incoming Word</th>
                  <th>Existing Vault Word</th>
                  <th class="text-center">Conflict Type</th>
                  <th class="text-center">Action</th>
                </tr>
              </thead>
              <tbody id="conflict-tbody">
                ${duplicateConflicts.map((c, ci) => `
                  <tr>
                    <td>
                      <div class="fw-600 text-sm">${escapeHtml(c.row.indonesian)}</div>
                      <div class="text-xs text-muted">${escapeHtml(c.row.english)}</div>
                      <div class="text-xs" style="color:#a5b4fc;">${escapeHtml(c.row.topic)}</div>
                    </td>
                    <td>
                      <div class="fw-600 text-sm">${escapeHtml(c.existingRecord.indonesian)}</div>
                      <div class="text-xs text-muted">${escapeHtml(c.existingRecord.english)}</div>
                      <div class="text-xs" style="color:#a5b4fc;">${escapeHtml(c.existingRecord.topic)}</div>
                    </td>
                    <td class="text-center">
                      <span class="badge ${c.conflictType === 'EXACT' ? 'badge-danger' : 'badge-warning'}" style="font-size:0.7rem;">
                        ${escapeHtml(c.conflictType)}
                      </span>
                    </td>
                    <td class="text-center">
                      <select class="form-control conflict-action-sel" data-conflict-idx="${ci}" data-row-idx="${c.index}" style="font-size:0.8rem;padding:4px 6px;">
                        <option value="merge">Merge</option>
                        <option value="overwrite">Overwrite</option>
                        <option value="skip" selected>Skip</option>
                      </select>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `;

        // Bulk actions
        const setBulkAction = (action) => {
          document.querySelectorAll('.conflict-action-sel').forEach(sel => {
            sel.value = action;
            const rowIdx = parseInt(sel.dataset.rowIdx);
            _resolutionMap[rowIdx] = action;
            // Attach existing record metadata for merge/overwrite
            const conflict = duplicateConflicts[parseInt(sel.dataset.conflictIdx)];
            _parsedRows[rowIdx]._existingId = conflict.existingRecord.id;
            _parsedRows[rowIdx]._existingEnglish = conflict.existingRecord.english;
          });
        };
        document.getElementById('bulk-merge-all')?.addEventListener('click', () => setBulkAction('merge'));
        document.getElementById('bulk-overwrite-all')?.addEventListener('click', () => setBulkAction('overwrite'));
        document.getElementById('bulk-skip-all')?.addEventListener('click', () => setBulkAction('skip'));

        // Per-row action changes
        document.querySelectorAll('.conflict-action-sel').forEach(sel => {
          sel.addEventListener('change', () => {
            const rowIdx = parseInt(sel.dataset.rowIdx);
            const ci = parseInt(sel.dataset.conflictIdx);
            _resolutionMap[rowIdx] = sel.value;
            _parsedRows[rowIdx]._existingId = duplicateConflicts[ci].existingRecord.id;
            _parsedRows[rowIdx]._existingEnglish = duplicateConflicts[ci].existingRecord.english;
          });
          // Default skip
          const rowIdx = parseInt(sel.dataset.rowIdx);
          _resolutionMap[rowIdx] = 'skip';
        });
      }

      // Show action row
      const actionRow = document.getElementById('import-action-row');
      if (actionRow) actionRow.style.display = 'flex';
    } catch (err) {
      hideLoading();
      showToast('Excel parse error: ' + err.message, 'error');
    }
  });

  document.getElementById('confirm-import-btn')?.addEventListener('click', async () => {
    showLoading('Importing words...');
    try {
      const result = await importVaultWords(_parsedRows, _resolutionMap);
      hideLoading();
      close();
      showToast(`&#10003; Import complete: ${result.inserted} inserted, ${result.updated} updated, ${result.skipped} skipped.`, 'success');
      // Reload vault words for parent grid refresh
      const newWords = await fetchVaultWords({ limit: 2500 });
      onSuccess(newWords);
    } catch (e) {
      hideLoading();
      showToast('Import failed: ' + e.message, 'error');
    }
  });
}

// ─── Assessment Builder Modal (5 Steps) ────────────────────

async function openAssessmentBuilderModal(vaultTopics) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'vocab-builder-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal-box" style="max-width:720px;max-height:90vh;overflow-y:auto;">
      <div class="d-flex justify-between align-center mb-4">
        <h3 class="fw-700" style="margin:0;">&#10133; Create Vocabulary Assessment</h3>
        <button class="btn btn-ghost btn-sm" id="close-builder-modal">&#10005;</button>
      </div>

      <!-- Step Indicators -->
      <div class="d-flex gap-2 mb-5 flex-wrap" id="step-indicators">
        ${['Scope','Tier','Source','Order & Quota','Schedule'].map((s,i) => `
          <div class="d-flex align-center gap-1 step-ind" data-step="${i+1}" style="font-size:0.78rem;color:${i===0?'var(--clr-primary)':'var(--clr-text-3)'};">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;
              background:${i===0?'var(--clr-primary)':'rgba(255,255,255,0.1)'};color:${i===0?'#fff':'var(--clr-text-3)'};font-size:0.72rem;font-weight:700;">${i+1}</span>
            ${s}${i<4?'<span style="color:var(--clr-border);margin-left:6px;">→</span>':''}
          </div>
        `).join('')}
      </div>

      <div id="builder-step-content"></div>

      <div class="d-flex gap-3 justify-between mt-5">
        <button class="btn btn-secondary btn-sm" id="builder-back-btn" style="display:none;">← Back</button>
        <button class="btn btn-primary btn-sm" id="builder-next-btn">Next →</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  document.getElementById('close-builder-modal')?.addEventListener('click', () => modal.remove());

  // State
  const state = {
    step: 1,
    institutionId: '', institutionName: '',
    programId: '', programName: '',
    classId: '', className: '',
    levelId: '', levelName: '',
    tier: 'TASK',
    title: '',
    sourceTopic: null,
    sourceTaskIds: [],
    sourceQuizIds: [],
    questionOrder: 'random',
    quotaMode: 'full',
    customQuota: null,
    scheduleMode: 'flexible',
    windowStart: null,
    windowEnd: null,
    durationMinutes: 60
  };

  function updateStepIndicators(currentStep) {
    document.querySelectorAll('.step-ind').forEach((el, i) => {
      const stepNum = i + 1;
      const circle = el.querySelector('span');
      const isActive = stepNum === currentStep;
      const isDone = stepNum < currentStep;
      circle.style.background = isActive ? 'var(--clr-primary)' : isDone ? 'rgba(16,185,129,0.6)' : 'rgba(255,255,255,0.1)';
      circle.style.color = (isActive || isDone) ? '#fff' : 'var(--clr-text-3)';
      el.style.color = isActive ? 'var(--clr-primary)' : isDone ? '#10b981' : 'var(--clr-text-3)';
    });
    document.getElementById('builder-back-btn').style.display = currentStep > 1 ? '' : 'none';
    document.getElementById('builder-next-btn').textContent = currentStep === 5 ? '&#10003; Create Assessment' : 'Next →';
  }

  function updateAutoTitle() {
    const parts = [state.institutionName, state.programName, state.levelName, state.className].filter(Boolean);
    let suffix = state.tier === 'TASK' ? 'Task' : (state.tier === 'QUIZ' ? 'Quiz' : 'Exam');
    if (state.tier === 'TASK' && state.sourceTopic) suffix += ` - ${state.sourceTopic}`;
    if (parts.length > 0) {
      state.title = `${parts.join(' - ')} - ${suffix}`;
      const titleInput = document.getElementById('b-title');
      if (titleInput && !titleInput.dataset.manualEdit) {
        titleInput.value = state.title;
      }
    }
  }

  async function renderStep(step) {
    const content = document.getElementById('builder-step-content');
    updateStepIndicators(step);

    if (step === 1) {
      // Scope: Institution → Program → Class → Level
      showLoading();
      const institutions = await fetchInstitutions();
      hideLoading();
      content.innerHTML = `
        <h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 1 — Select Scope</h4>
        <div class="form-group">
          <label class="form-label">Institution</label>
          <select class="form-control" id="b-institution">
            <option value="">— Select Institution —</option>
            ${institutions.map(i => `<option value="${escapeHtml(i.id)}">${escapeHtml(i.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Program</label>
          <select class="form-control" id="b-program" disabled><option value="">— Select Institution first —</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Target Level</label>
          <select class="form-control" id="b-level" disabled><option value="">— Select Program first —</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Class</label>
          <select class="form-control" id="b-class" disabled><option value="">— Select Level first —</option></select>
        </div>
        <div class="form-group">
          <label class="form-label">Assessment Title</label>
          <input type="text" class="form-control" id="b-title" placeholder="Auto-generated title..." />
        </div>
      `;

      const bInstitution = document.getElementById('b-institution');
      const bProgram = document.getElementById('b-program');
      const bLevel = document.getElementById('b-level');
      const bClass = document.getElementById('b-class');
      const bTitle = document.getElementById('b-title');

      if (state.institutionId) bInstitution.value = state.institutionId;

      bTitle.addEventListener('input', () => {
        state.title = bTitle.value;
        bTitle.dataset.manualEdit = 'true';
      });

      bInstitution.addEventListener('change', async () => {
        state.institutionId = bInstitution.value;
        state.institutionName = bInstitution.options[bInstitution.selectedIndex]?.text || '';
        bProgram.innerHTML = '<option value="">Loading...</option>';
        bProgram.disabled = true;
        bLevel.innerHTML = '<option value="">— Select Program first —</option>';
        bLevel.disabled = true;
        bClass.innerHTML = '<option value="">— Select Level first —</option>';
        bClass.disabled = true;
        updateAutoTitle();
        if (!state.institutionId) return;
        const sb = await getSupabase();
        const { data } = await sb.from('programs').select('id,name').eq('institution_id', state.institutionId).eq('is_active', true).is('deleted_at', null).order('name');
        bProgram.innerHTML = '<option value="">— Select Program —</option>' + (data || []).map(p => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)}</option>`).join('');
        bProgram.disabled = false;
        if (state.programId) bProgram.value = state.programId;
      });

      bProgram.addEventListener('change', async () => {
        state.programId = bProgram.value;
        state.programName = bProgram.options[bProgram.selectedIndex]?.text || '';
        bLevel.innerHTML = '<option value="">Loading...</option>';
        bLevel.disabled = true;
        bClass.innerHTML = '<option value="">— Select Level first —</option>';
        bClass.disabled = true;
        updateAutoTitle();
        if (!state.programId) return;
        const sb = await getSupabase();
        const { data } = await sb.from('levels').select('id,name,level_number').eq('program_id', state.programId).eq('is_active', true).is('deleted_at', null).order('level_number');
        let levelData = data;
        if (!data || data.length === 0) {
            levelData = [
                { id: 'lvl1', name: '1st', level_number: 1 },
                { id: 'lvl2', name: '2nd', level_number: 2 },
                { id: 'lvl3', name: '3rd', level_number: 3 }
            ];
        } else {
            levelData = levelData.map(l => {
                let suffix = 'th';
                if (l.level_number === 1) suffix = 'st';
                else if (l.level_number === 2) suffix = 'nd';
                else if (l.level_number === 3) suffix = 'rd';
                return { ...l, name: l.name || `${l.level_number}${suffix}` };
            });
        }
        bLevel.innerHTML = '<option value="">— Select Level —</option>' + levelData.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join('');
        bLevel.disabled = false;
        if (state.levelId) bLevel.value = state.levelId;
      });

      bLevel.addEventListener('change', async () => {
        state.levelId = bLevel.value;
        state.levelName = bLevel.options[bLevel.selectedIndex]?.text || '';
        bClass.innerHTML = '<option value="">Loading...</option>';
        bClass.disabled = true;
        updateAutoTitle();
        if (!state.levelId) return;
        const sb = await getSupabase();
        const { data } = await sb.from('classes').select('id,name').eq('is_active', true).is('deleted_at', null).order('name');
        bClass.innerHTML = '<option value="">— Select Class —</option>' + (data || []).map(c => `<option value="${escapeHtml(c.id)}">${escapeHtml(c.name)}</option>`).join('');
        bClass.disabled = false;
        if (state.classId) bClass.value = state.classId;
      });

      bClass.addEventListener('change', () => {
        state.classId = bClass.value;
        state.className = bClass.options[bClass.selectedIndex]?.text || '';
        updateAutoTitle();
      });

      // Re-trigger if we have saved state
      if (state.institutionId) bInstitution.dispatchEvent(new Event('change'));
    }

    else if (step === 2) {
      // Tier selection
      content.innerHTML = `
        <h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 2 — Select Assessment Tier</h4>
        <div class="d-flex flex-column gap-3">
          ${[
            { val: 'TASK', icon: '&#128203;', label: 'Task', desc: 'Single topic — vocabulary drill from one Vault topic' },
            { val: 'QUIZ', icon: '&#128220;', label: 'Quiz', desc: 'Multi-topic — aggregated from selected Task assessments' },
            { val: 'EXAM', icon: '&#127891;', label: 'Exam', desc: 'Comprehensive — aggregated from selected Quiz assessments' }
          ].map(t => `
            <label class="d-flex align-center gap-3 p-3 rounded" style="cursor:pointer;border:2px solid ${state.tier===t.val?'var(--clr-primary)':'var(--clr-border)'};background:${state.tier===t.val?'rgba(99,102,241,0.08)':'rgba(255,255,255,0.02)'};">
              <input type="radio" name="vocab-tier" value="${t.val}" ${state.tier===t.val?'checked':''} style="accent-color:var(--clr-primary);" />
              <div>
                <div class="fw-700">${t.icon} ${t.label}</div>
                <div class="text-muted text-xs mt-1">${t.desc}</div>
              </div>
            </label>
          `).join('')}
        </div>
      `;
      document.querySelectorAll('input[name="vocab-tier"]').forEach(r => {
        r.addEventListener('change', () => { state.tier = r.value; updateAutoTitle(); });
      });
    }

    else if (step === 3) {
      // Source selection (depends on tier)
      content.innerHTML = `<h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 3 — Select Source</h4><div id="source-area"><div class="spinner"></div></div>`;
      const sourceArea = document.getElementById('source-area');

      if (state.tier === 'TASK') {
        sourceArea.innerHTML = `
          <p class="text-muted text-sm mb-3">Select the Vault topic for this Task:</p>
          <div class="d-flex flex-column gap-2" style="max-height:280px;overflow-y:auto;" id="topic-radio-list">
            ${vaultTopics.map(t => `
              <label class="d-flex align-center gap-2 p-2 rounded" style="cursor:pointer;border:1px solid ${state.sourceTopic===t?'var(--clr-primary)':'var(--clr-border)'};">
                <input type="radio" name="vault-topic" value="${escapeHtml(t)}" ${state.sourceTopic===t?'checked':''} style="accent-color:var(--clr-primary);" />
                <span class="fw-600 text-sm">${escapeHtml(t)}</span>
              </label>
            `).join('')}
          </div>
        `;
        document.querySelectorAll('input[name="vault-topic"]').forEach(r => {
          r.addEventListener('change', () => { state.sourceTopic = r.value; updateAutoTitle(); });
        });
      } else if (state.tier === 'QUIZ') {
        // Load existing TASK assessments in selected class
        const sb = await getSupabase();
        const { data: tasks } = await sb.from('assessments')
          .select('id,name,title,payload')
          .eq('module_type', 'VOCAB_MASTERY')
          .eq('assessment_type', 'TASK')
          .eq('class_id', state.classId)
          .eq('status', 'PUBLISHED')
          .is('deleted_at', null)
          .order('name');
        if (!tasks || !tasks.length) {
          sourceArea.innerHTML = `<p class="text-warning">No Task assessments found in this class. Create Tasks first.</p>`;
        } else {
          sourceArea.innerHTML = `
            <p class="text-muted text-sm mb-3">Select Tasks to aggregate for this Quiz:</p>
            <div class="d-flex flex-column gap-2" style="max-height:280px;overflow-y:auto;">
              ${tasks.map(t => `
                <label class="d-flex align-center gap-2 p-2 rounded" style="cursor:pointer;border:1px solid var(--clr-border);">
                  <input type="checkbox" class="source-task-cb" value="${escapeHtml(t.id)}" ${state.sourceTaskIds.includes(t.id)?'checked':''} style="accent-color:var(--clr-primary);" />
                  <span class="fw-600 text-sm">${escapeHtml(t.title||t.name)}</span>
                  <span class="text-xs text-muted ml-2">Topic: ${escapeHtml(t.payload?.source_topic||'—')}</span>
                </label>
              `).join('')}
            </div>
          `;
          document.querySelectorAll('.source-task-cb').forEach(cb => {
            cb.addEventListener('change', () => {
              state.sourceTaskIds = [...document.querySelectorAll('.source-task-cb:checked')].map(c => c.value);
            });
          });
        }
      } else if (state.tier === 'EXAM') {
        // Load existing QUIZ assessments
        const sb = await getSupabase();
        const { data: quizzes } = await sb.from('assessments')
          .select('id,name,title,payload')
          .eq('module_type', 'VOCAB_MASTERY')
          .eq('assessment_type', 'QUIZ')
          .eq('class_id', state.classId)
          .eq('status', 'PUBLISHED')
          .is('deleted_at', null)
          .order('name');
        if (!quizzes || !quizzes.length) {
          sourceArea.innerHTML = `<p class="text-warning">No Quiz assessments found in this class. Create Quizzes first.</p>`;
        } else {
          sourceArea.innerHTML = `
            <p class="text-muted text-sm mb-3">Select Quizzes to aggregate for this Exam:</p>
            <div class="d-flex flex-column gap-2" style="max-height:280px;overflow-y:auto;">
              ${quizzes.map(q => `
                <label class="d-flex align-center gap-2 p-2 rounded" style="cursor:pointer;border:1px solid var(--clr-border);">
                  <input type="checkbox" class="source-quiz-cb" value="${escapeHtml(q.id)}" ${state.sourceQuizIds.includes(q.id)?'checked':''} style="accent-color:var(--clr-primary);" />
                  <span class="fw-600 text-sm">${escapeHtml(q.title||q.name)}</span>
                  <span class="text-xs text-muted ml-2">Topics: ${escapeHtml((q.payload?.source_topics||[]).join(', ')||'—')}</span>
                </label>
              `).join('')}
            </div>
          `;
          document.querySelectorAll('.source-quiz-cb').forEach(cb => {
            cb.addEventListener('change', () => {
              state.sourceQuizIds = [...document.querySelectorAll('.source-quiz-cb:checked')].map(c => c.value);
            });
          });
        }
      }
    }

    else if (step === 4) {
      // Question Order & Quota
      content.innerHTML = `
        <h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 4 — Question Order &amp; Quota</h4>

        <div class="form-group">
          <label class="form-label">Question Order</label>
          <div class="d-flex gap-3 flex-wrap">
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="q-order" value="random" ${state.questionOrder==='random'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#128256; Random (Default)</span>
            </label>
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="q-order" value="sequential" ${state.questionOrder==='sequential'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#10132; Sequential (Vault Order)</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Question Quota</label>
          <div class="d-flex flex-column gap-2">
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="q-quota" value="full" ${state.quotaMode==='full'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#9989; All Questions (100% Full — Default)</span>
            </label>
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="q-quota" value="custom" ${state.quotaMode==='custom'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#9881; Custom Sample (Stratified)</span>
            </label>
          </div>
          <div id="custom-quota-area" style="display:${state.quotaMode==='custom'?'block':'none'};margin-top:0.75rem;">
            <input type="number" class="form-control" id="custom-quota-input" min="1" placeholder="Number of questions to sample" value="${state.customQuota||''}" style="max-width:240px;" />
            <p class="text-muted text-xs mt-1">Words will be sampled proportionally across all source topics (stratified sampling).</p>
          </div>
        </div>
      `;
      document.querySelectorAll('input[name="q-order"]').forEach(r => {
        r.addEventListener('change', () => { state.questionOrder = r.value; });
      });
      document.querySelectorAll('input[name="q-quota"]').forEach(r => {
        r.addEventListener('change', () => {
          state.quotaMode = r.value;
          document.getElementById('custom-quota-area').style.display = r.value === 'custom' ? 'block' : 'none';
        });
      });
      document.getElementById('custom-quota-input')?.addEventListener('input', (e) => {
        state.customQuota = parseInt(e.target.value) || null;
      });
    }

    else if (step === 5) {
      // Schedule (WITA)
      const toLocalWita = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        // Format to local datetime-local value in WITA (+08:00)
        const wita = new Date(d.getTime() + 8 * 3600000);
        return wita.toISOString().slice(0, 16);
      };
      content.innerHTML = `
        <h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 5 — Schedule <span style="color:#38bdf8;font-size:0.78rem;">(WITA / GMT+8)</span></h4>

        <div class="form-group">
          <label class="form-label">Schedule Mode</label>
          <div class="d-flex gap-3 flex-wrap">
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="sched-mode" value="flexible" ${state.scheduleMode==='flexible'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#128336; Flexible Window (Due Date)</span>
            </label>
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="sched-mode" value="fixed" ${state.scheduleMode==='fixed'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#128197; Fixed Schedule (Synchronous Window)</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Window Start <span class="text-muted text-xs">(WITA GMT+8)</span></label>
          <input type="datetime-local" class="form-control" id="b-window-start" value="${escapeHtml(toLocalWita(state.windowStart))}" style="max-width:280px;" />
        </div>
        <div class="form-group">
          <label class="form-label">Window End / Due Date <span class="text-muted text-xs">(WITA GMT+8)</span></label>
          <input type="datetime-local" class="form-control" id="b-window-end" value="${escapeHtml(toLocalWita(state.windowEnd))}" style="max-width:280px;" />
        </div>
        <div class="form-group">
          <label class="form-label">Duration (minutes)</label>
          <input type="number" class="form-control" id="b-duration" value="${state.durationMinutes}" min="5" max="480" style="max-width:160px;" />
        </div>

        <div class="p-3 rounded mt-3" style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.2);">
          <p class="text-xs text-muted mb-1">&#128204; All times are in <strong>WITA (GMT+8, Asia/Makassar)</strong>. The system will convert to UTC for storage.</p>
          <p class="text-xs text-muted mb-0">&#128274; For Fixed Schedule mode, students cannot start the assessment outside the window.</p>
        </div>

        <!-- Summary -->
        <div class="mt-4 p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);">
          <p class="text-xs fw-700 mb-2" style="color:var(--clr-text-2);">ASSESSMENT SUMMARY</p>
          <div class="text-sm" style="line-height:1.8;">
            <div><strong>Title:</strong> ${escapeHtml(state.title||'(not set)')}</div>
            <div><strong>Tier:</strong> ${escapeHtml(state.tier)}</div>
            <div><strong>Quota:</strong> ${state.quotaMode === 'custom' ? `${state.customQuota||'?'} questions (stratified)` : 'All (100%)'}</div>
            <div><strong>Order:</strong> ${state.questionOrder}</div>
          </div>
        </div>
      `;
      document.querySelectorAll('input[name="sched-mode"]').forEach(r => {
        r.addEventListener('change', () => { state.scheduleMode = r.value; });
      });
      document.getElementById('b-window-start')?.addEventListener('change', (e) => {
        state.windowStart = parseWita(e.target.value);
      });
      document.getElementById('b-window-end')?.addEventListener('change', (e) => {
        state.windowEnd = parseWita(e.target.value);
      });
      document.getElementById('b-duration')?.addEventListener('input', (e) => {
        state.durationMinutes = parseInt(e.target.value) || 60;
      });
    }
  }

  // Navigation
  document.getElementById('builder-next-btn')?.addEventListener('click', async () => {
    // Collect current step values before advancing
    if (state.step === 1) {
      state.institutionId = document.getElementById('b-institution')?.value || state.institutionId;
      state.programId = document.getElementById('b-program')?.value || state.programId;
      state.classId = document.getElementById('b-class')?.value || state.classId;
      state.levelId = document.getElementById('b-level')?.value || state.levelId;
      state.title = document.getElementById('b-title')?.value || state.title;
      if (!state.institutionId || !state.programId || !state.classId || !state.levelId) {
        showToast('Please complete all scope fields.', 'warning'); return;
      }
    } else if (state.step === 3) {
      if (state.tier === 'TASK' && !state.sourceTopic) {
        showToast('Please select a Vault topic.', 'warning'); return;
      }
      if (state.tier === 'QUIZ' && !state.sourceTaskIds.length) {
        showToast('Please select at least one Task.', 'warning'); return;
      }
      if (state.tier === 'EXAM' && !state.sourceQuizIds.length) {
        showToast('Please select at least one Quiz.', 'warning'); return;
      }
    } else if (state.step === 5) {
      // Final submission
      if (!state.title) { showToast('Assessment title is required.', 'warning'); return; }
      state.windowStart = document.getElementById('b-window-start')?.value
        ? parseWita(document.getElementById('b-window-start').value) : null;
      state.windowEnd = document.getElementById('b-window-end')?.value
        ? parseWita(document.getElementById('b-window-end').value) : null;
      state.durationMinutes = parseInt(document.getElementById('b-duration')?.value) || 60;

      showLoading('Creating assessment...');
      try {
        const result = await createVocabMasteryAssessment({
          institutionId: state.institutionId,
          programId: state.programId,
          classId: state.classId,
          levelId: state.levelId,
          tier: state.tier,
          title: state.title,
          questionOrder: state.questionOrder,
          scheduleMode: state.scheduleMode,
          windowStart: state.windowStart,
          windowEnd: state.windowEnd,
          durationMinutes: state.durationMinutes,
          quotaMode: state.quotaMode,
          customQuota: state.customQuota,
          sourceTopic: state.sourceTopic,
          sourceTaskIds: state.sourceTaskIds,
          sourceQuizIds: state.sourceQuizIds
        });
        hideLoading();
        modal.remove();
        showToast(`&#10003; ${state.tier} created: "${result.title}" — ${result.sampledWords} questions.`, 'success');
      } catch (e) {
        hideLoading();
        showToast('Failed to create assessment: ' + e.message, 'error');
      }
      return;
    }

    if (state.step < 5) {
      state.step++;
      await renderStep(state.step);
    }
  });

  document.getElementById('builder-back-btn')?.addEventListener('click', async () => {
    if (state.step > 1) {
      state.step--;
      await renderStep(state.step);
    }
  });

  await renderStep(1);
}
