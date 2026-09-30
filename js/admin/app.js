import { DataGrid } from './datagrid.js?v=4.7.5';

// =========================================================
// EXCEL-STYLE TABLE COLUMN RESIZER
// =========================================================
export function makeTableResizable(table, storageKey) {
  const cols = table.querySelectorAll('th');
  const cachedWidths = JSON.parse(localStorage.getItem(storageKey) || '{}');

  [].forEach.call(cols, function (col, index) {
    if (cachedWidths[index]) {
      col.style.width = cachedWidths[index];
    }
    const resizer = document.createElement('div');
    resizer.classList.add('col-resizer');
    col.appendChild(resizer);

    let x = 0;
    let w = 0;

    const mouseDownHandler = function (e) {
      x = e.clientX;
      const styles = window.getComputedStyle(col);
      w = parseInt(styles.width, 10);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      resizer.classList.add('active');
      document.addEventListener('mousemove', mouseMoveHandler);
      document.addEventListener('mouseup', mouseUpHandler);
    };

    const mouseMoveHandler = function (e) {
      const dx = e.clientX - x;
      col.style.width = `${w + dx}px`;
    };

    const mouseUpHandler = function () {
      resizer.classList.remove('active');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', mouseMoveHandler);
      document.removeEventListener('mouseup', mouseUpHandler);
      const newWidths = {};
      [].forEach.call(cols, (th, idx) => {
        newWidths[idx] = window.getComputedStyle(th).width;
      });
      localStorage.setItem(storageKey, JSON.stringify(newWidths));
    };

    resizer.addEventListener('mousedown', mouseDownHandler);
  });
}

// =========================================================
// GENERIC GLOBAL TABLE SORTER
// =========================================================
document.addEventListener('click', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  const table = th.closest('table');
  if (!table) return;
  
  // Ignore datagrid, explicitly ignored tables, or custom sortable tables
  if (table.classList.contains('datagrid-table') || table.classList.contains('no-sort')) return;
  if (th.classList.contains('sortable') || th.classList.contains('no-sort')) return;
  
  const text = th.textContent.replace(/▲|▼/g, '').trim().toLowerCase();
  if (!text || text === 'actions' || text === 'action') return;

  const tbody = table.querySelector('tbody');
  if (!tbody) return;

  const tr = th.closest('tr');
  const index = Array.from(tr.children).indexOf(th);
  
  const isAsc = th.dataset.sortDir !== 'asc';
  
  // Reset other headers
  table.querySelectorAll('th').forEach(header => {
    if (header !== th) {
      header.dataset.sortDir = '';
      const icon = header.querySelector('.global-sort-icon');
      if (icon) icon.remove();
    }
  });
  
  th.dataset.sortDir = isAsc ? 'asc' : 'desc';
  let icon = th.querySelector('.global-sort-icon');
  if (!icon) {
    icon = document.createElement('span');
    icon.className = 'global-sort-icon';
    icon.style.fontSize = '0.7em';
    icon.style.opacity = '0.6';
    icon.style.marginLeft = '4px';
    th.appendChild(icon);
  }
  icon.innerHTML = isAsc ? '&#9650;' : '&#9660;';

  const rows = Array.from(tbody.querySelectorAll('tr'));
  // Filter out empty state rows
  const dataRows = rows.filter(r => !r.querySelector('.empty-state, [colspan]'));
  if (dataRows.length <= 1) return;

  dataRows.sort((a, b) => {
    const tdA = a.children[index];
    const tdB = b.children[index];
    if (!tdA || !tdB) return 0;
    
    // Dataset sort-val takes precedence over text content
    let valA = tdA.dataset.sortVal !== undefined ? tdA.dataset.sortVal : tdA.textContent.trim();
    let valB = tdB.dataset.sortVal !== undefined ? tdB.dataset.sortVal : tdB.textContent.trim();
    
    // Try numeric sort first
    const numA = parseFloat(valA.replace(/,/g, ''));
    const numB = parseFloat(valB.replace(/,/g, ''));
    if (!isNaN(numA) && !isNaN(numB) && valA !== '' && valB !== '') {
      valA = numA;
      valB = numB;
    } else {
      valA = String(valA).toLowerCase();
      valB = String(valB).toLowerCase();
    }
    
    if (valA < valB) return isAsc ? -1 : 1;
    if (valA > valB) return isAsc ? 1 : -1;
    return 0;
  });

  // Re-append sorted rows
  dataRows.forEach(row => tbody.appendChild(row));
});

// Inject global styling for sortable generic headers
const sortableStyle = document.createElement('style');
sortableStyle.textContent = `
  table:not(.datagrid-table) th:not(.no-sort):not(.sortable) {
    cursor: pointer;
    user-select: none;
    transition: background-color 0.2s;
  }
  table:not(.datagrid-table) th:not(.no-sort):not(.sortable):hover {
    background-color: rgba(255,255,255,0.05);
  }
`;
document.head.appendChild(sortableStyle);

// =========================================================
// GENERIC GLOBAL TABLE COLUMN REORDERING
// =========================================================
document.addEventListener('mousedown', (e) => {
  const th = e.target.closest('th');
  if (!th || th.closest('.datagrid-table')) return;
  if (e.target.classList.contains('col-resizer')) return;
  th.setAttribute('draggable', 'true');
});

document.addEventListener('dragstart', (e) => {
  const th = e.target.closest('th');
  if (!th || !th.closest('table:not(.datagrid-table)')) return;
  if (e.target.classList.contains('col-resizer')) {
    e.preventDefault();
    return;
  }
  e.dataTransfer.effectAllowed = 'move';
  const tr = th.closest('tr');
  th.dataset.dragSourceIdx = Array.from(tr.children).indexOf(th);
  th.style.opacity = '0.5';
});

document.addEventListener('dragover', (e) => {
  const th = e.target.closest('th');
  if (!th || !th.closest('table:not(.datagrid-table)')) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  th.style.borderLeft = '2px solid var(--clr-primary)';
});

document.addEventListener('dragleave', (e) => {
  const th = e.target.closest('th');
  if (!th || !th.closest('table:not(.datagrid-table)')) return;
  th.style.borderLeft = '';
});

document.addEventListener('dragend', (e) => {
  const th = e.target.closest('th');
  if (!th) return;
  th.style.opacity = '1';
  document.querySelectorAll('th').forEach(t => t.style.borderLeft = '');
});

document.addEventListener('drop', (e) => {
  const th = e.target.closest('th');
  if (!th || !th.closest('table:not(.datagrid-table)')) return;
  e.preventDefault();
  th.style.borderLeft = '';
  
  const table = th.closest('table');
  const sourceTh = table.querySelector('th[data-drag-source-idx]');
  if (!sourceTh) return;
  
  const fromIdx = parseInt(sourceTh.dataset.dragSourceIdx, 10);
  sourceTh.removeAttribute('data-drag-source-idx');
  
  const tr = th.closest('tr');
  const toIdx = Array.from(tr.children).indexOf(th);
  
  if (fromIdx === toIdx) return;
  
  if (toIdx > fromIdx) {
    tr.insertBefore(sourceTh, th.nextSibling);
  } else {
    tr.insertBefore(sourceTh, th);
  }
  
  table.querySelectorAll('tbody tr').forEach(row => {
    const cells = Array.from(row.children);
    if (cells.length > Math.max(fromIdx, toIdx)) {
      const sourceTd = cells[fromIdx];
      const targetTd = cells[toIdx];
      if (toIdx > fromIdx) {
        row.insertBefore(sourceTd, targetTd.nextSibling);
      } else {
        row.insertBefore(sourceTd, targetTd);
      }
    }
  });
});

// =========================================================
// GLOBAL AUTO-RESIZER OBSERVER
// =========================================================
const tableObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.addedNodes) {
      m.addedNodes.forEach(node => {
        if (node.nodeType === 1) {
          const tables = node.tagName === 'TABLE' ? [node] : Array.from(node.querySelectorAll('table:not(.datagrid-table)'));
          tables.forEach(table => {
            if (!table.dataset.resizableInit && table.querySelector('th')) {
              table.dataset.resizableInit = '1';
              setTimeout(() => {
                const sid = table.id || Math.random().toString(36).substring(7);
                makeTableResizable(table, 'global-table-w-' + sid);
              }, 100);
            }
          });
        }
      });
    }
  }
});
tableObserver.observe(document.body, { childList: true, subtree: true });

