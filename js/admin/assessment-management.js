import { adminFetchAll, adminUpdate, adminSoftDelete, clearAdminCache } from '../api.js?v=4.7.0';
import { openAssessmentBuilder } from './assessment-builder.js?v=4.7.0';
import { showToast, showLoading, hideLoading } from '../app.js?v=4.7.0';
import { getSupabase } from '../supabase.js?v=4.7.0';
import { DataGrid } from './datagrid.js?v=4.7.0';
if (typeof window !== 'undefined') window.DataGrid = DataGrid;

let AssessmentsGrid;

export async function renderAssessments(area) {
  const [rawData, allQuestions, allClasses, allLevels, allBoardClasses] = await Promise.all([
    adminFetchAll('Assessments'),
    adminFetchAll('questions', 'id, Assessment_id'),
    adminFetchAll('programs', 'id, name').catch(() => []),
    adminFetchAll('levels').catch(() => []),
    adminFetchAll('classes').catch(() => [])
  ]);

  const classMap = {};
  (allClasses || []).forEach(c => { classMap[c.id] = c; });
  const boardClassMap = {};
  (allBoardClasses || []).forEach(c => { boardClassMap[c.id] = c; });
  const levelMap = {};
  (allLevels || []).forEach(l => { levelMap[l.id] = l; });
  const AssessmentMap = {};
  (rawData || []).forEach(e => { AssessmentMap[e.id] = e; });

  const data = [...rawData].sort((a, b) => (a.Assessment_title || a.name || '').localeCompare(b.Assessment_title || b.name || ''));

  // Calculate KPI metrics (Assessments table uses Assessment_status, not assessment_type)
  const totalAssessments = data.length;
  const publishedCount = data.filter(e => e.Assessment_status === 'published').length;
  const draftCount = data.filter(e => !e.Assessment_status || e.Assessment_status === 'draft' || e.Assessment_status === 'unpublished').length;
  const totalQuestions = allQuestions.length;

  area.innerHTML = `
    <div class="assessment-hero">
      <div class="d-flex align-center justify-between flex-wrap gap-4">
        <div>
          <h2 class="section-title text-gradient" style="font-size:1.75rem;">Assessments Hub (C &mdash; CLASS)</h2>
          <p class="section-subtitle">Create, organize, publish, and inspect all online assessments</p>
        </div>
        <div class="d-flex gap-2 flex-wrap">
          <button class="btn btn-primary btn-sm" id="hub-add-Assessment">+ Create Assessment</button>
          <button class="btn btn-secondary btn-sm" id="hub-btn-assignments" onclick="window.loadSection('class-assignments')">&#128101; Cohorts &amp; Assignments</button>
          <button class="btn btn-secondary btn-sm" id="hub-btn-results" onclick="window.loadSection('results')">&#128202; Assessment Results</button>
          <button class="btn btn-warning btn-sm" id="hub-btn-recalibrate" onclick="window.loadSection('recalibrator')" style="font-weight:700;">&#9889; Recalibrate</button>
          <button class="btn btn-secondary btn-sm" onclick="window.loadSection('import-questions')">&#128229; Import Questions</button>
          <button class="btn btn-secondary btn-sm" onclick="window.loadSection('export-questions')">&#128228; Export Questions</button>
        </div>
      </div>

      <div class="kpi-grid mt-4">
        <div class="kpi-card">
          <div class="kpi-icon">&#128203;</div>
          <div><div class="kpi-val">${totalAssessments}</div><div class="kpi-lbl">Total Assessments</div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="color:var(--clr-success,#4ade80);">&#128994;</div>
          <div><div class="kpi-val" style="color:var(--clr-success,#4ade80);">${publishedCount}</div><div class="kpi-lbl">Published Assessments</div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="color:var(--clr-warning,#fbbf24);">&#128679;</div>
          <div><div class="kpi-val" style="color:var(--clr-warning,#fbbf24);">${draftCount}</div><div class="kpi-lbl">Draft / Inactive</div></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-icon" style="color:var(--clr-accent-1);">&#10067;</div>
          <div><div class="kpi-val">${totalQuestions}</div><div class="kpi-lbl">Questions in Bank</div></div>
        </div>
      </div>
    </div>
    
    <div id="Assessments-grid-container" class="card mt-4" style="padding:1rem;"></div>
  `;

  document.getElementById('hub-add-Assessment')?.addEventListener('click', () => {
    window.openCrudModal('Assessments', null);
  });

  const gridData = data.map(r => {
    const qCount = (allQuestions || []).filter(q => q?.Assessment_id === r?.id).length;
    // Assessments table uses program_id; map to program name
    const programName = (r?.program_id && classMap[r.program_id]?.name) ? classMap[r.program_id].name : 'All Programs';
    const prereqAssessment = (r?.prerequisite_Assessment_id && AssessmentMap[r.prerequisite_Assessment_id]) ? AssessmentMap[r.prerequisite_Assessment_id] : null;
    const boardName = (r?.class_id && boardClassMap[r.class_id]?.name) || r?.classes?.name || '—';
    const lvlObj = (r?.level_id && levelMap[r.level_id]) || r?.levels;
    const lvlNum = lvlObj?.level_number || 1;
    const levelDisplay = window.toLevelLetter ? window.toLevelLetter(lvlNum) : lvlNum;
    const prereqTitle = prereqAssessment?.Assessment_title || prereqAssessment?.name || r?.prereq?.name || r?.prerequisite?.name || r?.prereq || '';
    // Assessments table: Assessment_title, Assessment_status, Assessment_type, answer_type, time_limit_minutes, minimum_required_score
    const title = r?.Assessment_title || r?.display_name || r?.name || 'Untitled';
    const status = r?.Assessment_status || r?.assessment_type || 'draft';
    const AssessmentCategory = r?.Assessment_type || 'Daily';
    const answerType = r?.answer_type || '';
    const timeLimit = r?.time_limit_minutes || Math.floor((r?.time_limit_seconds || 3600) / 60);
    const minScore = r?.minimum_required_score || 60;
    
    return {
      id: r?.id || '',
      title,
      programName,
      classBoard: boardName,
      level: levelDisplay,
      order: r?.Assessment_order || 1,
      prereq: prereqTitle,
      answerType: formatAnswerType(answerType),
      questionOrder: r?.question_order === 'random' ? 'Random' : 'Seq',
      AssessmentCategory,
      timeLimit,
      minScore,
      qCount,
      status,
      _raw: r || {}
    };
  });


  const statusColors = { published: 'badge-success', draft: 'badge-neutral', unpublished: 'badge-warning', archived: 'badge-danger' };

  AssessmentsGrid = new (DataGrid || window.DataGrid)({
    container: 'Assessments-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['title', 'programName', 'classBoard', 'status'],
    bulkActions: true,
    onBulkAction: async (selectedIds) => {
      const action = prompt(`Bulk Action for ${selectedIds.length} Assessments.\nOptions: delete`);
      if (action === 'delete') {
        if (confirm(`Are you sure you want to permanently soft-delete ${selectedIds.length} Assessments?`)) {
          for (const id of selectedIds) {
            await adminSoftDelete('Assessments', id);
          }
          showToast(`Deleted ${selectedIds.length} Assessments.`, 'success');
          renderAssessments(area);
        }
      }
    },
    onRowClick: (row) => {
      const r = (row && typeof row === 'object') ? row : {};
      const prereqText = r?.prereq?.name || r?.prerequisite?.name || r?.prereq || '';
      const body = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <h4 style="margin:0; font-size:1.2rem;">${escapeHtml(r?.title || 'Untitled Assessment')}</h4>
            <div class="text-muted text-sm">Status: <strong class="${statusColors[r?.status] || 'text-muted'}" style="text-transform:uppercase;">${r?.status || 'draft'}</strong></div>
          </div>
          <hr style="border-color:var(--fm-border-subtle); margin:0;">
          <div>
            <div class="text-sm text-muted mb-1">Target</div>
            <div class="fw-600">Program: ${escapeHtml(r?.programName || 'Unknown')}</div>
            <div class="fw-600">Class Board: ${escapeHtml(r?.classBoard || 'Unknown')}</div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Structure</div>
            <div class="fw-600">Type: ${escapeHtml(r?.AssessmentCategory || 'Daily')} &bull; ${r?.qCount || 0} Qs</div>
            <div class="fw-600">Answer: ${formatAnswerType(r?.answerType)}</div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Constraints</div>
            <div class="fw-600">Time Limit: ${r?.timeLimit || 60} min</div>
            <div class="fw-600">Pass Mark: ${r?.minScore || 60}%</div>
            ${prereqText ? `<div class="fw-600 text-warning">Prerequisite: ${escapeHtml(prereqText)}</div>` : ''}
          </div>
        </div>
      `;
      const footer = `
        <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
        <button class="btn btn-outline" onclick="window.openAssessmentBuilder('${r?.id || ''}'); closeRecordDrawer();">Edit Builder</button>
        <button class="btn ${r?.status === 'published' ? 'btn-danger' : 'btn-success'}" onclick="window._publishAssessment('${r?.id || ''}', '${r?.status || 'draft'}'); closeRecordDrawer();">
          ${r?.status === 'published' ? 'Unpublish' : 'Publish'}
        </button>
      `;
      if (window.openRecordDrawer) window.openRecordDrawer('Assessment Details', body, footer);
    },
    columns: [
      { 
        key: 'title', 
        label: 'Assessment Details', 
        sortable: true,
        render: (val, row) => {
          const r = (row && typeof row === 'object') ? row : (val && typeof val === 'object' ? val : {}) || {};
          const title = (typeof val === 'string' ? val : r?.title) || 'Untitled Assessment';
          const prereqDisplay = r?.prereq?.name || r?.prerequisite?.name || r?.prereq || '';
          return `
            <div class="fw-800" style="color:var(--clr-text-1); font-size:1rem;">${escapeHtml(title)}</div>
            <div class="text-muted text-xs mt-1 fw-600 d-flex gap-2 flex-wrap align-center">
              <span><span class="text-accent">PROGRAM:</span> ${escapeHtml(r?.programName || 'Unknown')}</span>
              <span>&bull;</span>
              <span><span class="text-accent">CLASS:</span> ${escapeHtml(r?.classBoard || 'Unknown')}</span>
              <span>&bull;</span>
              <span><span class="badge badge-primary" style="font-size:0.6rem; padding: 2px 6px;">LVL ${r?.level || '-'}</span></span>
              <span><span class="badge badge-neutral" style="font-size:0.6rem; padding: 2px 6px;">ORD ${r?.order || '-'}</span></span>
            </div>
            ${prereqDisplay ? `<div class="mt-2"><span class="badge badge-warning text-xs">&#9888;&#65039; Prereq: ${escapeHtml(prereqDisplay)}</span></div>` : ''}
          `;
        }
      },
      { 
        key: 'answerType', 
        label: 'Settings', 
        sortable: false,
        render: (val, row) => {
          const r = (row && typeof row === 'object') ? row : (val && typeof val === 'object' ? val : {}) || {};
          const ansType = (typeof val === 'string' ? val : r?.answerType) || 'Multiple Choice';
          return `
            <div class="d-flex flex-wrap gap-1">
              <span class="badge badge-info text-xs">${escapeHtml(ansType)}</span>
              <span class="badge ${r?.questionOrder === 'Random' ? 'badge-primary' : 'badge-neutral'} text-xs">${r?.questionOrder === 'Random' ? '&#128256; Random' : '&rarr; Seq'}</span>
              <span class="badge badge-neutral text-xs">${escapeHtml(r?.AssessmentCategory || 'Daily')}</span>
            </div>
            <div class="text-muted text-xs mt-2 fw-600">
              &#9201;&#65039; ${r?.timeLimit || 60} min &nbsp; | &nbsp; &#127919; Pass: ${r?.minScore || 60}%
            </div>
          `;
        }
      },
      { 
        key: 'qCount', 
        label: 'Questions', 
        sortable: true,
        render: (val, row) => {
          const r = (row && typeof row === 'object') ? row : (val && typeof val === 'object' ? val : {}) || {};
          const count = typeof val === 'number' ? val : (r?.qCount || 0);
          return `<span class="badge ${count > 0 ? 'badge-info' : 'badge-danger'} fw-700">${count} Qs</span>`;
        }
      },
      { 
        key: 'status', 
        label: 'Status', 
        sortable: true,
        render: (val, row) => {
          const r = (row && typeof row === 'object') ? row : (val && typeof val === 'object' ? val : {}) || {};
          const st = (typeof val === 'string' ? val : r?.status) || 'draft';
          return `<span class="badge ${statusColors[st] || 'badge-neutral'} fw-700" style="text-transform: uppercase;">${escapeHtml(st)}</span>`;
        }
      },
      { 
        key: 'actions', 
        label: 'Actions', 
        sortable: false,
        render: (val, row) => {
          const r = (row && typeof row === 'object') ? row : (val && typeof val === 'object' ? val : {}) || {};
          const id = r?.id || '';
          return `
            <div class="d-flex gap-2 justify-end">
              <button class="btn btn-ghost btn-sm" title="View Results" onclick="window._filterAssessmentResults='${id}'; window.loadSection('results');">&#128202; Results</button>
              <button class="btn btn-ghost btn-sm" title="Recalibrate Assessment" onclick="window._filterRecalibrateAssessment='${id}'; window.loadSection('recalibrator');">&#9878;&#65039;</button>
              <button class="btn btn-secondary btn-sm" onclick="window._duplicateAssessment('${id}')" title="Duplicate Assessment">Copy</button>
              <button class="btn ${r?.status === 'published' ? 'btn-danger' : 'btn-success'} btn-sm" onclick="window._publishAssessment('${id}', '${r?.status || 'draft'}')">
                ${r?.status === 'published' ? 'Unpublish' : 'Publish'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.openAssessmentBuilder('${id}')">Edit</button>
              <button class="btn btn-secondary btn-sm" style="color: var(--clr-accent-1);" onclick="window._deleteRecord('Assessments', '${id}', '${escapeHtml(r?.title || '')}')">Del</button>
            </div>
          `;
        }
      }
    ]
  });
}

// Helpers
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function formatAnswerType(type) {
  switch(type) {
    case 'speech_to_text': return '\uD83C\uDF99\uFE0F Speech';
    case 'dropdown': return '\uD83D\uDD3D Drop-down';
    case 'multiple_choice': return '\uD83D\uDD18 Mult Choice';
    case 'written': return '\u270F\uFE0F Written';
    default: return String(type);
  }
}

window._publishAssessment = async (AssessmentId, currentStatus) => {
  const newStatus = currentStatus === 'published' ? 'unpublished' : 'published';
  try {
    await adminUpdate('Assessments', AssessmentId, { Assessment_status: newStatus });
    showToast(`Assessment ${newStatus}.`, 'success');
    window.loadSection('Assessments');
  } catch(e) { showToast(e.message, 'error'); }
};

window._duplicateAssessment = async (AssessmentId) => {
  if (!confirm(`Are you sure you want to duplicate this Assessment?`)) return;
  
  showLoading('Duplicating Assessment and questions...');
  try {
    const sb = await getSupabase();
    
    // 1. Fetch original Assessment
    const { data: rec, error: recErr } = await sb.from('Assessments').select('*').eq('id', AssessmentId).single();
    if (recErr) throw new Error(recErr.message);

    // 2. Fetch original questions
    const { data: questions, error: qErr } = await sb.from('questions').select('*').eq('Assessment_id', AssessmentId);
    if (qErr) throw new Error(qErr.message);

    // 3. Duplicate Assessment
    const newAssessment = { ...rec };
    delete newAssessment.id;
    delete newAssessment.created_at;
    delete newAssessment.updated_at;
    delete newAssessment.deleted_at;
    delete newAssessment.classes;
    delete newAssessment.levels;
    delete newAssessment.institutions;
    newAssessment.Assessment_title = `${newAssessment.Assessment_title || newAssessment.display_name || 'Assessment'} (Copy)`;
    newAssessment.display_name = `${newAssessment.display_name || newAssessment.Assessment_title} (Copy)`;
    newAssessment.Assessment_status = 'draft';

    const { data: createdAssessment, error: eErr } = await sb.from('Assessments').insert([newAssessment]).select().single();
    if (eErr) throw new Error(eErr.message);

    // 4. Duplicate Questions
    if (questions && questions.length > 0) {
      const newQuestions = questions.map(q => {
        const newQ = { ...q, Assessment_id: createdAssessment.id };
        delete newQ.id;
        delete newQ.created_at;
        delete newQ.updated_at;
        delete newQ.deleted_at;
        return newQ;
      });
      const { error: qInsertErr } = await sb.from('questions').insert(newQuestions);
      if (qInsertErr) throw new Error(qInsertErr.message);
    }

    // 5. Duplicate Class Assignments
    const { data: assignments } = await sb.from('Assessment_programs').select('program_id').eq('Assessment_id', AssessmentId);
    if (assignments && assignments.length > 0) {
       const newAssignments = assignments.map(a => ({ Assessment_id: createdAssessment.id, program_id: a.program_id }));
       const { error: assignErr } = await sb.from('Assessment_programs').insert(newAssignments);
       if (assignErr) throw new Error(assignErr.message);
    }
    
    clearAdminCache('Assessments');
    clearAdminCache('questions');
    clearAdminCache('Assessment_programs');

    showToast('Assessment duplicated successfully!', 'success');
    window.loadSection('Assessments');
  } catch (e) {
    console.error(e);
    showToast('Error duplicating Assessment: ' + e.message, 'error');
  } finally {
    hideLoading();
  }
};

window.openAssessmentBuilder = async (AssessmentId) => {
  await openAssessmentBuilder(AssessmentId);
};

export async function renderQuestions(area) {
  const [questions, rawAssessments] = await Promise.all([
    adminFetchAll('questions'),
    adminFetchAll('Assessments', 'id, name, Assessment_type').catch(() => [])
  ]);

  const AssessmentMap = new Map((rawAssessments || []).map(e => [e.id, e]));

  area.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Questions <span class="count-chip">${questions.length} Total</span></h2>
        <p class="section-subtitle">Question item bank for Assessmentinations</p>
      </div>
    </div>
    <div id="questions-grid-container" class="card mt-4" style="padding:1rem;"></div>
  `;

  window._qRecords = {};
  questions.forEach(q => { window._qRecords[q.id] = q; });

  const gridData = questions.map(q => {
    const matchedAssessment = AssessmentMap.get(q.Assessment_id);
    const AssessmentDisplay = matchedAssessment ? `${matchedAssessment.Assessment_type ? matchedAssessment.Assessment_type + ' — ' : ''}${matchedAssessment.name}` : (q.Assessments ? window.formatAssessmentDisplayName(q.Assessments) : '—');
    return {
      id: q.id,
      order: q.question_order,
      text: q.question_text || '',
      correctAnswer: q.correct_answer || '',
      type: q.answer_type,
      AssessmentDisplay: AssessmentDisplay,
      _raw: q
    };
  });

  new (DataGrid || window.DataGrid)({
    container: 'questions-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['text', 'correctAnswer', 'AssessmentDisplay'],
    bulkActions: false,
    onRowClick: (row) => {
      const body = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <h4 style="margin:0; font-size:1.2rem;">Question #${row.order}</h4>
            <div class="text-muted text-sm">Assessment: <strong style="color:var(--fm-text-primary);">${escapeHtml(row.AssessmentDisplay)}</strong></div>
          </div>
          <hr style="border-color:var(--fm-border-subtle); margin:0;">
          <div>
            <div class="text-sm text-muted mb-1">Question Text</div>
            <div class="fw-600 p-2 rounded" style="background:var(--fm-bg-1);">${escapeHtml(row.text)}</div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Correct Answer</div>
            <div class="fw-600 p-2 rounded" style="background:rgba(74,222,128,0.1);color:var(--clr-success,#4ade80);font-family:monospace;">${escapeHtml(row.correctAnswer)}</div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Answer Type</div>
            <div class="fw-600"><span class="badge badge-info">${formatAnswerType(row.type)}</span></div>
          </div>
        </div>
      `;
      const footer = `
        <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
        <button class="btn btn-primary" onclick="window.openCrudModal('questions', window._qRecords['${row.id}']); closeRecordDrawer();">Edit Question</button>
      `;
      if (window.openRecordDrawer) window.openRecordDrawer('Question Details', body, footer);
    },
    columns: [
      { key: 'order', label: 'No', sortable: true, render: (val, row) => `<div class="text-center text-muted fw-700">${row ? (row.order ?? val) : val}</div>` },
      { key: 'text', label: 'Question Text', sortable: true, render: (val, row) => {
        const str = String((row ? row.text : val) || '');
        return `<div class="fw-600">${escapeHtml(str.slice(0, 70))}${str.length > 70 ? '...' : ''}</div>`;
      }},
      { key: 'correctAnswer', label: 'Correct Answer', sortable: true, render: (val, row) => {
        const str = String((row ? row.correctAnswer : val) || '');
        return `<div class="text-sm" style="color:var(--clr-success,#4ade80);font-family:monospace;">${escapeHtml(str.slice(0, 40))}${str.length > 40 ? '...' : ''}</div>`;
      }},
      { key: 'type', label: 'Answer Type', sortable: true, render: (val, row) => `<div class="text-center"><span class="badge badge-info">${formatAnswerType((row ? row.type : val) || '')}</span></div>` },
      { key: 'AssessmentDisplay', label: 'Assessment Title', sortable: true, render: (val, row) => `<div class="text-muted text-sm">${escapeHtml(String((row ? row.AssessmentDisplay : val) || '—'))}</div>` },
      { key: 'actions', label: 'Actions', sortable: false, render: (val, row) => {
        const r = row || (typeof val === 'object' ? val : {}) || {};
        return `
          <div class="d-flex gap-2 justify-end">
            <button class="btn btn-secondary btn-sm" onclick="window.openCrudModal('questions', window._qRecords['${r.id}'])">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="window._deleteRecord('questions', '${r.id}', 'Question #${r.order || ''}')">Del</button>
          </div>
        `;
      }}
    ]
  });
}

export async function renderResults(area) {
  const [rawData, allPrograms, allClasses, allBatches] = await Promise.all([
    adminFetchAll('attempts', '*, students!student_id(name, gender, batch_id, batches!batch_id(name), program_id, programs!program_id(name, institution_id, institutions!institution_id(name))), Assessments!Assessment_id(name, Assessment_type), attempt_answers(id, evaluation_result, score)'),
    adminFetchAll('institutions'),
    adminFetchAll('programs'),
    adminFetchAll('batches')
  ]);

  const submittedOnly = rawData.filter(r => ['submitted', 'auto_submitted'].includes(r.status));

  // Deduplicate by Student + Assessment, keeping highest score only
  const mergedResults = new Map();
  submittedOnly.forEach(r => {
    const key = `${r.student_id}_${r.Assessment_id}`;
    const existing = mergedResults.get(key);
    if (!existing) {
      mergedResults.set(key, r);
    } else {
      const existingScore = parseFloat(existing.percentage || 0);
      const currentScore = parseFloat(r.percentage || 0);
      if (currentScore > existingScore || (currentScore === existingScore && new Date(r.submitted_at) > new Date(existing.submitted_at))) {
        mergedResults.set(key, r);
      }
    }
  });
  const deduplicated = Array.from(mergedResults.values());

  area.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Results <span class="count-chip" id="res-count-chip">${deduplicated.length} Total</span></h2>
        <p class="section-subtitle">Student Assessment attempt submissions</p>
      </div>
    </div>
    <div id="results-grid-container" class="card mt-4" style="padding:1rem;"></div>
  `;

  const gridData = deduplicated.map(r => {
    const answers = r.attempt_answers || [];
    let attCorrect = 0, attMinor = 0, attWrong = 0;
    answers.forEach(a => {
      const res = (a.evaluation_result || '').toLowerCase();
      const sc  = parseFloat(a.score || 0);
      if (res === 'correct' || sc >= 1)          attCorrect++;
      else if (res.includes('minor') || (sc > 0 && sc < 1)) attMinor++;
      else                                        attWrong++;
    });

    return {
      id: r.id,
      studentId: r.student_id,
      studentName: r.students?.name || 'Unknown',
      program: r.students?.programs?.institutions?.name || '—',
      className: r.students?.programs?.name || '—',
      batch: r.students?.batches?.name || '—',
      AssessmentTitle: r.Assessments?.name || 'Unknown Assessment',
      score: r.percentage ? parseFloat(r.percentage).toFixed(1) : '0.0',
      grade: r.grade || '-',
      correct: attCorrect,
      minor: attMinor,
      wrong: attWrong,
      submittedAt: r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—',
      _raw: r
    };
  });

  new (DataGrid || window.DataGrid)({
    container: 'results-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['studentName', 'program', 'className', 'batch', 'AssessmentTitle'],
    bulkActions: false,
    onRowClick: (row) => {
      const body = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <h4 style="margin:0; font-size:1.2rem;">${escapeHtml(row.studentName)}</h4>
            <div class="text-muted text-sm">Assessment: <strong style="color:var(--fm-text-primary);">${escapeHtml(row.AssessmentTitle)}</strong></div>
          </div>
          <hr style="border-color:var(--fm-border-subtle); margin:0;">
          <div>
            <div class="text-sm text-muted mb-1">Enrollment</div>
            <div class="fw-600">${escapeHtml(row.program)} / ${escapeHtml(row.className)} / ${escapeHtml(row.batch)}</div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Performance</div>
            <div class="fw-600" style="font-size:1.5rem;">${row.score}% <span class="badge badge-primary text-sm ml-2">${escapeHtml(row.grade)}</span></div>
          </div>
          <div class="d-flex gap-2">
             <div class="p-2 rounded text-center" style="background:rgba(74,222,128,0.1);flex:1;">
               <div class="text-xs text-muted">Correct</div>
               <div class="fw-800" style="color:var(--clr-success,#4ade80);">${row.correct}</div>
             </div>
             <div class="p-2 rounded text-center" style="background:rgba(251,191,36,0.1);flex:1;">
               <div class="text-xs text-muted">Half</div>
               <div class="fw-800" style="color:var(--clr-warning,#fbbf24);">${row.minor}</div>
             </div>
             <div class="p-2 rounded text-center" style="background:rgba(248,113,113,0.1);flex:1;">
               <div class="text-xs text-muted">Wrong</div>
               <div class="fw-800" style="color:var(--clr-danger,#f87171);">${row.wrong}</div>
             </div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Submitted At</div>
            <div class="fw-600">${row.submittedAt}</div>
          </div>
        </div>
      `;
      const footer = `
        <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
        <button class="btn btn-primary" onclick="window.openStudentProfile('${row.studentId}'); closeRecordDrawer();">View Profile</button>
      `;
      if (window.openRecordDrawer) window.openRecordDrawer('Attempt Details', body, footer);
    },
    columns: [
      { key: 'studentName', label: 'Student', sortable: true, render: (val) => `<div class="fw-700" style="color:var(--clr-text-1);">${escapeHtml(val)}</div>` },
      { key: 'program', label: 'Program', sortable: true, render: (val) => `<div class="text-xs text-muted">${escapeHtml(val)}</div>` },
      { key: 'className', label: 'Class', sortable: true, render: (val) => `<div class="text-xs text-muted">${escapeHtml(val)}</div>` },
      { key: 'batch', label: 'Batch', sortable: true, render: (val) => `<div class="text-xs text-muted">${escapeHtml(val)}</div>` },
      { key: 'AssessmentTitle', label: 'Assessment', sortable: true, render: (val) => `<div class="fw-600">${escapeHtml(val)}</div>` },
      { key: 'score', label: 'Score', sortable: true, render: (val) => `<div class="text-center fw-800">${val}%</div>` },
      { key: 'grade', label: 'Grade', sortable: true, render: (val) => `<div class="text-center"><span class="badge badge-primary fw-800">${escapeHtml(val)}</span></div>` },
      { key: 'correct', label: 'Correct', sortable: true, render: (val, row) => `<div class="text-center"><span class="badge ${val > 0 ? 'badge-success' : 'badge-neutral'}">${val}</span></div>` },
      { key: 'minor', label: 'Half', sortable: true, render: (val) => `<div class="text-center"><span class="badge ${val > 0 ? 'badge-warning' : 'badge-neutral'}">${val}</span></div>` },
      { key: 'wrong', label: 'Incorrect', sortable: true, render: (val) => `<div class="text-center"><span class="badge ${val > 0 ? 'badge-danger' : 'badge-neutral'}">${val}</span></div>` },
      { key: 'submittedAt', label: 'Submitted', sortable: true, render: (val) => `<div class="text-center text-xs text-muted">${val}</div>` },
      { key: 'actions', label: 'Profile', sortable: false, render: (val, row) => `<div class="text-center"><button class="btn btn-secondary btn-sm" onclick="window.openStudentProfile('${row.studentId}')">View</button></div>` }
    ]
  });
}

