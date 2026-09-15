import { adminFetchAll, formatStudentName } from '../api.js?v=1.4';
import { getGrade, showToast } from '../app.js?v=1.4';
import { DataGrid } from './datagrid.js';

let studentGrid = null;

export async function renderStudents(area) {
  const [rawData, allAttempts, allLevels] = await Promise.all([
    adminFetchAll('students', '*, programs(name), institutions(name), batches(name)'),
    adminFetchAll('attempts'),
    adminFetchAll('levels')
  ]);
  const levelsMap = new Map();
  (allLevels || []).forEach(l => levelsMap.set(l.id, l));

  // Detect duplicate students within the same class
  const dupMap = new Map();
  rawData.forEach(s => {
    if (s.deleted_at) return;
    const key = \`\${s.program_id}::\${(s.name || '').toLowerCase().trim()}\`;
    if (!dupMap.has(key)) dupMap.set(key, []);
    dupMap.get(key).push(s);
  });
  const duplicateGroups = Array.from(dupMap.values()).filter(g => g.length > 1);
  const totalDuplicates = duplicateGroups.reduce((acc, g) => acc + (g.length - 1), 0);
  
  // Format data for DataGrid
  const gridData = rawData.filter(s => !s.deleted_at).map(s => {
    const studentAttempts = allAttempts.filter(a => a.student_id === s.id);
    const completedExamsCount = new Set(studentAttempts.filter(a => a.status === 'SUBMITTED').map(a => a.exam_id)).size;
    const latestAttempt = studentAttempts.sort((a,b) => new Date(b.created_at) - new Date(a.created_at))[0];
    
    // Overall logic from old app.js
    let overallScoreStr = '-';
    let globalGrade = '-';
    let overallColor = 'rgba(255,255,255,0.4)';
    if (completedExamsCount > 0) {
      let totalMaxScore = 0;
      let totalObtained = 0;
      studentAttempts.filter(a => a.status === 'SUBMITTED').forEach(a => {
        totalMaxScore += (a.max_score || 0);
        totalObtained += (a.total_score || 0);
      });
      if (totalMaxScore > 0) {
        const pct = Math.round((totalObtained / totalMaxScore) * 100);
        overallScoreStr = \`\${pct}%\`;
        if (typeof getGrade === 'function') {
           const g = getGrade(pct);
           globalGrade = g.label;
           overallColor = g.color;
        }
      }
    }

    return {
      ...s,
      displayName: formatStudentName(s.name, s.gender),
      instName: s.institutions?.name || 'N/A',
      progName: s.programs?.name || 'N/A',
      batchName: s.batches?.name || '-',
      pinDisplay: s.pin || 'NOT SET',
      completedExams: completedExamsCount,
      latestActivity: latestAttempt ? new Date(latestAttempt.created_at).toLocaleDateString() : 'Never',
      overallScoreStr,
      globalGrade,
      overallColor
    };
  });

  // Filter data if navigated from Batches
  const filteredGridData = window._filterBatchId
    ? gridData.filter(s => s.batch_id === window._filterBatchId)
    : gridData;

  area.innerHTML = `
    <div class="section-header">
      <div>
        <h2 class="section-title">Students <span class="count-chip">${filteredGridData.length} Active</span></h2>
        <p class="section-subtitle">Manage enrolled students with Batch, Overall Score & Global Grade</p>
      </div>
      <div class="d-flex gap-2">
        ${totalDuplicates > 0 ? `<button class="btn btn-warning btn-sm" id="students-merge-shortcut" style="font-weight:700;">🔄 Resolve Duplicates (${totalDuplicates})</button>` : ''}
        <button class="btn btn-secondary btn-sm" id="students-import-shortcut">📥 Import</button>
        <button class="btn btn-success btn-sm" id="students-export-btn">📊 Export CSV</button>
        <button class="btn btn-primary btn-sm" id="students-add-shortcut">+ Add Student</button>
      </div>
    </div>

    ${window._filterBatchId ? `
      <div class="mb-4 p-3 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.15);border:1px solid rgba(59,130,246,0.4);color:#93c5fd;">
        <div class="d-flex align-center gap-2">
          <span style="font-size:1.2rem;">🏛️</span>
          <span>Filtered by Batch: <strong>${window._filterBatchName || 'Selected Batch'}</strong> (${filteredGridData.length} students)</span>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="window._filterBatchId=null; window._filterBatchName=null; window.loadSection('students');" style="text-decoration:underline;color:#93c5fd;">
          Show All Batches
        </button>
      </div>
    ` : ''}

    ${totalDuplicates > 0 ? `
      <div class="mb-4 p-3 rounded d-flex align-center justify-between" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#fef3c7;">
        <div class="d-flex align-center gap-3">
          <span style="font-size:1.4rem;">⚠️</span>
          <div>
            <div class="fw-700 text-sm">Detected ${totalDuplicates} Duplicate Student Profiles</div>
            <div class="text-xs text-muted" style="color:rgba(255,255,255,0.85)!important;">
              Found ${duplicateGroups.length} groups of students with identical names in the same class. Merge them to unify their exam progress.
            </div>
          </div>
        </div>
        <button class="btn btn-warning btn-sm" id="btn-banner-merge-duplicates" style="background:#f59e0b;color:#000;font-weight:700;border:none;">
          🔄 Resolve All Duplicates
        </button>
      </div>
    ` : ''}

    <div id="student-grid-container" class="card" style="padding:1rem;"></div>
  `;

  // Bind Buttons
  const addBtn = document.getElementById('students-add-shortcut');
  if (addBtn) addBtn.onclick = () => window.openCrudModal('students', null);
  
  const mergeBtn = document.getElementById('students-merge-shortcut');
  if (mergeBtn) mergeBtn.onclick = () => { if (window.openDuplicateStudentsModal) window.openDuplicateStudentsModal(); };
  
  const mergeBannerBtn = document.getElementById('btn-banner-merge-duplicates');
  if (mergeBannerBtn) mergeBannerBtn.onclick = () => { if (window.openDuplicateStudentsModal) window.openDuplicateStudentsModal(); };
  
  const importBtn = document.getElementById('students-import-shortcut');
  if (importBtn) importBtn.onclick = () => window.loadSection('import-students');
  
  const exportBtn = document.getElementById('students-export-btn');
  if (exportBtn) {
    exportBtn.onclick = () => {
      if (!students || !students.length) {
        showToast('No students to export.', 'info');
        return;
      }
      
      const headers = ['Student Name', 'Program', 'Class', 'PIN', 'Status'];
      const rows = students.map(s => [
        s.display_name || s.name || '',
        s.program_name || '',
        s.class_name || '',
        s.personal_pin || '',
        s.is_active ? 'Active' : 'Inactive'
      ]);
      
      let csvContent = "data:text/csv;charset=utf-8," 
        + headers.join(",") + "\\n" 
        + rows.map(e => e.join(",")).join("\\n");
        
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "students_export.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };
  }
  // Initialize DataGrid
  studentGrid = new DataGrid({
    container: 'student-grid-container',
    data: filteredGridData,
    pageSize: 50,
    searchKeys: ['displayName', 'progName', 'batchName', 'pinDisplay'],
    bulkActions: true,
    columns: [
      {
        key: 'displayName',
        label: 'Name & Account',
        sortable: true,
        render: (row) => \`
          <div class="d-flex align-center gap-3">
            \${row.photo_url ? \`<img src="\${row.photo_url}" style="width:36px;height:36px;border-radius:50%;object-fit:cover;">\` : \`<div style="width:36px;height:36px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:0.9rem;font-weight:700;">\${row.displayName.charAt(0)}</div>\`}
            <div>
              <div class="fw-600" style="color:var(--clr-text-1);">\${row.displayName}</div>
              <div class="text-xs text-muted" style="font-family:monospace;">PIN: \${row.pinDisplay}</div>
            </div>
          </div>
        \`
      },
      {
        key: 'progName',
        label: 'Program / Class',
        sortable: true,
        render: (row) => \`
          <div>\${row.progName}</div>
          <div class="text-xs text-muted">\${row.instName}</div>
        \`
      },
      {
        key: 'batchName',
        label: 'Batch',
        sortable: true,
        align: 'center',
        render: (row) => \`<span class="badge" style="background:rgba(255,255,255,0.1);color:#fff;">\${row.batchName}</span>\`
      },
      {
        key: 'overallScoreStr',
        label: 'Progress',
        sortable: true,
        align: 'center',
        render: (row) => \`
          <div class="fw-600">\${row.overallScoreStr}</div>
          <div class="text-xs text-muted">\${row.completedExams} Exams</div>
        \`
      },
      {
        key: 'globalGrade',
        label: 'Grade',
        sortable: true,
        align: 'center',
        render: (row) => row.globalGrade !== '-' ? \`<span class="badge" style="background:\${row.overallColor};color:#000;">\${row.globalGrade}</span>\` : '-'
      },
      {
        label: 'Actions',
        align: 'right',
        render: (row) => {
          const div = document.createElement('div');
          div.className = 'd-flex gap-2 justify-end';
          
          const profileBtn = document.createElement('button');
          profileBtn.className = 'btn btn-secondary btn-icon btn-sm';
          profileBtn.title = 'View Profile';
          profileBtn.innerHTML = '👤';
          profileBtn.onclick = () => {
             if(typeof window.openStudentProfile === 'function') window.openStudentProfile(row.id);
          };
          
          const editBtn = document.createElement('button');
          editBtn.className = 'btn btn-secondary btn-icon btn-sm';
          editBtn.innerHTML = '✎';
          editBtn.onclick = () => {
             if (window.openCrudModal) window.openCrudModal('students', row);
          };
          
          const delBtn = document.createElement('button');
          delBtn.className = 'btn btn-danger btn-icon btn-sm';
          delBtn.innerHTML = '✕';
          delBtn.onclick = () => {
             if (window._deleteRecord) window._deleteRecord('students', row.id, row.displayName);
          };
          
          div.appendChild(profileBtn);
          div.appendChild(editBtn);
          div.appendChild(delBtn);
          return div;
        }
      }
    ]
  });
}
