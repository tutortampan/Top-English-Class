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
  updateVaultWord,
  createVocabMasteryAssessment,
  fetchInstitutions,
  fetchPrograms,
  fetchAssessmentDefinitions,
  adminFetchAll,
  renameVaultTopic,
  exportVaultWords,
  updateAssessmentDefinition
} from '../api.js?v=4.7.4';
import { showToast, showLoading, hideLoading } from '../app.js?v=4.7.4';
import { getSupabase } from '../supabase.js?v=4.7.4';

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
      fetchVaultWords({ limit: 10000, targetLevel: null }),
      fetchVaultTopics()
    ]);
    hideLoading();
    
    area.innerHTML = `
      <div style="display: flex; flex-direction: column; height: 100%; overflow: hidden;">
        <div style="background: #020617; border-bottom: 1px solid #1e293b; display: flex; gap: 8px; padding: 12px 24px; overflow-x: auto; flex-shrink: 0;">
          <button id="vault_vocab_tab" style="background: #4f46e5; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
            📚 Single Words
          </button>
          <button id="vault_phrases_tab" style="background: transparent; color: #94a3b8; border: 1px solid transparent; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.color='#f8fafc'" onmouseout="if(!this.classList.contains('active-tab')) this.style.color='#94a3b8'">
            💬 Expressions, Idioms & Proverbs
          </button>
          <button id="vault_topics_tab" style="background: transparent; color: #94a3b8; border: 1px solid transparent; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s;" onmouseover="this.style.color='#f8fafc'" onmouseout="if(!this.classList.contains('active-tab')) this.style.color='#94a3b8'">
            📑 Topic Manager
          </button>
        </div>
        <div id="vault-tab-content" style="flex-grow: 1; overflow-y: auto; padding: 24px; box-sizing: border-box;">
        </div>
      </div>
    `;

    const tabContent = document.getElementById('vault-tab-content');
    const tabWords = document.getElementById('vault_vocab_tab');
    const tabPhrases = document.getElementById('vault_phrases_tab');
    const tabTopics = document.getElementById('vault_topics_tab');

    function setActiveTab(activeBtn, inactiveBtns, renderFn) {
      if (!Array.isArray(inactiveBtns)) inactiveBtns = [inactiveBtns];
      activeBtn.style.background = '#4f46e5';
      activeBtn.style.color = 'white';
      activeBtn.classList.add('active-tab');

      inactiveBtns.forEach(btn => {
        if (!btn) return;
        btn.style.background = 'transparent';
        btn.style.color = '#94a3b8';
        btn.classList.remove('active-tab');
      });

      renderFn();
    }

    const allTabs = [tabWords, tabPhrases, tabTopics];
    
    tabWords.addEventListener('click', () => {
      setActiveTab(tabWords, allTabs.filter(t => t !== tabWords), () => _renderVaultGrid(tabContent, words, topics, 'single_words'));
    });
    tabPhrases.addEventListener('click', () => {
      setActiveTab(tabPhrases, allTabs.filter(t => t !== tabPhrases), () => _renderVaultGrid(tabContent, words, topics, 'phrases'));
    });
    tabTopics.addEventListener('click', () => {
      setActiveTab(tabTopics, allTabs.filter(t => t !== tabTopics), () => _renderTopicManager(tabContent, words, topics));
    });

    // Default to Single Words tab
    setActiveTab(tabWords, allTabs.filter(t => t !== tabWords), () => _renderVaultGrid(tabContent, words, topics, 'single_words'));

  } catch (e) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><div class="empty-state__icon">&#9888;&#65039;</div><h3>Failed to load Vocabulary Vault</h3><p class="text-muted">${escapeHtml(e.message)}</p></div>`;
  }
}


// ─── Grid View ─────────────────────────────────────────────

