// TOPS CORE â€” Centralized Assessment System V1 Admin UI
import {
  fetchGlobalSubjects,
  fetchWordTypes,
  createWordType,
  toggleWordType,
  fetchTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  fetchCentralQuestions,
  createCentralQuestion,
  updateCentralQuestion,
  deleteCentralQuestion,
  fetchAssessments,
  publishAssessment,
  fetchAssessmentQuestions,
  fetchAssignments,
  assignAssessment,
  adminFetchAll,
  adminSoftDelete,
  clearAdminCache
} from '../api.js';
import { openAssessmentBuilder } from './exam-builder.js';
import { showToast, showLoading, hideLoading } from '../app.js';
import { parseExcelWorkbook, processCentralBankQuestionImport } from '../excel-parser.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// 1. TOPICS MANAGEMENT
// ============================================================
export async function renderTopics(area) {
  showLoading();
  try {
    const [topics, subjects] = await Promise.all([
      fetchTopics(),
      fetchGlobalSubjects()
    ]);
    hideLoading();

    area.innerHTML = `
      <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title text-gradient">Topic Management</h2>
          <p class="section-subtitle">Categorize and structure questions into global topics</p>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" id="btn-add-topic">+ Add New Topic</button>
        </div>
      </div>

      ${window._filterSubjectId ? `
        <div class="mb-3 p-2 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;font-size:0.85rem;">
          <span>ðŸ“ Filtered by Subject: <strong>${escapeHtml(window._filterSubjectName || 'Selected Subject')}</strong></span>
          <button class="btn btn-ghost btn-xs" id="clear-subj-filter-btn" style="text-decoration:underline;color:#93c5fd;">Show All Subjects</button>
        </div>
      ` : ''}

      <div class="card p-3 mb-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <div class="d-flex align-center gap-3 flex-wrap">
          <label class="form-label mb-0" style="font-size:0.85rem;">Filter by Subject:</label>
          <select class="form-control" id="topic-subject-filter" style="max-width:260px;">
            <option value="">All Subjects (${subjects.length})</option>
            ${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
          <span class="text-muted" style="font-size:0.85rem;margin-left:auto;">Total Topics: <strong id="topics-count">${topics.length}</strong></span>
        </div>
      </div>

      <div class="table-responsive card" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <table class="data-table" id="topics-table">
          <thead>
            <tr>
              <th>Topic Name</th>
              <th>Code</th>
              <th>Subject</th>
              <th>Status</th>
              <th>Created</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="topics-tbody">
            ${renderTopicRows(topics)}
          </tbody>
        </table>
      </div>
    `;

    // Filter event
    const filterEl = document.getElementById('topic-subject-filter');
    const updateFilteredTopics = () => {
      const val = filterEl.value;
      const filtered = val ? topics.filter(t => t.subject_id === val) : topics;
      document.getElementById('topics-tbody').innerHTML = renderTopicRows(filtered);
      document.getElementById('topics-count').textContent = filtered.length;
    };
    filterEl.addEventListener('change', updateFilteredTopics);

    if (window._filterSubjectId) {
      filterEl.value = window._filterSubjectId;
      updateFilteredTopics();
      document.getElementById('clear-subj-filter-btn')?.addEventListener('click', () => {
        window._filterSubjectId = null;
        window._filterSubjectName = null;
        renderTopics(area);
      });
    }

    // Add Topic Button
    document.getElementById('btn-add-topic').addEventListener('click', () => {
      openTopicModal(null, subjects, async () => {
        await renderTopics(area);
      });
    });

    // Edit and Delete Delegations
    document.getElementById('topics-tbody').addEventListener('click', async (e) => {
      const navBtn = e.target.closest('.btn-nav-questions');
      const editBtn = e.target.closest('.btn-edit-topic');
      const delBtn = e.target.closest('.btn-del-topic');

      if (navBtn) {
        window._filterTopicId = navBtn.dataset.id;
        window._filterTopicName = navBtn.dataset.name;
        window.loadSection('questions');
        return;
      }

      if (editBtn) {
        const id = editBtn.dataset.id;
        const topic = topics.find(t => t.id === id);
        if (topic) {
          openTopicModal(topic, subjects, async () => {
            await renderTopics(area);
          });
        }
      } else if (delBtn) {
        const id = delBtn.dataset.id;
        if (confirm('Are you sure you want to delete this topic? Associated questions will also be hidden.')) {
          showLoading();
          try {
            await deleteTopic(id);
            showToast('Topic deleted successfully.', 'success');
            await renderTopics(area);
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            hideLoading();
          }
        }
      }
    });

  } catch (err) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load topics: ${err.message}</p></div>`;
  }
}

function renderTopicRows(topicsList) {
  if (!topicsList || !topicsList.length) {
    return `<tr><td colspan="6" class="text-center p-4 text-muted">No topics found. Click "+ Add New Topic" to create one.</td></tr>`;
  }
  return topicsList.map(t => `
    <tr>
      <td><strong style="color:var(--clr-text-1);">${escapeHtml(t.name)}</strong></td>
      <td><code>${escapeHtml(t.code || 'â€”')}</code></td>
      <td><span class="badge badge-info">${escapeHtml(t.subjects?.name || 'General')}</span></td>
      <td>
        <span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-secondary'}">
          ${escapeHtml(t.status || 'active')}
        </span>
      </td>
      <td style="font-size:0.8rem;color:var(--clr-text-muted);">${new Date(t.created_at).toLocaleDateString()}</td>
      <td style="text-align:right;">
        <div class="d-flex gap-1 justify-end">
          <button class="btn btn-outline btn-xs btn-nav-questions" data-id="${t.id}" data-name="${escapeHtml(t.name)}" title="View Questions in this Topic">Questions â†’</button>
          <button class="btn btn-ghost btn-sm btn-edit-topic" data-id="${t.id}" title="Edit Topic">âœï¸</button>
          <button class="btn btn-ghost btn-sm text-danger btn-del-topic" data-id="${t.id}" title="Delete Topic">ðŸ—‘ï¸</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openTopicModal(topic, subjects, onSaved) {
  const isEdit = !!topic;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:480px;">
      <div class="modal-header d-flex justify-between align-center p-3" style="border-bottom:1px solid var(--clr-border);">
        <h3 class="modal-title" style="margin:0;font-size:1.2rem;">${isEdit ? 'Edit Topic' : 'Add New Topic'}</h3>
        <button class="btn btn-ghost btn-sm" id="close-topic-modal" style="font-size:1.2rem;">&times;</button>
      </div>
      <div class="modal-body p-4">
        <div class="form-group mb-3">
          <label class="form-label">Subject *</label>
          <select class="form-control" id="modal-topic-subject">
            ${subjects.map(s => `
              <option value="${s.id}" ${topic?.subject_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Topic Name *</label>
          <input type="text" class="form-control" id="modal-topic-name" value="${escapeHtml(topic?.name || '')}" placeholder="e.g. Food, Travel, Daily Activities" required />
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Topic Code (Optional)</label>
          <input type="text" class="form-control" id="modal-topic-code" value="${escapeHtml(topic?.code || '')}" placeholder="e.g. TOP-FOOD" />
        </div>
        <div class="form-group mb-4">
          <label class="form-label">Status</label>
          <select class="form-control" id="modal-topic-status">
            <option value="active" ${topic?.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${topic?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
        <div class="d-flex justify-end gap-2">
          <button class="btn btn-secondary btn-sm" id="cancel-topic-btn">Cancel</button>
          <button class="btn btn-primary btn-sm" id="save-topic-btn">${isEdit ? 'Save Changes' : 'Create Topic'}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-topic-modal').onclick = close;
  modal.querySelector('#cancel-topic-btn').onclick = close;

  modal.querySelector('#save-topic-btn').onclick = async () => {
    const subjectId = modal.querySelector('#modal-topic-subject').value;
    const name = modal.querySelector('#modal-topic-name').value.trim();
    const code = modal.querySelector('#modal-topic-code').value.trim();
    const status = modal.querySelector('#modal-topic-status').value;

    if (!name) {
      showToast('Please enter a topic name.', 'warning');
      return;
    }

    try {
      showLoading();
      if (isEdit) {
        await updateTopic(topic.id, { subject_id: subjectId, name, code, status });
        showToast('Topic updated.', 'success');
      } else {
        await createTopic({ subject_id: subjectId, name, code, status });
        showToast('Topic created.', 'success');
      }
      close();
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  };
}

// ============================================================
// 2. WORD TYPES MANAGEMENT
// ============================================================
export async function renderWordTypes(area) {
  showLoading();
  try {
    const wordTypes = await fetchWordTypes();
    hideLoading();

    const systemTypes = [
      'Noun', 'Verb', 'Adjective', 'Adverb', 'Pronoun', 'Preposition',
      'Conjunction', 'Interjection', 'Determiner', 'Article', 'Phrase', 'Expression', 'Idiom'
    ];

    area.innerHTML = `
      <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title text-gradient">Word Types</h2>
          <p class="section-subtitle">Configurable vocabulary classification with intelligent system suggestions</p>
        </div>
      </div>

      <div class="card p-4 mb-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <h4 style="font-size:0.95rem;margin-bottom:0.75rem;">âž• Add Custom Word Type</h4>
        <div class="d-flex gap-2 flex-wrap" style="max-width:500px;">
          <input type="text" class="form-control" id="new-word-type-input" placeholder="e.g. Phrasal Verb, Slang, Collocation" />
          <button class="btn btn-primary btn-sm" id="btn-add-word-type">+ Add</button>
        </div>

        <div class="mt-4">
          <label class="form-label" style="font-size:0.8rem;color:var(--clr-text-muted);">Quick Suggestions (Click to add):</label>
          <div class="d-flex gap-2 flex-wrap">
            ${systemTypes.map(st => {
              const exists = wordTypes.some(wt => wt.name.toLowerCase() === st.toLowerCase());
              return `
                <button class="btn btn-sm ${exists ? 'btn-ghost' : 'btn-outline-primary'} btn-suggest-wt" data-name="${st}" ${exists ? 'disabled title="Already added"' : ''}>
                  ${st} ${exists ? 'âœ“' : '+'}
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <div class="table-responsive card" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <table class="data-table">
          <thead>
            <tr>
              <th>Word Type</th>
              <th>Category</th>
              <th>Active Status</th>
              <th style="text-align:right;">Toggle</th>
            </tr>
          </thead>
          <tbody>
            ${wordTypes.map(wt => `
              <tr>
                <td><strong>${escapeHtml(wt.name)}</strong></td>
                <td>
                  <span class="badge ${wt.is_system ? 'badge-primary' : 'badge-secondary'}">
                    ${wt.is_system ? 'System Default' : 'Custom'}
                  </span>
                </td>
                <td>
                  <span class="badge ${wt.is_active ? 'badge-success' : 'badge-danger'}">
                    ${wt.is_active ? 'Active' : 'Disabled'}
                  </span>
                </td>
                <td style="text-align:right;">
                  <button class="btn btn-sm ${wt.is_active ? 'btn-secondary text-danger' : 'btn-success'} btn-toggle-wt" data-id="${wt.id}" data-active="${wt.is_active}">
                    ${wt.is_active ? 'Disable' : 'Enable'}
                  </button>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;

    // Add custom word type
    const addBtn = document.getElementById('btn-add-word-type');
    const inputEl = document.getElementById('new-word-type-input');
    const handleAdd = async (name) => {
      if (!name) return;
      showLoading();
      try {
        await createWordType(name);
        showToast(`Word type "${name}" added.`, 'success');
        await renderWordTypes(area);
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        hideLoading();
      }
    };

    addBtn.onclick = () => handleAdd(inputEl.value);
    inputEl.onkeydown = (e) => { if (e.key === 'Enter') handleAdd(inputEl.value); };

    // Suggestion chips
    area.querySelectorAll('.btn-suggest-wt').forEach(btn => {
      btn.onclick = () => handleAdd(btn.dataset.name);
    });

    // Toggle status
    area.querySelectorAll('.btn-toggle-wt').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.id;
        const currentActive = btn.dataset.active === 'true';
        showLoading();
        try {
          await toggleWordType(id, !currentActive);
          showToast(`Word type ${!currentActive ? 'enabled' : 'disabled'}.`, 'success');
          await renderWordTypes(area);
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          hideLoading();
        }
      };
    });

  } catch (err) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load word types: ${err.message}</p></div>`;
  }
}

// ============================================================
// 3. CENTRAL QUESTION BANK
// ============================================================
export async function renderCentralQuestionBank(area) {
  showLoading();
  try {
    const [questions, topics, subjects, wordTypes] = await Promise.all([
      fetchCentralQuestions(),
      fetchTopics(),
      fetchGlobalSubjects(),
      fetchWordTypes()
    ]);
    hideLoading();

    area.innerHTML = `
      <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title text-gradient">Central Question Bank</h2>
          <p class="section-subtitle">Global repository of questions organized by Topic and Word Type</p>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-primary btn-sm" id="btn-add-question">+ Add New Question</button>
          <button class="btn btn-secondary btn-sm" onclick="window.loadSection('import-questions')">ðŸ“¥ Import Excel</button>
        </div>
      </div>

      ${window._filterTopicId ? `
        <div class="mb-3 p-2 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;font-size:0.85rem;">
          <span>ðŸ“ Filtered by Topic: <strong>${escapeHtml(window._filterTopicName || 'Selected Topic')}</strong></span>
          <button class="btn btn-ghost btn-xs" id="clear-topic-filter-btn" style="text-decoration:underline;color:#93c5fd;">Show All Topics</button>
        </div>
      ` : ''}

      <!-- Filter Controls -->
      <div class="card p-3 mb-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <div class="d-flex gap-3 flex-wrap align-center">
          <div style="flex:1;min-width:200px;">
            <input type="text" class="form-control" id="q-search-input" placeholder="ðŸ” Search question or answer..." />
          </div>
          <div style="min-width:160px;">
            <select class="form-control" id="q-topic-filter">
              <option value="">All Topics (${topics.length})</option>
              ${topics.map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('')}
            </select>
          </div>
          <div style="min-width:150px;">
            <select class="form-control" id="q-wordtype-filter">
              <option value="">All Word Types</option>
              ${wordTypes.map(wt => `<option value="${wt.name}">${escapeHtml(wt.name)}</option>`).join('')}
            </select>
          </div>
          <span class="text-muted" style="font-size:0.85rem;margin-left:auto;">
            Questions: <strong id="q-count-badge">${questions.length}</strong>
          </span>
        </div>
      </div>

      <!-- Question List Table -->
      <div class="table-responsive card" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:160px;">Topic</th>
              <th style="width:110px;">Word Type</th>
              <th>Question Text</th>
              <th>Accepted Answers</th>
              <th style="width:80px;">Status</th>
              <th style="text-align:right;width:100px;">Actions</th>
            </tr>
          </thead>
          <tbody id="q-tbody">
            ${renderQuestionRows(questions)}
          </tbody>
        </table>
      </div>
    `;

    // Filter Logic
    const searchInput = document.getElementById('q-search-input');
    const topicFilter = document.getElementById('q-topic-filter');
    const wtFilter = document.getElementById('q-wordtype-filter');

    const applyFilters = () => {
      const s = searchInput.value.toLowerCase().trim();
      const tid = topicFilter.value;
      const wt = wtFilter.value;

      const filtered = questions.filter(q => {
        if (tid && q.topic_id !== tid) return false;
        if (wt && (q.word_type || '').toLowerCase() !== wt.toLowerCase()) return false;
        if (s) {
          const qMatch = (q.question_text || '').toLowerCase().includes(s);
          const aMatch = Array.isArray(q.accepted_answers) && q.accepted_answers.some((a) => String(a).toLowerCase().includes(s));
          if (!qMatch && !aMatch) return false;
        }
        return true;
      });

      document.getElementById('q-tbody').innerHTML = renderQuestionRows(filtered);
      document.getElementById('q-count-badge').textContent = filtered.length;
    };

    searchInput.oninput = applyFilters;
    topicFilter.onchange = applyFilters;
    wtFilter.onchange = applyFilters;

    if (window._filterTopicId) {
      topicFilter.value = window._filterTopicId;
      applyFilters();
      document.getElementById('clear-topic-filter-btn')?.addEventListener('click', () => {
        window._filterTopicId = null;
        window._filterTopicName = null;
        renderCentralQuestionBank(area);
      });
    }

    // Add Question
    document.getElementById('btn-add-question').onclick = () => {
      openQuestionModal(null, { topics, subjects, wordTypes }, async () => {
        await renderCentralQuestionBank(area);
      });
    };

    // Actions Delegation
    document.getElementById('q-tbody').addEventListener('click', async (e) => {
      const editBtn = e.target.closest('.btn-edit-q');
      const delBtn = e.target.closest('.btn-del-q');

      if (editBtn) {
        const qId = editBtn.dataset.id;
        const q = questions.find(item => item.id === qId);
        if (q) {
          openQuestionModal(q, { topics, subjects, wordTypes }, async () => {
            await renderCentralQuestionBank(area);
          });
        }
      } else if (delBtn) {
        const qId = delBtn.dataset.id;
        if (confirm('Delete this question from the central question bank?')) {
          showLoading();
          try {
            await deleteCentralQuestion(qId);
            showToast('Question deleted.', 'success');
            await renderCentralQuestionBank(area);
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            hideLoading();
          }
        }
      }
    });

  } catch (err) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load questions: ${err.message}</p></div>`;
  }
}

function renderQuestionRows(list) {
  if (!list || !list.length) {
    return `<tr><td colspan="6" class="text-center p-4 text-muted">No questions found. Click "+ Add New Question" to create one.</td></tr>`;
  }
  return list.map(q => {
    const answers = Array.isArray(q.accepted_answers) ? q.accepted_answers : [];
    return `
      <tr>
        <td>
          <span class="badge badge-info" style="font-size:0.8rem;">
            ${escapeHtml(q.topics?.name || 'General')}
          </span>
        </td>
        <td>
          ${q.word_type ? `<span class="badge badge-secondary" style="font-size:0.75rem;">${escapeHtml(q.word_type)}</span>` : '<span class="text-muted">â€”</span>'}
        </td>
        <td>
          <strong style="color:var(--clr-text-1);font-size:0.95rem;">${escapeHtml(q.question_text)}</strong>
        </td>
        <td>
          <div class="d-flex gap-1 flex-wrap">
            ${answers.map(a => `<span class="badge badge-success" style="font-size:0.8rem;">${escapeHtml(a)}</span>`).join('')}
          </div>
        </td>
        <td>
          <span class="badge ${q.status === 'active' ? 'badge-success' : 'badge-secondary'}" style="font-size:0.75rem;">
            ${escapeHtml(q.status || 'active')}
          </span>
        </td>
        <td style="text-align:right;">
          <button class="btn btn-ghost btn-sm btn-edit-q" data-id="${q.id}" title="Edit Question">âœï¸</button>
          <button class="btn btn-ghost btn-sm text-danger btn-del-q" data-id="${q.id}" title="Delete Question">ðŸ—‘ï¸</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openQuestionModal(question, { topics, subjects, wordTypes }, onSaved) {
  const isEdit = !!question;
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';

  const currentAnswers = Array.isArray(question?.accepted_answers)
    ? question.accepted_answers.join('; ')
    : (question?.accepted_answers || '');

  modal.innerHTML = `
    <div class="modal-content" style="max-width:560px;">
      <div class="modal-header d-flex justify-between align-center p-3" style="border-bottom:1px solid var(--clr-border);">
        <h3 class="modal-title" style="margin:0;font-size:1.2rem;">${isEdit ? 'Edit Question' : 'Add Question to Bank'}</h3>
        <button class="btn btn-ghost btn-sm" id="close-q-modal" style="font-size:1.2rem;">&times;</button>
      </div>
      <div class="modal-body p-4">
        <div class="form-group mb-3">
          <label class="form-label">Subject *</label>
          <select class="form-control" id="modal-q-subject">
            ${subjects.map(s => `
              <option value="${s.id}" ${question?.subject_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Topic *</label>
          <select class="form-control" id="modal-q-topic">
            ${topics.map(t => `
              <option value="${t.id}" ${question?.topic_id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>
            `).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Word Type (e.g. Noun, Verb, Adjective)</label>
          <input list="word-types-datalist" class="form-control" id="modal-q-wordtype" value="${escapeHtml(question?.word_type || '')}" placeholder="Select or type word type" />
          <datalist id="word-types-datalist">
            ${wordTypes.map(wt => `<option value="${escapeHtml(wt.name)}">`).join('')}
          </datalist>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Question Text *</label>
          <textarea class="form-control" id="modal-q-text" rows="3" placeholder="Enter question prompt" required>${escapeHtml(question?.question_text || '')}</textarea>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Accepted Answers (Separate multiple valid answers with ; or /) *</label>
          <input type="text" class="form-control" id="modal-q-answers" value="${escapeHtml(currentAnswers)}" placeholder="e.g. cook; prepare; make" required />
          <small class="text-muted" style="font-size:0.75rem;">Students submitting any of these answers will receive full credit.</small>
        </div>
        <div class="form-group mb-4">
          <label class="form-label">Status</label>
          <select class="form-control" id="modal-q-status">
            <option value="active" ${question?.status === 'active' ? 'selected' : ''}>Active</option>
            <option value="inactive" ${question?.status === 'inactive' ? 'selected' : ''}>Inactive</option>
          </select>
        </div>
        <div class="d-flex justify-end gap-2">
          <button class="btn btn-secondary btn-sm" id="cancel-q-btn">Cancel</button>
          <button class="btn btn-primary btn-sm" id="save-q-btn">${isEdit ? 'Save Changes' : 'Add Question'}</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-q-modal').onclick = close;
  modal.querySelector('#cancel-q-btn').onclick = close;

  modal.querySelector('#save-q-btn').onclick = async () => {
    const subjectId = modal.querySelector('#modal-q-subject').value;
    const topicId = modal.querySelector('#modal-q-topic').value;
    const wordType = modal.querySelector('#modal-q-wordtype').value.trim();
    const questionText = modal.querySelector('#modal-q-text').value.trim();
    const answersRaw = modal.querySelector('#modal-q-answers').value.trim();
    const status = modal.querySelector('#modal-q-status').value;

    if (!questionText || !answersRaw) {
      showToast('Please provide both question text and at least one accepted answer.', 'warning');
      return;
    }

    const answersArray = answersRaw.split(/[;/|]/).map(s => s.trim()).filter(Boolean);

    try {
      showLoading();
      if (isEdit) {
        await updateCentralQuestion(question.id, {
          subject_id: subjectId,
          topic_id: topicId,
          word_type: wordType || null,
          question_text: questionText,
          accepted_answers: answersArray,
          status
        });
        showToast('Question updated.', 'success');
      } else {
        await createCentralQuestion({
          subject_id: subjectId,
          topic_id: topicId,
          word_type: wordType || null,
          question_text: questionText,
          accepted_answers: answersArray,
          status
        });
        showToast('Question added to bank.', 'success');
      }
      close();
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  };
}

// ============================================================
// 4. ASSIGNMENTS MANAGEMENT
// ============================================================
export async function renderAssignments(area) {
  showLoading();
  try {
    const [assignments, assessments, batches, students] = await Promise.all([
      fetchAssignments(),
      fetchAssessments(),
      adminFetchAll('batches'),
      adminFetchAll('students')
    ]);
    hideLoading();

    area.innerHTML = `
      <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title text-gradient">Assessment Assignments</h2>
          <p class="section-subtitle">Control assessment access by Batch or individual Student</p>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" id="btn-assign-assessment">+ New Assignment</button>
        </div>
      </div>

      <div class="table-responsive card" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <table class="data-table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Type</th>
              <th>Assigned Target</th>
              <th>Availability Window</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="assignments-tbody">
            ${renderAssignmentRows(assignments)}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-assign-assessment').onclick = () => {
      openAssignmentModal({ assessments, batches, students }, async () => {
        await renderAssignments(area);
      });
    };

    document.getElementById('assignments-tbody').addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.btn-revoke-assignment');
      if (delBtn) {
        const id = delBtn.dataset.id;
        if (confirm('Revoke this assessment assignment?')) {
          showLoading();
          try {
            await adminSoftDelete('assignments', id);
            showToast('Assignment revoked.', 'success');
            await renderAssignments(area);
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            hideLoading();
          }
        }
      }
    });

  } catch (err) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load assignments: ${err.message}</p></div>`;
  }
}

function renderAssignmentRows(list) {
  if (!list || !list.length) {
    return `<tr><td colspan="6" class="text-center p-4 text-muted">No active assignments. Click "+ New Assignment" to assign an assessment.</td></tr>`;
  }
  return list.map(a => {
    const targetName = a.assignment_type === 'BATCH'
      ? `ðŸ‘¥ Batch: ${escapeHtml(a.batches?.name || 'Unknown')}`
      : `ðŸ‘¨â€ðŸŽ“ Student: ${escapeHtml(a.students?.name || 'Unknown')}`;

    const windowText = (a.availability_start || a.availability_end)
      ? `${a.availability_start ? new Date(a.availability_start).toLocaleDateString() : 'Now'} â†’ ${a.availability_end ? new Date(a.availability_end).toLocaleDateString() : 'Forever'}`
      : '<span class="text-success">Always Open</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(a.assessments?.title || 'Assessment')}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(a.assessments?.assessment_type || 'EVALUATION')}</span></td>
        <td>${targetName}</td>
        <td><small>${windowText}</small></td>
        <td><span class="badge badge-success">Active</span></td>
        <td style="text-align:right;">
          <button class="btn btn-ghost btn-sm text-danger btn-revoke-assignment" data-id="${a.id}" title="Revoke Assignment">ðŸ—‘ï¸ Revoke</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAssignmentModal({ assessments, batches, students }, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div class="modal-header d-flex justify-between align-center p-3" style="border-bottom:1px solid var(--clr-border);">
        <h3 class="modal-title" style="margin:0;font-size:1.2rem;">Assign Assessment</h3>
        <button class="btn btn-ghost btn-sm" id="close-asgn-modal" style="font-size:1.2rem;">&times;</button>
      </div>
      <div class="modal-body p-4">
        <div class="form-group mb-3">
          <label class="form-label">Select Assessment *</label>
          <select class="form-control" id="asgn-assessment-id">
            ${assessments.map(a => `<option value="${a.id}">${escapeHtml(a.title)} (${escapeHtml(a.assessment_type)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Assignment Mode *</label>
          <select class="form-control" id="asgn-mode">
            <option value="BATCH">Batch (All students in batch)</option>
            <option value="STUDENT">Individual Student</option>
          </select>
        </div>
        <div class="form-group mb-3" id="asgn-batch-group">
          <label class="form-label">Select Batch *</label>
          <select class="form-control" id="asgn-batch-id">
            ${batches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3 hidden" id="asgn-student-group">
          <label class="form-label">Select Student *</label>
          <select class="form-control" id="asgn-student-id">
            ${students.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Availability Start (Optional)</label>
          <input type="datetime-local" class="form-control" id="asgn-start" />
        </div>
        <div class="form-group mb-4">
          <label class="form-label">Availability End (Optional)</label>
          <input type="datetime-local" class="form-control" id="asgn-end" />
        </div>
        <div class="d-flex justify-end gap-2">
          <button class="btn btn-secondary btn-sm" id="cancel-asgn-btn">Cancel</button>
          <button class="btn btn-primary btn-sm" id="save-asgn-btn">Save Assignment</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-asgn-modal').onclick = close;
  modal.querySelector('#cancel-asgn-btn').onclick = close;

  const modeSelect = modal.querySelector('#asgn-mode');
  const batchGroup = modal.querySelector('#asgn-batch-group');
  const studentGroup = modal.querySelector('#asgn-student-group');

  modeSelect.onchange = () => {
    if (modeSelect.value === 'BATCH') {
      batchGroup.classList.remove('hidden');
      studentGroup.classList.add('hidden');
    } else {
      batchGroup.classList.add('hidden');
      studentGroup.classList.remove('hidden');
    }
  };

  modal.querySelector('#save-asgn-btn').onclick = async () => {
    const assessmentId = modal.querySelector('#asgn-assessment-id').value;
    const mode = modeSelect.value;
    const batchId = modal.querySelector('#asgn-batch-id').value;
    const studentId = modal.querySelector('#asgn-student-id').value;
    const startVal = modal.querySelector('#asgn-start').value;
    const endVal = modal.querySelector('#asgn-end').value;

    showLoading();
    try {
      await assignAssessment({
        assessment_id: assessmentId,
        assignment_type: mode,
        batch_id: mode === 'BATCH' ? batchId : null,
        student_id: mode === 'STUDENT' ? studentId : null,
        availability_start: startVal ? new Date(startVal).toISOString() : null,
        availability_end: endVal ? new Date(endVal).toISOString() : null
      });
      showToast('Assignment created.', 'success');
      close();
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  };
}

// ============================================================
// 5. CENTRAL QUESTION BANK EXCEL IMPORT (V1 Safe Workflow)
// ============================================================
export async function renderCentralQuestionImport(area) {
  showLoading('Loading import environment...');
  try {
    const [subjects, existingQuestions, validWordTypes, existingTopics] = await Promise.all([
      fetchGlobalSubjects(),
      fetchCentralQuestions(),
      fetchWordTypes(),
      fetchTopics()
    ]);
    hideLoading();

    area.innerHTML = `
      <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title text-gradient">Import Questions to Central Bank (V1)</h2>
          <p class="section-subtitle">Safely parse, validate word types, detect duplicates, and preview before committing.</p>
        </div>
        <div>
          <button class="btn btn-secondary btn-sm" id="btn-download-central-tmpl">ðŸ“¥ Download Excel Template</button>
        </div>
      </div>

      <!-- STEP 1: UPLOAD BOX -->
      <div class="card p-4 mb-4" id="import-upload-card" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <div class="form-grid mb-3">
          <div class="form-group mb-3">
            <label class="form-label">Target Subject *</label>
            <select class="form-control" id="import-target-subject" style="max-width:360px;">
              ${subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}${s.institutions?.name ? ` (${escapeHtml(s.institutions.name)})` : ''}</option>`).join('')}
            </select>
          </div>
        </div>

        <div class="drop-zone p-5 text-center rounded" id="question-drop-zone" style="border:2px dashed var(--clr-border);cursor:pointer;background:rgba(255,255,255,0.01);transition:all 0.2s;">
          <div style="font-size:2.8rem;margin-bottom:0.75rem;">ðŸ“</div>
          <h3 style="font-size:1.1rem;margin-bottom:0.5rem;">Click to select Excel file or drag &amp; drop</h3>
          <p class="text-muted text-xs mb-3">Accepts .xlsx, .xls, .csv with columns: <strong>Topic | Word Type | Question | Answer</strong></p>
          <input type="file" id="central-excel-file-input" accept=".xlsx,.xls,.csv" style="display:none;" />
          <button class="btn btn-primary btn-sm" id="btn-browse-excel" type="button">Browse Computer</button>
        </div>
      </div>

      <!-- STEP 2: PREVIEW CARD (Hidden until file selected) -->
      <div class="card p-4 mb-4 hidden" id="import-preview-card" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <div class="d-flex justify-between align-center flex-wrap gap-3 mb-4">
          <div>
            <h3 class="m-0" style="font-size:1.2rem;">Import Preview &amp; Verification</h3>
            <p class="text-muted text-xs m-0" id="preview-file-name">filename.xlsx</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm" id="btn-cancel-preview">Cancel / Choose Another File</button>
            <button class="btn btn-success btn-sm" id="btn-confirm-commit-import">ðŸš€ Confirm &amp; Commit Import</button>
          </div>
        </div>

        <!-- Summary KPI Row -->
        <div class="d-flex gap-3 flex-wrap mb-4" id="import-kpi-row">
          <!-- KPI Cards Injected Here -->
        </div>

        <!-- Warning Notice if Duplicates or Word Type Warnings exist -->
        <div id="import-alerts-container"></div>

        <!-- Data Preview Table -->
        <div class="table-responsive" style="max-height:480px;overflow-y:auto;border:1px solid var(--clr-border);border-radius:8px;">
          <table class="data-table" style="font-size:0.85rem;">
            <thead>
              <tr>
                <th style="width:50px;">Row</th>
                <th style="width:130px;">Topic</th>
                <th style="width:120px;">Word Type</th>
                <th>Question</th>
                <th>Accepted Answers</th>
                <th style="width:180px;">Status / Match</th>
                <th style="width:140px;text-align:right;">Action</th>
              </tr>
            </thead>
            <tbody id="import-preview-tbody">
              <!-- Rows Injected Here -->
            </tbody>
          </table>
        </div>
      </div>
    `;

    // 1. Download Template
    document.getElementById('btn-download-central-tmpl').onclick = () => {
      if (typeof XLSX === 'undefined') {
        showToast('SheetJS is not loaded.', 'error');
        return;
      }
      const data = [
        { "Topic": "Food", "Word Type": "Verb", "Question": "Memasak", "Answer": "cook / prepare" },
        { "Topic": "Food", "Word Type": "Noun", "Question": "Makanan", "Answer": "food / meal" },
        { "Topic": "Daily Activity", "Word Type": "Verb", "Question": "Bangun tidur", "Answer": "wake up / get up" },
        { "Topic": "Travel", "Word Type": "Noun", "Question": "Bandara", "Answer": "airport" },
        { "Topic": "Description", "Word Type": "Adjective", "Question": "Ramah", "Answer": "friendly / hospitable" }
      ];
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Vocabulary_Bank");
      XLSX.writeFile(wb, "Central_Question_Bank_Template.xlsx");
    };

    // 2. File Selection & Drag-Drop
    const fileInput = document.getElementById('central-excel-file-input');
    const dropZone = document.getElementById('question-drop-zone');
    const uploadCard = document.getElementById('import-upload-card');
    const previewCard = document.getElementById('import-preview-card');
    const browseBtn = document.getElementById('btn-browse-excel');

    browseBtn.onclick = (e) => { e.stopPropagation(); fileInput.click(); };
    dropZone.onclick = () => fileInput.click();

    dropZone.ondragover = (e) => { e.preventDefault(); dropZone.style.borderColor = 'var(--clr-primary)'; };
    dropZone.ondragleave = () => { dropZone.style.borderColor = 'var(--clr-border)'; };
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.style.borderColor = 'var(--clr-border)';
      if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
    };

    fileInput.onchange = () => {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
    };

    document.getElementById('btn-cancel-preview').onclick = () => {
      previewCard.classList.add('hidden');
      uploadCard.classList.remove('hidden');
      fileInput.value = '';
    };

    let currentParsedResult = null;

    async function handleFile(file) {
      if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
        showToast('Please select a valid Excel file (.xlsx, .xls, or .csv).', 'warning');
        return;
      }
      showLoading(`Parsing ${file.name}...`);
      try {
        const buffer = await file.arrayBuffer();
        const { rows, rawHeaders } = parseExcelWorkbook(buffer);
        if (!rows.length) {
          throw new Error('The uploaded file does not contain any valid data rows.');
        }

        const parsed = processCentralBankQuestionImport(rows, {
          existingQuestions,
          validWordTypes
        });

        currentParsedResult = parsed;
        currentParsedResult.file = file;

        hideLoading();
        uploadCard.classList.add('hidden');
        previewCard.classList.remove('hidden');
        document.getElementById('preview-file-name').textContent = `${file.name} (${rows.length} rows)`;

        renderPreviewUI(parsed);
      } catch (err) {
        hideLoading();
        showToast(`Failed to parse file: ${err.message}`, 'error');
      }
    }

    function renderPreviewUI(parsed) {
      const summary = parsed.summary;

      // Summary KPIs
      document.getElementById('import-kpi-row').innerHTML = `
        <div class="card p-3" style="flex:1;min-width:130px;background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);text-align:center;">
          <div style="font-size:1.4rem;font-weight:800;color:var(--clr-success);">${summary.newQuestions}</div>
          <div class="text-xs text-muted">New Questions</div>
        </div>
        <div class="card p-3" style="flex:1;min-width:130px;background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);text-align:center;">
          <div style="font-size:1.4rem;font-weight:800;color:var(--clr-info);">${summary.existingQuestions}</div>
          <div class="text-xs text-muted">Exact Matches (Preserved)</div>
        </div>
        <div class="card p-3" style="flex:1;min-width:130px;background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);text-align:center;">
          <div style="font-size:1.4rem;font-weight:800;color:#eab308;">${summary.answerChanges}</div>
          <div class="text-xs text-muted">Answer Updates</div>
        </div>
        <div class="card p-3" style="flex:1;min-width:130px;background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);text-align:center;">
          <div style="font-size:1.4rem;font-weight:800;color:#f97316;">${summary.possibleDuplicates}</div>
          <div class="text-xs text-muted">Possible Duplicates</div>
        </div>
        <div class="card p-3" style="flex:1;min-width:130px;background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);text-align:center;">
          <div style="font-size:1.4rem;font-weight:800;color:${summary.invalidWordTypes > 0 ? '#ef4444' : 'var(--clr-text-muted)'};">${summary.invalidWordTypes}</div>
          <div class="text-xs text-muted">Word Type Warnings</div>
        </div>
      `;

      // Warning Alerts
      let alertHtml = '';
      if (summary.possibleDuplicates > 0) {
        alertHtml += `
          <div class="alert alert-warning p-3 mb-3 text-xs" style="background:rgba(249,115,22,0.1);border:1px solid rgba(249,115,22,0.3);border-radius:8px;">
            âš ï¸ <strong>${summary.possibleDuplicates} Possible Duplicate(s) Found:</strong> High similarity detected. Review the comparisons below and choose whether to <em>Use Existing</em> or <em>Create New</em>.
          </div>
        `;
      }
      if (summary.invalidWordTypes > 0) {
        alertHtml += `
          <div class="alert alert-info p-3 mb-3 text-xs" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:8px;">
            ðŸ’¡ <strong>${summary.invalidWordTypes} Word Type Suggestion(s):</strong> Non-standard word types detected. Suggested standard types have been applied, or you can register them as custom types.
          </div>
        `;
      }
      document.getElementById('import-alerts-container').innerHTML = alertHtml;

      // Render Rows
      const tbody = document.getElementById('import-preview-tbody');
      tbody.innerHTML = parsed.rows.map((r, idx) => {
        let statusBadge = '';
        let actionCol = '';

        if (r.duplicateStatus === 'EXACT_DUPLICATE') {
          statusBadge = `<span class="badge badge-info">Exact Match</span>`;
          if (r.answerKeyChanged) {
            statusBadge += `<br/><span class="badge badge-warning mt-1" title="Existing: ${escapeHtml(r.existingAnswers.join(' / '))} -> New: ${escapeHtml(r.accepted_answers.join(' / '))}">âš¡ Answer Update</span>`;
          }
          actionCol = `
            <select class="form-control form-control-sm row-action-choice" data-idx="${idx}">
              <option value="USE_EXISTING" ${r.actionChoice === 'USE_EXISTING' ? 'selected' : ''}>Use Existing ID</option>
              <option value="SKIP" ${r.actionChoice === 'SKIP' ? 'selected' : ''}>Skip Row</option>
            </select>
          `;
        } else if (r.duplicateStatus === 'POSSIBLE_DUPLICATE') {
          statusBadge = `<span class="badge" style="background:#f97316;color:#fff;">Duplicate? (${r.similarityPct}%)</span>`;
          actionCol = `
            <select class="form-control form-control-sm row-action-choice" data-idx="${idx}">
              <option value="CREATE_NEW" ${r.actionChoice === 'CREATE_NEW' ? 'selected' : ''}>Create New</option>
              <option value="USE_EXISTING" ${r.actionChoice === 'USE_EXISTING' ? 'selected' : ''}>Use Existing</option>
              <option value="SKIP" ${r.actionChoice === 'SKIP' ? 'selected' : ''}>Skip</option>
            </select>
          `;
        } else {
          statusBadge = `<span class="badge badge-success">New Question</span>`;
          actionCol = `<span class="text-muted text-xs">Will Insert</span>`;
        }

        let qDisplay = `<div><strong>${escapeHtml(r.question_text)}</strong></div>`;
        if (r.duplicateStatus === 'POSSIBLE_DUPLICATE' && r.existingQuestionText) {
          qDisplay += `<div class="text-muted text-xs mt-1" style="font-style:italic;">Existing: "${escapeHtml(r.existingQuestionText)}"</div>`;
        }

        let wtDisplay = escapeHtml(r.wordType || 'â€”');
        if (r.wordTypeWarning) {
          wtDisplay += `<div class="text-danger text-xs mt-1" title="${escapeHtml(r.wordTypeWarning)}">âš ï¸ ${escapeHtml(r.wordTypeWarning)}</div>`;
        }

        return `
          <tr>
            <td>${r.rowIndex}</td>
            <td><span class="badge badge-neutral">${escapeHtml(r.topicName)}</span></td>
            <td>${wtDisplay}</td>
            <td>${qDisplay}</td>
            <td><code>${escapeHtml(r.accepted_answers.join(' / '))}</code></td>
            <td>${statusBadge}</td>
            <td style="text-align:right;">${actionCol}</td>
          </tr>
        `;
      }).join('');

      // Wire up action choice dropdowns
      tbody.querySelectorAll('.row-action-choice').forEach(sel => {
        sel.onchange = () => {
          const idx = parseInt(sel.dataset.idx, 10);
          parsed.rows[idx].actionChoice = sel.value;
        };
      });
    }

    // 3. Confirm & Commit Import
    document.getElementById('btn-confirm-commit-import').onclick = async () => {
      if (!currentParsedResult || !currentParsedResult.rows.length) return;

      const targetSubjectId = document.getElementById('import-target-subject').value;
      const rows = currentParsedResult.rows;

      const confirmMsg = `Are you sure you want to commit this import?
â€¢ ${currentParsedResult.summary.newQuestions} new questions will be added
â€¢ ${currentParsedResult.summary.answerChanges} answer keys will be updated
Existing historical attempt records will NOT be modified.`;

      if (!confirm(confirmMsg)) return;

      showLoading('Committing import to Central Question Bank...');
      try {
        const sb = await (await import('../supabase.js')).getSupabase();

        // 1. Resolve & Auto-create Topics
        const topicMap = new Map();
        existingTopics.filter(t => t.subject_id === targetSubjectId).forEach(t => {
          topicMap.set(t.name.toLowerCase().trim(), t.id);
        });

        const uniqueTopicNames = Array.from(new Set(rows.map(r => r.topicName.trim()).filter(Boolean)));
        for (const tName of uniqueTopicNames) {
          const key = tName.toLowerCase();
          if (!topicMap.has(key)) {
            const { data: newT, error: tErr } = await sb.from('topics')
              .insert({
                subject_id: targetSubjectId,
                name: tName,
                status: 'active'
              })
              .select()
              .single();
            if (!tErr && newT) {
              topicMap.set(key, newT.id);
              existingTopics.push(newT);
            }
          }
        }

        // 2. Auto-register any new custom Word Types
        const customWordTypesToRegister = Array.from(new Set(
          rows.filter(r => r.wordType && !validWordTypes.some(v => (v.name || v).toLowerCase() === r.wordType.toLowerCase()))
              .map(r => r.wordType.trim())
        ));
        for (const cwt of customWordTypesToRegister) {
          try {
            await sb.from('word_types').insert({ name: cwt, is_system: false, is_active: true });
          } catch (_) {}
        }

        // 3. Commit Question Updates and Inserts
        let insertedCount = 0;
        let updatedCount = 0;
        let skippedCount = 0;

        const questionsToInsert = [];

        for (const r of rows) {
          if (r.actionChoice === 'SKIP') {
            skippedCount++;
            continue;
          }

          const topicId = topicMap.get(r.topicName.toLowerCase().trim()) || existingTopics[0]?.id;

          if (r.duplicateStatus === 'EXACT_DUPLICATE' && r.actionChoice === 'USE_EXISTING') {
            if (r.answerKeyChanged && r.duplicateOfId) {
              // Update central question accepted_answers
              await sb.from('questions')
                .update({ accepted_answers: r.accepted_answers, updated_at: new Date().toISOString() })
                .eq('id', r.duplicateOfId);
              updatedCount++;
            } else {
              skippedCount++;
            }
          } else if (r.duplicateStatus === 'POSSIBLE_DUPLICATE' && r.actionChoice === 'USE_EXISTING') {
            skippedCount++;
          } else {
            // New Question Insert
            questionsToInsert.push({
              subject_id: targetSubjectId,
              topic_id: topicId,
              word_type: r.wordType || null,
              question_text: r.question_text.trim(),
              accepted_answers: r.accepted_answers,
              status: 'active'
            });
          }
        }

        if (questionsToInsert.length > 0) {
          // Batch in chunks of 100 for safety
          const chunkSize = 100;
          for (let i = 0; i < questionsToInsert.length; i += chunkSize) {
            const chunk = questionsToInsert.slice(i, i + chunkSize);
            let insErr = null;
            try {
              const { error } = await sb.from('questions').insert(chunk);
              insErr = error;
            } catch (e) {
              insErr = e;
            }

            if (insErr) {
              console.warn('V1 questions insert notice, using legacy schema fallback:', insErr.message);
              // Resolve active exam for this subject to satisfy exam_id NOT NULL constraint
              let fallbackExamId = null;
              const { data: exData } = await sb.from('exams')
                .select('id')
                .eq('subject_id', targetSubjectId)
                .is('deleted_at', null)
                .limit(1);

              if (exData && exData.length > 0) {
                fallbackExamId = exData[0].id;
              } else {
                const { data: anyEx } = await sb.from('exams').select('id').is('deleted_at', null).limit(1);
                fallbackExamId = anyEx?.[0]?.id || null;
              }

              if (fallbackExamId) {
                const legacyChunk = chunk.map((q, qIdx) => ({
                  exam_id: fallbackExamId,
                  question_order: qIdx + 1,
                  question_text: q.question_text,
                  correct_answer: Array.isArray(q.accepted_answers) ? q.accepted_answers.join(' / ') : String(q.accepted_answers || ''),
                  answer_type: 'written',
                  metadata: { topic: q.topic_id || 'General', word_type: q.word_type || '' }
                }));
                const { error: legErr } = await sb.from('questions').insert(legacyChunk);
                if (legErr) throw legErr;
              } else {
                throw insErr;
              }
            }
            insertedCount += chunk.length;
          }
        }

        clearAdminCache('questions');
        clearAdminCache('topics');

        hideLoading();
        showToast(`Import complete! ${insertedCount} questions added, ${updatedCount} answer keys updated.`, 'success');

        // Redirect to Question Bank table
        if (window.loadSection) {
          window.loadSection('questions');
        }
      } catch (err) {
        hideLoading();
        showToast(`Failed during commit: ${err.message}`, 'error');
      }
    };

  } catch (err) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load import screen: ${err.message}</p></div>`;
  }
}

