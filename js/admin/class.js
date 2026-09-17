// TOPS CORE Ã¯Â¿Â½ Centralized Assessment System V1 Admin UI
import {
  fetchGlobalClasses,
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
  fetchChallengeDefinitions,
  publishChallengeDefinition,
  fetchChallengeInstances,
  createChallengeInstance,
  adminFetchAll,
  adminSoftDelete,
  clearAdminCache,
  fetchClasses,
  fetchClassInstances,
  adminUpdate,
  previewRecalibrateExam,
  applyRecalibrateExam,
  isPassing,
  calculatePercentage,
  formatStudentName,
  fetchClassInstanceRoster,
  addAdditionalMember
} from '../api.js';
import { openAssessmentBuilder } from './exam-builder.js';
import { showToast, showLoading, hideLoading, getGrade } from '../app.js';
import { parseExcelWorkbook, processCentralBankQuestionImport } from '../excel-parser.js';
import { openStudentProfile } from './student-management.js';

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
      fetchGlobalClasses()
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
          <span>Ã°Å¸â€œÂ Filtered by Subject: <strong>${escapeHtml(window._filterSubjectName || 'Selected Subject')}</strong></span>
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
      const filtered = val ? topics.filter(t => t.class_id === val) : topics;
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
      <td><code>${escapeHtml(t.code || 'Ã¯Â¿Â½')}</code></td>
      <td><span class="badge badge-info">${escapeHtml(t.classes?.name || 'General')}</span></td>
      <td>
        <span class="badge ${t.status === 'active' ? 'badge-success' : 'badge-secondary'}">
          ${escapeHtml(t.status || 'active')}
        </span>
      </td>
      <td style="font-size:0.8rem;color:var(--clr-text-muted);">${new Date(t.created_at).toLocaleDateString()}</td>
      <td style="text-align:right;">
        <div class="d-flex gap-1 justify-end">
          <button class="btn btn-outline btn-xs btn-nav-questions" data-id="${t.id}" data-name="${escapeHtml(t.name)}" title="View Questions in this Topic">Questions Ã¢â€ â€™</button>
          <button class="btn btn-ghost btn-sm btn-edit-topic" data-id="${t.id}" title="Edit Topic">Ã¢Å“ÂÃ¯Â¸Â</button>
          <button class="btn btn-ghost btn-sm text-danger btn-del-topic" data-id="${t.id}" title="Delete Topic">Ã°Å¸â€”â€˜Ã¯Â¸Â</button>
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
              <option value="${s.id}" ${topic?.class_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
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
        await updateTopic(topic.id, { class_id: subjectId, name, code, status });
        showToast('Topic updated.', 'success');
      } else {
        await createTopic({ class_id: subjectId, name, code, status });
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
        <h4 style="font-size:0.95rem;margin-bottom:0.75rem;">Ã¢Å¾â€¢ Add Custom Word Type</h4>
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
                  ${st} ${exists ? 'Ã¢Å“â€œ' : '+'}
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
      fetchGlobalClasses(),
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
          <button class="btn btn-secondary btn-sm" onclick="window.loadSection('import-questions')">Ã°Å¸â€œÂ¥ Import Excel</button>
        </div>
      </div>

      ${window._filterTopicId ? `
        <div class="mb-3 p-2 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;font-size:0.85rem;">
          <span>Ã°Å¸â€œÂ Filtered by Topic: <strong>${escapeHtml(window._filterTopicName || 'Selected Topic')}</strong></span>
          <button class="btn btn-ghost btn-xs" id="clear-topic-filter-btn" style="text-decoration:underline;color:#93c5fd;">Show All Topics</button>
        </div>
      ` : ''}

      <!-- Filter Controls -->
      <div class="card p-3 mb-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <div class="d-flex gap-3 flex-wrap align-center">
          <div style="flex:1;min-width:200px;">
            <input type="text" class="form-control" id="q-search-input" placeholder="Ã°Å¸â€Â Search question or answer..." />
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
        if (wt && (q.question_type || '').toLowerCase() !== wt.toLowerCase()) return false;
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
          ${q.question_type ? `<span class="badge badge-secondary" style="font-size:0.75rem;">${escapeHtml(q.question_type)}</span>` : '<span class="text-muted">Ã¯Â¿Â½</span>'}
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
          <button class="btn btn-ghost btn-sm btn-edit-q" data-id="${q.id}" title="Edit Question">Ã¢Å“ÂÃ¯Â¸Â</button>
          <button class="btn btn-ghost btn-sm text-danger btn-del-q" data-id="${q.id}" title="Delete Question">Ã°Å¸â€”â€˜Ã¯Â¸Â</button>
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
              <option value="${s.id}" ${question?.class_id === s.id ? 'selected' : ''}>${escapeHtml(s.name)}</option>
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
          <input list="word-types-datalist" class="form-control" id="modal-q-wordtype" value="${escapeHtml(question?.question_type || '')}" placeholder="Select or type word type" />
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
          class_id: subjectId,
          topic_id: topicId,
          question_type: wordType || null,
          question_text: questionText,
          accepted_answers: answersArray,
          status
        });
        showToast('Question updated.', 'success');
      } else {
        await createCentralQuestion({
          class_id: subjectId,
          topic_id: topicId,
          question_type: wordType || null,
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
// ============================================================
// 4. ASSIGNMENTS MANAGEMENT (Assessment Instances)
// ============================================================
export async function renderAssignments(area) {
  showLoading();
  try {
    const [instances, definitions, batches, classInsts, classes] = await Promise.all([
      fetchChallengeInstances(),
      fetchChallengeDefinitions(),
      adminFetchAll('batches'),
      fetchClassInstances(),
      fetchClasses()
    ]);
    hideLoading();

    area.innerHTML = `
      <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title text-gradient">Assessment Assignments</h2>
          <p class="section-subtitle">Control assessment access by Batch (Class Instance)</p>
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
            ${renderAssignmentRows(instances)}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-assign-assessment').onclick = () => {
      openAssignmentModal({ definitions, batches, classInsts, classes }, async () => {
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
            await adminSoftDelete('challenge_instances', id);
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
    const targetName = a.class_instances?.batches?.name 
      ? `Ã°Å¸â€˜Â¥ Batch: ${escapeHtml(a.class_instances.batches.name)} (${escapeHtml(a.class_instances.classes?.name || 'Class')})`
      : `Ã°Å¸â€˜Â¥ Unknown Target`;

    const windowText = (a.availability_start || a.availability_end)
      ? `${a.availability_start ? new Date(a.availability_start).toLocaleDateString() : 'Now'} Ã¢â€ â€™ ${a.availability_end ? new Date(a.availability_end).toLocaleDateString() : 'Forever'}`
      : '<span class="text-success">Always Open</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(a.title_override || a.challenge_definitions?.title || 'Assessment')}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(a.challenge_definitions?.challenge_type || 'EVALUATION')}</span></td>
        <td>${targetName}</td>
        <td><small>${windowText}</small></td>
        <td><span class="badge badge-success">${escapeHtml(a.status || 'DRAFT')}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-ghost btn-sm text-danger btn-revoke-assignment" data-id="${a.id}" title="Revoke Assignment">Ã°Å¸â€”â€˜Ã¯Â¸Â Revoke</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAssignmentModal({ definitions, batches, classInsts, classes }, onSaved) {
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
            ${definitions.map(a => `<option value="${a.id}" data-class="${a.class_id}">${escapeHtml(a.title)} (${escapeHtml(a.challenge_type)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Assignment Mode *</label>
          <select class="form-control" id="asgn-mode">
            <option value="BATCH">Batch (Class Instance)</option>
          </select>
        </div>
        <div class="form-group mb-3" id="asgn-batch-group">
          <label class="form-label">Select Batch *</label>
          <select class="form-control" id="asgn-batch-id">
            ${batches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
          </select>
          <small class="text-muted text-xs">Note: A Class Instance must exist for the selected Batch and the Assessment's Class.</small>
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

  modal.querySelector('#save-asgn-btn').onclick = async () => {
    const asmSelect = modal.querySelector('#asgn-assessment-id');
    const definitionId = asmSelect.value;
    const classId = asmSelect.options[asmSelect.selectedIndex]?.dataset.class;
    const batchId = modal.querySelector('#asgn-batch-id').value;
    const startVal = modal.querySelector('#asgn-start').value;
    const endVal = modal.querySelector('#asgn-end').value;

    const ci = classInsts.find(c => c.batch_id === batchId && c.class_id === classId);
    if (!ci) {
      showToast('No Class Instance found for this Batch and the Assessment\'s Class. Please assign this batch to the class first.', 'error');
      return;
    }

    showLoading();
    try {
      await createChallengeInstance({
        class_instance_id: ci.id,
        challenge_definition_id: definitionId,
        availability_start: startVal ? new Date(startVal).toISOString() : null,
        availability_end: endVal ? new Date(endVal).toISOString() : null,
        status: 'READY'
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
      fetchGlobalClasses(),
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
          <button class="btn btn-secondary btn-sm" id="btn-download-central-tmpl">Ã°Å¸â€œÂ¥ Download Excel Template</button>
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
          <div style="font-size:2.8rem;margin-bottom:0.75rem;">Ã°Å¸â€œÂ</div>
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
            <button class="btn btn-success btn-sm" id="btn-confirm-commit-import">Ã°Å¸Å¡â‚¬ Confirm &amp; Commit Import</button>
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
            Ã¢Å¡Â Ã¯Â¸Â <strong>${summary.possibleDuplicates} Possible Duplicate(s) Found:</strong> High similarity detected. Review the comparisons below and choose whether to <em>Use Existing</em> or <em>Create New</em>.
          </div>
        `;
      }
      if (summary.invalidWordTypes > 0) {
        alertHtml += `
          <div class="alert alert-info p-3 mb-3 text-xs" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);border-radius:8px;">
            Ã°Å¸â€™Â¡ <strong>${summary.invalidWordTypes} Word Type Suggestion(s):</strong> Non-standard word types detected. Suggested standard types have been applied, or you can register them as custom types.
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
            statusBadge += `<br/><span class="badge badge-warning mt-1" title="Existing: ${escapeHtml(r.existingAnswers.join(' / '))} -> New: ${escapeHtml(r.accepted_answers.join(' / '))}">Ã¢Å¡Â¡ Answer Update</span>`;
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

        let wtDisplay = escapeHtml(r.wordType || 'Ã¯Â¿Â½');
        if (r.wordTypeWarning) {
          wtDisplay += `<div class="text-danger text-xs mt-1" title="${escapeHtml(r.wordTypeWarning)}">Ã¢Å¡Â Ã¯Â¸Â ${escapeHtml(r.wordTypeWarning)}</div>`;
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
Ã¢â‚¬Â¢ ${currentParsedResult.summary.newQuestions} new questions will be added
Ã¢â‚¬Â¢ ${currentParsedResult.summary.answerChanges} answer keys will be updated
Existing historical attempt records will NOT be modified.`;

      if (!confirm(confirmMsg)) return;

      showLoading('Committing import to Central Question Bank...');
      try {
        const sb = await (await import('../supabase.js')).getSupabase();

        // 1. Resolve & Auto-create Topics
        const topicMap = new Map();
        existingTopics.filter(t => t.class_id === targetSubjectId).forEach(t => {
          topicMap.set(t.name.toLowerCase().trim(), t.id);
        });

        const uniqueTopicNames = Array.from(new Set(rows.map(r => r.topicName.trim()).filter(Boolean)));
        for (const tName of uniqueTopicNames) {
          const key = tName.toLowerCase();
          if (!topicMap.has(key)) {
            const { data: newT, error: tErr } = await sb.from('topics')
              .insert({
                class_id: targetSubjectId,
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
            await sb.from('question_types').insert({ name: cwt, is_system: false, is_active: true });
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
              class_id: targetSubjectId,
              topic_id: topicId,
              question_type: r.wordType || null,
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
                .eq('class_id', targetSubjectId)
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
                  metadata: { topic: q.topic_id || 'General', question_type: q.question_type || '' }
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


function toLevelLetter(num) {
  const n = parseInt(num, 10);
  if (isNaN(n) || n < 1) return num ? String(num) : 'A';
  let result = '';
  let curr = n;
  while (curr > 0) {
    let remainder = (curr - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    curr = Math.floor((curr - 1) / 26);
  }
  return result;
}

    export async function renderResults(area) {
      const [rawData, allPrograms, allClasses, allBatches] = await Promise.all([
        adminFetchAll('challenge_attempts', '*, students(name, gender, batch_id, batches(name), program_id, programs(name, institution_id, institutions(name))), challenge_instances(challenge_definitions(id, title, challenge_type, prerequisite_assessment_id, prerequisite_min_score)), challenge_attempt_answers(id, evaluation_result, score)'),
        adminFetchAll('institutions'),
        adminFetchAll('programs'),
        adminFetchAll('batches')
      ]);

      // Precalculate student best scores per assessment for prerequisite checking and highest score logic
      const studentBestScoreMap = new Map();
      rawData.forEach(r => {
        if (!['submitted', 'auto_submitted'].includes(r.status)) return;
        const defId = r.challenge_instances?.challenge_definitions?.id;
        if (!r.student_id || !defId) return;
        const key = `${r.student_id}_${defId}`;
        const pct = parseFloat(r.percentage || 0);
        const cur = studentBestScoreMap.get(key) ?? -1;
        if (pct > cur) {
          studentBestScoreMap.set(key, pct);
        }
      });

      const submittedOnly = rawData.filter(r => ['submitted', 'auto_submitted'].includes(r.status));
      // Default: sort alphabetically by Student Name (A-Z)
      let allData = [...submittedOnly].sort((a, b) => (a.students?.name || '').localeCompare(b.students?.name || ''));
      if (window._filterExamResults) {
        allData = allData.filter(r => r.challenge_instances?.challenge_definitions?.id === window._filterExamResults);
      }

      let selectedProg = '';
      let selectedClass = '';
      let selectedBatch = '';
      let searchQuery = '';
      let currentDeduplicatedResults = [];

      area.innerHTML = `
        <div class="section-header d-flex justify-between align-center flex-wrap gap-2">
          <div>
            <h2 class="section-title">Assessment Results <span class="count-chip" id="res-count-chip">${allData.length} Total</span></h2>
            <p class="section-subtitle">Student assessment attempt submissions displaying highest score records and prerequisite status</p>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" id="export-gradebook-btn" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
              &#128202; Export Gradebook (.xlsx)
            </button>
          </div>
        </div>

        ${window._filterExamResults ? `
          <div class="mb-3 p-2 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;font-size:0.85rem;">
            <span>&#9889; Filtered Results for Selected Assessment (${allData.length} attempts)</span>
            <button class="btn btn-ghost btn-xs" id="clear-exam-results-btn" style="text-decoration:underline;color:#93c5fd;">Show All Assessment Results</button>
          </div>
        ` : ''}

        <!-- Filter Bar -->
        <div class="filter-bar mb-4 p-3 rounded d-flex gap-3 align-center flex-wrap" style="background:var(--clr-surface-2);border:1px solid var(--clr-border);">
          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Program</label>
            <select id="res-filter-prog" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">&mdash; All Institutions &mdash;</option>
              ${(allPrograms || []).filter(p => !p.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Class</label>
            <select id="res-filter-class" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">&mdash; All Programs &mdash;</option>
              ${(allClasses || []).filter(c => !c.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => `<option value="${c.id}" data-prog="${c.institution_id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Batch (Group)</label>
            <select id="res-filter-batch" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">&mdash; All Batches &mdash;</option>
              ${(allBatches || []).filter(b => !b.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(b => `<option value="${b.id}" data-class="${b.program_id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          </div>

          <div style="flex:1;min-width:220px;">
            <label class="text-xs text-muted d-block mb-1">Search Student / Assessment</label>
            <input type="text" id="res-filter-search" class="form-control" placeholder="Type student name or assessment title&hellip;" style="padding:6px 10px;font-size:0.85rem;">
          </div>

          <div class="d-flex align-end" style="padding-top:18px;">
            <button class="btn btn-ghost btn-sm" id="res-btn-reset" title="Reset all filters">&#10006; Reset</button>
          </div>
        </div>

        <div id="results-grid-container" class="mt-4"></div>
      `;

      const progSelect  = document.getElementById('res-filter-prog');
      const classSelect = document.getElementById('res-filter-class');
      const batchSelect = document.getElementById('res-filter-batch');
      const searchInput = document.getElementById('res-filter-search');
      const countChip   = document.getElementById('res-count-chip');

      const updateClassOptions = () => {
        const pId = progSelect.value;
        Array.from(classSelect.options).forEach((opt, idx) => {
          if (idx === 0) return;
          const match = !pId || opt.getAttribute('data-prog') === pId;
          opt.style.display = match ? '' : 'none';
        });
        if (pId && classSelect.selectedOptions[0]?.style.display === 'none') {
          classSelect.value = '';
        }
        updateBatchOptions();
      };

      const updateBatchOptions = () => {
        const cId = classSelect.value;
        Array.from(batchSelect.options).forEach((opt, idx) => {
          if (idx === 0) return;
          const match = !cId || opt.getAttribute('data-class') === cId;
          opt.style.display = match ? '' : 'none';
        });
        if (cId && batchSelect.selectedOptions[0]?.style.display === 'none') {
          batchSelect.value = '';
        }
      };

      const renderTable = () => {
        const pId = progSelect.value;
        const cId = classSelect.value;
        const bId = batchSelect.value;
        const q = searchInput.value.toLowerCase().trim();

        const filtered = allData.filter(r => {
          const studentProgId = r.students?.programs?.institutions?.id || r.students?.programs?.institution_id;
          if (pId && studentProgId !== pId) return false;
          if (cId && r.students?.program_id !== cId) return false;
          if (bId && r.students?.batch_id !== bId) return false;
          if (q) {
            const sName = (r.students?.name || '').toLowerCase();
            const eTitle = (r.challenge_instances?.challenge_definitions?.title || '').toLowerCase();
            const eType = (r.challenge_instances?.challenge_definitions?.challenge_type || '').toLowerCase();
            if (!sName.includes(q) && !eTitle.includes(q) && !eType.includes(q)) return false;
          }
          return true;
        });

        // Deduplicate by Student + Assessment, keeping highest score only
        const mergedResults = new Map();
        filtered.forEach(r => {
          const key = `${r.student_id}_${r.challenge_instances?.challenge_definitions?.id}`;
          const existing = mergedResults.get(key);
          if (!existing) {
            mergedResults.set(key, r);
          } else {
            const existingScore = parseFloat(existing.percentage || 0);
            const currentScore = parseFloat(r.percentage || 0);
            // If current score is higher, or if same score but newer submission, take the new one
            if (currentScore > existingScore || (currentScore === existingScore && new Date(r.submitted_at) > new Date(existing.submitted_at))) {
              mergedResults.set(key, r);
            }
          }
        });
        const deduplicated = Array.from(mergedResults.values());
        currentDeduplicatedResults = deduplicated;

        countChip.textContent = `${deduplicated.length} Records (Highest Score)`;

        document.getElementById('results-grid-container').innerHTML = '';
        if (!deduplicated.length) {
          document.getElementById('results-grid-container').innerHTML = '<div class="text-center text-muted p-5">No submitted results match the selected filters.</div>';
          return;
        }

        new window.DataGrid({
          container: 'results-grid-container',
          data: deduplicated,
          pageSize: 20,
          searchKeys: ['students.name', 'challenge_instances.challenge_definitions.title', 'challenge_instances.challenge_definitions.challenge_type', 'students.programs.name', 'students.programs.institutions.name'],
          columns: [
            { key: 'students.name', label: 'Student Name', sortable: true, render: (v, r) => `<span class="fw-600" style="color:var(--clr-text-1);">${formatStudentName(r.students?.name, r.students?.gender) || '&mdash;'}</span>` },
            { key: 'students.programs.institutions.name', label: 'Program', sortable: true, render: (v, r) => `<span class="text-muted text-sm">${escapeHtml(r.students?.programs?.institutions?.name || '&mdash;')}</span>` },
            { key: 'students.programs.name', label: 'Class', sortable: true, render: (v, r) => `<span class="text-muted text-sm">${escapeHtml(r.students?.programs?.name || '&mdash;')}</span>` },
            { key: 'students.batches.name', label: 'Batch', sortable: true, render: (v, r) => `<span class="badge ${r.students?.batches?.name ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">${escapeHtml(r.students?.batches?.name || 'Unassigned')}</span>` },
            { key: 'challenge_instances.challenge_definitions.title', label: 'Assessment Title', sortable: true, render: (v, r) => {
              const def = r.challenge_instances?.challenge_definitions || {};
              return `<span class="text-sm fw-600">${def.challenge_type ? escapeHtml(def.challenge_type) + ' &mdash; ' : ''}${escapeHtml(def.title || '&mdash;')}</span>`;
            }},
            { key: 'percentage', label: 'Score', sortable: true, render: (v, r) => `
              <div class="text-center fw-700 text-grade-${r.grade || 'F'}" style="display:flex;align-items:center;justify-content:center;gap:4px;">
                <span>${parseFloat(r.percentage || 0).toFixed(1)}%</span>
                <span class="badge badge-success text-xs" style="font-size:0.65rem;padding:1px 5px;" title="Highest score recorded across attempts">Highest</span>
              </div>
            ` },
            { key: 'grade', label: 'Grade', sortable: true, render: (v, r) => `<div class="text-center"><span class="grade-badge grade-${r.grade || 'F'}" style="width:30px;height:30px;font-size:0.85rem;">${r.grade || '&mdash;'}</span></div>` },
            { key: 'prereq', label: 'Prerequisite', sortable: false, render: (v, r) => {
              const def = r.challenge_instances?.challenge_definitions || {};
              const prereqId = def.prerequisite_assessment_id;
              const minScore = Number(def.prerequisite_min_score) || 60;
              if (!prereqId) return '<div class="text-center"><span class="text-muted text-xs">&mdash;</span></div>';
              const studentPrereqBest = studentBestScoreMap.get(`${r.student_id}_${prereqId}`);
              if (studentPrereqBest != null && studentPrereqBest >= minScore) {
                return `<div class="text-center"><span class="badge badge-success text-xs" style="font-size:0.75rem;padding:2px 6px;" title="Prerequisite completed (${studentPrereqBest.toFixed(1)}% &ge; ${minScore}%)">Unlocked &#9989;</span></div>`;
              }
              return `<div class="text-center"><span class="badge badge-danger" style="font-size:0.75rem;padding:2px 7px;font-weight:600;display:inline-flex;align-items:center;gap:3px;" title="Prerequisite requirement not completed (Required &ge; ${minScore}%)">Locked &#128274;</span></div>`;
            }},
            { key: 'correct', label: '&#9989; Correct', sortable: false, render: (v, r) => {
                const answers = r.challenge_attempt_answers || [];
                let attCorrect = 0;
                answers.forEach(a => {
                  const res = (a.evaluation_result || '').toLowerCase();
                  const sc  = parseFloat(a.score || 0);
                  if (res === 'correct' || sc >= 1) attCorrect++;
                });
                return answers.length > 0 ? `<div class="text-center"><span class="badge badge-success" style="font-size:0.75rem;">${attCorrect}</span></div>` : '<div class="text-center"><span class="text-muted text-xs">&mdash;</span></div>';
              }
            },
            { key: 'half', label: '&#9888;&#65039; Half', sortable: false, render: (v, r) => {
                const answers = r.challenge_attempt_answers || [];
                let attMinor = 0;
                answers.forEach(a => {
                  const res = (a.evaluation_result || '').toLowerCase();
                  const sc  = parseFloat(a.score || 0);
                  if (res.includes('minor') || (sc > 0 && sc < 1)) attMinor++;
                });
                return answers.length > 0 ? `<div class="text-center"><span class="badge badge-warning" style="font-size:0.75rem;">${attMinor}</span></div>` : '<div class="text-center"><span class="text-muted text-xs">&mdash;</span></div>';
              }
            },
            { key: 'wrong', label: '&#10060; Incorrect', sortable: false, render: (v, r) => {
                const answers = r.challenge_attempt_answers || [];
                let attWrong = 0;
                answers.forEach(a => {
                  const res = (a.evaluation_result || '').toLowerCase();
                  const sc  = parseFloat(a.score || 0);
                  if (res !== 'correct' && sc < 1 && !res.includes('minor') && !(sc > 0 && sc < 1)) attWrong++;
                });
                return answers.length > 0 ? `<div class="text-center"><span class="badge badge-danger" style="font-size:0.75rem;">${attWrong}</span></div>` : '<div class="text-center"><span class="text-muted text-xs">&mdash;</span></div>';
              }
            },
            { key: 'submitted_at', label: 'Submitted At', sortable: true, render: (v, r) => `<div class="text-center text-muted text-xs">${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '&mdash;'}</div>` },
            { key: 'actions', label: 'Profile', sortable: false, render: (v, r) => `<div class="text-center"><button class="btn btn-ghost btn-sm results-view-profile-btn" data-sid="${r.student_id}" style="font-size:0.75rem; padding:3px 10px; display:inline-flex; align-items:center; gap:4px;" title="View full student profile">&#128100; Profile</button></div>` }
          ]
        });
      };

      progSelect.addEventListener('change', () => { updateClassOptions(); renderTable(); });
      classSelect.addEventListener('change', () => { updateBatchOptions(); renderTable(); });
      batchSelect.addEventListener('change', renderTable);
      searchInput.addEventListener('input', renderTable);

      document.getElementById('res-btn-reset')?.addEventListener('click', () => {
        window._filterExamResults = null;
        progSelect.value = '';
        classSelect.value = '';
        batchSelect.value = '';
        searchInput.value = '';
        updateClassOptions();
        loadSection('results');
      });

      document.getElementById('clear-exam-results-btn')?.addEventListener('click', () => {
        window._filterExamResults = null;
        loadSection('results');
      });

      renderTable();

      // Export Gradebook (.xlsx) handler
      document.getElementById('export-gradebook-btn')?.addEventListener('click', () => {
        if (typeof XLSX === 'undefined') {
          showToast('SheetJS library (XLSX) is not loaded.', 'error');
          return;
        }
        const rowsToExport = currentDeduplicatedResults && currentDeduplicatedResults.length > 0 ? currentDeduplicatedResults : allData;
        if (!rowsToExport.length) {
          showToast('No results to export.', 'warning');
          return;
        }
        const exportData = rowsToExport.map(r => {
          const def = r.challenge_instances?.challenge_definitions || {};
          return {
            'Student Name': r.students?.name || 'â€”',
            'Gender': r.students?.gender ? (r.students.gender === 'female' ? 'Female' : 'Male') : 'â€”',
            'Institution': r.students?.programs?.institutions?.name || 'â€”',
            'Program': r.students?.programs?.name || 'â€”',
            'Batch': r.students?.batches?.name || 'â€”',
            'Assessment Title': def.title || 'â€”',
            'Assessment Type': def.challenge_type || 'â€”',
            'Score': r.score != null ? r.score : 'â€”',
            'Percentage (%)': r.percentage != null ? `${r.percentage}%` : 'â€”',
            'Grade': r.grade || (r.percentage != null ? getGrade(r.percentage) : 'â€”'),
            'Submitted At': r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'â€”',
            'Status': r.status || 'â€”'
          };
        });

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gradebook');
        const filename = `Gradebook_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast(`Exported ${exportData.length} records to ${filename}`, 'success');
      });

      document.getElementById('results-grid-container').addEventListener('click', e => {
        const btn = e.target.closest('.results-view-profile-btn');
        if (!btn) return;
        const sid = btn.getAttribute('data-sid');
        if (!sid) return;
        
        // Collect all currently visible student IDs for batch nav
        const allSids = currentDeduplicatedResults.map(r => r.student_id);
        openStudentProfile(sid, allSids);
      });
    }

    // ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ STUDENT PROGRESS (Level Progression with Batch Grouping) ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬

    export async function renderProgressView(area) {
      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Student Progress <span class="count-chip" id="prog-count-chip">Loading...</span></h2>
            <p class="section-subtitle">Assessment progression and completion status filterable by Program, Class, and Batch</p>
          </div>
        </div>
        <div class="p-5 text-center text-muted"><span class="loader"></span> Loading progression data...</div>
      `;

      try {
        const [allStudents, allPrograms, allClasses, allBatches, allAssignments, allAssessments, allAttempts] = await Promise.all([
          adminFetchAll('students', '*, batches(name), programs(name, institution_id, institutions(name))'),
          adminFetchAll('institutions'),
          adminFetchAll('programs'),
          adminFetchAll('batches'),
          adminFetchAll('challenge_instances', 'student_id, batch_id, challenge_definition_id'),
          adminFetchAll('challenge_definitions', 'id, title, level_id, levels(name, level_number)'),
          adminFetchAll('challenge_attempts', '*, students(name, gender, batch_id, batches(name), program_id, programs(name, institution_id, institutions(name))), challenge_instances(challenge_definitions(title, challenge_type)), challenge_attempt_answers(id, evaluation_result, score)')
        ]);

        const allData = [];

        // Map V1 Data
        const assessmentsMap = new Map((allAssessments || []).map(a => [a.id, a]));
        
        (allStudents || []).filter(s => !s.deleted_at).forEach(student => {
          const sAssignments = (allAssignments || []).filter(a => 
            a.student_id === student.id || (a.batch_id && a.batch_id === student.batch_id)
          );
          
          // To avoid duplicates if both student and batch assigned
          const assignedAssesIds = new Set(sAssignments.map(a => a.challenge_definition_id));

          assignedAssesIds.forEach(assessmentId => {
            const assessment = assessmentsMap.get(assessmentId);
            if (!assessment) return;

            const studentAttempts = (allAttempts || []).filter(att => att.student_id === student.id && att.challenge_definition_id === assessmentId);
            const isCompleted = studentAttempts.some(att => att.status === 'SUBMITTED' || att.status === 'AUTO_SUBMITTED');
            const isInProgress = studentAttempts.some(att => att.status === 'IN_PROGRESS');

            allData.push({
              student: student,
              assessmentTitle: assessment.title,
              levelNumber: assessment.levels?.level_number || 1,
              levelName: assessment.levels?.name || 'Unknown',
              is_completed: isCompleted,
              is_in_progress: isInProgress
            });
          });
        });

        // Default: sort alphabetically by Student Name (A-Z)
        allData.sort((a, b) => (a.student.name || '').localeCompare(b.student.name || ''));

        area.innerHTML = `
          <div class="section-header">
            <div>
              <h2 class="section-title">Student Progress <span class="count-chip" id="prog-count-chip">${allData.length} Records</span></h2>
              <p class="section-subtitle">Assessment progression and completion status filterable by Program, Class, and Batch</p>
            </div>
          </div>

          <div class="d-flex align-center gap-3 flex-wrap p-3 mb-4 rounded" style="background:var(--clr-surface-2); border:1px solid var(--clr-border);">
            <div style="min-width:180px;">
              <label class="text-xs text-muted d-block mb-1">Filter Class</label>
              <select id="prog-filter-class" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
                <option value="">&mdash; All Programs &mdash;</option>
                ${(allClasses || []).filter(c => !c.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => `<option value="${c.id}" data-prog="${c.institution_id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>

            <div style="min-width:180px;">
              <label class="text-xs text-muted d-block mb-1">Filter Batch (Group)</label>
              <select id="prog-filter-batch" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
                <option value="">&mdash; All Batches &mdash;</option>
                ${(allBatches || []).filter(b => !b.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(b => `<option value="${b.id}" data-class="${b.program_id}">${escapeHtml(b.name)}</option>`).join('')}
              </select>
            </div>

            <div style="flex:1;min-width:220px;">
              <label class="text-xs text-muted d-block mb-1">Search Student / Assessment</label>
              <input type="text" id="prog-filter-search" class="form-control" placeholder="Type student name or assessment..." style="padding:6px 10px;font-size:0.85rem;">
            </div>

            <div class="d-flex align-end" style="padding-top:18px;">
              <button class="btn btn-ghost btn-sm" id="prog-btn-reset" title="Reset all filters">&#10005; Reset</button>
            </div>
          </div>

          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th class="text-left">Student Name</th>
                  <th class="text-left">Program</th>
                  <th class="text-left">Class</th>
                  <th class="text-left">Batch</th>
                  <th class="text-left">Assessment</th>
                  <th class="text-center">Level</th>
                  <th class="text-center">Status</th>
                  <th class="text-center">Completion</th>
                </tr>
              </thead>
              <tbody id="tbl-progress-body"></tbody>
            </table>
          </div>
        `;

        const progSelect  = document.getElementById('prog-filter-prog');
        const classSelect = document.getElementById('prog-filter-class');
        const batchSelect = document.getElementById('prog-filter-batch');
        const searchInput = document.getElementById('prog-filter-search');
        const tbody       = document.getElementById('tbl-progress-body');
        const countChip   = document.getElementById('prog-count-chip');

        const updateClassOptions = () => {
          const pId = progSelect.value;
          Array.from(classSelect.options).forEach((opt, idx) => {
            if (idx === 0) return;
            const match = !pId || opt.getAttribute('data-prog') === pId;
            opt.style.display = match ? '' : 'none';
          });
          if (pId && classSelect.selectedOptions[0]?.style.display === 'none') {
            classSelect.value = '';
          }
          updateBatchOptions();
        };

        const updateBatchOptions = () => {
          const cId = classSelect.value;
          Array.from(batchSelect.options).forEach((opt, idx) => {
            if (idx === 0) return;
            const match = !cId || opt.getAttribute('data-class') === cId;
            opt.style.display = match ? '' : 'none';
          });
          if (cId && batchSelect.selectedOptions[0]?.style.display === 'none') {
            batchSelect.value = '';
          }
        };

        const renderTable = () => {
          const pId = progSelect.value;
          const cId = classSelect.value;
          const bId = batchSelect.value;
          const q = searchInput.value.toLowerCase().trim();

          const filtered = allData.filter(r => {
            const studentProgId = r.student?.programs?.institutions?.id || r.student?.programs?.institution_id;
            if (pId && studentProgId !== pId) return false;
            if (cId && r.student?.program_id !== cId) return false;
            if (bId && r.student?.batch_id !== bId) return false;
            if (q) {
              const sName = (r.student?.name || '').toLowerCase();
              const sSubj = (r.assessmentTitle || '').toLowerCase();
              if (!sName.includes(q) && !sSubj.includes(q)) return false;
            }
            return true;
          });

          countChip.textContent = `${filtered.length} of ${allData.length}`;

          if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-5">No progression records match the selected filters.</td></tr>';
            return;
          }

          tbody.innerHTML = filtered.map(r => `
            <tr>
              <td class="fw-600" style="color:var(--clr-text-1);">${formatStudentName(r.student?.name, r.student?.gender) || 'Ã¢â‚¬â€'}</td>
              <td class="text-muted text-sm">${escapeHtml(r.student?.programs?.institutions?.name || 'Ã¢â‚¬â€')}</td>
              <td class="text-muted text-sm">${escapeHtml(r.student?.programs?.name || 'Ã¢â‚¬â€')}</td>
              <td><span class="badge ${r.student?.batches?.name ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">${escapeHtml(r.student?.batches?.name || 'Unassigned')}</span></td>
              <td class="fw-600 text-sm">${escapeHtml(r.assessmentTitle || 'Ã¢â‚¬â€')}</td>
              <td class="text-center"><span class="badge badge-primary">Level ${toLevelLetter(r.levelNumber)} ${escapeHtml(r.levelName || '')}</span></td>
              <td class="text-center">
                <span class="badge ${r.is_completed ? 'badge-success' : r.is_in_progress ? 'badge-warning' : 'badge-neutral'}">
                  ${r.is_completed ? 'Ã¢Å“â€Ã¯Â¸Â Completed' : r.is_in_progress ? 'Ã¢â€“Â¶Ã¯Â¸Â In Progress' : 'Ã°Å¸â€â€™ Not Started'}
                </span>
              </td>
              <td class="text-center">
                <div class="progress-pill">
                  <div class="progress-pill-fill" style="width:${r.is_completed ? 100 : r.is_in_progress ? 50 : 0}%;"></div>
                </div>
              </td>
            </tr>
          `).join('');
        };

        progSelect.addEventListener('change', () => { updateClassOptions(); renderTable(); });
        classSelect.addEventListener('change', () => { updateBatchOptions(); renderTable(); });
        batchSelect.addEventListener('change', renderTable);
        searchInput.addEventListener('input', renderTable);
        document.getElementById('prog-btn-reset')?.addEventListener('click', () => {
          progSelect.value = '';
          classSelect.value = '';
          batchSelect.value = '';
          searchInput.value = '';
          updateClassOptions();
          renderTable();
        });

        renderTable();

      } catch (err) {
        console.error('Failed to load progress', err);
        area.innerHTML = `<div class="p-5 text-center text-error">Failed to load progression data: ${err.message}</div>`;
      }
}

window.viewClassInstanceRoster = async function(classInstanceId) {
  const modal = document.getElementById('roster-modal');
  const tbody = document.getElementById('roster-modal-tbody');
  const select = document.getElementById('roster-add-student-select');
  const addBtn = document.getElementById('roster-add-student-btn');
  
  modal.classList.remove('hidden');
  tbody.innerHTML = '<tr><td colspan="2" class="text-center">Loading roster...</td></tr>';
  
  try {
    const roster = await fetchClassInstanceRoster(classInstanceId);
    if (roster.length === 0) {
      tbody.innerHTML = '<tr><td colspan="2" class="text-center text-muted">No students enrolled yet.</td></tr>';
    } else {
      tbody.innerHTML = roster.map(s => `
        <tr style="border-bottom: 1px solid var(--clr-border);">
          <td style="padding:8px 0;">${escapeHtml(s.name)}</td>
          <td class="text-right" style="padding:8px 0;">
            <span class="badge ${s.enrollment_type === 'auto' ? 'badge-primary' : 'badge-warning'}">${s.enrollment_type === 'auto' ? 'Auto-Enrolled' : 'Manual / Dropped'}</span>
          </td>
        </tr>
      `).join('');
    }
    
    // Populate dropdown with all students (excluding those already in the roster)
    const allStudents = window._adminStore?.students || [];
    const rosterIds = new Set(roster.map(s => s.id));
    select.innerHTML = '<option value="">Select student to manually enroll...</option>' + 
      allStudents.filter(s => !rosterIds.has(s.id)).map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
      
    addBtn.onclick = async () => {
      const studentId = select.value;
      if (!studentId) return;
      addBtn.disabled = true;
      addBtn.textContent = 'Adding...';
      try {
        await addAdditionalMember(classInstanceId, studentId);
        await window.viewClassInstanceRoster(classInstanceId); // Refresh modal
      } catch (e) {
        alert('Failed to add member: ' + e.message);
      } finally {
        addBtn.disabled = false;
        addBtn.textContent = 'Add to Roster';
      }
    };
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="2" class="text-center text-danger">Error: ${err.message}</td></tr>`;
  }
};
    // &mdash;&mdash; AUDIT LOG &mdash;&mdash;

    export async function renderRecalibrator(area) {
      showLoading('Loading exams for recalibration&hellip;');
      const allExams = await adminFetchAll('exams');
      hideLoading();
      const activeExams = allExams.filter(e => !e.deleted_at).sort((a, b) => (a.exam_title || '').localeCompare(b.exam_title || ''));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title text-gradient" style="font-size:1.6rem;">&#9889; Exam Recalibrator</h2>
            <p class="section-subtitle">
              Recalculate historical submitted student attempts after updating questions, adding multiple correct answers (separated by <code>;</code> or <code>|</code>), or enabling hyphen tolerance.
            </p>
          </div>
        </div>

        <div class="glass-card p-6 mb-6">
          <div class="d-flex align-center gap-4 flex-wrap">
            <div style="flex: 1; min-width: 280px;">
              <label class="form-label">Select Target Exam</label>
              <select class="form-control" id="recalibrator-exam-select">
                <option value="">&mdash; Choose an Exam to Recalibrate &mdash;</option>
                ${activeExams.map(e => `<option value="${e.id}">[${escapeHtml(e.exam_type || 'Exam')}] ${escapeHtml(e.exam_title || e.display_name || e.id)}</option>`).join('')}
              </select>
            </div>
            <div style="display: flex; gap: 12px; align-items: flex-end; padding-top: 20px;">
              <button class="btn btn-primary" id="btn-preview-recal" disabled>&#128269; Preview Recalibration</button>
              <button class="btn btn-success" id="btn-apply-recal" disabled style="background:linear-gradient(135deg,#10b981,#059669);font-weight:700;">&#9889; Apply Recalibration</button>
            </div>
          </div>
        </div>

        <!-- Metrics Overview Panel -->
        <div id="recal-metrics-panel" class="hidden mb-6">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 16px;">
            <div class="glass-card p-4 text-center">
              <div class="text-xs text-muted mb-1">Total Questions</div>
              <div class="fw-700" style="font-size:1.6rem;" id="recal-metric-questions">0</div>
            </div>
            <div class="glass-card p-4 text-center">
              <div class="text-xs text-muted mb-1">Submitted Attempts</div>
              <div class="fw-700" style="font-size:1.6rem;" id="recal-metric-attempts">0</div>
            </div>
            <div class="glass-card p-4 text-center" style="border-left: 4px solid var(--clr-primary, #6366f1);">
              <div class="text-xs text-muted mb-1">Affected Attempts</div>
              <div class="fw-700" style="font-size:1.6rem; color:var(--clr-primary, #a78bfa);" id="recal-metric-affected">0</div>
            </div>
            <div class="glass-card p-4 text-center" style="border-left: 4px solid #10b981;">
              <div class="text-xs text-muted mb-1">Status: FAIL &rarr; PASS</div>
              <div class="fw-700" style="font-size:1.6rem; color: #10b981;" id="recal-metric-fail-pass">0</div>
            </div>
            <div class="glass-card p-4 text-center" style="border-left: 4px solid #f43f5e;">
              <div class="text-xs text-muted mb-1">Status: PASS &rarr; FAIL</div>
              <div class="fw-700" style="font-size:1.6rem; color: #f43f5e;" id="recal-metric-pass-fail">0</div>
            </div>
            <div class="glass-card p-4 text-center" style="border-left: 4px solid #38bdf8;">
              <div class="text-xs text-muted mb-1">Score Increases</div>
              <div class="fw-700" style="font-size:1.6rem; color: #38bdf8;" id="recal-metric-increases">0</div>
            </div>
          </div>
        </div>

        <!-- Preview Results Table -->
        <div id="recal-results-wrap" class="hidden">
          <div class="glass-card p-6">
            <div class="d-flex align-center justify-between flex-wrap gap-3 mb-4">
              <div>
                <h3 class="fw-700 text-lg">Recalibration Preview</h3>
                <p class="text-sm text-muted">Review exactly what will change for each student before applying.</p>
              </div>
              <div class="d-flex align-center gap-2">
                <label class="text-xs text-muted">Filter:</label>
                <select class="form-control" id="recal-filter-view" style="width: auto; padding: 4px 10px; font-size: 0.85rem;">
                  <option value="affected">Affected Students Only</option>
                  <option value="all">All Students</option>
                </select>
              </div>
            </div>

            <div class="table-wrap">
              <table style="width:100%;">
                <thead>
                  <tr>
                    <th class="text-left">Student Name</th>
                    <th class="text-left">Class</th>
                    <th class="text-center">Old Score</th>
                    <th class="text-center">New Score</th>
                    <th class="text-center">Old %</th>
                    <th class="text-center">New %</th>
                    <th class="text-center">Old Grade</th>
                    <th class="text-center">New Grade</th>
                    <th class="text-center">Status Change</th>
                    <th class="text-center">Answers Changed</th>
                  </tr>
                </thead>
                <tbody id="recal-table-body"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Confirmation Modal for Recalibration -->
        <div class="modal-backdrop hidden" id="recal-confirm-modal" role="dialog" aria-modal="true">
          <div class="modal-box" style="max-width: 480px; text-align: center;">
            <div style="font-size: 2.8rem; margin-bottom: 1rem;">&#9889;</div>
            <h3 class="mb-2">Confirm Exam Recalibration?</h3>
            <p class="text-muted text-sm mb-4" id="recal-modal-desc">
              This will safely update historical submitted scores, percentages, grades, and student progression using the authoritative grading engine.
            </p>
            <div class="p-4 rounded text-left text-xs mb-6" style="background: rgba(255,255,255,0.04); border: 1px solid var(--clr-border);">
              <div class="mb-1">&bull; <b>Affected Attempts:</b> <span id="modal-affected-count" class="fw-700 text-primary">0</span></div>
              <div class="mb-1">&bull; <b>Status Transitions:</b> <span id="modal-status-changes" class="fw-700">0</span></div>
              <div>&bull; <b>Audit Trail:</b> An audit log entry will be permanently recorded.</div>
            </div>
            <div class="d-flex gap-3 justify-between">
              <button class="btn btn-secondary" id="btn-recal-cancel" style="flex:1;">Cancel</button>
              <button class="btn btn-primary" id="btn-recal-confirm-run" style="flex:1; background: linear-gradient(135deg,#10b981,#059669); border:none;">&#9989; Yes, Apply Changes</button>
            </div>
          </div>
        </div>
      `;

      let currentPreviewData = null;
      const examSelect = document.getElementById('recalibrator-exam-select');
      const btnPreview = document.getElementById('btn-preview-recal');
      const btnApply = document.getElementById('btn-apply-recal');
      const metricsPanel = document.getElementById('recal-metrics-panel');
      const resultsWrap = document.getElementById('recal-results-wrap');
      const tableBody = document.getElementById('recal-table-body');
      const filterSelect = document.getElementById('recal-filter-view');
      const confirmModal = document.getElementById('recal-confirm-modal');

      examSelect.addEventListener('change', () => {
        const val = examSelect.value;
        btnPreview.disabled = !val;
        btnApply.disabled = true;
        metricsPanel.classList.add('hidden');
        resultsWrap.classList.add('hidden');
        currentPreviewData = null;
      });

      if (window._filterRecalibrateExam) {
        examSelect.value = window._filterRecalibrateExam;
        window._filterRecalibrateExam = null;
        btnPreview.disabled = !examSelect.value;
      }

      const renderPreviewRows = () => {
        if (!currentPreviewData) return;
        const mode = filterSelect.value;
        const list = mode === 'affected'
          ? currentPreviewData.attemptsDiff.filter(a => a.isAffected)
          : currentPreviewData.attemptsDiff;

        tableBody.innerHTML = '';
        if (!list.length) {
          tableBody.innerHTML = `<tr><td colspan="10" class="text-center text-muted p-4">No ${mode === 'affected' ? 'affected ' : ''}student attempts found.</td></tr>`;
          return;
        }

        list.forEach(item => {
          const isScoreUp = item.newPercentage > item.oldPercentage;
          const isScoreDown = item.newPercentage < item.oldPercentage;
          const isStatusPass = item.oldStatus === 'FAIL' && item.newStatus === 'PASS';
          const isStatusFail = item.oldStatus === 'PASS' && item.newStatus === 'FAIL';

          let statusBadge = '<span class="badge badge-neutral">No Change</span>';
          if (isStatusPass) {
            statusBadge = '<span class="badge badge-success fw-700">FAIL &rarr; PASS &#10024;</span>';
          } else if (isStatusFail) {
            statusBadge = '<span class="badge badge-danger fw-700">PASS &rarr; FAIL &#9888;&#65039;</span>';
          } else if (item.isAffected) {
            statusBadge = isScoreUp ? '<span class="badge badge-info">+ Score Up</span>' : '<span class="badge badge-warning">- Score Down</span>';
          }

          const changedAnswersCount = item.questions.filter(q => q.isAffected).length;

          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="fw-600">${escapeHtml(item.studentName)}</td>
            <td class="text-muted text-sm">${escapeHtml(item.programName)}</td>
            <td class="text-center text-muted">${item.oldScore}</td>
            <td class="text-center fw-700 ${isScoreUp ? 'text-success' : isScoreDown ? 'text-danger' : ''}">${item.newScore}</td>
            <td class="text-center text-muted">${item.oldPercentage}%</td>
            <td class="text-center fw-700 ${isScoreUp ? 'text-success' : isScoreDown ? 'text-danger' : ''}">${item.newPercentage}%</td>
            <td class="text-center"><span class="grade-badge grade-${item.oldGrade}" style="width:24px;height:24px;font-size:0.75rem;display:inline-flex;">${item.oldGrade}</span></td>
            <td class="text-center"><span class="grade-badge grade-${item.newGrade}" style="width:24px;height:24px;font-size:0.75rem;display:inline-flex;">${item.newGrade}</span></td>
            <td class="text-center">${statusBadge}</td>
            <td class="text-center"><span class="badge ${changedAnswersCount > 0 ? 'badge-primary' : 'badge-neutral'}">${changedAnswersCount} q</span></td>
          `;
          tableBody.appendChild(tr);
        });
      };

      filterSelect.addEventListener('change', renderPreviewRows);

      btnPreview.addEventListener('click', async () => {
        const examId = examSelect.value;
        if (!examId) return;

        showLoading('Calculating recalibration preview across all attemptsÃ¢â‚¬Â¦');
        try {
          currentPreviewData = await previewRecalibrateExam(examId);
          hideLoading();

          // Update metrics
          document.getElementById('recal-metric-questions').textContent = currentPreviewData.totalQuestions;
          document.getElementById('recal-metric-attempts').textContent = currentPreviewData.totalAttempts;
          document.getElementById('recal-metric-affected').textContent = currentPreviewData.affectedAttemptsCount;
          document.getElementById('recal-metric-fail-pass').textContent = currentPreviewData.failToPassCount;
          document.getElementById('recal-metric-pass-fail').textContent = currentPreviewData.passToFailCount;
          document.getElementById('recal-metric-increases').textContent = currentPreviewData.scoreIncreaseCount;

          metricsPanel.classList.remove('hidden');
          resultsWrap.classList.remove('hidden');
          renderPreviewRows();

          if (currentPreviewData.affectedAttemptsCount > 0) {
            btnApply.disabled = false;
            showToast(`Found ${currentPreviewData.affectedAttemptsCount} attempts that can be recalibrated.`, 'info');
          } else {
            btnApply.disabled = true;
            showToast('All attempts already match the latest question definitions and grading engine.', 'success');
          }
        } catch (err) {
          hideLoading();
          showToast('Preview error: ' + err.message, 'error');
        }
      });

      btnApply.addEventListener('click', () => {
        if (!currentPreviewData || currentPreviewData.affectedAttemptsCount === 0) return;
        document.getElementById('modal-affected-count').textContent = currentPreviewData.affectedAttemptsCount;
        document.getElementById('modal-status-changes').textContent = (currentPreviewData.failToPassCount + currentPreviewData.passToFailCount);
        confirmModal.classList.remove('hidden');
      });

      document.getElementById('btn-recal-cancel')?.addEventListener('click', () => {
        confirmModal.classList.add('hidden');
      });

      document.getElementById('btn-recal-confirm-run')?.addEventListener('click', async () => {
        confirmModal.classList.add('hidden');
        const examId = examSelect.value;
        if (!examId) return;

        showLoading('Applying recalibration to historical student resultsÃ¢â‚¬Â¦');
        try {
          const res = await applyRecalibrateExam(examId);
          hideLoading();
          showToast(`Successfully recalibrated ${res.updatedAttemptsCount} attempts!`, 'success');
          btnApply.disabled = true;
          // Refresh preview
          btnPreview.click();
        } catch (err) {
          hideLoading();
          showToast('Failed to apply recalibration: ' + err.message, 'error');
        }
      });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Class Instances UI Ã¢â€â‚¬Ã¢â€â‚¬
    export async function renderClassInstances(area) {
      const [rawData, batches, classes] = await Promise.all([
        adminFetchAll('class_instances', '*, batches(name, programs(name, institutions(name))), classes(name)'),
        adminFetchAll('batches', 'id, name'),
        adminFetchAll('classes', 'id, name, institution_id')
      ]);

      const data = [...rawData].sort((a, b) => {
        const pA = a.batches?.programs?.name || '';
        const pB = b.batches?.programs?.name || '';
        return pA.localeCompare(pB) || (a.batches?.name || '').localeCompare(b.batches?.name || '');
      });

      area.innerHTML = `
        <div class="section-header d-flex justify-between align-center flex-wrap gap-2">
          <div>
            <h2 class="section-title">Class Instances <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage class instances attached to batches (start dates, recurring schedules)</p>
          </div>
          <button class="btn btn-primary" onclick="window.openCrudModal('class_instances', null)">
            <svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4"></path></svg>
            Attach Class to Batch
          </button>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Program</th>
                <th class="text-left">Batch</th>
                <th class="text-left">Class Board</th>
                <th class="text-left">Start Date</th>
                <th class="text-left">Est. Finish</th>
                <th class="text-left">Schedule</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${data.length === 0 ? '<tr><td colspan="8" class="text-center text-muted">No class instances yet.</td></tr>' : (() => {
                window._ciRecords = {};
                return data.map(row => {
                  window._ciRecords[row.id] = row;
                  let scheduleText = 'Ã¢â‚¬â€';
                  if (row.recurring_schedule) {
                    try {
                      const parsed = typeof row.recurring_schedule === 'string' ? JSON.parse(row.recurring_schedule) : row.recurring_schedule;
                      if (Array.isArray(parsed)) scheduleText = parsed.join(', ');
                      else scheduleText = JSON.stringify(parsed);
                    } catch { scheduleText = String(row.recurring_schedule); }
                  }
                  return `
                <tr>
                  <td>
                    <div class="fw-600">${escapeHtml(row.batches?.programs?.name || 'Ã¢â‚¬â€')}</div>
                    <div class="text-xs text-muted">${escapeHtml(row.batches?.programs?.institutions?.name || 'Ã¢â‚¬â€')}</div>
                  </td>
                  <td>${escapeHtml(row.batches?.name || 'Ã¢â‚¬â€')}</td>
                  <td>${escapeHtml(row.classes?.name || 'Ã¢â‚¬â€')}</td>
                  <td>${row.start_date || 'Ã¢â‚¬â€'}</td>
                  <td>${row.estimated_finish || 'Ã¢â‚¬â€'}</td>
                  <td class="text-xs text-muted" style="max-width: 150px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(scheduleText)}</td>
                  <td class="text-center">
                    <span class="badge ${row.status === 'active' ? 'badge-primary' : (row.status === 'finished' ? 'badge-success' : 'badge-neutral')}">${row.status}</span>
                  </td>
                  <td class="text-right">
                    <button class="btn btn-ghost btn-sm" onclick="window.viewClassInstanceRoster('${row.id}')">Roster</button>
                    <button class="btn btn-ghost btn-sm" onclick="window.openCrudModal('class_instances', window._ciRecords['${row.id}'])">Edit</button>
                  </td>
                </tr>
              `}).join('');
              })()}
            </tbody>
          </table>
        </div>
      `;
    }

    // ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ Student Import Engine ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÆ’Ã‚Â¢Ã¢â‚¬ÂÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬


