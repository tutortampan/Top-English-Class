// TOPS CORE � Centralized Assessment Wizard V1
// Implements multi-step Evaluation & Assessment creation, topic derivation from Evaluations,
// live question counts, inline assignments, and frozen snapshots on publish.
import {
  fetchClasses,
  fetchTopics,
  fetchCentralQuestions,
  fetchAssessmentDefinitions,
  createAssessmentDefinition,
  updateAssessmentDefinition,
  publishAssessmentDefinition,
  createAssessmentInstance,
  fetchBatches,
  fetchClassInstances,
  createTopic,
  adminFetchAll,
  clearAdminCache
} from '../api.js';
import { showToast, showLoading, hideLoading } from '../app.js';

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export async function openAssessmentBuilder(assessmentId = null) {
  const isEdit = !!assessmentId;

  const builderDiv = document.createElement('div');
  builderDiv.id = 'assessment-builder-modal';
  builderDiv.className = 'modal-backdrop';
  builderDiv.innerHTML = `
    <div class="modal-content" style="max-width: 960px; height: 90vh; display: flex; flex-direction: column;">
      <div class="modal-header d-flex justify-between align-center p-3" style="border-bottom: 1px solid var(--clr-border);">
        <div>
          <h2 class="modal-title m-0 text-gradient" style="font-size: 1.35rem;">
            ${isEdit ? 'Edit Assessment' : 'New Assessment Wizard (V1)'}
          </h2>
          <p class="text-muted m-0" style="font-size: 0.8rem;">Create Evaluations or Comprehensive Assessments with frozen question snapshots</p>
        </div>
        <button class="btn btn-ghost" id="close-assessment-builder" style="font-size: 1.5rem; line-height: 1;">&times;</button>
      </div>

      <div class="modal-body p-0" style="flex: 1; overflow: hidden; display: flex; flex-direction: column;">
        <!-- Step Navigation Tabs -->
        <div class="builder-tabs" style="display: flex; border-bottom: 1px solid var(--clr-border); background: var(--clr-bg-2);">
          <button class="builder-tab active" data-tab="tab-details" style="flex: 1; padding: 12px; border: none; background: transparent; cursor: pointer; font-weight: 700; border-bottom: 3px solid var(--clr-primary);">
            1. Details &amp; Type
          </button>
          <button class="builder-tab" data-tab="tab-topics" style="flex: 1; padding: 12px; border: none; background: transparent; cursor: pointer; font-weight: 700;">
            2. Topic Coverage
          </button>
          <button class="builder-tab" data-tab="tab-assign" style="flex: 1; padding: 12px; border: none; background: transparent; cursor: pointer; font-weight: 700;">
            3. Assignment
          </button>
          <button class="builder-tab" data-tab="tab-publish" style="flex: 1; padding: 12px; border: none; background: transparent; cursor: pointer; font-weight: 700;">
            4. Review &amp; Freeze
          </button>
        </div>

        <div class="builder-content" style="flex: 1; overflow-y: auto; padding: 24px; background: var(--clr-bg-1);">
          
          <!-- TAB 1: BASIC DETAILS -->
          <div id="tab-details" class="b-tab-content">
            <div class="card p-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
              <div class="form-grid">
                <div class="form-group form-group-full mb-3">
                  <label class="form-label">Assessment Type *</label>
                  <div class="d-flex gap-4">
                    <label style="cursor:pointer;display:flex;align-items:center;gap:8px;">
                      <input type="radio" name="wiz-type" value="EVALUATION" checked />
                      <strong>Evaluation</strong> <span class="text-muted text-xs">(Routine / modular topic check)</span>
                    </label>
                    <label style="cursor:pointer;display:flex;align-items:center;gap:8px;">
                      <input type="radio" name="wiz-type" value="Assessment" />
                      <strong>Comprehensive Assessment</strong> <span class="text-muted text-xs">(Derived from Evaluation sequences)</span>
                    </label>
                  </div>
                </div>

                <div class="form-group form-group-full mb-3">
                  <label class="form-label">Assessment Title *</label>
                  <input type="text" class="form-control" id="wiz-title" placeholder="e.g. Vocabulary Evaluation A1 - Daily Routine" required />
                </div>

                <div class="form-group mb-3">
                  <label class="form-label">Class *</label>
                  <select class="form-control" id="wiz-class"></select>
                </div>

                <div class="form-group mb-3">
                  <label class="form-label">Working Duration (Minutes) *</label>
                  <input type="number" class="form-control" id="wiz-duration" value="60" min="5" max="300" />
                </div>

                <div class="form-group mb-3">
                  <label class="form-label">Question Order</label>
                  <select class="form-control" id="wiz-order">
                    <option value="RANDOM">Random (Shuffled order for each student attempt)</option>
                    <option value="SEQUENTIAL">Sequential (Fixed bank display order)</option>
                  </select>
                </div>

                

                <div class="form-group mb-3">
                  <label class="form-label">Availability End (Optional)</label>
                  <input type="datetime-local" class="form-control" id="wiz-end" />
                </div>
              </div>

              <div class="text-right mt-4">
                <button class="btn btn-primary" id="btn-details-next">Next: Topic Coverage →</button>
              </div>
            </div>
          </div>

          <!-- TAB 2: TOPIC COVERAGE -->
          <div id="tab-topics" class="b-tab-content hidden">
            <!-- Container for EVALUATION: direct topic checkboxes -->
            <div id="wiz-evaluation-topic-section" class="card p-4 mb-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
              <div class="d-flex justify-between align-center flex-wrap gap-2 mb-3">
                <div>
                  <h3 style="font-size:1.1rem;margin:0;">Select Topics for this Evaluation</h3>
                  <p class="text-muted text-xs m-0">All active questions from checked topics are automatically included. No question limit.</p>
                </div>
                <div>
                  <span class="badge badge-primary p-2" style="font-size:0.85rem;">
                    Total Questions: <strong id="wiz-eval-q-count">0</strong>
                  </span>
                </div>
              </div>
              <div id="wiz-topics-container" class="d-flex flex-column gap-2 mt-3" style="max-height: 360px; overflow-y: auto;">
                <!-- Topic checkboxes injected here -->
              </div>
            </div>

            <!-- Container for Assessment: sequence of evaluations derivation -->
            <div id="wiz-Assessment-sequence-section" class="card p-4 mb-4 hidden" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
              <div class="d-flex justify-between align-center flex-wrap gap-2 mb-3">
                <div>
                  <h3 style="font-size:1.1rem;margin:0;">Derive Coverage from Evaluations</h3>
                  <p class="text-muted text-xs m-0">Select the source Evaluations. The system unifies unique topics and includes all active questions.</p>
                </div>
                <div>
                  <span class="badge badge-primary p-2" style="font-size:0.85rem;">
                    Derived Questions: <strong id="wiz-Assessment-q-count">0</strong>
                  </span>
                </div>
              </div>

              <div class="mb-3">
                <label class="form-label" style="font-size:0.85rem;">Source Evaluations:</label>
                <div id="wiz-evaluations-container" class="d-flex flex-column gap-2" style="max-height: 200px; overflow-y: auto;">
                  <!-- Existing evaluations checkboxes injected here -->
                </div>
              </div>

              <!-- Derived Topics summary -->
              <div class="p-3 rounded" style="background:rgba(0,0,0,0.25);border:1px solid var(--clr-border);">
                <div class="text-xs fw-700 text-muted uppercase mb-2">Unified Topic Coverage (<span id="wiz-derived-topic-count">0</span> topics):</div>
                <div id="wiz-derived-topics-chips" class="d-flex gap-2 flex-wrap">
                  <span class="text-muted text-xs">No evaluations selected yet.</span>
                </div>
              </div>
            </div>

            <div class="d-flex justify-between mt-4">
              <button class="btn btn-secondary btn-sm" id="btn-topics-prev">← Back to Details</button>
              <button class="btn btn-primary btn-sm" id="btn-topics-next">Next: Set Assignment →</button>
            </div>
          </div>

          <!-- TAB 3: ASSIGNMENT -->
          <div id="tab-assign" class="b-tab-content hidden">
            <div class="card p-4 mb-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
              <h3 style="font-size:1.1rem;margin-bottom:0.5rem;">Access &amp; Assignment (Who can take this?)</h3>
              <p class="text-muted text-xs mb-4">You can assign this assessment immediately to a Batch or selected Students, or skip and assign later.</p>

                            <div class="form-group mb-3">
                <label class="form-label">Assignment Strategy</label>
                <select class="form-control" id="wiz-assign-strategy" style="max-width:360px;">
                  <option value="NONE">Assign Later (Draft or Open to Class)</option>
                  <option value="BATCH" selected>Assign to Specific Batch (Class Instance)</option>
                </select>
              </div>

              <div class="form-group mb-3" id="wiz-assign-batch-group">
                <label class="form-label">Target Batch *</label>
                <select class="form-control" id="wiz-assign-batch-select" style="max-width:360px;">
                  <!-- Batches populated here -->
                </select>
              </div>

              <div class="form-group mb-3" id="wiz-assign-time-group1">
                  <label class="form-label">Availability Start (Optional)</label>
                  <input type="datetime-local" class="form-control" id="wiz-start" style="max-width:360px;" />
              </div>
              <div class="form-group mb-3" id="wiz-assign-time-group2">
                  <label class="form-label">Availability End (Optional)</label>
                  <input type="datetime-local" class="form-control" id="wiz-end" style="max-width:360px;" />
              </div>

              <div class="form-group mb-3" id="wiz-assign-batch-group">
                <label class="form-label">Target Batch *</label>
                <select class="form-control" id="wiz-assign-batch-select" style="max-width:360px;">
                  <!-- Batches populated here -->
                </select>
              </div>

              <div class="form-group mb-3 hidden" id="wiz-assign-student-group">
                <label class="form-label">Target Student *</label>
                <select class="form-control" id="wiz-assign-student-select" style="max-width:360px;">
                  <!-- Students populated here -->
                </select>
              </div>

              <div class="d-flex justify-between mt-4">
                <button class="btn btn-secondary btn-sm" id="btn-assign-prev">← Back to Topics</button>
                <button class="btn btn-primary btn-sm" id="btn-assign-next">Next: Review &amp; Publish →</button>
              </div>
            </div>
          </div>

          <!-- TAB 4: REVIEW & PUBLISH -->
          <div id="tab-publish" class="b-tab-content hidden">
            <div class="card p-4" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
              <h3 style="font-size:1.1rem;margin-bottom:1rem;">Assessment Summary &amp; Snapshot Freeze</h3>
              
              <div class="p-4 rounded mb-4" style="background:rgba(0,0,0,0.25);border:1px solid var(--clr-border);">
                <div class="d-flex justify-between align-center mb-3">
                  <h4 class="m-0" id="rev-title" style="font-size:1.15rem;font-weight:700;">�</h4>
                  <span id="rev-type" class="badge badge-info">EVALUATION</span>
                </div>
                <div class="d-flex gap-4 flex-wrap text-sm mb-3">
                  <div><strong>Class Board:</strong> <span id="rev-class">�</span></div>
                  <div><strong>Duration:</strong> <span id="rev-duration">60 min</span></div>
                  <div><strong>Order:</strong> <span id="rev-order">Random</span></div>
                  <div><strong>Assignment:</strong> <span id="rev-assignment" class="badge badge-neutral">Batch</span></div>
                </div>
                <div class="mb-3">
                  <strong>Included Topics:</strong> <span id="rev-topics" class="text-muted">�</span>
                </div>
                <div class="d-flex align-center gap-2 p-3 rounded" style="background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.3);">
                  <div style="font-size:1.5rem;">🔒</div>
                  <div>
                    <div style="font-size:0.85rem;font-weight:700;">Question Snapshot Immutability</div>
                    <div class="text-xs text-muted">
                      Publishing will freeze exactly <strong id="rev-questions" class="text-success">0</strong> active questions into <code>assessment_questions</code>.
                    </div>
                  </div>
                </div>
              </div>

              <div class="d-flex justify-between align-center">
                <button class="btn btn-secondary btn-sm" id="btn-publish-prev">← Back to Assignment</button>
                <div class="d-flex gap-2">
                  <button class="btn btn-secondary btn-sm" id="btn-save-draft">💾 Save as Draft</button>
                  <button class="btn btn-success btn-sm" id="btn-publish-assessment">🚀 Publish &amp; Freeze Snapshot</button>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `;

  document.body.appendChild(builderDiv);

  // Tab Switching
  const tabs = builderDiv.querySelectorAll('.builder-tab');
  const contents = builderDiv.querySelectorAll('.b-tab-content');

  function switchTab(targetTabId) {
    tabs.forEach(t => {
      const isTarget = t.dataset.tab === targetTabId;
      t.style.borderBottom = isTarget ? '3px solid var(--clr-primary)' : 'none';
      t.classList.toggle('active', isTarget);
    });
    contents.forEach(c => c.classList.toggle('hidden', c.id !== targetTabId));
  }

  tabs.forEach(t => t.onclick = () => switchTab(t.dataset.tab));

  const close = () => {
    builderDiv.remove();
    if (window.loadSection) window.loadSection('Assessments');
  };
  document.getElementById('close-assessment-builder').onclick = close;

  // Load Initial Data
  showLoading('Initializing Assessment Wizard...');
  let allClasses = [];
  let allTopics = [];
  let allQuestions = [];
  let existingAssessments = [];
  let allBatches = [];
  let allStudents = [];
  let allClassInstances = [];
  let selectedTopicIds = new Set();
  let selectedEvalIds = new Set();
  let createdAssessmentId = assessmentId;

  try {
        const [subjs, topcs, qList, asms, btchs, stds, classInsts] = await Promise.all([
      fetchClasses(),
      fetchTopics(),
      fetchCentralQuestions({ status: 'active' }),
      fetchAssessmentDefinitions(),
      fetchBatches(),
      adminFetchAll('students'),
      fetchClassInstances()
    ]);

    allClasses = subjs;
    allTopics = topcs;
    allQuestions = qList;
    existingAssessments = asms;
    allBatches = btchs;
    allStudents = stds.filter(s => !s.deleted_at);
    allClassInstances = classInsts;

    hideLoading();

    // Populate Classes dropdown
    const subSel = document.getElementById('wiz-Class');
    subSel.innerHTML = allClasses.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    // Populate Prerequisite dropdown
    const prereqSel = document.getElementById('wiz-prereq');
    prereqSel.innerHTML = `<option value="">None (Available immediately)</option>` +
      existingAssessments.filter(a => a.id !== assessmentId).map(a => `
        <option value="${a.id}">${escapeHtml(a.title)} (${escapeHtml(a.category || 'EVALUATION')})</option>
      `).join('');

    // Populate Batches dropdown
    const batchSel = document.getElementById('wiz-assign-batch-select');
    batchSel.innerHTML = allBatches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('');

    // Populate Students dropdown
    const studentSel = document.getElementById('wiz-assign-student-select');
    studentSel.innerHTML = allStudents.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');

    // Toggle Assignment Mode
    const assignStrategySel = document.getElementById('wiz-assign-strategy');
    const batchGroup = document.getElementById('wiz-assign-batch-group');
    const studentGroup = document.getElementById('wiz-assign-student-group');
    assignStrategySel.onchange = () => {
      const mode = assignStrategySel.value;
      batchGroup.classList.toggle('hidden', mode !== 'BATCH');
      studentGroup.classList.toggle('hidden', mode !== 'STUDENT');
    };

    // Toggle Evaluation vs Assessment UI in Tab 2
    const typeRadios = builderDiv.querySelectorAll('input[name="wiz-type"]');
    const evalSection = document.getElementById('wiz-evaluation-topic-section');
    const Assessmentsection = document.getElementById('wiz-Assessment-sequence-section');

    const updateTypeUI = () => {
      const isAssessment = builderDiv.querySelector('input[name="wiz-type"]:checked').value === 'Assessment';
      evalSection.classList.toggle('hidden', isAssessment);
      Assessmentsection.classList.toggle('hidden', !isAssessment);
      if (isAssessment) {
        renderAssessmentEvaluations();
      } else {
        renderTopicCheckboxes();
      }
    };

    typeRadios.forEach(r => r.onchange = updateTypeUI);

    // Render topics checkboxes for current Class (EVALUATION mode)
    const renderTopicCheckboxes = () => {
      const currentClassId = subSel.value;
      const filteredTopics = allTopics.filter(t => t.class_id === currentClassId);
      const container = document.getElementById('wiz-topics-container');

      if (!filteredTopics.length) {
        container.innerHTML = `
          <div class="p-4 text-center rounded" style="background:rgba(255,255,255,0.02);border:1px dashed var(--clr-border);">
            <p class="text-muted text-xs mb-3">No topics found for this Class yet. You can add one quickly below:</p>
            <div class="d-flex justify-center gap-2 flex-wrap" style="max-width:420px;margin:0 auto;">
              <input type="text" class="form-control form-control-sm" id="wiz-quick-topic-name" placeholder="Topic Name (e.g. Vocabulary Set 1)" style="flex:1;min-width:180px;" />
              <button class="btn btn-primary btn-sm" id="btn-wiz-add-topic" type="button">+ Add Topic</button>
            </div>
          </div>
        `;
        document.getElementById('wiz-eval-q-count').textContent = '0';
        document.getElementById('btn-wiz-add-topic')?.addEventListener('click', async () => {
          const tName = document.getElementById('wiz-quick-topic-name')?.value.trim();
          if (!tName) {
            showToast('Please enter a topic name.', 'warning');
            return;
          }
          try {
            const newT = await createTopic({ class_id: currentClassId, name: tName });
            allTopics.push(newT);
            selectedTopicIds.add(newT.id);
            renderTopicCheckboxes();
            showToast(`Topic "${tName}" created and selected.`, 'success');
          } catch (err) {
            showToast(`Failed to create topic: ${err.message}`, 'error');
          }
        });
        return;
      }

      container.innerHTML = filteredTopics.map(t => {
        const qCount = allQuestions.filter(q => q.topic_id === t.id).length;
        const isChecked = selectedTopicIds.has(t.id);
        return `
          <label class="d-flex align-center justify-between p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);cursor:pointer;">
            <div class="d-flex align-center gap-3">
              <input type="checkbox" class="topic-checkbox" value="${t.id}" data-count="${qCount}" ${isChecked ? 'checked' : ''} />
              <div>
                <strong>${escapeHtml(t.name)}</strong>
                ${t.code ? `<span class="badge badge-secondary ml-2">${escapeHtml(t.code)}</span>` : ''}
              </div>
            </div>
            <span class="badge ${qCount > 0 ? 'badge-info' : 'badge-neutral'}">
              ${qCount} questions
            </span>
          </label>
        `;
      }).join('');

      updateEvalQuestionSum();
    };

    const updateEvalQuestionSum = () => {
      let sum = 0;
      builderDiv.querySelectorAll('.topic-checkbox:checked').forEach(cb => {
        sum += Number(cb.dataset.count || 0);
      });
      document.getElementById('wiz-eval-q-count').textContent = sum;
    };

    // Render source Evaluations checkboxes (Assessment mode)
    const renderAssessmentEvaluations = () => {
      const currentClassId = subSel.value;
      const evals = existingAssessments.filter(a => a.class_id === currentClassId && (a.category || 'EVALUATION') === 'EVALUATION');
      const container = document.getElementById('wiz-evaluations-container');

      if (!evals.length) {
        container.innerHTML = `<p class="text-muted text-xs p-3 text-center">No published evaluations found for this Class. Create Evaluations first.</p>`;
        updateAssessmentDerivedCoverage();
        return;
      }

      container.innerHTML = evals.map(ev => {
        const isChecked = selectedEvalIds.has(ev.id);
        return `
          <label class="d-flex align-center justify-between p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);cursor:pointer;">
            <div class="d-flex align-center gap-3">
              <input type="checkbox" class="eval-checkbox" value="${ev.id}" ${isChecked ? 'checked' : ''} />
              <div>
                <strong>${escapeHtml(ev.title)}</strong>
                <span class="badge badge-neutral ml-2">${ev.working_duration_minutes || 60} min</span>
              </div>
            </div>
          </label>
        `;
      }).join('');

      updateAssessmentDerivedCoverage();
    };

    const updateAssessmentDerivedCoverage = async () => {
      // Find all topics linked to selected evaluations
      const derivedTopicIds = new Set();

      for (const evId of selectedEvalIds) {
        const ev = existingAssessments.find(a => a.id === evId);
        if (ev && ev.assessment_topics) {
          ev.assessment_topics.forEach(t => derivedTopicIds.add(t.topic_id));
        }
      }

      // If assessment_topics is empty locally, fallback to all active topics in Class
      selectedTopicIds = derivedTopicIds;

      const chipsContainer = document.getElementById('wiz-derived-topics-chips');
      const topicCountEl = document.getElementById('wiz-derived-topic-count');

      const derivedTopics = allTopics.filter(t => derivedTopicIds.has(t.id));
      topicCountEl.textContent = derivedTopics.length;

      if (!derivedTopics.length) {
        chipsContainer.innerHTML = `<span class="text-muted text-xs">No evaluations selected or no topics linked yet.</span>`;
        document.getElementById('wiz-Assessment-q-count').textContent = '0';
        return;
      }

      chipsContainer.innerHTML = derivedTopics.map(t => `
        <span class="badge badge-info p-2">${escapeHtml(t.name)}</span>
      `).join('');

      // Calculate total questions belonging to these topics
      const qCount = allQuestions.filter(q => derivedTopicIds.has(q.topic_id)).length;
      document.getElementById('wiz-Assessment-q-count').textContent = qCount;
    };

    // Pre-populate if in edit mode
    let editAssessment = null;
    if (assessmentId) {
      editAssessment = existingAssessments.find(a => a.id === assessmentId);
      if (!editAssessment) {
        try {
          const allAssessments = await adminFetchAll('assessments');
          editAssessment = (allAssessments || []).find(e => e.id === assessmentId);
        } catch (_) {}
      }
    }

    if (editAssessment) {
      const isAssessment = (editAssessment.category || '').toUpperCase() === 'Assessment';
      const typeRadio = builderDiv.querySelector(`input[name="wiz-type"][value="${isAssessment ? 'Assessment' : 'EVALUATION'}"]`);
      if (typeRadio) typeRadio.checked = true;

      const titleInput = document.getElementById('wiz-title');
      if (titleInput) titleInput.value = editAssessment.title || editAssessment.Assessment_title || '';

      if (editAssessment.class_id && subSel) {
        subSel.value = editAssessment.class_id;
      }

      const durInput = document.getElementById('wiz-duration');
      if (durInput) durInput.value = editAssessment.working_duration_minutes || editAssessment.time_limit_minutes || 60;

      const orderSel = document.getElementById('wiz-order');
      if (orderSel) {
        const ordVal = (editAssessment.question_order || '').toUpperCase();
        orderSel.value = ordVal === 'SEQUENTIAL' ? 'SEQUENTIAL' : 'RANDOM';
      }

      const prereqSelEl = document.getElementById('wiz-prereq');
      if (prereqSelEl && (editAssessment.prerequisite_assessment_id || editAssessment.prerequisite_Assessment_id)) {
        prereqSelEl.value = editAssessment.prerequisite_assessment_id || editAssessment.prerequisite_Assessment_id;
      }

      if (editAssessment.availability_start) {
        const d = new Date(editAssessment.availability_start);
        if (!isNaN(d.getTime())) document.getElementById('wiz-start').value = d.toISOString().slice(0, 16);
      }
      if (editAssessment.availability_end) {
        const d = new Date(editAssessment.availability_end);
        if (!isNaN(d.getTime())) document.getElementById('wiz-end').value = d.toISOString().slice(0, 16);
      }

      // Pre-select topics linked to this assessment/Assessment
      if (Array.isArray(editAssessment.assessment_topics)) {
        editAssessment.assessment_topics.forEach(t => selectedTopicIds.add(t.topic_id));
      }
      // Also check questions linked to this Assessment for topic_ids
      const linkedQuestions = allQuestions.filter(q => q.Assessment_id === assessmentId || q.assessment_id === assessmentId);
      linkedQuestions.forEach(q => {
        if (q.topic_id) selectedTopicIds.add(q.topic_id);
      });
    }

    subSel.onchange = () => {
      selectedTopicIds.clear();
      selectedEvalIds.clear();
      updateTypeUI();
    };
    updateTypeUI();

    builderDiv.addEventListener('change', (e) => {
      if (e.target.classList.contains('topic-checkbox')) {
        const id = e.target.value;
        if (e.target.checked) selectedTopicIds.add(id);
        else selectedTopicIds.delete(id);
        updateEvalQuestionSum();
      }
      if (e.target.classList.contains('eval-checkbox')) {
        const id = e.target.value;
        if (e.target.checked) selectedEvalIds.add(id);
        else selectedEvalIds.delete(id);
        updateAssessmentDerivedCoverage();
      }
    });

    // Step 1 -> Step 2
    document.getElementById('btn-details-next').onclick = () => {
      const title = document.getElementById('wiz-title').value.trim();
      if (!title) {
        showToast('Please enter an assessment title.', 'warning');
        return;
      }
      updateTypeUI();
      switchTab('tab-topics');
    };

    // Step 2 -> Step 3
    document.getElementById('btn-topics-prev').onclick = () => switchTab('tab-details');
    document.getElementById('btn-topics-next').onclick = () => {
      if (selectedTopicIds.size === 0) {
        showToast('Please select at least one topic (or source evaluation) for this assessment.', 'warning');
        return;
      }
      switchTab('tab-assign');
    };

    // Step 3 -> Step 4 (Review)
    document.getElementById('btn-assign-prev').onclick = () => switchTab('tab-topics');
    document.getElementById('btn-assign-next').onclick = () => {
      const typeVal = builderDiv.querySelector('input[name="wiz-type"]:checked').value;
      const title = document.getElementById('wiz-title').value;
      const duration = document.getElementById('wiz-duration').value;
      const order = document.getElementById('wiz-order').value;
      const strategy = assignStrategySel.value;

      document.getElementById('rev-title').textContent = title;
      document.getElementById('rev-type').textContent = typeVal;
      document.getElementById('rev-class').textContent = subSel.options[subSel.selectedIndex]?.text || '';
      document.getElementById('rev-duration').textContent = `${duration} minutes`;
      document.getElementById('rev-order').textContent = order;

      if (strategy === 'BATCH') {
        const bName = batchSel.options[batchSel.selectedIndex]?.text || 'Batch';
        document.getElementById('rev-assignment').textContent = `Batch: ${bName}`;
      } else if (strategy === 'STUDENT') {
        const sName = studentSel.options[studentSel.selectedIndex]?.text || 'Student';
        document.getElementById('rev-assignment').textContent = `Student: ${sName}`;
      } else {
        document.getElementById('rev-assignment').textContent = 'Open / Assign Later';
      }

      const topicNames = allTopics.filter(t => selectedTopicIds.has(t.id)).map(t => t.name).join(', ');
      document.getElementById('rev-topics').textContent = topicNames || 'Selected Topics';

      const qTotal = (typeVal === 'Assessment')
        ? document.getElementById('wiz-Assessment-q-count').textContent
        : document.getElementById('wiz-eval-q-count').textContent;
      document.getElementById('rev-questions').textContent = qTotal;

      switchTab('tab-publish');
    };

    // Step 4 Nav
    document.getElementById('btn-publish-prev').onclick = () => switchTab('tab-assign');

    // Save as Draft
    document.getElementById('btn-save-draft').onclick = async () => {
      await persistAssessment('DRAFT');
    };

    // Publish & Freeze Snapshot
    document.getElementById('btn-publish-assessment').onclick = async () => {
      await persistAssessment('PUBLISHED');
    };

    async function persistAssessment(targetStatus) {
      const title = document.getElementById('wiz-title').value.trim();
      const typeVal = builderDiv.querySelector('input[name="wiz-type"]:checked').value;
      const ClassId = subSel.value;
      const duration = Number(document.getElementById('wiz-duration').value) || 60;
      const order = document.getElementById('wiz-order').value;
      const prereqId = document.getElementById('wiz-prereq').value || null;
      const startVal = document.getElementById('wiz-start').value;
      const endVal = document.getElementById('wiz-end').value;
      const strategy = assignStrategySel.value;
      const batchId = batchSel.value;
      const studentId = studentSel.value;

      showLoading(targetStatus === 'PUBLISHED' ? 'Publishing & Freezing Snapshot...' : 'Saving Assessment Draft...');
      try {
        let asmId = createdAssessmentId;
        if (!asmId) {
          const newAsm = await createAssessmentDefinitionWithTopics({
            class_id: ClassId,
            category: typeVal,
            title,
            working_duration_minutes: duration,
            question_order: order,
            prerequisite_assessment_id: prereqId,
            availability_start: startVal ? new Date(startVal).toISOString() : null,
            availability_end: endVal ? new Date(endVal).toISOString() : null
          }, Array.from(selectedTopicIds));
          asmId = newAsm.id;
          createdAssessmentId = asmId;
        } else {
          await updateAssessmentWithTopics(asmId, {
            class_id: ClassId,
            category: typeVal,
            title,
            working_duration_minutes: duration,
            question_order: order,
            prerequisite_assessment_id: prereqId,
            availability_start: startVal ? new Date(startVal).toISOString() : null,
            availability_end: endVal ? new Date(endVal).toISOString() : null,
            status: targetStatus
          }, Array.from(selectedTopicIds));
        }

        // Inline Assignment if selected
        if (strategy === 'BATCH' && batchId) {
          await assignAssessment({
            assessment_id: asmId,
            challenge_instance_type: 'BATCH',
            batch_id: batchId,
            availability_start: startVal ? new Date(startVal).toISOString() : null,
            availability_end: endVal ? new Date(endVal).toISOString() : null
          });
        } else if (strategy === 'STUDENT' && studentId) {
          await assignAssessment({
            assessment_id: asmId,
            challenge_instance_type: 'STUDENT',
            student_id: studentId,
            availability_start: startVal ? new Date(startVal).toISOString() : null,
            availability_end: endVal ? new Date(endVal).toISOString() : null
          });
        }

        if (targetStatus === 'PUBLISHED') {
          const res = await publishAssessment(asmId);
          showToast(`Assessment published with ${res.total_questions} frozen questions!`, 'success');
        } else {
          showToast(isEdit ? 'Assessment updated successfully.' : 'Assessment saved as draft.', 'success');
        }

        close();
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        hideLoading();
      }
    }

  } catch (err) {
    showToast(`Failed to initialize wizard: ${err.message}`, 'error');
  } finally {
    hideLoading();
  }
}