window.makeTableResizable = makeTableResizable;
window.DataGrid = DataGrid;
window.adminFetchAll = adminFetchAll;
window.adminUpdate = adminUpdate;
window.adminInsert = adminInsert;
import {
  adminFetchAll, adminInsert, adminUpdate, adminSoftDelete, adminHardDelete,
  adminFetchDeleted, adminRestore,
  mergeDuplicateStudents, detectDuplicateStudents, mergeStudentPair,
  detectDuplicateQuestions, resequenceAssessmentQuestions, resolveDuplicateQuestionGroup, batchResolveAssessmentDuplicateQuestions,
  fetchInstitutions, fetchPrograms, fetchBatches, formatStudentName,
  testSupabaseConnection, previewRecalibrateAssessment, applyRecalibrateAssessment, isPassing, calculatePercentage
} from '../api.js?v=4.7.5';
import { parseExcelWorkbook, processStudentImportRows, processQuestionImportRows } from '../excel-parser.js?v=4.7.5';
import { setAdminSession, getAdminSession, clearAdminSession } from '../session.js?v=4.7.5';
import { showToast, showLoading, hideLoading, getGrade } from '../app.js?v=4.7.5';
import { getSupabase } from '../supabase.js?v=4.7.5';
import { renderStudents as _renderStudentsModule } from './student-management.js?v=4.7.5';
import { renderClasses as _renderClassesModule } from './classes-management.js?v=4.7.5';
import { renderBatches as _renderBatchesModule, renderUnifiedInstitutions } from './program-management.js?v=4.7.5';
import { renderTopics, renderWordTypes, renderCentralQuestionBank, renderAssignments, renderCentralQuestionImport, renderResults, renderProgressView, renderRecalibrator, renderClassInstances } from './class.js?v=4.7.5';
import { renderAssessments } from './assessment-management.js?v=4.7.5';
import { renderVocabularyVault } from './vocab-vault.js?v=4.7.5';
import { renderModules } from './modules.js?v=4.7.5';
import { renderAuditLog, renderSettings, renderDataHealth, renderRecycleBin } from './desk.js?v=4.7.5';
import { renderImportStudents, renderImportQuestions, renderExportQuestions } from './imports-exports.js?v=4.7.5';
import { openCrudModal, openDuplicateStudentsModal, openDuplicateQuestionsModal, hashPin } from './crud-modals.js?v=4.7.5';
import { renderDashboard, renderAdminProfile, renderAdminSchedule, renderWorkRecords, renderCVGenerator } from './admin-deck.js?v=4.7.5';
import { openStudentFullEdit } from './student-management.js?v=4.7.5';

    // -- Primary Tab Switching Variables --
    const mobileTabs = document.querySelectorAll('.mobile-tab');

    // â€”â€”â€” ABCD Primary Architecture Section Titles â€”â€”â€”
    const sectionTitles = {
      dashboard: 'Executive Dashboard', profile: 'My Profile', schedule: 'Personal Schedule', work_records: 'Work Records', cv_generator: 'CV Generator',
      import_ai_assessments: 'Import AI Assessments',
      institutions: 'Batches', students: 'Students Roster', 'import-students': 'Import Students', 'progress-view': 'Student Progress',
      Classes: 'Curriculum & Classes', classes: 'Curriculum & Classes', class_instances: 'Class Instances', levels: 'Levels', topics: 'Topics', questions: 'Question Bank', vocab_vault: 'Vocabulary Vault', modules: 'Modules (Core Blocks)', 'import-questions': 'Import Questions', 'export-questions': 'Export Questions',
      assessments: 'Assessments Hub', assignments: 'Assignments & Rosters', results: 'Assessment Results', recalibrator: 'Recalibration Engine', question_types: 'Validation Dictionary',
      audit: 'Activity & Audit Logs', settings: 'Site Settings & Cost Guard', recycle: 'Recycle Bin', health: 'Data Health & Connectivity'
    };

    // ABCD 4-Domain Mapping
    const sectionDomainMap = {
      dashboard: 'ADMIN', profile: 'ADMIN', schedule: 'ADMIN', work_records: 'ADMIN', cv_generator: 'ADMIN',
      institutions: 'BOARD', students: 'BOARD', 'import-students': 'BOARD', 'progress-view': 'BOARD',
      Classes: 'CLASS', classes: 'CLASS', class_instances: 'CLASS', levels: 'CLASS', topics: 'CLASS', questions: 'CLASS', question_types: 'CLASS', 'import-questions': 'CLASS', 'export-questions': 'CLASS',
      assessments: 'CLASS', assignments: 'CLASS', results: 'CLASS', recalibrator: 'CLASS', import_ai_assessments: 'CLASS',
      audit: 'DATA', settings: 'DATA', recycle: 'DATA', health: 'DATA', vocab_vault: 'DATA', modules: 'DATA'
    };

    // Mobile Bottom Tab Panels -> Primary Domain
    const domainToPanelMap = {
      ADMIN: 'admin', BOARD: 'board', CLASS: 'class', DATA: 'desk', DESK: 'desk',
      ASSESSMENTS: 'class', // Legacy alias
      DATABASE: 'board', STUDENT: 'board', Assessment: 'class',
      ACADEMY: 'board'
    };

    const tabDefaultSections = {
      admin: 'dashboard',
      board: 'institutions',
      class: 'classes',
      assessments: 'classes', // Legacy alias
      desk: 'recycle',
      data: 'recycle',
      database: 'classes', student: 'students', Assessment: 'assessments',
      academy: 'institutions'
    };

    // Section alias map to guarantee 100% backward compatibility
    const aliasSectionMap = {
      'academy-institutions': 'institutions',
      'academy-programs': 'programs',
      'academy-batches': 'batches',
      'academy-students': 'students',
      'academy-import': 'import-students',
      'board-Classes': 'classes',
      'board-topics': 'topics',
      'board-bank': 'questions',
      'board-wordtypes': 'question_types',
      'board-import': 'import-questions',
      'board-export': 'export-questions',
      'class-hub': 'assessments',
      'class-assignments': 'assignments',
      'class-results': 'results',
      'class-recalibrator': 'recalibrator',
      'assessments-hub': 'assessments',
      'assessments-assignments': 'assignments',
      'assessments-results': 'results',
      'assessments-recalibrator': 'recalibrator',
      'desk-audit': 'audit',
      'desk-settings': 'settings',
      'desk-recycle': 'recycle',
      'desk-health': 'health'
    };

    async function updateAdminKpiBanner() {
      try {
        const [stds, asms, atts, profs] = await Promise.all([
          adminFetchAll('students'),
          adminFetchAll('assessments'),
          adminFetchAll('attempts')
        ]);
        const kpiAcad = document.getElementById('kpi-board');
        if (kpiAcad) kpiAcad.textContent = stds.filter(s => !s.deleted_at).length;
        const kpiChal = document.getElementById('kpi-class') || document.getElementById('kpi-assessments');
        if (kpiChal) kpiChal.textContent = asms.filter(a => !a.deleted_at && a.status === 'published').length;
        const kpiDesk = document.getElementById('kpi-desk');
        if (kpiDesk) kpiDesk.textContent = atts.length;
        const kpiAdmin = document.getElementById('kpi-admin');
        if (kpiAdmin) kpiAdmin.textContent = profs ? profs.length : 0;
      } catch (err) {
        console.warn('Could not refresh admin KPI banner:', err.message);
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

    // --- Auth ---
    const session = getAdminSession();
    if (session) showConsole();

    document.getElementById('admin-login-btn').addEventListener('click', async () => {
      const user = document.getElementById('admin-username').value.trim();
      const pass = document.getElementById('admin-password').value;
      if (!user || !pass) { showToast('Please enter credentials.', 'warning'); return; }

      showLoading('Authenticating...');
      try {
        // 1. Primary Check: Master credentials (admin / admin123) or custom saved password
        const savedCustomPass = localStorage.getItem('topscore_admin_custom_password');
        const isMaster = (user.toLowerCase() === 'admin' && (savedCustomPass ? pass === savedCustomPass : pass === 'admin123'));

        if (isMaster) {
          setAdminSession({ admin_id: 'admin-master', username: 'admin' });
          hideLoading();
          showToast('Welcome, Administrator!', 'success');
          showConsole();
          return;
        }

        // 2. Secondary Check: Supabase Auth (if user provided an email address registered in Supabase)
        if (user.includes('@')) {
          try {
            const sb = await getSupabase();
            const { data, error } = await sb.auth.signInWithPassword({ email: user, password: pass });
            if (!error && data?.user) {
              setAdminSession({ admin_id: data.user.id, username: user });
              hideLoading();
              showToast('Welcome, Administrator!', 'success');
              showConsole();
              return;
            }
          } catch(authErr) {
            console.warn('Supabase Auth attempt failed:', authErr);
          }
        }

        // Neither matched
        hideLoading();
        showToast('Invalid admin credentials. Please try again.', 'error');
      } catch(e) {
        hideLoading();
        console.error('Login flow error:', e);
        showToast(e.message || 'Authentication failed due to an internal error.', 'error');
      }
    });

    document.getElementById('admin-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('admin-login-btn').click();
    });

    document.getElementById('admin-logout-btn').addEventListener('click', () => {
      if (window.isProfileDirty) {
        if (!confirm('You have unsaved changes. Are you sure you want to logout?')) {
          return;
        }
      }
      clearAdminSession();
      document.getElementById('admin-console').classList.add('hidden');
      document.getElementById('admin-login-screen').classList.remove('hidden');
    });

    function showConsole() {
      document.getElementById('admin-login-screen').classList.add('hidden');
      document.getElementById('admin-console').classList.remove('hidden');
      updateAdminKpiBanner();
      const hash = window.location.hash.substring(1);
      const targetSec = aliasSectionMap[hash] || hash;
      if (targetSec && (sectionTitles[targetSec] || targetSec === 'students')) {
        loadSection(targetSec, true);
      } else if (hash && hash.startsWith('profile-')) {
        const studentId = (hash || '').replace('profile-', '');
        activatePrimaryTab('board');
        openStudentProfile(studentId, [], true);
      } else {
        activatePrimaryTab('class');
        loadSection('assessments', true);
      }
      initConnectionBanner(); // Check live DB connection and show status banner
      populateCPanel(); // Dynamically load Classes and Levels into the C Panel sidebar
    }

    async function renderClassDetail(area) {
      if (!window.currentClassContext) {
        return loadSection('assessments');
      }
      
      const { cid, lid, cname, lname, program, institution } = window.currentClassContext;
      const title = `${cname} - ${lname}`;
      const subtitle = program && institution ? `${institution} ➔ ${program}` : 'Manage assessments and vocabulary for this class';
      
      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">${escapeHtml(title)}</h2>
            <p class="section-subtitle">${escapeHtml(subtitle)}</p>
          </div>
        </div>
        <div class="dashboard-grid mt-4">
          <div class="stat-card" style="cursor:pointer;" onclick="window.loadSection('assessments')">
            <div class="stat-icon">&#128221;</div>
            <div class="stat-value">Manage Assessments</div>
            <div class="stat-label">View all tests & assignments</div>
          </div>
          <div class="stat-card" style="cursor:pointer;" onclick="window.loadSection('vocab_vault')">
            <div class="stat-icon">&#128214;</div>
            <div class="stat-value">Vocab Vault</div>
            <div class="stat-label">Manage word lists & phrases</div>
          </div>
        </div>
        <div class="card mt-4" style="padding: 2rem; text-align: center;">
          <h3 style="margin-bottom: 1rem;">Context Loaded: ${escapeHtml(title)}</h3>
          <p class="text-muted">You can navigate to <strong>Manage Assessments</strong> or <strong>Vocab Vault</strong> from the buttons above, or use the sidebar.</p>
        </div>
      `;
    }

    async function populateCPanel() {
      const cPanel = document.querySelector('.nav-domain-group[data-domain="class"]');
      if (!cPanel) return;
      try {
        const { adminFetchAll } = await import('../api.js?v=4.7.5');
        const [classes, levels] = await Promise.all([
          adminFetchAll('classes', 'id, name'),
          adminFetchAll('levels', 'id, name, level_number')
        ]);
        if (!classes || !levels) return;
        
        const staticClasses = cPanel.querySelector('.admin-nav-item[data-sub="classes"]');
        if (staticClasses) staticClasses.remove();
        cPanel.querySelectorAll('.dynamic-class-item').forEach(el => el.remove());

        classes.sort((a,b) => (a.name||'').localeCompare(b.name||''));
        levels.sort((a,b) => (a.level_number || 0) - (b.level_number || 0));

        classes.forEach(c => {
          levels.forEach(l => {
            const levelLabel = l.level_number === 0 ? 'Universal' : l.name;
            const tabName = `${c.name} ${levelLabel}`;
            
            const item = document.createElement('div');
            item.className = 'admin-nav-item dynamic-class-item';
            item.dataset.sub = 'class-detail';
            item.dataset.cid = c.id;
            item.dataset.lid = l.id;
            item.dataset.cname = c.name;
            item.dataset.lname = levelLabel;
            item.dataset.lnum = l.level_number;

            const programName = l.programs?.name || 'Global Program';
            const instName = l.programs?.institutions?.name || 'TopsCore Institution';

            // Use escapeHtml safely if it's available, otherwise fallback
            const esc = (window.escapeHtml || (s => s))(tabName);
            item.innerHTML = `<span class="nav-icon">📚</span>${esc}`;
            
            item.addEventListener('click', () => {
              document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
              item.classList.add('active');
              window.currentClassContext = { 
                cid: c.id, lid: l.id, 
                cname: c.name, lname: levelLabel, 
                lnum: l.level_number,
                program: programName,
                institution: instName
              };
              loadSection('class-detail');
              if (window.innerWidth <= 1024) document.getElementById('sidebar-toggle')?.click();
            });
            cPanel.appendChild(item);
          });
        });
      } catch (e) {
        console.error('Failed to populate dynamic C panel', e);
      }
    }
    
    window.addEventListener('popstate', (e) => {
      const hash = window.location.hash.substring(1);
      const targetSec = aliasSectionMap[hash] || hash;
      if (targetSec && (sectionTitles[targetSec] || targetSec === 'students')) {
        loadSection(targetSec, true);
      } else if (hash && hash.startsWith('profile-')) {
        const studentId = (hash || '').replace('profile-', '');
        const batchStudentIds = e.state?.batchStudentIds || [];
        openStudentProfile(studentId, batchStudentIds, true);
      }
    });

    function activatePrimaryTab(panel) {
      // Update mobile bottom tabs (these exist in the DOM)
      mobileTabs.forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
      // Update topbar breadcrumb domain label
      const domainEl = document.getElementById('topbar-domain');
      if (domainEl) {
        const domainNameMap = {
          admin: 'ADMIN',
          board: 'BOARD',
          class: 'CLASS',
          assessments: 'CLASS', // Legacy fallback
          desk: 'DATA',
          data: 'DATA',
          academy: 'BOARD' // Legacy fallback
        };
        domainEl.textContent = domainNameMap[panel.toLowerCase()] || panel.toUpperCase();
      }
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ Topbar Domain Switcher Click (removed â€” no domain pill elements exist) Ã¢â€â‚¬Ã¢â€â‚¬

    // Ã¢â€â‚¬Ã¢â€â‚¬ Mobile Bottom Tab Switching Ã¢â€â‚¬Ã¢â€â‚¬
    mobileTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panel = tab.dataset.panel;
        activatePrimaryTab(panel);
        loadSection(tabDefaultSections[panel]);
      });
    });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Sidebar Toggle for Mobile Ã¢â€â‚¬Ã¢â€â‚¬
    const sidebarToggleBtn = document.getElementById('sidebar-toggle');
    const adminSidebar = document.getElementById('admin-sidebar');
    const sidebarOverlay = document.getElementById('sidebar-overlay');

    function openSidebar() {
      adminSidebar.classList.add('open');
      sidebarOverlay.classList.remove('hidden');
      document.body.style.overflow = 'hidden';
    }
    function closeSidebar() {
      adminSidebar.classList.remove('open');
      sidebarOverlay.classList.add('hidden');
      document.body.style.overflow = '';
    }

    sidebarToggleBtn?.addEventListener('click', () => {
      adminSidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });
    sidebarOverlay?.addEventListener('click', closeSidebar);

    // Ã¢â€â‚¬Ã¢â€â‚¬ Sub-nav item click Ã¢â€â‚¬Ã¢â€â‚¬
    document.querySelectorAll('.admin-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadSection(item.dataset.sub);
        if (window.innerWidth <= 1024) closeSidebar();
      });
    });

    // Ã¢â€â‚¬Ã¢â€â‚¬ Global String & HTML Utilities Ã¢â€â‚¬Ã¢â€â‚¬
    function escapeHtml(str) {
      return String(str || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }

    function getRowVal(row, possibleKeys) {
      if (!row || typeof row !== 'object') return '';
      const rowKeys = Object.keys(row);
      for (const k of possibleKeys) {
        const targetNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
        for (const rk of rowKeys) {
          if (rk.toLowerCase().replace(/[^a-z0-9]/g, '') === targetNorm) {
            const v = row[rk];
            if (v !== undefined && v !== null && String(v).trim() !== '') {
              return String(v).trim();
            }
          }
        }
      }
      return '';
    }

    function formatAssessmentDisplayName(Assessment, classContext = '') {
      if (!Assessment) return 'â€”';
      const parts = [];
      if (Assessment.institutions?.name) parts.push(`[${Assessment.institutions.name}]`);
      if (classContext) parts.push(`[${classContext}]`);
      if (Assessment.classes?.name) parts.push(Assessment.classes.name);
      if (Assessment.levels?.name) {
        const lvl = String(Assessment.levels.name);
        parts.push(lvl.toLowerCase().includes('level') ? lvl : `Level ${lvl}`);
      }
      if (Assessment.assessment_type) parts.push(Assessment.assessment_type);
      if (Assessment.title) parts.push(Assessment.title);
      return parts.length > 0 ? parts.join(' &middot; ') : (Assessment.title || 'Assessment');
    }

    // â”€â”€ DB Connection Status Banner â”€â”€
    async function initConnectionBanner() {
      const banner = document.getElementById('db-connection-banner');
      const statusDot = document.getElementById('db-status-dot');
      const statusText = document.getElementById('db-status-text');
      if (!banner) return;

      // Show checking state â€” use CSS classes, not inline styles
      statusText.textContent = 'Checking database connection...';

      const result = await testSupabaseConnection();
      if (result.connected) {
        statusDot.classList.add('connected');
        banner.classList.add('connected');
        statusText.innerHTML = `<strong>Connected to Supabase</strong> &mdash; data is saved permanently to the cloud`;
        setTimeout(() => { banner.style.display = 'none'; }, 4000); // Auto-hide when connected
      } else {
        statusDot.classList.add('error');
        banner.classList.add('error');
        if (result.mode === 'demo') {
          statusText.innerHTML = `<strong>Demo / Offline Mode</strong> &mdash; data is in-memory only and will be lost on page reload`;
        } else {
          statusText.innerHTML = `<strong>Database Error</strong> &mdash; ${result.error}. <a href="docs/DATABASE.md" target="_blank" style="color:#f87171;">Check setup guide</a>`;
        }
      }
    }

    function formatAnswerType(atype) {
      if (!atype) return 'Written Test';
      if (atype === 'speech_to_text') return 'Speaking Test';
      if (atype === 'written') return 'Written Test';
      if (atype === 'multiple_choice') return 'Multiple Choice';
      if (atype === 'dropdown') return 'Dropdown';
      return atype.replace('_', ' ');
    }

    var _currentSection = null;
    async function loadSection(section, skipHistory = false) {
      if (!section) return;
      const rawSection = section;
      section = aliasSectionMap[section] || section;
      if (!skipHistory && window.location.hash.substring(1) !== rawSection) {
        window.history.pushState(null, '', `#${rawSection}`);
      }
      _currentSection = section;
      window._activeSectionAlias = rawSection; // the hash alias
      window._activeSection = section; // the actual section

      if (typeof window._cleanupProfileView === 'function') {
        window._cleanupProfileView();
        window._cleanupProfileView = null;
      }
      const domain = sectionDomainMap[section] || 'BOARD';
      const panel = domainToPanelMap[domain] || domain.toLowerCase();
      activatePrimaryTab(panel);

      // Highlight active sub-nav item (support direct key and alias)
      document.querySelectorAll('.admin-nav-item').forEach(i => {
        const sub = i.dataset.sub;
        const mappedSub = aliasSectionMap[sub] || sub;
        i.classList.toggle('active', sub === rawSection || sub === section || mappedSub === section);
      });

      const domainEl = document.getElementById('topbar-domain');
      if (domainEl) domainEl.textContent = domain;
      document.getElementById('topbar-title').textContent = sectionTitles[section] || section;
      const area = document.getElementById('admin-content-area');
      area.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading...</p></div>';

      document.getElementById('add-record-btn').onclick = () => {
        openCrudModal(section, null);
      };
      document.getElementById('add-record-btn').style.display = ['audit', 'health', 'recycle', 'settings', 'results', 'progress-view', 'import-students', 'import-questions', 'export-questions', 'recalibrator', 'cv_generator', 'schedule', 'work_records', 'assessments', 'Assessments'].includes(section) ? 'none' : '';

      try {
        switch(section) {
          case 'institutions':        await renderUnifiedInstitutions(area); break;
          case 'classes':            await _renderClassesModule(area); break;
          case 'class_instances':     await renderClassInstances(area); break;
          case 'class-detail':        await renderClassDetail(area); break;
          case 'levels':              window.location.hash = '#classes'; break;
          case 'topics':              await renderTopics(area); break;
          case 'question_types':          await renderWordTypes(area); break;
          case 'vocab_vault':             await renderVocabularyVault(area); break;
          case 'modules':                 await renderModules(area); break;
          case 'students':            await _renderStudentsModule(area); break;

          case 'questions':           await renderCentralQuestionBank(area); break;

          case 'results':             await renderResults(area); break;
          case 'progress-view':       await renderProgressView(area); break;
          case 'audit':               await renderAuditLog(area); break;
          case 'health':              await renderDataHealth(area); break;
          case 'recycle':             await renderRecycleBin(area); break;
          case 'settings':            await renderSettings(area); break;
          case 'import-students':     await renderImportStudents(area); break;
          case 'import-questions':    await renderCentralQuestionImport(area); break;
          case 'export-questions':    renderExportQuestions(area); break;
          case 'recalibrator':        await renderRecalibrator(area); break;
          case 'assessments':         await renderAssessments(area); break;
          case 'import_ai_assessments': window.location.hash = '#assessments'; break;
          case 'dashboard':           await renderDashboard(area); break;
          case 'profile':             await renderAdminProfile(area); break;
          case 'schedule':            await renderAdminSchedule(area); break;
          case 'work_records':        await renderWorkRecords(area); break;
          case 'cv_generator':        await renderCVGenerator(area); break;

          default: area.innerHTML = `<div class="empty-state"><div class="empty-state__icon">&#128679;</div><h3>${sectionTitles[section] || section}</h3><p>This section is under development.</p></div>`;
        }
      } catch(e) {
        console.error('[loadSection] error:', section, e);
        area.innerHTML = `
          <div class="empty-state card mt-4" style="padding:3.5rem 1.5rem; text-align:center; max-width:600px; margin:2rem auto; border:1px solid rgba(239,68,68,0.3); background:rgba(239,68,68,0.04);">
            <div style="font-size:2.5rem; margin-bottom:1rem;">&#9888;&#65039;</div>
            <h3 style="color:var(--clr-text-1); font-size:1.25rem; font-weight:700; margin-bottom:0.5rem;">Section Loading Interrupted</h3>
            <p class="text-danger text-sm" style="margin-bottom:1.5rem; word-break:break-word;">${escapeHtml(e?.message || 'An unexpected error occurred.')}</p>
            <div class="d-flex gap-3 justify-center">
              <button class="btn btn-primary btn-sm" onclick="window.loadSection('${section}')">&#8635; Retry Section</button>
              <button class="btn btn-secondary btn-sm" onclick="window.location.reload()">Reload Application</button>
            </div>
          </div>
        `;
      }
    }

    // â”€â”€ INSTITUTIONS â”€â”€

    async function renderPrograms(area) {
      const rawData = await adminFetchAll('institutions');
      // Enforce strict alphabetical ordering
      const data = [...rawData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Institutions <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage English learning institutions in alphabetical order</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Institution Name</th>
                <th class="text-center">Status</th>
                <th class="text-center">Created Date</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-institutions"></tbody>
          </table>
        </div>
      `;
      const tbody = document.getElementById('tbl-institutions');
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state__icon">&#127963;</div><p>No institutions yet.</p></div></td></tr>'; return; }
      window._progRecords = {};
      data.forEach(r => {
        window._progRecords[r.id] = r;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="fw-600">${escapeHtml(r.name)}</td>
          <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
          <td class="text-center text-muted text-sm">${new Date(r.created_at).toLocaleDateString()}</td>
          <td class="text-right">
            <div class="d-flex gap-2 justify-end">
              <button class="btn btn-outline btn-sm" data-nav-progs="${r.id}" title="View Programs in ${escapeHtml(r.name)}">Programs &rarr;</button>
              <button class="btn btn-secondary btn-sm" data-edit-prog="${r.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-prog="${r.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('[data-nav-progs]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-nav-progs');
          const rec = window._progRecords[pid];
          window._filterInstitutionId = pid;
          window._filterInstitutionName = rec ? rec.name : '';
          loadSection('programs');
        });
      });
      tbody.querySelectorAll('[data-edit-prog]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-edit-prog');
          const rec = window._progRecords[pid];
          if (rec) openCrudModal('institutions', rec);
        });
      });
      tbody.querySelectorAll('[data-del-prog]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-del-prog');
          const rec = window._progRecords[pid];
          if (rec) window._deleteRecord('institutions', pid, rec.name || 'Program');
        });
      });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ CLASSES (Formerly Classes) Ã¢â€â‚¬Ã¢â€â‚¬
    async function renderClasses(area) {
      const [rawData, institutions, levelsData] = await Promise.all([
        adminFetchAll('classes', '*, levels(*)'),
        adminFetchAll('institutions'),
        adminFetchAll('levels', '*', { order: 'level_number', ascending: true })
      ]);
      
      // Group levels by name to merge duplicate tabs
      const uniqueLevels = [];
      const seen = new Set();
      for (const l of levelsData) {
        if (!seen.has(l.name)) {
          seen.add(l.name);
          uniqueLevels.push(l);
        }
      }


      if (!window._activeClassLevelTab && uniqueLevels.length > 0) {
        window._activeClassLevelTab = uniqueLevels[0].name;
      }
      const activeTabName = window._activeClassLevelTab;
      
      const data = [...rawData].filter(r => r.levels?.name === activeTabName || r.level_id === activeTabName).sort((a, b) => {
        return (a.name || '').localeCompare(b.name || '');
      });

      const tabsHtml = uniqueLevels.map(l => 
        `<button class="btn ${activeTabName === l.name ? 'btn-primary' : 'btn-outline'} btn-sm" onclick="window._activeClassLevelTab='${l.name.replace(/'/g, "\\\'")}'; window.loadSection('classes');">${escapeHtml(l.name)}</button>`
      ).join(' ');

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Classes & Blueprint <span class="count-chip">${data.length} in Tab</span></h2>
            <p class="section-subtitle">Manage class board grouped by level in alphabetical order</p>
          </div>
          <div class="d-flex gap-2 flex-wrap mt-3" style="width: 100%;">
             ${tabsHtml}
          </div>
        </div>

        <!-- C-CLASS TOOLS QUICK-ACCESS BAR -->
        <div class="card p-3 mt-3 mb-3" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
          <div class="text-xs fw-700 mb-2" style="color:var(--clr-text-2);letter-spacing:0.08em;">C &mdash; CLASS TOOLS</div>
          <div class="d-flex gap-2 flex-wrap">
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('levels')">&#128200; Levels</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('topics')">&#127991;&#65039; Topics</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('questions')">&#10067; Question Bank</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('question_types')">&#128284; Validation Dictionary</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('class_instances')">&#128197; Class Instances</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('recalibrator')">&#9889; Recalibrator</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('import-questions')">&#128229; Import Questions</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('export-questions')">&#128228; Export Questions</button>
            <button class="btn btn-ghost btn-sm" onclick="window.loadSection('import_ai_assessments')">&#129302; Import AI Assessments</button>
          </div>
        </div>

        <div class="table-wrap mt-3">
          <table>
            <thead>
              <tr>
                <th class="text-left">Level</th>
                <th class="text-left">Class Name</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-Classes"></tbody>
          </table>
        </div>
      `;
      const tbody = document.getElementById('tbl-Classes');
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No classes in this level yet.</td></tr>'; }
      else {
          window._subjRecords = {};
          data.forEach(r => {
            window._subjRecords[r.id] = r;
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td class="text-muted fw-600">${escapeHtml(r.levels?.name || '&mdash;')}</td>
              <td class="fw-600" style="color:var(--clr-text-1);">${escapeHtml(r.name)}</td>
              <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
              <td class="text-right">
                <div class="d-flex gap-2 justify-end">
                  <button class="btn btn-outline btn-sm" data-nav-topics="${r.id}" title="View Topics in ${escapeHtml(r.name)}">Topics &rarr;</button>
                  <button class="btn btn-info btn-sm" data-nav-bank="${r.id}" title="Question Bank">&#10067; Question Bank</button>
                  <button class="btn btn-secondary btn-sm" data-edit-subj="${r.id}">Edit</button>
                  <button class="btn btn-danger btn-sm" data-del-subj="${r.id}">Delete</button>
                </div>
              </td>
            `;
            tbody.appendChild(tr);
          });
      }

      tbody.querySelectorAll('[data-nav-topics]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-nav-topics');
          const rec = window._subjRecords[sid];
          window._filterClassId = sid;
          window._filterClassName = rec ? rec.name : '';
          loadSection('topics');
        });
      });
      tbody.querySelectorAll('[data-nav-bank]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-nav-bank');
          const rec = window._subjRecords[sid];
          window._filterClassId = sid;
          window._filterClassName = rec ? rec.name : '';
          loadSection('questions');
        });
      });
      tbody.querySelectorAll('[data-edit-subj]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-edit-subj');
          const rec = window._subjRecords[sid];
          if (rec) openCrudModal('classes', rec);
        });
      });
      tbody.querySelectorAll('[data-del-subj]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-del-subj');
          const rec = window._subjRecords[sid];
          if (rec) window._deleteRecord('classes', sid, rec.name || 'Class Board');
        });
      });
    }

    // Ã¢â€â‚¬Ã¢â€â‚¬ LEVELS Ã¢â€â‚¬Ã¢â€â‚¬
    async function renderLevels(area) {
      const [rawData, allClasses] = await Promise.all([
        adminFetchAll('levels', '*'),
        adminFetchAll('programs', 'id, name, institution_id')
      ]);
      const classMap = {};
      allClasses.forEach(c => { classMap[c.id] = c; });

      // Sort by Institution Name (A-Z), Program Name, Class Name (A-Z), then level_number ascending
      const data = [...rawData].sort((a, b) => {
        const pA = a.classes?.institutions?.name || '';
        const pB = b.classes?.institutions?.name || '';
        const cA = (a.program_id && classMap[a.program_id]?.name) || '';
        const cB = (b.program_id && classMap[b.program_id]?.name) || '';
        const sA = a.classes?.name || '';
        const sB = b.classes?.name || '';
        return pA.localeCompare(pB) || cA.localeCompare(cB) || sA.localeCompare(sB) || (a.level_number - b.level_number) || (a.name || '').localeCompare(b.name || '');
      });

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Levels <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Curriculum progression tiers ordered by program, class, Class, and level rank</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Program</th>
                <th class="text-left">Class</th>
                <th class="text-left">Class Board</th>
                <th class="text-center">Level #</th>
                <th class="text-left">Level Name</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-levels"></tbody>
          </table>
        </div>
      `;
      const tbody = document.getElementById('tbl-levels');
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted p-4">No levels yet.</td></tr>'; return; }
      
      window._levelRecords = {};
      data.forEach(r => {
        if (!r.institution_id && r.classes?.institution_id) {
          r.institution_id = r.classes.institution_id;
        }
        window._levelRecords[r.id] = r;
      });

      data.forEach(r => {
        const progName = r.classes?.institutions?.name || 'â€”';
        const programName = (r.program_id && classMap[r.program_id]?.name) ? classMap[r.program_id].name : 'All Programs';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge badge-neutral">${escapeHtml(progName)}</span></td>
          <td><span class="badge badge-neutral">${escapeHtml(programName)}</span></td>
          <td class="text-muted fw-600">${escapeHtml(r.classes?.name || 'â€”')}</td>
          <td class="text-center"><span class="badge badge-primary">Level ${toLevelLetter(r.level_number)}</span></td>
          <td class="fw-600">${escapeHtml(r.name)}</td>
          <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
          <td class="text-right">
            <div class="d-flex gap-2 justify-end">
              <button class="btn btn-secondary btn-sm" data-edit-level="${r.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-level="${r.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('[data-edit-level]').forEach(btn => {
        btn.addEventListener('click', async () => {
          const lid = btn.getAttribute('data-edit-level');
          const rec = window._levelRecords[lid];
          if (rec) await openCrudModal('levels', rec);
        });
      });
      tbody.querySelectorAll('[data-del-level]').forEach(btn => {
        btn.addEventListener('click', () => {
          const lid = btn.getAttribute('data-del-level');
          const rec = window._levelRecords[lid];
          if (rec) window._deleteRecord('levels', lid, rec.name || 'Level');
        });
      });
    }

    // Helper function to calculate age from birth date string (YYYY-MM-DD)
    function calculateAgeFromBirthDate(birthDateStr) {
      if (!birthDateStr) return 'â€”';
      const birthDate = new Date(birthDateStr);
      if (isNaN(birthDate.getTime())) return 'â€”';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? `${age} yrs` : 'â€”';
    }


    // Ã¢â€â‚¬Ã¢â€â‚¬ INDIVIDUAL STUDENT PROFILE (Detailed Progress, Correct/Incorrect Counts, Batch Navigation) Ã¢â€â‚¬Ã¢â€â‚¬
    async function openStudentProfile(studentId, batchStudentIds = [], skipHistory = false) {
      window.openStudentProfile = openStudentProfile;
      if (!skipHistory) {
         const hashState = `profile-${studentId}`;
         if (window.location.hash.substring(1) !== hashState) {
            window.history.pushState({ batchStudentIds }, '', `#${hashState}`);
         }
      }
      if (typeof window._cleanupProfileView === 'function') {
        window._cleanupProfileView();
        window._cleanupProfileView = null;
      }

      const area = document.getElementById('admin-content-area');
      area.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading student profile &amp; question answer history...</p></div>';

      try {
        const sb = await getSupabase();

        // 1. Fetch student record with relations
        const { data: student, error: stErr } = await sb
          .from('students')
          .select('*, programs!program_id(id, name, institution_id), institutions!institution_id(id, name), batches!batch_id(id, name)')
          .eq('id', studentId)
          .single();

        if (stErr || !student) {
          throw new Error(stErr?.message || 'Student record not found.');
        }

        // 2. Fetch student\'s attempts with Assessments and attempt_answers
        const { data: rawAttempts, error: attErr } = await sb
          .from('attempts')
          .select('*, assessments(id, title, assessment_type, classes(id, name)), attempt_answers(*)')
          .eq('student_id', studentId)
          .in('status', ['submitted', 'auto_submitted'])
          .order('submitted_at', { ascending: false });

        if (attErr) {
          console.warn('Could not fetch student attempts:', attErr);
        }

        const allAttempts = rawAttempts || [];

        // 3. Identify highest-scoring attempt per unique Assessment
        const bestAttemptMap = new Map();
        allAttempts.forEach(att => {
          const pct = parseFloat(att.percentage || att.score || 0);
          const existing = bestAttemptMap.get(att.assessment_id);
          if (!existing || pct > parseFloat(existing.percentage || existing.score || 0)) {
            bestAttemptMap.set(att.assessment_id, att);
          }
        });

        const bestAttempts = Array.from(bestAttemptMap.values());
        const bestAttemptIds = new Set(bestAttempts.map(a => a.id));

        // 4. Compute KPIs (Best attempt per Assessment only â€” per agreement)
        let totalCorrect = 0;
        let totalMinor = 0;
        let totalIncorrect = 0;
        let totalQuestionsAnswered = 0;

        bestAttempts.forEach(att => {
          const answers = att.attempt_answers || [];
          totalQuestionsAnswered += answers.length;
          answers.forEach(ans => {
            const evalRes = (ans.evaluation_result || '').toLowerCase();
            const scoreVal = parseFloat(ans.score || 0);
            if (evalRes === 'correct' || scoreVal >= 1) {
              totalCorrect++;
            } else if (evalRes.includes('minor') || (scoreVal > 0 && scoreVal < 1)) {
              totalMinor++;
            } else {
              totalIncorrect++;
            }
          });
        });

        const avgScore = bestAttempts.length > 0
          ? bestAttempts.reduce((sum, a) => sum + parseFloat(a.percentage || a.score || 0), 0) / bestAttempts.length
          : 0;
        const globalGrade = bestAttempts.length > 0 ? getGrade(Math.round(avgScore)) : 'â€”';
        const gradeColors = { S: '#f59e0b', A: '#10b981', B: '#3b82f6', C: '#f59e0b', D: '#ea580c', E: '#ef4444', F: '#94a3b8' };
        const gradeColor = gradeColors[globalGrade] || 'var(--clr-text-1)';

        // 5. Navigation variables within batch
        const currentIdx = batchStudentIds.indexOf(studentId);
        const hasPrev = currentIdx > 0;
        const hasNext = currentIdx >= 0 && currentIdx < batchStudentIds.length - 1;
        const prevId = hasPrev ? batchStudentIds[currentIdx - 1] : null;
        const nextId = hasNext ? batchStudentIds[currentIdx + 1] : null;
        const positionText = batchStudentIds.length > 0 ? `${currentIdx + 1} of ${batchStudentIds.length}` : '';

        // Student metadata
        const displayName = formatStudentName(student.name, student.gender);
        const initial = (student.name || 'S').trim().charAt(0).toUpperCase();
        const ageDisplay = calculateAgeFromBirthDate(student.birth_date);
        const batchName = student.batches?.name || 'Unassigned Batch';
        const programName = student.programs?.name || '&mdash;';
        const institutionName = student.institutions?.name || student.programs?.institutions?.name || '&mdash;';

        area.innerHTML = `
          <div class="student-profile-view animate-fade-in" style="display:flex; flex-direction:column; gap:20px;">
            <!-- Top Navigation Bar -->
            <div class="d-flex align-center justify-between flex-wrap gap-3 p-4 rounded" style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border);">
              <div class="d-flex align-center gap-3">
                <button class="btn btn-secondary btn-sm" id="btn-back-to-students" style="display:inline-flex; align-items:center; gap:6px;">
                  <span>&larr;</span> Back to Students
                </button>
                <div class="d-flex align-center gap-2">
                  <span class="badge badge-info" style="font-size:0.8rem;">&#128101; Batch: ${escapeHtml(batchName)}</span>
                </div>
              </div>

              <!-- Next / Prev Controls -->
              ${batchStudentIds.length > 0 ? `
                <div class="d-flex align-center gap-2">
                  <button class="btn btn-secondary btn-sm" id="btn-prev-student" ${!hasPrev ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} title="Previous Student (ArrowLeft)">
                    &larr; Previous
                  </button>
                  <span class="text-xs fw-700 text-muted" style="padding:0 6px;">${positionText}</span>
                  <button class="btn btn-secondary btn-sm" id="btn-next-student" ${!hasNext ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} title="Next Student (ArrowRight)">
                    Next &rarr;
                  </button>
                </div>
              ` : ''}
            </div>

            <!-- Top Hero Grid: Left Showcase Widget (Diagram) + Right Metadata Card -->
            <div style="display:grid; grid-template-columns: 386px 1fr; gap:20px; align-items:stretch;">
              <!-- Left: Student Showcase & Name Widget (Matches Diagram 100%) -->
              <div style="display:flex; flex-direction:column; gap:16px; width:100%; max-width:386px;">
                <!-- Top Row: Photo on left, 2 stacked boxes on right -->
                <div style="display:flex; gap:16px; align-items:center; width:100%;">
                  <!-- Large Squircle Student Photo -->
                  <div style="
                    width:230px; height:230px; flex-shrink:0; border-radius:28px; overflow:hidden;
                    background: linear-gradient(135deg, var(--clr-primary, #6366f1), var(--clr-accent-1, #ec4899));
                    display:flex; align-items:center; justify-content:center;
                    font-size:5.5rem; font-weight:800; color:#fff;
                    border:3.5px solid var(--clr-accent-1, #ec4899);
                    box-shadow: 0 0 0 6px rgba(99,102,241,0.22), 0 16px 40px rgba(0,0,0,0.5);
                  ">
                    ${student.photo_url ? `<img src="${student.photo_url}" alt="Student Photo" style="width:100%;height:100%;object-fit:cover;" />` : `<span>${escapeHtml(initial)}</span>`}
                  </div>

                  <!-- 2 Stacked Rounded Boxes: Top = Grade, Bottom = Score -->
                  <div style="display:flex; flex-direction:column; justify-content:space-between; height:230px; gap:14px; width:140px; flex-shrink:0;">
                    <!-- Top Box: Grade Only -->
                    <div class="glass-card" style="width:100%; flex:1; border-radius:20px; display:flex; align-items:center; justify-content:center; padding:10px; text-align:center;" title="Global Grade">
                      <div class="fw-800" style="font-size:3.8rem; line-height:1; font-family:var(--font-display); color:${gradeColor};">${globalGrade}</div>
                    </div>
                    <!-- Bottom Box: Score Only -->
                    <div class="glass-card" style="width:100%; flex:1; border-radius:20px; display:flex; align-items:center; justify-content:center; padding:10px; text-align:center;" title="Average Score">
                      <div class="fw-800" style="font-size:2.2rem; line-height:1; color:var(--clr-accent-1, #a78bfa); font-family:var(--font-display);">${avgScore.toFixed(1)}%</div>
                    </div>
                  </div>
                </div>

                <!-- Bottom Row: Student Name & Active Badge Card (Uniform Width 386px!) -->
                <div class="glass-card" style="border-radius:20px; padding:16px 20px; box-sizing:border-box;">
                  <div class="d-flex align-center justify-between gap-2 mb-1">
                    <span class="badge ${student.is_active ? 'badge-success' : 'badge-danger'}">${student.is_active ? 'Active Student' : 'Inactive'}</span>
                    <span class="text-xs text-muted">ID: <code style="font-size:0.75rem;">${escapeHtml(student.id.substring(0, 8))}...</code></span>
                  </div>
                  <h2 style="font-size:1.35rem; font-weight:800; margin:0 0 2px; color:var(--clr-text-1);">${escapeHtml(displayName)}</h2>
                  <p class="text-xs text-muted" style="margin:0;">&#128101; Batch: <strong>${escapeHtml(batchName)}</strong></p>
                </div>
              </div>

              <!-- Right: Detailed Enrollment & Academic Record Card -->
              <div class="glass-card p-5" style="border-radius:24px; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                <div>
                  <div class="d-flex align-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <h3 style="font-size:1.15rem; font-weight:800; margin:0; color:var(--clr-text-1);">&#127891; Student Enrollment &amp; Demographics</h3>
                      <p class="text-xs text-muted" style="margin:2px 0 0;">Official class registration and student profile data</p>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-edit-current-student" style="display:inline-flex; align-items:center; gap:6px;">
                      &#9999;&#65039; Edit Student
                    </button>
                  </div>

                  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-top:16px;">
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">&#127963; Program</div>
                      <div class="fw-700 text-sm mt-1" style="color:var(--clr-text-1);">${escapeHtml(institutionName)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">&#127979; Class</div>
                      <div class="fw-700 text-sm mt-1" style="color:var(--clr-text-1);">${escapeHtml(programName)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">&#128100; Gender</div>
                      <div class="fw-700 text-sm mt-1" style="text-transform:capitalize; color:var(--clr-text-1);">${escapeHtml(student.gender || '&mdash;')}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">&#127874; Age / Birth Date</div>
                      <div class="fw-700 text-sm mt-1" style="color:var(--clr-text-1);">${ageDisplay} <span class="text-xs text-muted fw-400">(${escapeHtml(student.birth_date || '&mdash;')})</span></div>
                    </div>
                  </div>
                </div>

                <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--clr-border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                  <span class="text-xs text-muted">Created: ${student.created_at ? new Date(student.created_at).toLocaleDateString() : 'â€”'}</span>
                  <span class="badge badge-neutral" style="font-size:0.75rem;">Account Status: ${student.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>

            <!-- Detailed Answer Stats: Assessments, Correct, Incorrect -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
              <div class="glass-card p-4 text-center">
                <div class="text-xs text-muted mb-1" style="font-weight:700; letter-spacing:0.05em;">Assessments COMPLETED</div>
                <div class="fw-800" style="font-size:2rem; color:var(--clr-text-1);">${bestAttempts.length}</div>
                <div class="text-xs text-muted mt-1">${allAttempts.length} total attempt${allAttempts.length === 1 ? '' : 's'}</div>
              </div>
              <div class="glass-card p-4 text-center" style="border-top:3px solid #10b981;">
                <div class="text-xs text-muted mb-1" style="font-weight:700; letter-spacing:0.05em; color:#10b981;">&#9989; CORRECT ANSWERS</div>
                <div class="fw-800" style="font-size:2rem; color:#10b981;">${totalCorrect}</div>
                <div class="text-xs text-muted mt-1">From best attempts</div>
              </div>
              <div class="glass-card p-4 text-center" style="border-top:3px solid #ef4444;">
                <div class="text-xs text-muted mb-1" style="font-weight:700; letter-spacing:0.05em; color:#ef4444;">&#10060; INCORRECT ANSWERS</div>
                <div class="fw-800" style="font-size:2rem; color:#ef4444;">${totalIncorrect}</div>
                <div class="text-xs text-muted mt-1">${totalMinor > 0 ? `+ ${totalMinor} minor error${totalMinor === 1 ? '' : 's'}` : '0 minor errors'}</div>
              </div>
            </div>

            <!-- Detailed Assessment Breakdown -->
            <div class="glass-card p-5">
              <div class="d-flex align-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 style="font-size:1.15rem; font-weight:700; margin:0;">&#128203; Assessment Performance &amp; Question History</h3>
                  <p class="text-xs text-muted">Click any Assessment row below to inspect question-level answers and correct vs. incorrect breakdown</p>
                </div>
                <span class="badge badge-neutral">${allAttempts.length} Attempt${allAttempts.length === 1 ? '' : 's'} Logged</span>
              </div>

              ${allAttempts.length === 0 ? `
                <div class="empty-state p-6 text-center">
                  <div style="font-size:2.5rem; margin-bottom:8px;">&#128221;</div>
                  <h4 style="font-weight:700;">No Assessments Taken Yet</h4>
                  <p class="text-xs text-muted">This student hasn't completed or submitted any Assessments yet.</p>
                </div>
              ` : `
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Assessment Title</th>
                        <th>Class</th>
                        <th class="text-center">Score</th>
                        <th class="text-center">Grade</th>
                        <th class="text-center">&#9989; Correct</th>
                        <th class="text-center">&#9888;&#65039; Half</th>
                        <th class="text-center">&#10060; Incorrect</th>
                        <th class="text-center">Submitted At</th>
                        <th class="text-center" style="width:110px;">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${allAttempts.map((att) => {
                        const isBest = bestAttemptIds.has(att.id);
                        const answers = att.attempt_answers || [];
                        let attCorrect = 0, attMinor = 0, attIncorrect = 0;
                        answers.forEach(a => {
                          const res = (a.evaluation_result || '').toLowerCase();
                          const sc = parseFloat(a.score || 0);
                          if (res === 'correct' || sc >= 1) attCorrect++;
                          else if (res.includes('minor') || (sc > 0 && sc < 1)) attMinor++;
                          else attIncorrect++;
                        });
                        const pct = parseFloat(att.percentage || att.score || 0).toFixed(1);
                        const grade = att.grade || getGrade(Math.round(pct));
                        const AssessmentTitle = att.assessments?.title || 'Assessment';
                        const ClassName = att.assessments?.classes?.name || '&mdash;';
                        const submitDate = att.submitted_at ? new Date(att.submitted_at).toLocaleString() : '&mdash;';
                        const rowId = `att-row-${att.id}`;
                        const detailId = `att-detail-${att.id}`;

                        return `
                          <tr id="${rowId}" class="clickable-attempt-row" data-att-id="${att.id}" style="cursor:pointer; transition:background 0.15s;">
                            <td class="fw-600">
                              <div class="d-flex align-center gap-2">
                                <span class="toggle-arrow" id="arrow-${att.id}" style="font-size:0.75rem; color:var(--clr-text-muted); transition:transform 0.2s;">&#9654;</span>
                                <span>${escapeHtml(AssessmentTitle)}</span>
                                ${isBest ? `<span class="badge badge-success" style="font-size:0.65rem;" title="Highest score attempt for this Assessment">&#11088; Best</span>` : ''}
                              </div>
                            </td>
                            <td class="text-sm text-muted">${escapeHtml(ClassName)}</td>
                            <td class="text-center fw-700 text-grade-${grade}">${pct}%</td>
                            <td class="text-center"><span class="grade-badge grade-${grade}" style="width:26px; height:26px; font-size:0.75rem; display:inline-flex;">${grade}</span></td>
                            <td class="text-center"><span class="badge badge-success" style="font-size:0.75rem;">${attCorrect}</span></td>
                            <td class="text-center"><span class="badge badge-warning" style="font-size:0.75rem;">${attMinor}</span></td>
                            <td class="text-center"><span class="badge badge-danger" style="font-size:0.75rem;">${attIncorrect}</span></td>
                            <td class="text-center text-xs text-muted">${submitDate}</td>
                            <td class="text-center">
                              <button class="btn btn-ghost btn-sm" style="font-size:0.75rem; padding:2px 8px;">
                                View Answers
                              </button>
                            </td>
                          </tr>

                          <!-- Accordion Detail Row for Questions -->
                          <tr id="${detailId}" class="hidden" style="background:rgba(0,0,0,0.25);">
                            <td colspan="8" style="padding:16px 20px;">
                              <div style="border-left:3px solid var(--clr-primary, #6366f1); padding-left:14px;">
                                <div class="d-flex align-center justify-between flex-wrap gap-3 mb-3">
                                  <h4 class="text-sm fw-700" style="color:var(--clr-text-1); margin:0;">
                                    Questions &amp; Answers Breakdown (${answers.length} Questions)
                                  </h4>
                                  ${(att.assessments?.assessment_type === 'EXAM' && parseFloat(att.percentage || att.score || 0) < 60 && !att.is_remedial_unlocked) ? `
                                    <button class="btn btn-primary btn-sm remedial-override-btn" data-attempt-id="${att.id}" style="background:var(--clr-accent-1);border:none;">
                                      🔓 Allow Remedial Retake
                                    </button>
                                  ` : ''}
                                  ${att.is_remedial_unlocked ? `<span class="badge badge-success" style="font-size:0.7rem;">🔓 Remedial Authorized</span>` : ''}
                                </div>

                                ${answers.length === 0 ? `
                                  <p class="text-xs text-muted">No individual question snapshot records stored for this attempt.</p>
                                ` : `
                                  <div style="display:flex; flex-direction:column; gap:10px;">
                                    ${[...answers].sort((a, b) => (a.question_order || 0) - (b.question_order || 0)).map((ans, qIdx) => {
                                      const evalRes = (ans.evaluation_result || 'Unknown').toLowerCase();
                                      const sc = parseFloat(ans.score || 0);
                                      let statusBadge = '<span class="badge badge-danger">&#10060; Incorrect (0 pt)</span>';
                                      if (evalRes === 'correct' || sc >= 1) {
                                        statusBadge = '<span class="badge badge-success">&#9989; Correct (+1 pt)</span>';
                                      } else if (evalRes.includes('minor') || (sc > 0 && sc < 1)) {
                                        statusBadge = '<span class="badge badge-warning">&#9888;&#65039; Minor Error (+0.5 pt)</span>';
                                      }
                                      
                                      const qText = ans.question_snapshot || `Question #${qIdx + 1}`;
                                      const studentAns = ans.student_answer || '(No Answer)';
                                      const correctAns = ans.correct_answer_snapshot || '&mdash;';

                                      return `
                                        <div style="padding:10px 14px; background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.06); border-radius:8px;">
                                          <div class="d-flex align-center justify-between flex-wrap gap-2 mb-2">
                                            <div class="fw-700 text-sm" style="color:var(--clr-text-1);">
                                              <span class="text-muted mr-1">Q${qIdx + 1}.</span> ${escapeHtml(qText)}
                                            </div>
                                            <div>${statusBadge}</div>
                                          </div>
                                          <div class="d-flex gap-4 flex-wrap text-xs" style="margin-top:6px;">
                                            <div>
                                              <span class="text-muted">Student Answer:</span>
                                              <span class="fw-600" style="color:${evalRes === 'correct' ? '#10b981' : '#f87171'}; margin-left:4px;">
                                                ${escapeHtml(studentAns)}
                                              </span>
                                            </div>
                                            <div>
                                              <span class="text-muted">Correct Answer:</span>
                                              <span class="fw-600 text-success" style="margin-left:4px;">
                                                ${escapeHtml(correctAns)}
                                              </span>
                                            </div>
                                          </div>
                                        </div>
                                      `;
                                    }).join('')}
                                  </div>
                                `}
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            </div>
          </div>
        `;

        // Cleanup listener helper
        const cleanup = () => {
          window.removeEventListener('keydown', onKeyDown);
          window._cleanupProfileView = null;
        };
        window._cleanupProfileView = cleanup;

        // Wire Back button
        document.getElementById('btn-back-to-students')?.addEventListener('click', () => {
          cleanup();
          loadSection('students');
        });

        // Wire Previous / Next buttons
        document.getElementById('btn-prev-student')?.addEventListener('click', () => {
          if (hasPrev) {
            cleanup();
            openStudentProfile(prevId, batchStudentIds);
          }
        });
        document.getElementById('btn-next-student')?.addEventListener('click', () => {
          if (hasNext) {
            cleanup();
            openStudentProfile(nextId, batchStudentIds);
          }
        });

        // Keyboard navigation (ArrowLeft & ArrowRight)
        function onKeyDown(e) {
          if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
          if (e.key === 'ArrowLeft' && hasPrev) {
            e.preventDefault();
            cleanup();
            openStudentProfile(prevId, batchStudentIds);
          } else if (e.key === 'ArrowRight' && hasNext) {
            e.preventDefault();
            cleanup();
            openStudentProfile(nextId, batchStudentIds);
          }
        }
        window.addEventListener('keydown', onKeyDown);

        // Wire Edit Student button
        document.getElementById('btn-edit-current-student')?.addEventListener('click', () => {
          openCrudModal('students', student);
        });

        // Accordion row expansion for question breakdown
        area.querySelectorAll('.clickable-attempt-row').forEach(row => {
          row.addEventListener('click', () => {
            const attId = row.dataset.attId;
            const detailRow = document.getElementById(`att-detail-${attId}`);
            const arrow = document.getElementById(`arrow-${attId}`);
            if (detailRow) {
              const isNowHidden = detailRow.classList.toggle('hidden');
              if (arrow) arrow.textContent = isNowHidden ? '\u25B6\uFE0F' : '\u25BC';
            }
          });
        });

        // Wire Remedial Override buttons
        area.querySelectorAll('.remedial-override-btn').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            e.stopPropagation(); // Prevent accordion toggle
            const attId = btn.dataset.attemptId;
            if (!attId) return;
            if (!confirm('Authorize a remedial retake for this failed EXAM? This action cannot be undone.')) return;
            
            try {
              btn.disabled = true;
              btn.innerHTML = '<span class="spinner" style="width:12px;height:12px;margin-right:6px;border-width:2px;border-top-color:#fff;"></span> Authorizing...';
              
              if (typeof window.adminUnlockRemedialExam !== 'function') {
                const api = await import('../api.js?v=4.7.5');
                await api.adminUnlockRemedialExam(attId);
              } else {
                await window.adminUnlockRemedialExam(attId);
              }
              
              showToast('Remedial retake authorized.', 'success');
              openStudentProfile(studentId, batchStudentIds, true);
            } catch (err) {
              btn.disabled = false;
              btn.textContent = '🔓 Allow Remedial Retake';
              showToast(err.message, 'error');
            }
          });
        });

      } catch(err) {
        console.error('Failed to render student profile:', err);
        area.innerHTML = `
          <div class="empty-state p-6 text-center">
            <div style="font-size:2.5rem; margin-bottom:8px;">&#9888;&#65039;</div>
            <h4 class="text-danger">Failed to load student profile</h4>
            <p class="text-xs text-muted mb-4">${escapeHtml(err.message)}</p>
            <button class="btn btn-secondary btn-sm" id="btn-err-back">&larr; Back to Students</button>
          </div>
        `;
        document.getElementById('btn-err-back')?.addEventListener('click', () => loadSection('students'));
      }
    }

    // --- Assessment MANAGEMENT HUB (Restored & Elevated) ---


