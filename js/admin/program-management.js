import { adminFetchAll } from '../api.js';

let programsGrid, batchesGrid;

/**
 * Renders the Programs (Classes) section
 */
export async function renderClasses(area) {
  const rawData = await adminFetchAll('programs', '*, institutions(name)');
  
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

  programsGrid = new window.DataGrid({
    container: 'programs-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['institutionName', 'name'],
    bulkActions: true,
    columns: [
      { key: 'institutionName', label: 'Institution', sortable: true },
      { key: 'name', label: 'Program Name', sortable: true, render: (val) => `<span class="fw-600">${escapeHtml(val)}</span>` },
      { key: 'status', label: 'Status', sortable: true, render: (val, row) => `<span class="badge ${row._raw.is_active ? 'badge-success' : 'badge-neutral'}">${val}</span>` },
      { 
        key: 'actions', 
        label: 'Actions', 
        sortable: false,
        render: (val, row) => `
          <div class="d-flex gap-2 justify-end">
            <button class="btn btn-outline btn-sm" onclick='window._filterProgramId="${row.id}"; window._filterProgramName="${escapeHtml(row.name)}"; window.loadSection("batches");' title="View Batches in ${escapeHtml(row.name)}">Batches →</button>
            <button class="btn btn-secondary btn-sm" onclick='window._editRecord("programs", "${row.id}", ${JSON.stringify(JSON.stringify(row._raw))})'>Edit</button>
            <button class="btn btn-danger btn-sm" onclick='window._deleteRecord("programs", "${row.id}", "${escapeHtml(row.name)}")'>Delete</button>
          </div>
        `
      }
    ]
  });
}

/**
 * Renders the Batches section
 */
export async function renderBatches(area) {
  const [rawData, allStudents] = await Promise.all([
    adminFetchAll('batches', '*, programs(name, institution_id, institutions(name))'),
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

  batchesGrid = new window.DataGrid({
    container: 'batches-grid-container',
    data: gridData,
    pageSize: 50,
    searchKeys: ['program', 'className', 'name'],
    bulkActions: true,
    columns: [
      { key: 'program', label: 'Program', sortable: true },
      { key: 'className', label: 'Class', sortable: true },
      { key: 'name', label: 'Batch Name', sortable: true, render: (val) => `<span class="fw-600">${escapeHtml(val)}</span>` },
      { 
        key: 'studentCount', 
        label: 'Active Students', 
        sortable: true,
        render: (val, row) => `
          <button class="btn btn-ghost btn-xs fw-600" onclick='window._filterBatchId="${row.id}"; window._filterBatchName="${escapeHtml(row.name)}"; window.loadSection("students");' title="View ${val} Students in ${escapeHtml(row.name)}">
            ${val} Students →
          </button>
        `
      },
      { key: 'status', label: 'Status', sortable: true, render: (val, row) => `<span class="badge ${row._raw.is_active ? 'badge-success' : 'badge-neutral'}">${val}</span>` },
      { 
        key: 'actions', 
        label: 'Actions', 
        sortable: false,
        render: (val, row) => `
          <div class="d-flex gap-2 justify-end">
            <button class="btn btn-outline btn-sm" onclick='window._filterBatchId="${row.id}"; window._filterBatchName="${escapeHtml(row.name)}"; window.loadSection("students");' title="View Students in ${escapeHtml(row.name)}">Students →</button>
            <button class="btn btn-secondary btn-sm" onclick='window._editRecord("batches", "${row.id}", ${JSON.stringify(JSON.stringify(row._raw))})'>Edit</button>
            <button class="btn btn-danger btn-sm" onclick='window._deleteRecord("batches", "${row.id}", "${escapeHtml(row.name)}")'>Delete</button>
          </div>
        `
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
