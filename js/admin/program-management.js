import { adminFetchAll, adminSoftDelete } from '../api.js?v=4.4.3';
import { showToast } from '../app.js?v=4.4.3';
import { DataGrid } from './datagrid.js?v=4.4.3';
if (typeof window !== 'undefined' && !window.DataGrid) window.DataGrid = DataGrid;

let programsGrid, batchesGrid;

/**
 * Renders the Programs (Classes) section
 */
export async function renderClasses(area) {
  const [rawPrograms, institutions] = await Promise.all([
    adminFetchAll('programs', '*, institutions(name)'),
    adminFetchAll('institutions')
  ]);
  const instMap = new Map((institutions || []).map(i => [i.id, i.name]));
  const rawData = (rawPrograms || []).map(p => ({
    ...p,
    institutions: p.institutions || { name: instMap.get(p.institution_id) || '' }
  }));
  
  // Sort by Institution Name (A-Z), then Program Name (A-Z)
  const data = [...rawData].sort((a, b) => {
    const pA = a.institutions?.name || '';
    const pB = b.institutions?.name || '';
    return pA.localeCompare(pB) || (a.name || '').localeCompare(b.name || '');
  });

  const filteredData = window._filterInstitutionId
    ? data.filter(r => r.institution_id === window._filterInstitutionId)
    : data;

  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center">
      <div>
        <h2 class="section-title">Programs <span class="count-chip">${filteredData.length} Total</span></h2>
        <p class="section-subtitle">Manage student classrooms ordered alphabetically by program and name</p>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" id="programs-add-shortcut">+ Add Program</button>
      </div>
    </div>
    
    ${window._filterInstitutionId ? `
      <div class="mb-3 p-2 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;font-size:0.85rem;">
        <span>🏛️ Filtered by Institution: <strong>${escapeHtml(window._filterInstitutionName || 'Selected Institution')}</strong> (${filteredData.length} programs)</span>
        <button class="btn btn-ghost btn-xs" onclick="window._filterInstitutionId=null; window._filterInstitutionName=null; window.loadSection('programs');" style="text-decoration:underline;color:#93c5fd;">Show All Institutions</button>
      </div>
    ` : ''}

    <div id="programs-grid-container" class="card" style="padding:1rem;"></div>
  `;

  // Bind Buttons
  const addBtn = document.getElementById('programs-add-shortcut');
  if (addBtn) addBtn.onclick = () => window.openCrudModal('programs', null);

  const gridData = filteredData.map(r => ({
    id: r.id,
    institutionName: r.institutions?.name || '-',
    name: r.name,
    status: r.is_active ? 'Active' : 'Inactive',
    _raw: r
  }));

  programsGrid = new (DataGrid || window.DataGrid)({
    container: 'programs-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['institutionName', 'name'],
    bulkActions: true,
    onRowClick: (row) => {
      const body = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <h4 style="margin:0; font-size:1.2rem;">${escapeHtml(row.name)}</h4>
            <div class="text-muted text-sm">Status: <strong class="${row?._raw?.is_active ? 'text-success' : 'text-muted'}">${row.status}</strong></div>
          </div>
          <hr style="border-color:var(--fm-border-subtle); margin:0;">
          <div>
            <div class="text-sm text-muted mb-1">Institution</div>
            <div class="fw-600">${escapeHtml(row.institutionName)}</div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Details</div>
            <div class="text-sm">More details about this program would go here.</div>
          </div>
        </div>
      `;
      const footer = `
        <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
        <button class="btn btn-outline" onclick='window._filterProgramId="${row.id}"; window._filterProgramName="${escapeHtml(row.name)}"; window.loadSection("batches"); closeRecordDrawer();'>View Batches</button>
        <button class="btn btn-primary" onclick='window._editRecord("programs", "${row.id}", ${JSON.stringify(JSON.stringify(row._raw))}); closeRecordDrawer();'>Edit Program</button>
      `;
      if (window.openRecordDrawer) window.openRecordDrawer('Program Details', body, footer);
    },
    columns: [
      { 
        key: 'institutionName', 
        label: 'Institution', 
        sortable: true, 
        render: (val, row) => { 
          const nameStr = row?._raw?.institutions?.name || row?._raw?.institution_name || 'N/A';
          return escapeHtml(String(nameStr)); 
        } 
      },
      { 
        key: 'name', 
        label: 'Program Name', 
        sortable: true, 
        render: (val, row) => { 
          const nameStr = row?._raw?.name || row?._raw?.program_name || 'N/A';
          return `<span class="fw-600">${escapeHtml(String(nameStr))}</span>`; 
        } 
      },
      { key: 'status', label: 'Status', sortable: true, render: (val, row) => `<span class="badge ${row?._raw?.is_active ? 'badge-success' : 'badge-neutral'}">${val}</span>` },
      { 
        key: 'actions', 
        label: 'Actions', 
        sortable: false,
        render: (val, row) => {
          if (!row) return '';
          const rName = typeof row?.name === 'object' ? (row?.name?.name || JSON.stringify(row?.name)) : (row?.name || '');
          return `
          <div class="d-flex gap-2 justify-end">
            <button class="btn btn-outline btn-sm" onclick='window._filterProgramId="${row?.id || ''}"; window._filterProgramName="${escapeHtml(String(rName))}"; window.loadSection("batches");' title="View Batches in ${escapeHtml(String(rName))}">Batches &rarr;</button>
            <button class="btn btn-secondary btn-sm" onclick='window._editRecord("programs", "${row?.id || ''}", ${JSON.stringify(JSON.stringify(row?._raw || {}))})'>Edit</button>
            <button class="btn btn-danger btn-sm" onclick='window._deleteRecord("programs", "${row?.id || ''}", "${escapeHtml(String(rName))}")'>Delete</button>
          </div>
        `}
      }
    ]
  });
}