// Global edit/delete handlers
window._editRecord = async (section, id, jsonStr) => {
  const record = JSON.parse(jsonStr);
  await openCrudModal(section, record);
};

let _deleteSection, _deleteId;
window._deleteRecord = (section, id, name) => {
  _deleteSection = section || window._currentSection || 'batches';
  _deleteId = id;
  document.getElementById('delete-modal-message').textContent = `Soft-delete "${name}"? Historical data is preserved.`;
  document.getElementById('delete-modal').classList.remove('hidden');
};

document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
  if (!_deleteSection || !_deleteId) return; // Prevent duplicate/empty listener execution
  try {
    await adminSoftDelete(_deleteSection, _deleteId);
    showToast('Record deleted.', 'success');
    document.getElementById('delete-modal').classList.add('hidden');
    if (window._currentSection) loadSection(window._currentSection);
    _deleteSection = null; _deleteId = null; // Clear state
  } catch(e) { showToast(e.message, 'error'); }
});

// Modal close handlers
['close-crud-modal','crud-cancel-btn'].forEach(id => document.getElementById(id)?.addEventListener('click', () => document.getElementById('crud-modal')?.classList.add('hidden')));
['delete-cancel-btn'].forEach(id => document.getElementById(id)?.addEventListener('click', () => document.getElementById('delete-modal')?.classList.add('hidden')));

window.openCrudModal = openCrudModal;
window.openStudentFullEdit = openStudentFullEdit;
window.openDuplicateStudentsModal = openDuplicateStudentsModal;
window.openDuplicateQuestionsModal = openDuplicateQuestionsModal;
window.loadSection = loadSection;
window.openStudentProfile = openStudentProfile;