function _renderVaultGrid(area, words, topics, mode = 'single_words') {
  let title = mode === 'single_words' ? '📚 Single Words' : '💬 Expressions, Idioms & Proverbs';
  let desc = mode === 'single_words' 
    ? 'Standard vocabulary (Noun, Verb, Adjective, Adverb). Feeds Module 1.'
    : 'Expressions, idioms, and proverbs. Feeds Module 2.';

  // Determine allowed options in filter based on mode
  const wordTypeOptions = mode === 'single_words' 
    ? `
      <option value="Vocab">Vocab / Vocabulary</option>
      <option value="Verb">Verb</option>
      <option value="Noun">Noun</option>
      <option value="Adjective">Adjective</option>
      <option value="Adverb">Adverb</option>
    `
    : `
      <option value="Expression">Expression</option>
      <option value="Idiom">Idiom</option>
      <option value="Proverb">Proverb</option>
    `;

  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title text-gradient">${title}</h2>
        <p class="section-subtitle">${desc}</p>
      </div>
      <div class="d-flex gap-2 flex-wrap">
        <button class="btn btn-secondary btn-sm" id="btn-import-vault">&#128229; Import Excel</button>
        <button class="btn btn-secondary btn-sm" id="btn-export-vault">&#128228; Export Excel</button>
        <button class="btn btn-secondary btn-sm" id="btn-check-duplicates">&#9874; Check Duplicates</button>
        <button class="btn btn-danger btn-sm" id="btn-reset-vault" title="Truncate all vault words — clean slate" style="opacity:0.7;">&#128465; Reset Vault</button>
        <button class="btn btn-primary btn-sm" id="btn-create-vocab-assessment">${mode === 'phrases' ? '+ Create Phrase Assessment' : '+ Create Vocab Assessment'}</button>
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
        <select class="form-control" id="vault-wordtype-filter" style="max-width:180px;">
          <option value="">All Word Types</option>
          ${wordTypeOptions}
        </select>
        <span class="text-muted text-sm" id="vault-count">${words.length} words</span>
      </div>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table id="vault-table" style="table-layout: fixed; width: 100%;">
        <thead>
          <tr>
            <th class="text-center" style="width:50px;">NO</th>
            <th style="width:22%;">TOPIC</th>
            <th style="width:25%;">INDONESIAN</th>
            <th style="width:30%;">ENGLISH</th>
            <th class="text-center" style="width:110px;">WORD TYPE</th>
            <th class="text-right" style="width:90px;">ACTIONS</th>
          </tr>
        </thead>
        <tbody id="vault-tbody"></tbody>
      </table>
    </div>
  `;

  // Store all words for client-side filtering
  // Filter down to the mode initially
  let _allWords = words.filter(w => {
    const wt = (w.word_type || '').toLowerCase();
    const isPhrase = ['expression', 'idiom', 'proverb'].includes(wt);
    if (mode === 'single_words') return !isPhrase;
    return isPhrase;
  });

  setTimeout(() => {
    // Fire initial render
    filterAndRender();
  }, 10);

  function renderRows(filtered) {
    const tbody = document.getElementById('vault-tbody');
    if (!tbody) return;
    const uniqueIndoCount = new Set(filtered.map(w => w.indonesian.toLowerCase().trim())).size;
    document.getElementById('vault-count').textContent = `${uniqueIndoCount} questions (${filtered.length} entries)`;
    if (!filtered.length) {
      tbody.innerHTML = '<tr><td colspan="6"><div class="empty-state"><div class="empty-state__icon">&#128218;</div><p>No words found. Import an Excel file to get started.</p></div></td></tr>';
      return;
    }
    tbody.innerHTML = filtered.map((w, i) => {
      let typeColor = "#3b82f6"; // default blue
      const wt = (w.word_type || 'Vocab').toLowerCase();
      if (wt === 'vocab' || wt === 'vocabulary') typeColor = "#10b981"; // green
      if (wt === 'idiom') typeColor = "#f59e0b"; // yellow/orange
      if (wt === 'expression') typeColor = "#8b5cf6"; // purple
      if (wt === 'proverb') typeColor = "#ef4444"; // red

      return `
      <tr data-word-id="${escapeHtml(w.id)}">
        <td class="text-center text-muted text-sm">${i + 1}</td>
        <td class="cell-topic"><span class="badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);font-size:0.75rem;text-transform:capitalize;">${escapeHtml(w.topic)}</span></td>
        <td class="fw-600 cell-indonesian">${escapeHtml(w.indonesian)}</td>
        <td style="color:var(--clr-text-2);" class="cell-english">${escapeHtml(w.english)}</td>
        <td class="text-center cell-wordtype">
          <span style="font-size:0.75rem; padding: 4px 8px; border-radius: 4px; background: ${typeColor}20; color: ${typeColor}; border: 1px solid ${typeColor}40; display: inline-block; text-transform: capitalize;">${escapeHtml(w.word_type || 'Vocab')}</span>
        </td>
        <td class="text-right">
          <button class="btn btn-xs btn-edit-vault" data-edit-vault="${escapeHtml(w.id)}" style="background: transparent; color: #3b82f6; border: 1px solid #3b82f6;" title="Edit word">&#9998;</button>
          <button class="btn btn-danger btn-xs" data-del-vault="${escapeHtml(w.id)}" title="Delete word">&#128465;</button>
        </td>
      </tr>
    `}).join('');

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

    // Edit handlers
    tbody.querySelectorAll('.btn-edit-vault').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.editVault;
        const tr = btn.closest('tr');
        const isEditing = tr.classList.contains('editing');
        const word = _allWords.find(w => w.id === id);

        if (isEditing) {
          // Save
          const newTopic = tr.querySelector('.edit-topic').value.trim();
          const newIndo = tr.querySelector('.edit-indo').value.trim();
          const newEng = tr.querySelector('.edit-eng').value.trim();
          const newType = tr.querySelector('.edit-type').value;

          if (!newTopic || !newIndo || !newEng) return showToast('Please fill all required fields.', 'error');

          btn.innerHTML = '&#8987;'; // wait
          btn.disabled = true;

          updateVaultWord(id, {
            topic: newTopic,
            indonesian: newIndo,
            english: newEng,
            word_type: newType
          }).then(() => {
            showToast('Word updated successfully.', 'success');
            word.topic = newTopic;
            word.indonesian = newIndo;
            word.english = newEng;
            word.word_type = newType;
            filterAndRender();
          }).catch(e => {
            showToast('Update failed: ' + e.message, 'error');
            filterAndRender(); // reset
          });
        } else {
          // Enter edit mode
          tr.classList.add('editing');
          tr.querySelector('.cell-topic').innerHTML = '<input type="text" class="input edit-topic" style="width: 100px; padding: 2px 4px; font-size: 0.8rem;" value="' + escapeHtml(word.topic) + '">';
          tr.querySelector('.cell-indonesian').innerHTML = '<input type="text" class="input edit-indo" style="width: 100px; padding: 2px 4px; font-size: 0.8rem;" value="' + escapeHtml(word.indonesian) + '">';
          tr.querySelector('.cell-english').innerHTML = '<input type="text" class="input edit-eng" style="width: 100px; padding: 2px 4px; font-size: 0.8rem;" value="' + escapeHtml(word.english) + '">';
          const phraseOpts = `
            <option value="Expression"${word.word_type === 'Expression' ? ' selected' : ''}>Expression</option>
            <option value="Idiom"${word.word_type === 'Idiom' ? ' selected' : ''}>Idiom</option>
            <option value="Proverb"${word.word_type === 'Proverb' ? ' selected' : ''}>Proverb</option>
          `;
          const singleOpts = `
            <option value="Vocab"${word.word_type === 'Vocab' ? ' selected' : ''}>Vocab</option>
            <option value="Verb"${word.word_type === 'Verb' ? ' selected' : ''}>Verb</option>
            <option value="Noun"${word.word_type === 'Noun' ? ' selected' : ''}>Noun</option>
            <option value="Adjective"${word.word_type === 'Adjective' ? ' selected' : ''}>Adjective</option>
            <option value="Adverb"${word.word_type === 'Adverb' ? ' selected' : ''}>Adverb</option>
          `;

          tr.querySelector('.cell-wordtype').innerHTML =
            '<select class="input edit-type" style="width: 100px; padding: 2px 4px; font-size: 0.8rem;">' +
            (mode === 'phrases' ? phraseOpts : singleOpts) +
            '</select>';
          btn.innerHTML = '&#10004;'; // Checkmark
          btn.title = 'Save';
          btn.style.color = '#10b981';
          btn.style.borderColor = '#10b981';
        }
      });
    });
  }

  function filterAndRender() {
    const search = (document.getElementById('vault-search')?.value || '').toLowerCase().trim();
    const topic = document.getElementById('vault-topic-filter')?.value || '';
    const wordType = document.getElementById('vault-wordtype-filter')?.value || '';
    let filtered = _allWords;
    if (topic) filtered = filtered.filter(w => w.topic === topic);
    if (wordType) {
      filtered = filtered.filter(w => {
        if (wordType === 'Vocab') return w.word_type?.toLowerCase().includes('vocab');
        return w.word_type === wordType;
      });
    }
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
  document.getElementById('vault-wordtype-filter')?.addEventListener('change', filterAndRender);
  
  document.getElementById('btn-export-vault')?.addEventListener('click', async () => {
    try {
      const btn = document.getElementById('btn-export-vault');
      const oldText = btn.innerHTML;
      btn.innerHTML = '&#8987; Exporting...';
      btn.disabled = true;
      await exportVaultWords(mode);
      btn.innerHTML = oldText;
      btn.disabled = false;
    } catch (e) {
      showToast('Export failed: ' + e.message, 'error');
      document.getElementById('btn-export-vault').innerHTML = '&#128228; Export Excel';
      document.getElementById('btn-export-vault').disabled = false;
    }
  });

  document.getElementById('btn-import-vault')?.addEventListener('click', () => openImportModal(_allWords, topics, (newWords) => {
    _allWords = [..._allWords, ...newWords];
    filterAndRender();
  }, mode));
  document.getElementById('btn-check-duplicates')?.addEventListener('click', () => {
    openDuplicateCheckerModal(_allWords, (updatedWords) => {
      _allWords = updatedWords;
      filterAndRender();
    });
  });
  document.getElementById('btn-create-vocab-assessment')?.addEventListener('click', () => {
    if (mode === 'phrases') {
      openAssessmentBuilderModal(topics, { assessmentType: 'IDIOM_PROVERB' });
    } else {
      openAssessmentBuilderModal(topics, { assessmentType: 'VOCAB_MASTERY' });
    }
  });

  document.getElementById('btn-reset-vault')?.addEventListener('click', async () => {
    if (!confirm('⚠️ DANGER: This will permanently delete ALL vault words from the database. This cannot be undone. Are you absolutely sure?')) return;
    if (!confirm('Second confirmation required. Type OK in the next prompt to confirm.')) return;
    const confirmText = prompt('Type RESET to confirm truncation of all vault words:');
    if (confirmText?.trim().toUpperCase() !== 'RESET') { showToast('Reset cancelled.', 'info'); return; }
    showLoading('Resetting vault...');
    try {
      const sb = await getSupabase();
      const { error } = await sb.from('vault_words').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      hideLoading();
      if (error) throw error;
      showToast('✓ Vault reset complete. All words deleted.', 'success');
      _allWords = [];
      filterAndRender();
    } catch (e) {
      hideLoading();
      showToast('Reset failed: ' + e.message, 'error');
    }
  });
}

// ─── Import Modal ───────────────────────────────────────────

function openImportModal(existingWords, topics, onSuccess, mode = 'single_words') {
  const allowedTypesStr = 'Vocab, Noun, Verb, Adjective, Adverb, Expression, Idiom, Proverb';

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'vault-import-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');
  modal.innerHTML = `
    <div class="modal-box" style="max-width:680px;">
      <div class="d-flex justify-between align-center mb-4">
        <h3 class="fw-700" style="margin:0;">&#128229; Import Vocabulary &amp; Phrases from Excel (Auto-Split)</h3>
        <button class="btn btn-ghost btn-sm" id="close-import-modal">&#10005;</button>
      </div>
      <p class="text-muted text-sm mb-4">
        Upload an <strong>.xlsx</strong> file with columns: <code>TOPIC</code>, <code>INDONESIAN</code>, <code>ENGLISH</code>, <code>WORD TYPE</code><br>
        <span class="text-xs" style="color: #6366f1;">All word types accepted: ${allowedTypesStr}. Rows are auto-classified — phrases (Expression/Idiom/Proverb) and single words are split automatically.</span>
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
          level:      normalized.LEVEL || normalized.TARGET_LEVEL || '1',
          topic:      normalized.TOPIC || '',
          indonesian: normalized.INDONESIAN || '',
          english:    normalized.ENGLISH || '',
          word_type:  normalized['WORD TYPE'] || normalized.WORD_TYPE || (mode === 'phrases' ? 'Expression' : 'Vocab')
        };
      }).filter(r => r.topic && r.indonesian && r.english);

      // Auto-classify rows — no filtering/discarding
      const allowedPhraseTypes = ['expression', 'idiom', 'proverb'];
      _parsedRows = _parsedRows.map(r => {
        const wt = (r.word_type || '').toLowerCase();
        return { ...r, _isPhrase: allowedPhraseTypes.includes(wt) };
      });

      hideLoading();
      if (!_parsedRows.length) {
        showToast('No valid rows found. Ensure the file has TOPIC, INDONESIAN, ENGLISH, and WORD TYPE columns.', 'error');
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
      const vocabRows = _parsedRows.filter(r => !r._isPhrase);
      const phraseRows = _parsedRows.filter(r => r._isPhrase);
      const vocabDupes = duplicateConflicts.filter(c => !allowedPhraseTypes.includes((c.row.word_type||'').toLowerCase())).length;
      const phraseDupes = duplicateConflicts.filter(c => allowedPhraseTypes.includes((c.row.word_type||'').toLowerCase())).length;

      const distributionBadge = `
        <div class="d-flex gap-2 flex-wrap mt-2">
          <span style="background:rgba(16,185,129,0.15);color:#10b981;border:1px solid rgba(16,185,129,0.3);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;">📚 Single Words: ${vocabRows.length} (${vocabDupes} dupes)</span>
          <span style="background:rgba(139,92,246,0.15);color:#a78bfa;border:1px solid rgba(139,92,246,0.3);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;">💬 Phrases: ${phraseRows.length} (${phraseDupes} dupes)</span>
          <span style="background:rgba(99,102,241,0.1);color:#818cf8;border:1px solid rgba(99,102,241,0.25);padding:3px 8px;border-radius:4px;font-size:11px;font-weight:600;">🔖 Unique Questions: ${uniqueIndoCount}</span>
        </div>`;

      if (!duplicateConflicts.length) {
        previewArea.innerHTML = `
          <div class="p-3 rounded mb-3" style="background:rgba(16,185,129,0.1);border:1px solid rgba(16,185,129,0.3);">
            <p class="text-success fw-600 mb-1">&#10003; ${_parsedRows.length} total rows parsed — no conflicts detected.</p>
            ${distributionBadge}
          </div>
        `;
      } else {
        previewArea.innerHTML = `
          <div class="p-3 rounded mb-3" style="background:rgba(245,158,11,0.1);border:1px solid rgba(245,158,11,0.3);">
            <p class="fw-600 mb-1" style="color:#f59e0b;">&#9888; ${duplicateConflicts.length} conflict(s) detected — choose an action for each:</p>
            <p class="text-muted text-xs mb-1">${cleanRows.length} rows are clean and will be imported automatically.</p>
            ${distributionBadge}
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
      const newWords = await fetchVaultWords({ limit: 10000, targetLevel: null });
      onSuccess(newWords);
    } catch (e) {
      hideLoading();
      showToast('Import failed: ' + e.message, 'error');
    }
  });
}

// ─── Assessment Builder Modal (5 Steps) ────────────────────

export async function openAssessmentBuilderModal(initialVaultTopics, overrides = {}) {
  let vaultTopics = initialVaultTopics;
  if (!vaultTopics) {
    vaultTopics = await fetchVaultTopics();
  }
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'vocab-builder-modal';
  modal.setAttribute('role', 'dialog');
  modal.setAttribute('aria-modal', 'true');

  modal.innerHTML = `
    <div class="modal-box" style="max-width:720px;max-height:90vh;overflow-y:auto;">
      <div class="d-flex justify-between align-center mb-4">
        <h3 class="fw-700" style="margin:0;">&#10133; ${overrides.editAssessment ? 'Edit' : 'Create'} Vocabulary Assessment</h3>
        <button class="btn btn-ghost btn-sm" id="close-builder-modal">&#10005;</button>
      </div>

      <!-- Step Indicators -->
      <div class="d-flex gap-2 mb-5 flex-wrap" id="step-indicators">
        ${['Scope & Tier','Source','Order & Quota','Schedule'].map((s,i) => `
          <div class="d-flex align-center gap-1 step-ind" data-step="${i+1}" style="font-size:0.78rem;color:${i===0?'var(--clr-primary)':'var(--clr-text-3)'};">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:22px;height:22px;border-radius:50%;
              background:${i===0?'var(--clr-primary)':'rgba(255,255,255,0.1)'};color:${i===0?'#fff':'var(--clr-text-3)'};font-size:0.72rem;font-weight:700;">${i+1}</span>
            ${s}${i<3?'<span style="color:var(--clr-border);margin-left:6px;">→</span>':''}
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
  const editAsm = overrides.editAssessment || null;
  const state = {
    isEdit: !!editAsm,
    assessmentId: editAsm?.id || null,
    step: overrides.skipStep1 ? 2 : 1,
    institutionId: editAsm?.institution_id || overrides.institutionId || '', institutionName: overrides.institutionName || '',
    programId: editAsm?.program_id || overrides.programId || '', programName: overrides.programName || '',
    classId: editAsm?.class_id || overrides.classId || '', className: overrides.className || '',
    levelId: editAsm?.level_id || overrides.levelId || '', levelName: overrides.levelName || '',
    assessmentType: editAsm?.assessment_type || overrides.assessmentType || 'VOCAB_MASTERY',
    tier: editAsm ? (editAsm.assessment_type.includes('TASK') ? 'TASK' : (editAsm.assessment_type.includes('QUIZ') ? 'QUIZ' : 'EXAM')) : 'TASK',
    title: editAsm?.title || '',
    sourceTopic: null,
    sourceTaskIds: [],
    sourceQuizIds: [],
    questionOrder: 'random',
    quotaMode: 'full',
    customQuota: null,
    scheduleMode: editAsm ? (editAsm.availability_start ? 'batch' : 'anytime') : 'batch',
    windowStart: editAsm?.availability_start || null,
    windowEnd: editAsm?.availability_end || null,
    durationMinutes: editAsm?.working_duration_minutes || 60
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
    document.getElementById('builder-next-btn').innerHTML = currentStep === 4 ? (state.isEdit ? '&#10003; Save Changes' : '&#10003; Create Assessment') : 'Next →';
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
      // Scope: Institution → Program → Class → Level + Tier
      showLoading();
      const institutions = await fetchInstitutions();
      hideLoading();
      content.innerHTML = `
        <h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 1 — Select Scope & Tier</h4>
        <div class="d-flex gap-4 flex-wrap">
          <div style="flex: 1; min-width: 250px;">
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
            ${state.isEdit ? '<div class="text-sm mt-3" style="color:var(--clr-warning);"><strong>Note:</strong> Scope and Tier are locked in Edit Mode to preserve history.</div>' : ''}
          </div>
          <div style="flex: 1; min-width: 250px;">
            <label class="form-label">Assessment Tier</label>
            <div class="d-flex flex-column gap-3 mb-3">
              ${[
                { val: 'TASK', icon: '&#128203;', label: 'Task', desc: 'Single topic drill' },
                { val: 'QUIZ', icon: '&#128220;', label: 'Quiz', desc: 'Multi-topic aggregation' },
                { val: 'EXAM', icon: '&#127891;', label: 'Exam', desc: 'Comprehensive aggregation' }
              ].map(t => `
                <label class="d-flex align-center gap-3 p-2 rounded" style="cursor:pointer;border:2px solid ${state.tier===t.val?'var(--clr-primary)':'var(--clr-border)'};background:${state.tier===t.val?'rgba(99,102,241,0.08)':'rgba(255,255,255,0.02)'};">
                  <input type="radio" name="vocab-tier" value="${t.val}" ${state.tier===t.val?'checked':''} style="accent-color:var(--clr-primary);" />
                  <div>
                    <div class="fw-700">${t.icon} ${t.label}</div>
                    <div class="text-muted text-xs mt-1">${t.desc}</div>
                  </div>
                </label>
              `).join('')}
            </div>
            <div class="form-group">
              <label class="form-label">Assessment Title</label>
              <input type="text" class="form-control" id="b-title" placeholder="Auto-generated title..." />
            </div>
          </div>
        </div>
      `;

      const bInstitution = document.getElementById('b-institution');
      const bProgram = document.getElementById('b-program');
      const bLevel = document.getElementById('b-level');
      const bClass = document.getElementById('b-class');
      const bTitle = document.getElementById('b-title');

            async function initContext() {
        if (!state.institutionId) return;
        
        if (state.isEdit || state.classId) {
          const sb = await getSupabase();
          const [{data:iData}, {data:pData}, {data:lData}, {data:cData}] = await Promise.all([
            state.institutionId ? sb.from('institutions').select('name').eq('id', state.institutionId).single() : {data:null},
            state.programId ? sb.from('programs').select('name').eq('id', state.programId).single() : {data:null},
            state.levelId ? sb.from('levels').select('name,level_number').eq('id', state.levelId).single() : {data:null},
            state.classId ? sb.from('classes').select('name').eq('id', state.classId).single() : {data:null}
          ]);
          
          state.institutionName = iData?.name || state.institutionName;
          state.programName = pData?.name || state.programName;
          if (lData) {
            let suffix = 'th Level';
            if (lData.level_number === 1) suffix = 'st Level';
            else if (lData.level_number === 2) suffix = 'nd Level';
            else if (lData.level_number === 3) suffix = 'rd Level';
            state.levelName = lData.name || `${lData.level_number}${suffix}`;
          }
          state.className = cData?.name || state.className;
          
          bInstitution.innerHTML = `<option value="${state.institutionId}">${escapeHtml(state.institutionName)}</option>`;
          bProgram.innerHTML = `<option value="${state.programId}">${escapeHtml(state.programName)}</option>`;
          bLevel.innerHTML = `<option value="${state.levelId}">${escapeHtml(state.levelName)}</option>`;
          bClass.innerHTML = `<option value="${state.classId}">${escapeHtml(state.className)}</option>`;
          
          bInstitution.disabled = true;
          bProgram.disabled = true;
          bLevel.disabled = true;
          bClass.disabled = true;
          
          updateAutoTitle();
        } else {
          bInstitution.value = state.institutionId;
          bInstitution.dispatchEvent(new Event('change'));
        }
      }
      initContext();

      bTitle.addEventListener('input', () => {
        state.title = bTitle.value;
        bTitle.dataset.manualEdit = 'true';
      });

      document.querySelectorAll('input[name="vocab-tier"]').forEach(r => {
        r.addEventListener('change', () => { 
          state.tier = r.value; 
          document.querySelectorAll('label[style*="border: 2px solid"]').forEach(l => {
            l.style.borderColor = 'var(--clr-border)';
            l.style.background = 'rgba(255,255,255,0.02)';
          });
          const parent = r.closest('label');
          parent.style.borderColor = 'var(--clr-primary)';
          parent.style.background = 'rgba(99,102,241,0.08)';
          updateAutoTitle(); 
        });
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
        const { data } = await sb.from('levels')
            .select('id,name,level_number')
            .order('level_number', { ascending: true });
        
        let levelData = data || [];
        levelData = levelData.map(l => {
            if (l.level_number === 0) return { ...l, name: 'Level 0 (Universal)' };
            let suffix = 'th Level';
            if (l.level_number === 1) suffix = 'st Level';
            else if (l.level_number === 2) suffix = 'nd Level';
            else if (l.level_number === 3) suffix = 'rd Level';
            return { ...l, name: l.name || `${l.level_number}${suffix}` };
        });

        bLevel.innerHTML = '<option value="">- Select Level -</option>' + levelData.map(l => `<option value="${escapeHtml(l.id)}">${escapeHtml(l.name)}</option>`).join('');
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
      // Source selection (depends on tier)
      content.innerHTML = `<h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 2 — Select Source</h4><div id="source-area"><div class="spinner"></div></div>`;
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
          .select('id,title,description')
          .eq('assessment_type', 'VOCAB_TASK')
          .eq('class_id', state.classId)
          .eq('status', 'PUBLISHED')
          .is('deleted_at', null)
          .order('created_at');
        if (!tasks || !tasks.length) {
          sourceArea.innerHTML = `<p class="text-warning">No Task assessments found in this class. Create Tasks first.</p>`;
        } else {
          sourceArea.innerHTML = `
            <p class="text-muted text-sm mb-3">Select Tasks to aggregate for this Quiz:</p>
            <div class="d-flex flex-column gap-2" style="max-height:280px;overflow-y:auto;">
              ${tasks.map(t => {
                const topicDesc = t.description?.split('Topics: ')?.[1] || '—';
                return `
                <label class="d-flex align-center gap-2 p-2 rounded" style="cursor:pointer;border:1px solid var(--clr-border);">
                  <input type="checkbox" class="source-task-cb" value="${escapeHtml(t.id)}" ${state.sourceTaskIds.includes(t.id)?'checked':''} style="accent-color:var(--clr-primary);" />
                  <span class="fw-600 text-sm">${escapeHtml(t.title)}</span>
                  <span class="text-xs text-muted ml-2">Topic: ${escapeHtml(topicDesc)}</span>
                </label>
                `;
              }).join('')}
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
          .select('id,title,description')
          .eq('assessment_type', 'VOCAB_QUIZ')
          .eq('class_id', state.classId)
          .eq('status', 'PUBLISHED')
          .is('deleted_at', null)
          .order('created_at');
        if (!quizzes || !quizzes.length) {
          sourceArea.innerHTML = `<p class="text-warning">No Quiz assessments found in this class. Create Quizzes first.</p>`;
        } else {
          sourceArea.innerHTML = `
            <p class="text-muted text-sm mb-3">Select Quizzes to aggregate for this Exam:</p>
            <div class="d-flex flex-column gap-2" style="max-height:280px;overflow-y:auto;">
              ${quizzes.map(q => {
                const topicDesc = q.description?.split('Topics: ')?.[1] || '—';
                return `
                <label class="d-flex align-center gap-2 p-2 rounded" style="cursor:pointer;border:1px solid var(--clr-border);">
                  <input type="checkbox" class="source-quiz-cb" value="${escapeHtml(q.id)}" ${state.sourceQuizIds.includes(q.id)?'checked':''} style="accent-color:var(--clr-primary);" />
                  <span class="fw-600 text-sm">${escapeHtml(q.title)}</span>
                  <span class="text-xs text-muted ml-2">Topics: ${escapeHtml(topicDesc)}</span>
                </label>
                `;
              }).join('')}
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

    else if (step === 3) {
      // Question Order & Quota
      content.innerHTML = `
        <h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 3 — Question Order &amp; Quota</h4>

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

    else if (step === 4) {
      // Schedule (WITA)
      const toLocalWita = (isoStr) => {
        if (!isoStr) return '';
        const d = new Date(isoStr);
        // Format to local datetime-local value in WITA (+08:00)
        const wita = new Date(d.getTime() + 8 * 3600000);
        return wita.toISOString().slice(0, 16);
      };
      content.innerHTML = `
        <h4 class="fw-600 mb-3 text-sm" style="color:var(--clr-text-2);">Step 4 — Schedule <span style="color:#38bdf8;font-size:0.78rem;">(WITA / GMT+8)</span></h4>

        <div class="form-group">
          <label class="form-label">Schedule Mode</label>
          <div class="d-flex gap-3 flex-wrap">
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="sched-mode" value="batch" ${state.scheduleMode==='batch' || state.scheduleMode==='flexible' ? 'checked' : ''} style="accent-color:var(--clr-primary);" />
              <span>&#128336; Batch Duration (Flexible Self-Paced)</span>
            </label>
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="sched-mode" value="manual" ${state.scheduleMode==='manual'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#128197; Tutor Live Control (Manual Toggle / In-Class)</span>
            </label>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Due Date <span class="text-muted text-xs">(WITA GMT+8, Optional)</span></label>
          <input type="datetime-local" class="form-control" id="b-window-end" value="${escapeHtml(toLocalWita(state.windowEnd))}" style="max-width:280px;" />
        </div>
        <div class="form-group">
          <label class="form-label">Duration (minutes)</label>
          <input type="number" class="form-control" id="b-duration" value="${state.durationMinutes}" min="5" max="480" style="max-width:160px;" />
        </div>

        <div class="p-3 rounded mt-3" style="background:rgba(56,189,248,0.06);border:1px solid rgba(56,189,248,0.2);">
          <p class="text-xs text-muted mb-1">&#128204; All times are in <strong>WITA (GMT+8, Asia/Makassar)</strong>. The system will convert to UTC for storage.</p>
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
    } else if (state.step === 2) {
      if (state.tier === 'TASK' && !state.sourceTopic) {
        showToast('Please select a Vault topic.', 'warning'); return;
      }
      if (state.tier === 'QUIZ' && !state.sourceTaskIds.length) {
        showToast('Please select at least one Task.', 'warning'); return;
      }
      if (state.tier === 'EXAM' && !state.sourceQuizIds.length) {
        showToast('Please select at least one Quiz.', 'warning'); return;
      }
    } else if (state.step === 4) {
      // Final submission
      if (!state.title) { showToast('Assessment title is required.', 'warning'); return; }
      state.windowStart = null;
      state.windowEnd = document.getElementById('b-window-end')?.value
        ? parseWita(document.getElementById('b-window-end').value) : null;
      state.durationMinutes = parseInt(document.getElementById('b-duration')?.value) || 60;

      showLoading(state.isEdit ? 'Saving changes...' : 'Creating assessment...');
      try {
        if (state.isEdit) {
          await updateAssessmentDefinition(state.assessmentId, {
            title: state.title,
            working_duration_minutes: state.durationMinutes,
            availability_start: state.windowStart,
            availability_end: state.windowEnd,
          });
          hideLoading();
          modal.remove();
          showToast(`&#10003; Assessment saved successfully.`, 'success');
        } else {
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
            sourceQuizIds: state.sourceQuizIds,
            assessmentType: state.assessmentType,
            answerType: state.assessmentType === 'IDIOM_PROVERB' ? 'dropdown_10' : 'written'
          });
          hideLoading();
          modal.remove();
          showToast(`&#10003; ${state.tier} created: "${result.title}" — ${result.sampledWords} questions.`, 'success');
        }
      } catch (e) {
        hideLoading();
        showToast('Failed to save assessment: ' + e.message, 'error');
      }
      return;
    }

    if (state.step < 4) {
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


// ─── Domain D: Topic Management Panel ─────────────────────────────

function _renderTopicManager(area, words, topics) {
  const topicMap = new Map();
  topics.forEach(t => topicMap.set(t, { count: 0, targetLevel: null, types: {} }));
  words.forEach(w => {
    if (!w.topic) return;
    if (!topicMap.has(w.topic)) topicMap.set(w.topic, { count: 0, targetLevel: null, types: {} });
    const tData = topicMap.get(w.topic);
    tData.count++;
    tData.targetLevel = w.target_level;
    const type = w.word_type || "Unknown";
    tData.types[type] = (tData.types[type] || 0) + 1;
  });
  const topicEntries = Array.from(topicMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));

  area.innerHTML = `
    <div style="display: flex; flex-direction: column; height: calc(100vh - 120px); padding: 24px; box-sizing: border-box; overflow: hidden; font-family: 'Inter', sans-serif;">
      <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0 0 8px 0; display: flex; align-items: center; gap: 10px;">
            <span style="color: #6366f1;">🗃️</span> Domain D: Topic Manager
          </h2>
          <p style="font-size: 13px; color: #94a3b8; margin: 0;">Centralized topic binding and vocabulary aggregation.</p>
        </div>
      </div>
      <div style="flex-grow: 1; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="padding: 16px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; background: #020617;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="search" id="vault-topic-search" placeholder="Search Topics..." style="background: #1e293b; border: 1px solid #334155; color: #f8fafc; padding: 8px 12px; border-radius: 6px; font-size: 13px; width: 250px; outline: none;">
            <button class="btn btn-secondary btn-sm" id="btn-topic-dup-checker">&#9874; Merge Similar Topics</button>
          </div>
          <div style="font-size: 12px; color: #64748b; font-weight: 500;">
            Total Topics: <span style="color: #f8fafc; font-weight: 700;">${topicEntries.length}</span> &nbsp;|&nbsp; 
            Total Words: <span style="color: #f8fafc; font-weight: 700;">${words.length}</span>
          </div>
        </div>
        <div style="flex-grow: 1; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead style="background: #0f172a; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #1e293b;">
              <tr>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px;">Topic Title</th>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; text-align: center;">Word Count</th>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px;">Composition</th>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; width: 300px;">Structural Binding (Level)</th>
              </tr>
            </thead>
            <tbody id="vault-topic-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  `;

  const tbody = document.getElementById("vault-topic-tbody");
  function renderRows(filteredEntries) {
    if (!filteredEntries.length) {
      tbody.innerHTML = "<tr><td colspan=\"4\" style=\"text-align: center; padding: 40px; color: #64748b;\">No topics match your search.</td></tr>";
      return;
    }
    tbody.innerHTML = filteredEntries.map(([topic, data]) => {
      const compBadges = Object.entries(data.types).map(([type, count]) => {
        let color = "#3b82f6";
        if (type.toLowerCase() === "vocab" || type.toLowerCase() === "vocabulary") color = "#10b981";
        if (type.toLowerCase() === "idiom") color = "#f59e0b";
        if (type.toLowerCase() === "expression") color = "#8b5cf6";
        return `<span style="background: ${color}20; color: ${color}; border: 1px solid ${color}40; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-right: 4px;">${escapeHtml(type)}: ${count}</span>`;
      }).join("");
      return `
        <tr style="border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
          <td style="padding: 16px; font-weight: 600; color: #e2e8f0;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span>${escapeHtml(topic)}</span>
              <button class="btn-edit-topic" data-topic="${escapeHtml(topic)}" style="background: transparent; border: none; cursor: pointer; color: #3b82f6; opacity: 0.8; font-size: 14px;" title="Rename Topic">&#9998;</button>
            </div>
          </td>
          <td style="padding: 16px; text-align: center;"><span style="background: #1e293b; color: #cbd5e1; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 12px;">${data.count}</span></td>
          <td style="padding: 16px;">${compBadges}</td>
          <td style="padding: 16px;">
            <select class="topic-level-select form-control" data-topic="${escapeHtml(topic)}" style="background: #020617; border: 1px solid #334155; color: #f8fafc; padding: 6px 12px; border-radius: 6px; font-size: 12px; width: 100%; outline: none; cursor: pointer;">
              <option value="0" ${data.targetLevel === 0 ? "selected" : ""}>Level 0 (Universal)</option>
              <option value="1" ${data.targetLevel === 1 ? "selected" : ""}>Level 1</option>
              <option value="2" ${data.targetLevel === 2 ? "selected" : ""}>Level 2</option>
              <option value="3" ${data.targetLevel === 3 ? "selected" : ""}>Level 3</option>
            </select>
          </td>
        </tr>
      `;
    }).join("");

    tbody.querySelectorAll(".btn-edit-topic").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        const oldTopic = e.currentTarget.getAttribute("data-topic");
        const newTopic = prompt(`Rename topic "${oldTopic}" to:`, oldTopic);
        if (!newTopic || newTopic.trim() === "" || newTopic === oldTopic) return;
        
        try {
          const { showLoading, hideLoading, showToast } = await import('../app.js?v=4.7.4'); // unified v=4.7.4
          showLoading();
          await renameVaultTopic(oldTopic, newTopic.trim());
          hideLoading();
          showToast(`Topic renamed to "${newTopic.trim()}"`, "success");
          
          // Refresh Vault
          if (typeof renderVocabularyVault === 'function') {
            const container = document.getElementById('classes-detail-canvas');
            if (container) renderVocabularyVault(container);
          }
        } catch (err) {
          hideLoading();
          showToast(`Failed to rename: ${err.message}`, "error");
        }
      });
    });

    tbody.querySelectorAll(".topic-level-select").forEach(select => {
      select.addEventListener("change", async (e) => {
        const topicName = e.target.getAttribute("data-topic");
        const newLevel = parseInt(e.target.value, 10);
        
        // Dynamic import to avoid missing dependencies in older backup
        const { moveVaultTopicsToLevel } = await import('../api.js?v=4.7.4');
        const { showLoading, hideLoading, showToast } = await import('../app.js?v=4.7.4');
        
        showLoading();
        try {
          await moveVaultTopicsToLevel([topicName], newLevel);
          showToast(`Topic "${topicName}" bound to Level ${newLevel}`, "success");
          const t = topicMap.get(topicName);
          if(t) t.targetLevel = newLevel;
        } catch (err) {
          showToast(`Binding failed: ${err.message}`, "error");
          const t = topicMap.get(topicName);
          e.target.value = t ? t.targetLevel : 1;
        } finally {
          hideLoading();
        }
      });
    });
  }

  renderRows(topicEntries);

  document.getElementById("vault-topic-search")?.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = topicEntries.filter(([topic]) => topic.toLowerCase().includes(term));
    renderRows(filtered);
  });

  document.getElementById("btn-topic-dup-checker")?.addEventListener("click", () => {
    openTopicDuplicateCheckerModal(topicEntries, words, () => {
      // Re-render whole vault view after merge
      const area = document.getElementById('vault-tab-content').parentElement.parentElement;
      if (area) {
        // Trigger a fresh render by re-calling renderVocabularyVault
        import('./vocab-vault.js').then(m => m.renderVocabularyVault(area));
      }
    });
  });
}