/**
 * Renders the Batches section
 */
export async function renderBatches(area) {
  const [rawData, allStudents] = await Promise.all([
    adminFetchAll('batches', '*, programs!program_id(name, institution_id, institutions!institution_id(name))'),
    adminFetchAll('students')
  ]);

  // Sort by Program (A-Z), Class (A-Z), Batch Name (A-Z)
  const data = [...rawData].sort((a, b) => {
    const progA = a.programs?.institutions?.name || '';
    const progB = b.programs?.institutions?.name || '';
    if (progA !== progB) return progA.localeCompare(progB);
    const clsA = a.programs?.name || '';
    const clsB = b.programs?.name || '';
    if (clsA !== clsB) return clsA.localeCompare(clsB);
    return (a.name || '').localeCompare(b.name || '');
  });

  const filteredData = window._filterProgramId
    ? data.filter(r => r.program_id === window._filterProgramId)
    : data;

  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center">
      <div>
        <h2 class="section-title">Batches <span class="count-chip">${filteredData.length} Total</span></h2>
        <p class="section-subtitle">Manage student batches ordered alphabetically by program, class, and name</p>
      </div>
      <div>
        <button class="btn btn-primary btn-sm" id="batches-add-shortcut">+ Add Batch</button>
      </div>
    </div>
    
    ${window._filterProgramId ? `
      <div class="mb-3 p-2 rounded d-flex align-center justify-between" style="background:rgba(59,130,246,0.1);border:1px solid rgba(59,130,246,0.3);color:#93c5fd;font-size:0.85rem;">
        <span>🏛️ Filtered by Program: <strong>${escapeHtml(window._filterProgramName || 'Selected Program')}</strong> (${filteredData.length} batches)</span>
        <button class="btn btn-ghost btn-xs" onclick="window._filterProgramId=null; window._filterProgramName=null; window.loadSection('batches');" style="text-decoration:underline;color:#93c5fd;">Show All Programs</button>
      </div>
    ` : ''}

    <div id="batches-grid-container" class="card" style="padding:1rem;"></div>
  `;

  const addBtn = document.getElementById('batches-add-shortcut');
  if (addBtn) addBtn.onclick = () => window.openCrudModal('batches', null);

  const gridData = filteredData.map(r => {
    const pName = r.programs?.institutions?.name || '-';
    const cName = r.programs?.name || '-';
    const studentCount = allStudents.filter(s => s.batch_id === r.id && s.is_active).length;
    
    return {
      id: r.id,
      program: pName,
      className: cName,
      name: r.name,
      studentCount,
      status: r.is_active ? 'Active' : 'Inactive',
      _raw: r
    };
  });

  batchesGrid = new (DataGrid || window.DataGrid)({
    container: 'batches-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['program', 'className', 'name'],
    bulkActions: true,
    onRowClick: (row) => {
      const body = `
        <div style="display:flex; flex-direction:column; gap:1rem;">
          <div>
            <h4 style="margin:0; font-size:1.2rem;">${escapeHtml(row.name)}</h4>
            <div class="text-muted text-sm">Status: <strong class="${row?._raw?.is_active ? 'text-success' : 'text-muted'}">${row.status}</strong></div>
          </div>
          <hr style="border-color:var(--fm-border-subtle); margin:0;">
          <div>
            <div class="text-sm text-muted mb-1">Program & Class</div>
            <div class="fw-600">${escapeHtml(row.program)} / ${escapeHtml(row.className)}</div>
          </div>
          <div>
            <div class="text-sm text-muted mb-1">Enrollment</div>
            <div class="fw-600">${row.studentCount} Active Students</div>
          </div>
        </div>
      `;
      const footer = `
        <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
        <button class="btn btn-outline" onclick='window._filterBatchId="${row.id}"; window._filterBatchName="${escapeHtml(row.name)}"; window.loadSection("students"); closeRecordDrawer();'>View Students</button>
        <button class="btn btn-primary" onclick='window._editRecord("batches", "${row.id}", ${JSON.stringify(JSON.stringify(row._raw))}); closeRecordDrawer();'>Edit Batch</button>
      `;
      if (window.openRecordDrawer) window.openRecordDrawer('Batch Details', body, footer);
    },
    columns: [
      { 
        key: 'program', 
        label: 'Program', 
        sortable: true, 
        render: (val, row) => { 
          const nameStr = row?._raw?.programs?.name || row?._raw?.program_name || val;
          return escapeHtml(String(nameStr || 'N/A')); 
        } 
      },
      { 
        key: 'className', 
        label: 'Class', 
        sortable: true, 
        render: (val, row) => { 
          const nameStr = row?._raw?.classes?.name || row?._raw?.class_name || val;
          return escapeHtml(String(nameStr || 'N/A')); 
        } 
      },
      { 
        key: 'name', 
        label: 'Batch Name', 
        sortable: true, 
        render: (val, row) => { 
          const nameStr = row?._raw?.name || val;
          return `<span class="fw-600">${escapeHtml(String(nameStr || 'N/A'))}</span>`; 
        } 
      },
      { 
        key: 'studentCount', 
        label: 'Active Students', 
        sortable: true,
        render: (val, row) => {
          if (!row) return '';
          return `
          <button class="btn btn-ghost btn-xs fw-600" onclick='window._filterBatchId="${row?.id || ''}"; window._filterBatchName="${escapeHtml(row?.name || '')}"; window.loadSection("students");' title="View ${val} Students in ${escapeHtml(row?.name || '')}">
            ${val} Students →
          </button>
        `}
      },
      { key: 'status', label: 'Status', sortable: true, render: (val, row) => `<span class="badge ${row?._raw?.is_active ? 'badge-success' : 'badge-neutral'}">${val}</span>` },
      { 
        key: 'actions', 
        label: 'Actions', 
        sortable: false,
        render: (val, row) => {
          if (!row) return '';
          const rName = typeof row?.name === 'object' ? (row?.name?.name || JSON.stringify(row?.name)) : (row?.name || '');
          return `
          <div class="d-flex gap-2 justify-end">
            <button class="btn btn-outline btn-sm" onclick='window._filterBatchId="${row?.id || ''}"; window._filterBatchName="${escapeHtml(String(rName))}"; window.loadSection("students");' title="View Students in ${escapeHtml(String(rName))}">Students &rarr;</button>
            <button class="btn btn-secondary btn-sm" onclick='window._editRecord("batches", "${row?.id || ''}", ${JSON.stringify(JSON.stringify(row?._raw || {}))})'>Edit</button>
            <button class="btn btn-danger btn-sm" onclick='window._deleteRecord("batches", "${row?.id || ''}", "${escapeHtml(String(rName))}")'>Delete</button>
          </div>
        `}
      }
    ]
  });
}

export async function renderUnifiedInstitutions(area) {
  const [batches, programs, institutions, allStudents] = await Promise.all([
    adminFetchAll('batches', '*'),
    adminFetchAll('programs', '*'),
    adminFetchAll('institutions', '*'),
    adminFetchAll('students', 'id, is_active, batch_id')
  ]);

  // Map programs and institutions by ID for easy lookup
  const instMap = institutions.reduce((acc, i) => ({...acc, [i.id]: i}), {});
  const progMap = programs.reduce((acc, p) => ({...acc, [p.id]: p}), {});

  // Build the flattened rows
  // To handle empty programs/institutions, we could iterate over all.
  // But for now, we'll iterate over all batches, PLUS any programs without batches, PLUS any institutions without programs.
  let gridData = [];
  
  // 1. Batches
  batches.forEach(b => {
    const prog = progMap[b.program_id] || {};
    const inst = instMap[prog.institution_id] || {};
    const activeStudents = allStudents.filter(s => s.batch_id === b.id && s.is_active !== false).length;
    
    gridData.push({
      id: b.id, // ID for DataGrid key
      batchId: b.id,
      programId: prog.id,
      institutionId: inst.id,
      institutionName: inst.name || 'Unknown',
      programName: prog.name || 'Unknown',
      batchName: b.name || 'Unknown',
      enrollmentDate: b.enrollment_date || '-',
      graduateDate: b.actual_final_date || '-',
      studentCount: activeStudents,
      status: (b.is_active !== false) ? 'Active' : 'Inactive',
      type: 'Batch',
      _batchRaw: b,
      _progRaw: prog,
      _instRaw: inst
    });
  });

  // 2. Programs without batches (REMOVED: User requested Batch only view)
  // 3. Institutions without programs (REMOVED: User requested Batch only view)

  // Sort by Institution -> Program -> Batch
  gridData.sort((a, b) => {
    if (a.institutionName !== b.institutionName) return a.institutionName.localeCompare(b.institutionName);
    if (a.programName !== b.programName) return a.programName.localeCompare(b.programName);
    return a.batchName.localeCompare(b.batchName);
  });

  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center">
      <div>
        <h2 class="section-title">Batches <span class="count-chip">${gridData.length} Total Rows</span></h2>
        <p class="section-subtitle">Manage batch enrollments and schedules.</p>
      </div>
      <div style="display:flex;gap:0.5rem;">
        <button class="btn btn-primary btn-sm" onclick="window.openCrudModal('batches', null)">+ Batch</button>
      </div>
    </div>
    
    <div id="unified-grid-container" class="card" style="padding:1rem;"></div>
  `;

  // Attach drawer functions to the window so the grid can call them
  window._showInstitutionDrawer = (id) => {
    const row = gridData.find(r => r.institutionId === id);
    if (!row || !row._instRaw) return;
    const body = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div>
          <h4 style="margin:0; font-size:1.2rem;">${escapeHtml(row.institutionName)}</h4>
          <div class="text-muted text-sm">Institution details available in Board Overview.</div>
        </div>
      </div>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
      <button class="btn btn-outline" onclick='window.loadSection("board_overview"); closeRecordDrawer();'>Board Overview</button>
      <button class="btn btn-primary" onclick='window._editRecord("institutions", "${id}", ${JSON.stringify(JSON.stringify(row._instRaw))}); closeRecordDrawer();'>Edit</button>
    `;
    if (window.openRecordDrawer) window.openRecordDrawer('Institution Details', body, footer);
  };

  window._showProgramDrawer = (id) => {
    const row = gridData.find(r => r.programId === id);
    if (!row || !row._progRaw) return;
    const isActive = row._progRaw.is_active !== false;
    const body = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div>
          <h4 style="margin:0; font-size:1.2rem;">${escapeHtml(row.programName)}</h4>
          <div class="text-muted text-sm">Status: <strong class="${isActive ? 'text-success' : 'text-muted'}">${isActive ? 'Active' : 'Inactive'}</strong></div>
        </div>
        <hr style="border-color:var(--fm-border-subtle); margin:0;">
        <div>
          <div class="text-sm text-muted mb-1">Parent Institution</div>
          <div class="fw-600">${escapeHtml(row.institutionName)}</div>
        </div>
      </div>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
      <button class="btn btn-primary" onclick='window._editRecord("programs", "${id}", ${JSON.stringify(JSON.stringify(row._progRaw))}); closeRecordDrawer();'>Edit</button>
    `;
    if (window.openRecordDrawer) window.openRecordDrawer('Program Details', body, footer);
  };

  window._showBatchDrawer = (id) => {
    const row = gridData.find(r => r.batchId === id);
    if (!row || !row._batchRaw) return;
    const isActive = row._batchRaw.is_active !== false;
    const body = `
      <div style="display:flex; flex-direction:column; gap:1rem;">
        <div>
          <h4 style="margin:0; font-size:1.2rem;">${escapeHtml(row.batchName)}</h4>
          <div class="text-muted text-sm">Status: <strong class="${isActive ? 'text-success' : 'text-muted'}">${row.status}</strong></div>
        </div>
        <hr style="border-color:var(--fm-border-subtle); margin:0;">
        <div>
          <div class="text-sm text-muted mb-1">Hierarchy</div>
          <div class="fw-600">${escapeHtml(row.institutionName)} / ${escapeHtml(row.programName)}</div>
        </div>
        <div>
          <div class="text-sm text-muted mb-1">Enrollment</div>
          <div class="fw-600">${row.studentCount} Active Students</div>
        </div>
        <div>
          <div class="text-sm text-muted mb-1">Enrollment Date</div>
          <div class="fw-600">${escapeHtml(row.enrollmentDate)}</div>
        </div>
        <div>
          <div class="text-sm text-muted mb-1">Graduate Date</div>
          <div class="fw-600">${escapeHtml(row.graduateDate)}</div>
        </div>
      </div>
    `;
    const footer = `
      <button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>
      <button class="btn btn-outline" onclick='window._filterBatchId="${id}"; window._filterBatchName="${escapeHtml(row.batchName)}"; window.loadSection("students"); closeRecordDrawer();'>View Students</button>
      <button class="btn btn-primary" onclick='window._editRecord("batches", "${id}", ${JSON.stringify(row._batchRaw).replace(/'/g, "&#39;")}); closeRecordDrawer();'>Edit</button>
    `;
    if (window.openRecordDrawer) window.openRecordDrawer('Batch Details', body, footer);
  };

  new (DataGrid || window.DataGrid)({
    container: 'unified-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['institutionName', 'programName', 'batchName'],
    bulkActions: false,
    columns: [
      { 
        key: 'institutionName', 
        label: 'Institution', 
        sortable: true,
        render: (val, row) => {
          if (row.institutionId) {
             return `<a href="#" onclick="event.preventDefault(); event.stopPropagation(); window._showInstitutionDrawer('${row.institutionId}')" class="text-primary fw-600" style="text-decoration:none;">${escapeHtml(val)}</a>`;
          }
          return escapeHtml(val);
        }
      },
      { 
        key: 'programName', 
        label: 'Program', 
        sortable: true,
        render: (val, row) => {
          if (row.programId) {
             return `<a href="#" onclick="event.preventDefault(); event.stopPropagation(); window._showProgramDrawer('${row.programId}')" class="text-primary fw-600" style="text-decoration:none;">${escapeHtml(val)}</a>`;
          }
          return escapeHtml(val);
        }
      },
      { 
        key: 'batchName', 
        label: 'Batch', 
        sortable: true,
        render: (val, row) => {
          if (row.batchId) {
             return `<a href="#" onclick="event.preventDefault(); event.stopPropagation(); window._showBatchDrawer('${row.batchId}')" class="text-primary fw-600" style="text-decoration:none;">${escapeHtml(val)}</a>`;
          }
          return escapeHtml(val);
        }
      },
      { 
        key: 'enrollmentDate', 
        label: 'Enrollment Date', 
        sortable: true 
      },
      { 
        key: 'graduateDate', 
        label: 'Graduate Date', 
        sortable: true 
      },
      { 
        key: 'studentCount', 
        label: 'Students', 
        sortable: true,
        render: (val) => val > 0 ? `${val} <span style="color:var(--fm-text-muted);font-size:0.8rem;">Active</span>` : '-'
      },
      { 
        key: 'status', 
        label: 'Status', 
        sortable: true,
        render: (val) => {
          if (val === '-') return val;
          return val === 'Active' 
            ? '<span class="status-badge status-active">ACTIVE</span>'
            : '<span class="status-badge status-inactive">INACTIVE</span>';
        }
      },
      {
        key: 'actions',
        label: '',
        sortable: false,
        align: 'right',
        render: (val, row) => {
          return `
            <button class="btn btn-ghost btn-xs text-primary" onclick='event.stopPropagation(); window._showBatchDrawer("${row.batchId}");' title="Options">⋮</button>
          `;
        }
      }
    ]
  });
}

// Utility function copied from app.js to prevent undefined errors
function escapeHtml(unsafe) {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
