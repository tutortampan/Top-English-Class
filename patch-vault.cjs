const fs = require('fs');

const vaultPath = 'd:/TopsCore/js/admin/vocab-vault.js';
let vaultCode = fs.readFileSync(vaultPath, 'utf8');

// Replacement 1: openAssessmentBuilderModal signature
vaultCode = vaultCode.replace(
  `export async function openAssessmentBuilderModal(vaultTopics) {`,
  `export async function openAssessmentBuilderModal(vaultTopics, overrides = {}) {`
);

// Replacement 2: state initialization
const stateInitOld = `  // State
  const state = {
    step: 1,
    institutionId: '', institutionName: '',
    programId: '', programName: '',
    classId: '', className: '',
    levelId: '', levelName: '',
    tier: 'TASK',`;

const stateInitNew = `  // State
  const state = {
    step: overrides.skipStep1 ? 2 : 1,
    institutionId: overrides.institutionId || '', institutionName: overrides.institutionName || '',
    programId: overrides.programId || '', programName: overrides.programName || '',
    classId: overrides.classId || '', className: overrides.className || '',
    levelId: overrides.levelId || '', levelName: overrides.levelName || '',
    tier: 'TASK',`;

vaultCode = vaultCode.replace(stateInitOld, stateInitNew);

// Replacement 3: Table Word Type UI
const typeSelectOld = `<select class="form-control vault-type-select" data-id="\${escapeHtml(w.id)}" style="font-size:0.75rem; padding: 2px 4px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid #334155; width: 100%; outline: none; cursor: pointer;">
            <option value="Vocab" \${w.word_type?.toLowerCase().includes('vocab') ? 'selected' : ''}>Vocab</option>
            <option value="Verb" \${w.word_type === 'Verb' ? 'selected' : ''}>Verb</option>
            <option value="Noun" \${w.word_type === 'Noun' ? 'selected' : ''}>Noun</option>
            <option value="Adjective" \${w.word_type === 'Adjective' ? 'selected' : ''}>Adjective</option>
            <option value="Adverb" \${w.word_type === 'Adverb' ? 'selected' : ''}>Adverb</option>
            <option value="Phrase" \${w.word_type === 'Phrase' ? 'selected' : ''}>Phrase</option>
            <option value="Expression" \${w.word_type === 'Expression' ? 'selected' : ''}>Expression</option>
            <option value="Idiom" \${w.word_type === 'Idiom' ? 'selected' : ''}>Idiom</option>
            <option value="Proverb" \${w.word_type === 'Proverb' ? 'selected' : ''}>Proverb</option>
          </select>`;
const typeSelectNew = `<span style="font-size:0.75rem; padding: 4px 8px; border-radius: 4px; background: rgba(255,255,255,0.05); color: #cbd5e1; border: 1px solid #334155; display: inline-block;">\${escapeHtml(w.word_type || 'Vocab')}</span>`;

vaultCode = vaultCode.replace(typeSelectOld, typeSelectNew);

// Replacement 4: Remove event listener block
const eventListenerOld = `    // Update word type handlers
    tbody.querySelectorAll('.vault-type-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        try {
          const id = e.target.getAttribute('data-id');
          const newType = e.target.value;
          const { adminUpdate } = await import('../api.js?v=4.7.3');
          await adminUpdate('vocabulary_vault', id, { word_type: newType });
          const word = _allWords.find(w => w.id === id);
          if (word) word.word_type = newType;
        } catch (err) {
          const { showToast } = await import('../app.js?v=4.7.3');
          showToast('Failed to update word type: ' + err.message, 'error');
        }
      });
    });`;

vaultCode = vaultCode.replace(eventListenerOld, '');

fs.writeFileSync(vaultPath, vaultCode);
console.log('Successfully patched vocab-vault.js');