// ─── Duplicate Checker Modal ──────────────────────────────────

function openDuplicateCheckerModal(allWords, onResolved) {
  const normStr = s => String(s || '').toLowerCase().trim().replace(/\s+/g, ' ');

  // Group by normalized Indonesian AND English (Connected Components)
  const adj = new Map();
  allWords.forEach(w => adj.set(w.id, []));

  const indoMap = {};
  const engMap = {};
  
  allWords.forEach(w => {
    const ind = normStr(w.indonesian);
    const eng = normStr(w.english);
    
    if (ind) {
      if (!indoMap[ind]) indoMap[ind] = [];
      indoMap[ind].push(w.id);
    }
    if (eng) {
      if (!engMap[eng]) engMap[eng] = [];
      engMap[eng].push(w.id);
    }
  });

  const connectList = (list) => {
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        adj.get(list[i]).push(list[j]);
        adj.get(list[j]).push(list[i]);
      }
    }
  };

  Object.values(indoMap).forEach(connectList);
  Object.values(engMap).forEach(connectList);

  const visited = new Set();
  const duplicateGroups = [];

  allWords.forEach(w => {
    if (!visited.has(w.id)) {
      const group = [];
      const q = [w.id];
      visited.add(w.id);
      
      while (q.length > 0) {
        const curr = q.shift();
        group.push(allWords.find(x => x.id === curr));
        
        adj.get(curr).forEach(neighbor => {
          if (!visited.has(neighbor)) {
            visited.add(neighbor);
            q.push(neighbor);
          }
        });
      }
      
      if (group.length > 1) {
        duplicateGroups.push(group);
      }
    }
  });

  if (duplicateGroups.length === 0) {
    showToast('&#10003; No duplicates found in the Vault.', 'success');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'vault-dup-modal';

  function buildTable() {
    return duplicateGroups.map((group, gi) => {
      const rows = group.map((w, wi) => `
        <tr data-gi="${gi}" data-wi="${wi}" data-id="${escapeHtml(w.id)}">
          <td class="fw-600" style="padding:10px 8px;">${wi === 0 ? escapeHtml(w.indonesian) : ''}</td>
          <td style="padding:10px 8px; color:var(--clr-text-2);" class="cell-eng-${gi}-${wi}">${escapeHtml(w.english)}</td>
          <td style="padding:10px 8px;"><span class="badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc;font-size:0.72rem;">${escapeHtml(w.topic)}</span></td>
          <td style="padding:10px 8px; text-align:right;">
            <button class="btn btn-xs btn-keep-this" data-gi="${gi}" data-id="${escapeHtml(w.id)}" style="background:transparent;color:#10b981;border:1px solid #10b981;margin-right:4px;" title="Keep this entry, delete others">&#10003; Keep</button>
            <button class="btn btn-danger btn-xs btn-del-this" data-gi="${gi}" data-id="${escapeHtml(w.id)}" title="Delete this entry">&#128465;</button>
          </td>
        </tr>
      `).join('');
      

      const allSynonyms = new Set();
      group.forEach(w => {
        if (w.english) {
          w.english.split('/').forEach(s => {
            const clean = s.trim();
            if (clean) allSynonyms.add(clean);
          });
        }
      });
      const mergedEnglish = Array.from(allSynonyms).join(' / ');
      
      return `
        <tbody data-group="${gi}">
          ${rows}
          <tr style="background:rgba(99,102,241,0.05);">
            <td colspan="4" style="padding:8px;">
              <div class="d-flex align-center gap-2 flex-wrap">
                <span class="text-xs text-muted">Merge English into:</span>
                <input type="text" class="input merge-eng-input" data-gi="${gi}" value="${escapeHtml(mergedEnglish)}" style="flex:1; min-width:200px; padding:4px 8px; font-size:0.8rem;" />
                <button class="btn btn-xs btn-merge-group" data-gi="${gi}" style="background:rgba(99,102,241,0.2);color:#a5b4fc;border:1px solid rgba(99,102,241,0.4);">&#9889; Merge</button>
              </div>
            </td>
          </tr>
          <tr><td colspan="4" style="padding:0; border-bottom:2px solid #1e293b;"></td></tr>
        </tbody>
      `;
    }).join('');
  }

  modal.innerHTML = `
    <div class="modal-box" style="max-width:860px; max-height:85vh; display:flex; flex-direction:column;">
      <div class="d-flex justify-between align-center mb-3">
        <div>
          <h3 class="fw-700" style="margin:0;">&#9874; Duplicate Checker</h3>
          <p class="text-muted text-xs mt-1 mb-0">${duplicateGroups.length} group(s) with duplicate Indonesian words found.</p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary btn-sm" id="dup-modal-keep-all" style="background:#047857; color:white;">&#10004; Keep First (All)</button>
          <button class="btn btn-secondary btn-sm" id="dup-modal-merge-all" style="background:#4f46e5; color:white;">&#9889; Merge All</button>
          <button class="btn btn-ghost btn-sm" id="dup-modal-close">&#10005;</button>
        </div>
      </div>
      <div style="overflow-y:auto; flex-grow:1;">
        <table class="table w-100" id="dup-table">
          <thead>
            <tr>
              <th style="width:170px;">Indonesian</th>
              <th>English</th>
              <th style="width:140px;">Topic</th>
              <th style="width:130px; text-align:right;">Action</th>
            </tr>
          </thead>
          ${buildTable()}
        </table>
      </div>
      <div class="d-flex justify-end mt-3">
        <button class="btn btn-secondary btn-sm" id="dup-modal-done">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function closeModal() {
    document.body.removeChild(modal);
    if (onResolved) onResolved([...allWords]);
  }

  modal.querySelector('#dup-modal-close').addEventListener('click', closeModal);
  modal.querySelector('#dup-modal-done').addEventListener('click', closeModal);

  // Keep one, delete others in group
  modal.querySelectorAll('.btn-keep-this').forEach(btn => {
    btn.addEventListener('click', async () => {
      const gi = parseInt(btn.dataset.gi);
      const keepId = btn.dataset.id;
      const group = duplicateGroups[gi];
      const toDelete = group.filter(w => w.id !== keepId);

      btn.disabled = true;
      btn.innerHTML = '...';
      try {
        for (const w of toDelete) {
          await deleteVaultWord(w.id);
          allWords = allWords.filter(x => x.id !== w.id);
        }
        // Remove the group from duplicateGroups
        duplicateGroups.splice(gi, 1);
        showToast('Kept 1 entry, deleted ' + toDelete.length + ' duplicate(s).', 'success');
        // Re-render table
        modal.querySelector('#dup-table').querySelector('tbody[data-group="' + gi + '"]')?.remove();
        if (onResolved) onResolved([...allWords]);
        if (duplicateGroups.length === 0) {
          modal.querySelector('p.text-muted.text-xs').textContent = '&#10003; All duplicates resolved!';
        }
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '&#10003; Keep';
      }
    });
  });

  // Delete a single entry
  modal.querySelectorAll('.btn-del-this').forEach(btn => {
    btn.addEventListener('click', async () => {
      const gi = parseInt(btn.dataset.gi);
      const delId = btn.dataset.id;
      btn.disabled = true;
      btn.innerHTML = '...';
      try {
        await deleteVaultWord(delId);
        allWords = allWords.filter(x => x.id !== delId);
        // Remove from group
        const gIdx = duplicateGroups[gi].findIndex(w => w.id === delId);
        if (gIdx !== -1) duplicateGroups[gi].splice(gIdx, 1);
        btn.closest('tr').remove();
        showToast('Entry deleted.', 'success');
        if (onResolved) onResolved([...allWords]);
        // If group now has only 1, remove its merge row
        if (duplicateGroups[gi] && duplicateGroups[gi].length <= 1) {
          const tbody = modal.querySelector('tbody[data-group="' + gi + '"]');
          if (tbody) tbody.remove();
          duplicateGroups.splice(gi, 1);
        }
      } catch (e) {
        showToast('Error: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '&#128465;';
      }
    });
  });

  // Merge group: update first entry's English and Indonesian to merged value, delete rest
  modal.querySelectorAll('.btn-merge-group').forEach(btn => {
    btn.addEventListener('click', async () => {
      const gi = parseInt(btn.dataset.gi);
      const group = duplicateGroups[gi];
      const mergedEng = modal.querySelector('.merge-eng-input[data-gi="' + gi + '"]').value.trim();

      if (!mergedEng) return showToast('Merged English cannot be empty.', 'error');

      btn.disabled = true;
      btn.innerHTML = '...';
      try {
        const keeper = group[0];
        const toDelete = group.slice(1);

        // Also merge Indonesian automatically
        const allIndo = new Set();
        group.forEach(w => {
          if (w.indonesian) {
            w.indonesian.split('/').forEach(s => {
              const clean = s.trim();
              if (clean) allIndo.add(clean);
            });
          }
        });
        const mergedIndo = Array.from(allIndo).join(' / ');

        // Update keeper's English and Indonesian to merged value
        await updateVaultWord(keeper.id, { english: mergedEng, indonesian: mergedIndo });
        keeper.english = mergedEng;
        keeper.indonesian = mergedIndo;

        // Delete the rest
        for (const w of toDelete) {
          await deleteVaultWord(w.id);
          allWords = allWords.filter(x => x.id !== w.id);
        }

        duplicateGroups.splice(gi, 1);
        const tbody = modal.querySelector('tbody[data-group="' + gi + '"]');
        if (tbody) tbody.remove();

        showToast('Merged into: "' + mergedEng + '"', 'success');
        if (onResolved) onResolved([...allWords]);

        if (duplicateGroups.length === 0) {
          modal.querySelector('p.text-muted.text-xs').textContent = 'All duplicates resolved!';
        }
      } catch (e) {
        showToast('Merge failed: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '&#9889; Merge';
      }
    });
  });

  // Bulk: Keep First (All)
  const keepAllBtn = modal.querySelector('#dup-modal-keep-all');
  if (keepAllBtn) {
    keepAllBtn.addEventListener('click', async () => {
      if (!confirm('This will keep the first entry of EVERY duplicate group and delete the rest. Proceed?')) return;
      keepAllBtn.disabled = true;
      keepAllBtn.innerHTML = '...';
      try {
        // Iterate backwards so we can safely remove from duplicateGroups
        for (let i = duplicateGroups.length - 1; i >= 0; i--) {
          const group = duplicateGroups[i];
          const toDelete = group.slice(1);
          for (const w of toDelete) {
            await deleteVaultWord(w.id);
            allWords = allWords.filter(x => x.id !== w.id);
          }
          const tbody = modal.querySelector('tbody[data-group="' + i + '"]');
          if (tbody) tbody.remove();
          duplicateGroups.splice(i, 1);
        }
        showToast('All groups resolved (Kept First).', 'success');
        modal.querySelector('p.text-muted.text-xs').textContent = '&#10003; All duplicates resolved!';
        if (onResolved) onResolved([...allWords]);
      } catch (e) {
        showToast('Bulk Keep failed: ' + e.message, 'error');
      }
      keepAllBtn.innerHTML = '&#10004; Keep First (All)';
      keepAllBtn.disabled = false;
    });
  }

  // Bulk: Merge All
  const mergeAllBtn = modal.querySelector('#dup-modal-merge-all');
  if (mergeAllBtn) {
    mergeAllBtn.addEventListener('click', async () => {
      if (!confirm('This will merge all English and Indonesian synonyms for EVERY duplicate group into the first entry and delete the rest. Proceed?')) return;
      mergeAllBtn.disabled = true;
      mergeAllBtn.innerHTML = '...';
      try {
        for (let i = duplicateGroups.length - 1; i >= 0; i--) {
          const group = duplicateGroups[i];
          const keeper = group[0];
          const toDelete = group.slice(1);
          const mergedEng = modal.querySelector('.merge-eng-input[data-gi="' + i + '"]').value.trim();

          const allIndo = new Set();
          group.forEach(w => {
            if (w.indonesian) {
              w.indonesian.split('/').forEach(s => {
                const clean = s.trim();
                if (clean) allIndo.add(clean);
              });
            }
          });
          const mergedIndo = Array.from(allIndo).join(' / ');

          if (mergedEng) {
            await updateVaultWord(keeper.id, { english: mergedEng, indonesian: mergedIndo });
            keeper.english = mergedEng;
            keeper.indonesian = mergedIndo;
            
            for (const w of toDelete) {
              await deleteVaultWord(w.id);
              allWords = allWords.filter(x => x.id !== w.id);
            }
            const tbody = modal.querySelector('tbody[data-group="' + i + '"]');
            if (tbody) tbody.remove();
            duplicateGroups.splice(i, 1);
          }
        }
        showToast('All groups merged.', 'success');
        modal.querySelector('p.text-muted.text-xs').textContent = '&#10003; All duplicates resolved!';
        if (onResolved) onResolved([...allWords]);
      } catch (e) {
        showToast('Bulk Merge failed: ' + e.message, 'error');
      }
      mergeAllBtn.innerHTML = '&#9889; Merge All';
      mergeAllBtn.disabled = false;
    });
  }
}

// ─── Topic Duplicate Checker Modal ────────────────────────────

function openTopicDuplicateCheckerModal(topicEntries, allWords, onResolved) {
  // Simple normalization: lowercase and remove non-alphanumeric
  const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  const groups = {};
  topicEntries.forEach(([topic]) => {
    const key = norm(topic);
    if (!groups[key]) groups[key] = [];
    groups[key].push(topic);
  });
  
  const duplicateGroups = Object.values(groups).filter(g => g.length > 1);

  if (duplicateGroups.length === 0) {
    showToast('&#10003; No similar topics found.', 'success');
    return;
  }

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.id = 'vault-topic-dup-modal';

  function buildTable() {
    return duplicateGroups.map((group, gi) => {
      const rows = group.map((t, ti) => `
        <tr data-gi="${gi}" data-ti="${ti}">
          <td style="padding:10px 8px;"><span class="badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc;font-size:0.75rem;">${escapeHtml(t)}</span></td>
        </tr>
      `).join('');
      
      const mergedTopic = group[0];
      
      return `
        <tbody data-group="${gi}">
          ${rows}
          <tr style="background:rgba(99,102,241,0.05);">
            <td style="padding:8px;">
              <div class="d-flex align-center gap-2 flex-wrap">
                <span class="text-xs text-muted">Merge topics into:</span>
                <input type="text" class="input merge-topic-input" data-gi="${gi}" value="${escapeHtml(mergedTopic)}" style="flex:1; min-width:200px; padding:4px 8px; font-size:0.8rem;" />
                <button class="btn btn-xs btn-merge-topic-group" data-gi="${gi}" style="background:rgba(99,102,241,0.2);color:#a5b4fc;border:1px solid rgba(99,102,241,0.4);">&#9889; Merge</button>
              </div>
            </td>
          </tr>
          <tr><td style="padding:0; border-bottom:2px solid #1e293b;"></td></tr>
        </tbody>
      `;
    }).join('');
  }

  modal.innerHTML = `
    <div class="modal-box" style="max-width:600px; max-height:85vh; display:flex; flex-direction:column;">
      <div class="d-flex justify-between align-center mb-3">
        <div>
          <h3 class="fw-700" style="margin:0;">&#9874; Topic Duplicate Checker</h3>
          <p class="text-muted text-xs mt-1 mb-0">${duplicateGroups.length} group(s) of similar topics found.</p>
        </div>
        <div class="d-flex gap-2">
          <button class="btn btn-secondary btn-sm" id="dup-topic-merge-all" style="background:#4f46e5; color:white;">&#9889; Merge All</button>
          <button class="btn btn-ghost btn-sm" id="dup-topic-modal-close">&#10005;</button>
        </div>
      </div>
      <div style="overflow-y:auto; flex-grow:1;">
        <table class="table w-100" id="dup-topic-table">
          <thead>
            <tr>
              <th>Topics</th>
            </tr>
          </thead>
          ${buildTable()}
        </table>
      </div>
      <div class="d-flex justify-end mt-3">
        <button class="btn btn-secondary btn-sm" id="dup-topic-modal-done">Done</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  function closeModal() {
    document.body.removeChild(modal);
    if (onResolved) onResolved();
  }

  modal.querySelector('#dup-topic-modal-close').addEventListener('click', closeModal);
  modal.querySelector('#dup-topic-modal-done').addEventListener('click', closeModal);

  async function performMerge(gi, mergedTopic) {
    const group = duplicateGroups[gi];
    if (!mergedTopic) throw new Error('Merged topic name cannot be empty.');
    for (const t of group) {
      if (t !== mergedTopic) {
        await renameVaultTopic(t, mergedTopic);
      }
    }
    const tbody = modal.querySelector('tbody[data-group="' + gi + '"]');
    if (tbody) tbody.remove();
    duplicateGroups.splice(gi, 1);
  }

  modal.querySelectorAll('.btn-merge-topic-group').forEach(btn => {
    btn.addEventListener('click', async () => {
      const gi = parseInt(btn.dataset.gi);
      const mergedTopic = modal.querySelector('.merge-topic-input[data-gi="' + gi + '"]').value.trim();
      
      btn.disabled = true;
      btn.innerHTML = '...';
      try {
        await performMerge(gi, mergedTopic);
        showToast('Topics merged.', 'success');
        if (duplicateGroups.length === 0) {
          modal.querySelector('p.text-muted.text-xs').textContent = 'All topic duplicates resolved!';
        }
      } catch (e) {
        showToast('Topic merge failed: ' + e.message, 'error');
        btn.disabled = false;
        btn.innerHTML = '&#9889; Merge';
      }
    });
  });

  const mergeAllBtn = modal.querySelector('#dup-topic-merge-all');
  if (mergeAllBtn) {
    mergeAllBtn.addEventListener('click', async () => {
      if (!confirm('Merge all similar topics into the first proposed name?')) return;
      mergeAllBtn.disabled = true;
      mergeAllBtn.innerHTML = '...';
      try {
        for (let i = duplicateGroups.length - 1; i >= 0; i--) {
          const mergedTopic = modal.querySelector('.merge-topic-input[data-gi="' + i + '"]').value.trim();
          await performMerge(i, mergedTopic);
        }
        showToast('All topic groups merged.', 'success');
        modal.querySelector('p.text-muted.text-xs').textContent = '&#10003; All duplicates resolved!';
      } catch (e) {
        showToast('Bulk Merge failed: ' + e.message, 'error');
      }
      mergeAllBtn.innerHTML = '&#9889; Merge All';
      mergeAllBtn.disabled = false;
    });
  }
}
