import { adminFetchAll, adminUpdate, previewRecalibrateExam, applyRecalibrateExam, isPassing, calculatePercentage, formatStudentName } from '../api.js?v=3.1.0';
import { showToast, showLoading, hideLoading, getGrade } from '../app.js?v=3.1.0';
import { openStudentProfile } from './student-management.js?v=3.1.0';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
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
        adminFetchAll('attempts', '*, students(name, gender, batch_id, batches(name), program_id, programs(name, institution_id, institutions(name))), exams(exam_title, exam_type), attempt_answers(id, evaluation_result, score)'),
        adminFetchAll('institutions'),
        adminFetchAll('programs'),
        adminFetchAll('batches')
      ]);

      const submittedOnly = rawData.filter(r => ['submitted', 'auto_submitted'].includes(r.status));
      // Default: sort alphabetically by Student Name (A-Z)
      let allData = [...submittedOnly].sort((a, b) => (a.students?.name || '').localeCompare(b.students?.name || ''));
      if (window._filterExamResults) {
        allData = allData.filter(r => r.exam_id === window._filterExamResults);
      }

      let selectedProg = '';
      let selectedClass = '';
      let selectedBatch = '';
      let searchQuery = '';
      let currentDeduplicatedResults = [];

      area.innerHTML = `
        <div class="section-header d-flex justify-between align-center flex-wrap gap-2">
          <div>
            <h2 class="section-title">Results <span class="count-chip" id="res-count-chip">${allData.length} Total</span></h2>
            <p class="section-subtitle">Student exam attempt submissions grouped and filterable by Program, Class, and Batch</p>
          </div>
          <div>
            <button class="btn btn-secondary btn-sm" id="export-gradebook-btn" style="display:inline-flex;align-items:center;gap:6px;font-weight:600;">
              ðŸ“Š Export Gradebook (.xlsx)
            </button>
          </div>
        </div>

        ${window._filterExamResults ? `
          <div class="mb-3 p-2 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;font-size:0.85rem;">
            <span>⚡ Filtered Results for Selected Challenge (${allData.length} attempts)</span>
            <button class="btn btn-ghost btn-xs" id="clear-exam-results-btn" style="text-decoration:underline;color:#93c5fd;">Show All Challenge Results</button>
          </div>
        ` : ''}

        <!-- Filter Bar -->
        <div class="filter-bar mb-4 p-3 rounded d-flex gap-3 align-center flex-wrap" style="background:var(--clr-surface-2);border:1px solid var(--clr-border);">
          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Program</label>
            <select id="res-filter-prog" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">â€” All Institutions â€”</option>
              ${(allPrograms || []).filter(p => !p.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Class</label>
            <select id="res-filter-class" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">â€” All Programs â€”</option>
              ${(allClasses || []).filter(c => !c.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => `<option value="${c.id}" data-prog="${c.institution_id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Batch (Group)</label>
            <select id="res-filter-batch" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">â€” All Batches â€”</option>
              ${(allBatches || []).filter(b => !b.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(b => `<option value="${b.id}" data-class="${b.program_id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          </div>

          <div style="flex:1;min-width:220px;">
            <label class="text-xs text-muted d-block mb-1">Search Student / Exam</label>
            <input type="text" id="res-filter-search" class="form-control" placeholder="Type student name or exam titleâ€¦" style="padding:6px 10px;font-size:0.85rem;">
          </div>

          <div class="d-flex align-end" style="padding-top:18px;">
            <button class="btn btn-ghost btn-sm" id="res-btn-reset" title="Reset all filters">âœ• Reset</button>
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
                <th class="text-left">Exam Title</th>
                <th class="text-center">Score</th>
                <th class="text-center">Grade</th>
                <th class="text-center">âœ… Correct</th>
                <th class="text-center">âš ï¸ Half</th>
                <th class="text-center">âŒ Incorrect</th>
                <th class="text-center">Submitted At</th>
                <th class="text-center" style="width:100px;">Profile</th>
              </tr>
            </thead>
            <tbody id="tbl-results-body"></tbody>
          </table>
        </div>
      `;

      const progSelect  = document.getElementById('res-filter-prog');
      const classSelect = document.getElementById('res-filter-class');
      const batchSelect = document.getElementById('res-filter-batch');
      const searchInput = document.getElementById('res-filter-search');
      const tbody       = document.getElementById('tbl-results-body');
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
            const eTitle = (r.exams?.exam_title || '').toLowerCase();
            const eType = (r.exams?.exam_type || '').toLowerCase();
            if (!sName.includes(q) && !eTitle.includes(q) && !eType.includes(q)) return false;
          }
          return true;
        });

        // Deduplicate by Student + Exam, keeping highest score only
        const mergedResults = new Map();
        filtered.forEach(r => {
          const key = `${r.student_id}_${r.exam_id}`;
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

        countChip.textContent = `${deduplicated.length} attempts (Merged)`;

        if (!deduplicated.length) {
          tbody.innerHTML = '<tr><td colspan="12" class="text-center text-muted p-5">No submitted results match the selected filters.</td></tr>';
          return;
        }

        tbody.innerHTML = deduplicated.map(r => {
          // Compute correct / minor / wrong from attempt_answers
          const answers = r.attempt_answers || [];
          let attCorrect = 0, attMinor = 0, attWrong = 0;
          answers.forEach(a => {
            const res = (a.evaluation_result || '').toLowerCase();
            const sc  = parseFloat(a.score || 0);
            if (res === 'correct' || sc >= 1)          attCorrect++;
            else if (res.includes('minor') || (sc > 0 && sc < 1)) attMinor++;
            else                                        attWrong++;
          });
          const total = answers.length;
          const correctLabel = total > 0
            ? `<span class="badge badge-success" style="font-size:0.75rem;">${attCorrect}</span>`
            : '<span class="text-muted text-xs">â€”</span>';
          const halfLabel = total > 0
            ? `<span class="badge badge-warning" style="font-size:0.75rem;">${attMinor}</span>`
            : '<span class="text-muted text-xs">â€”</span>';
          const wrongLabel  = total > 0
            ? `<span class="badge badge-danger" style="font-size:0.75rem;">${attWrong}</span>`
            : '<span class="text-muted text-xs">â€”</span>';

          const studentId = r.student_id;

          return `
          <tr>
            <td class="fw-600" style="color:var(--clr-text-1);">${formatStudentName(r.students?.name, r.students?.gender) || 'â€”'}</td>
            <td class="text-muted text-sm">${escapeHtml(r.students?.programs?.institutions?.name || 'â€”')}</td>
            <td class="text-muted text-sm">${escapeHtml(r.students?.programs?.name || 'â€”')}</td>
            <td><span class="badge ${r.students?.batches?.name ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">${escapeHtml(r.students?.batches?.name || 'Unassigned')}</span></td>
            <td class="text-sm fw-600">${r.exams?.exam_type ? escapeHtml(r.exams.exam_type) + ' â€” ' : ''}${escapeHtml(r.exams?.exam_title || 'â€”')}</td>
            <td class="text-center fw-700 text-grade-${r.grade || 'F'}">${parseFloat(r.percentage || 0).toFixed(1)}%</td>
            <td class="text-center"><span class="grade-badge grade-${r.grade || 'F'}" style="width:30px;height:30px;font-size:0.85rem;">${r.grade || 'â€”'}</span></td>
            <td class="text-center">${correctLabel}</td>
            <td class="text-center">${wrongLabel}</td>
            <td class="text-center text-muted text-xs">${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'â€”'}</td>
            <td class="text-center">
              <button class="btn btn-ghost btn-sm results-view-profile-btn" data-sid="${studentId}" style="font-size:0.75rem; padding:3px 10px; display:inline-flex; align-items:center; gap:4px;" title="View full student profile">
                ðŸ‘¤ Profile
              </button>
            </td>
          </tr>
        `;
        }).join('');
      };

      progSelect.addEventListener('change', () => { updateClassOptions();       renderTable();

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
        const exportData = rowsToExport.map(r => ({
          'Student Name': r.students?.name || 'â€”',
          'Gender': r.students?.gender ? (r.students.gender === 'female' ? 'Female' : 'Male') : 'â€”',
          'Institution': r.students?.programs?.institutions?.name || 'â€”',
          'Program': r.students?.programs?.name || 'â€”',
          'Batch': r.students?.batches?.name || 'â€”',
          'Exam Title': r.exams?.exam_title || 'â€”',
          'Exam Type': r.exams?.exam_type || 'â€”',
          'Score': r.score != null ? r.score : 'â€”',
          'Percentage (%)': r.percentage != null ? `${r.percentage}%` : 'â€”',
          'Grade': r.grade || (r.percentage != null ? getGrade(r.percentage) : 'â€”'),
          'Submitted At': r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'â€”',
          'Status': r.status || 'â€”'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gradebook');
        const filename = `Gradebook_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast(`Exported ${exportData.length} records to ${filename}`, 'success');
      }); });
      classSelect.addEventListener('change', () => { updateBatchOptions();       renderTable();

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
        const exportData = rowsToExport.map(r => ({
          'Student Name': r.students?.name || 'â€”',
          'Gender': r.students?.gender ? (r.students.gender === 'female' ? 'Female' : 'Male') : 'â€”',
          'Institution': r.students?.programs?.institutions?.name || 'â€”',
          'Program': r.students?.programs?.name || 'â€”',
          'Batch': r.students?.batches?.name || 'â€”',
          'Exam Title': r.exams?.exam_title || 'â€”',
          'Exam Type': r.exams?.exam_type || 'â€”',
          'Score': r.score != null ? r.score : 'â€”',
          'Percentage (%)': r.percentage != null ? `${r.percentage}%` : 'â€”',
          'Grade': r.grade || (r.percentage != null ? getGrade(r.percentage) : 'â€”'),
          'Submitted At': r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'â€”',
          'Status': r.status || 'â€”'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gradebook');
        const filename = `Gradebook_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast(`Exported ${exportData.length} records to ${filename}`, 'success');
      }); });
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
        const exportData = rowsToExport.map(r => ({
          'Student Name': r.students?.name || 'â€”',
          'Gender': r.students?.gender ? (r.students.gender === 'female' ? 'Female' : 'Male') : 'â€”',
          'Institution': r.students?.programs?.institutions?.name || 'â€”',
          'Program': r.students?.programs?.name || 'â€”',
          'Batch': r.students?.batches?.name || 'â€”',
          'Exam Title': r.exams?.exam_title || 'â€”',
          'Exam Type': r.exams?.exam_type || 'â€”',
          'Score': r.score != null ? r.score : 'â€”',
          'Percentage (%)': r.percentage != null ? `${r.percentage}%` : 'â€”',
          'Grade': r.grade || (r.percentage != null ? getGrade(r.percentage) : 'â€”'),
          'Submitted At': r.submitted_at ? new Date(r.submitted_at).toLocaleString() : 'â€”',
          'Status': r.status || 'â€”'
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Gradebook');
        const filename = `Gradebook_Export_${new Date().toISOString().slice(0, 10)}.xlsx`;
        XLSX.writeFile(wb, filename);
        showToast(`Exported ${exportData.length} records to ${filename}`, 'success');
      });

      // Event delegation: Profile buttons (re-rendered on each filter change)
      tbody.addEventListener('click', e => {
        const btn = e.target.closest('.results-view-profile-btn');
        if (!btn) return;
        const sid = btn.getAttribute('data-sid');
        if (!sid) return;
        // Collect all currently visible student IDs (deduplicated order) for batch nav
        const allSids = Array.from(tbody.querySelectorAll('.results-view-profile-btn'))
          .map(b => b.getAttribute('data-sid'))
          .filter((v, i, arr) => arr.indexOf(v) === i); // unique
        openStudentProfile(sid, allSids);
      });
    }

    // â”€â”€ STUDENT PROGRESS (Level Progression with Batch Grouping) â”€â”€

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
          adminFetchAll('assignments', 'student_id, batch_id, assessment_id'),
          adminFetchAll('assessments', 'id, title, level_id, levels(name, level_number)'),
          adminFetchAll('attempts', 'student_id, assessment_id, status, is_best_score')
        ]);

        const allData = [];

        // Map V1 Data
        const assessmentsMap = new Map((allAssessments || []).map(a => [a.id, a]));
        
        (allStudents || []).filter(s => !s.deleted_at).forEach(student => {
          const sAssignments = (allAssignments || []).filter(a => 
            a.student_id === student.id || (a.batch_id && a.batch_id === student.batch_id)
          );
          
          // To avoid duplicates if both student and batch assigned
          const assignedAssesIds = new Set(sAssignments.map(a => a.assessment_id));

          assignedAssesIds.forEach(assessmentId => {
            const assessment = assessmentsMap.get(assessmentId);
            if (!assessment) return;

            const studentAttempts = (allAttempts || []).filter(att => att.student_id === student.id && att.assessment_id === assessmentId);
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

          <!-- Filter Bar -->
          <div class="filter-bar mb-4 p-3 rounded d-flex gap-3 align-center flex-wrap" style="background:var(--clr-surface-2);border:1px solid var(--clr-border);">
            <div style="min-width:180px;">
              <label class="text-xs text-muted d-block mb-1">Filter Program</label>
              <select id="prog-filter-prog" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
                <option value="">â€” All Institutions â€”</option>
                ${(allPrograms || []).filter(p => !p.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
              </select>
            </div>

            <div style="min-width:180px;">
              <label class="text-xs text-muted d-block mb-1">Filter Class</label>
              <select id="prog-filter-class" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
                <option value="">â€” All Programs â€”</option>
                ${(allClasses || []).filter(c => !c.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => `<option value="${c.id}" data-prog="${c.institution_id}">${escapeHtml(c.name)}</option>`).join('')}
              </select>
            </div>

            <div style="min-width:180px;">
              <label class="text-xs text-muted d-block mb-1">Filter Batch (Group)</label>
              <select id="prog-filter-batch" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
                <option value="">â€” All Batches â€”</option>
                ${(allBatches || []).filter(b => !b.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(b => `<option value="${b.id}" data-class="${b.program_id}">${escapeHtml(b.name)}</option>`).join('')}
              </select>
            </div>

            <div style="flex:1;min-width:220px;">
              <label class="text-xs text-muted d-block mb-1">Search Student / Assessment</label>
              <input type="text" id="prog-filter-search" class="form-control" placeholder="Type student name or assessment..." style="padding:6px 10px;font-size:0.85rem;">
            </div>

            <div class="d-flex align-end" style="padding-top:18px;">
              <button class="btn btn-ghost btn-sm" id="prog-btn-reset" title="Reset all filters">âœ• Reset</button>
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
              <td class="fw-600" style="color:var(--clr-text-1);">${formatStudentName(r.student?.name, r.student?.gender) || '—'}</td>
              <td class="text-muted text-sm">${escapeHtml(r.student?.programs?.institutions?.name || '—')}</td>
              <td class="text-muted text-sm">${escapeHtml(r.student?.programs?.name || '—')}</td>
              <td><span class="badge ${r.student?.batches?.name ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">${escapeHtml(r.student?.batches?.name || 'Unassigned')}</span></td>
              <td class="fw-600 text-sm">${escapeHtml(r.assessmentTitle || '—')}</td>
              <td class="text-center"><span class="badge badge-primary">Level ${toLevelLetter(r.levelNumber)} ${escapeHtml(r.levelName || '')}</span></td>
              <td class="text-center">
                <span class="badge ${r.is_completed ? 'badge-success' : r.is_in_progress ? 'badge-warning' : 'badge-neutral'}">
                  ${r.is_completed ? '✓ Completed' : r.is_in_progress ? '▶ In Progress' : '🔒 Not Started'}
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
    // â”€â”€ AUDIT LOG â”€â”€

    export async function renderRecalibrator(area) {
      showLoading('Loading exams for recalibrationâ€¦');
      const allExams = await adminFetchAll('exams');
      hideLoading();
      const activeExams = allExams.filter(e => !e.deleted_at).sort((a, b) => (a.exam_title || '').localeCompare(b.exam_title || ''));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title text-gradient" style="font-size:1.6rem;">âš¡ Exam Recalibrator</h2>
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
                <option value="">â€” Choose an Exam to Recalibrate â€”</option>
                ${activeExams.map(e => `<option value="${e.id}">[${escapeHtml(e.exam_type || 'Exam')}] ${escapeHtml(e.exam_title || e.display_name || e.id)}</option>`).join('')}
              </select>
            </div>
            <div style="display: flex; gap: 12px; align-items: flex-end; padding-top: 20px;">
              <button class="btn btn-primary" id="btn-preview-recal" disabled>ðŸ” Preview Recalibration</button>
              <button class="btn btn-success" id="btn-apply-recal" disabled style="background:linear-gradient(135deg,#10b981,#059669);font-weight:700;">âš¡ Apply Recalibration</button>
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
              <div class="text-xs text-muted mb-1">Status: FAIL âž” PASS</div>
              <div class="fw-700" style="font-size:1.6rem; color: #10b981;" id="recal-metric-fail-pass">0</div>
            </div>
            <div class="glass-card p-4 text-center" style="border-left: 4px solid #f43f5e;">
              <div class="text-xs text-muted mb-1">Status: PASS âž” FAIL</div>
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
            <div style="font-size: 2.8rem; margin-bottom: 1rem;">âš¡</div>
            <h3 class="mb-2">Confirm Exam Recalibration?</h3>
            <p class="text-muted text-sm mb-4" id="recal-modal-desc">
              This will safely update historical submitted scores, percentages, grades, and student progression using the authoritative grading engine.
            </p>
            <div class="p-4 rounded text-left text-xs mb-6" style="background: rgba(255,255,255,0.04); border: 1px solid var(--clr-border);">
              <div class="mb-1">â€¢ <b>Affected Attempts:</b> <span id="modal-affected-count" class="fw-700 text-primary">0</span></div>
              <div class="mb-1">â€¢ <b>Status Transitions:</b> <span id="modal-status-changes" class="fw-700">0</span></div>
              <div>â€¢ <b>Audit Trail:</b> An audit log entry will be permanently recorded.</div>
            </div>
            <div class="d-flex gap-3 justify-between">
              <button class="btn btn-secondary" id="btn-recal-cancel" style="flex:1;">Cancel</button>
              <button class="btn btn-primary" id="btn-recal-confirm-run" style="flex:1; background: linear-gradient(135deg,#10b981,#059669); border:none;">âœ“ Yes, Apply Changes</button>
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
            statusBadge = '<span class="badge badge-success fw-700">FAIL âž” PASS âœ¨</span>';
          } else if (isStatusFail) {
            statusBadge = '<span class="badge badge-danger fw-700">PASS âž” FAIL âš ï¸</span>';
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

        showLoading('Calculating recalibration preview across all attemptsâ€¦');
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

        showLoading('Applying recalibration to historical student resultsâ€¦');
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

    // â”€â”€ Student Import Engine â”€â”€