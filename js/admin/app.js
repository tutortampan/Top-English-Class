import {
  adminFetchAll, adminInsert, adminUpdate, adminSoftDelete, adminHardDelete,
  adminFetchDeleted, adminRestore,
  mergeDuplicateStudents, detectDuplicateStudents, mergeStudentPair,
  detectDuplicateQuestions, resequenceExamQuestions, resolveDuplicateQuestionGroup, batchResolveExamDuplicateQuestions,
  fetchInstitutions, fetchPrograms, fetchBatches, formatStudentName,
  testSupabaseConnection, previewRecalibrateExam, applyRecalibrateExam, isPassing, calculatePercentage
} from '../api.js?v=4.0.0';
import { parseExcelWorkbook, processStudentImportRows, processQuestionImportRows } from '../excel-parser.js?v=4.0.0';
import { setAdminSession, getAdminSession, clearAdminSession } from '../session.js?v=4.0.0';
import { showToast, showLoading, hideLoading, getGrade } from '../app.js?v=4.0.0';
import { getSupabase } from '../supabase.js?v=4.0.0';
import { openAssessmentBuilder } from './exam-builder.js?v=4.0.0';
import { renderStudents as _renderStudentsModule } from './student-management.js?v=4.0.0';
import { renderClasses as _renderClassesModule, renderBatches as _renderBatchesModule } from './program-management.js?v=4.0.0';
import { renderTopics, renderWordTypes, renderCentralQuestionBank, renderAssignments, renderCentralQuestionImport } from './central-assessment.js?v=4.0.0';
import { renderExams } from './exam-management.js?v=4.0.0';
import { renderResults, renderProgressView, renderRecalibrator, renderClassInstances } from './challenges-management.js?v=4.0.0';
import { renderAuditLog, renderSettings, renderDataHealth, renderRecycleBin } from './desk-management.js?v=4.0.0';
import { renderImportStudents, renderImportQuestions, renderExportQuestions } from './imports-exports.js?v=4.0.0';
import { openCrudModal, openDuplicateStudentsModal, openDuplicateQuestionsModal, hashPin } from './crud-modals.js?v=4.0.0';
import { renderProfile, renderSchedule, renderWorkRecords, renderCvGenerator } from './affairs.js?v=4.0.0';
    // -- Primary Tab Switching Variables --
    const mobileTabs = document.querySelectorAll('.mobile-tab');

    // ——— ABCD Primary Architecture Section Titles ———
    const sectionTitles = {
      profile: 'My Profile', schedule: 'Personal Schedule', work_records: 'Work Records', cv_generator: 'CV Generator',
      institutions: 'Institutions', programs: 'Programs', batches: 'Batches', students: 'Students Roster', 'import-students': 'Import Students', 'progress-view': 'Student Progress',
      subjects: 'Classes (Subjects)', classes: 'Classes', class_instances: 'Class Instances', levels: 'Levels', topics: 'Question Groups & Topics', questions: 'Central Question Bank', question_types: 'Validation Dictionary', 'import-questions': 'Import Questions', 'export-questions': 'Export Questions',
      exams: 'All Challenges', challenge_definitions: 'Challenge Definitions', challenge_instances: 'Challenge Instances', assignments: 'Assignments & Rosters', results: 'Challenge Results', recalibrator: 'Recalibration Engine',
      audit: 'Activity & Audit Logs', settings: 'System Settings', recycle: 'Recycle Bin', health: 'Data Health & Diagnostics'
    };

    // ABCD 4-Domain Mapping
    const sectionDomainMap = {
      profile: 'AFFAIRS', schedule: 'AFFAIRS', work_records: 'AFFAIRS', cv_generator: 'AFFAIRS',
      institutions: 'BLUEPRINTS', programs: 'BLUEPRINTS', batches: 'BLUEPRINTS', students: 'BLUEPRINTS', 'import-students': 'BLUEPRINTS', 'progress-view': 'BLUEPRINTS',
      subjects: 'CHALLENGES', classes: 'CHALLENGES', class_instances: 'CHALLENGES', levels: 'CHALLENGES', topics: 'CHALLENGES', questions: 'CHALLENGES', question_types: 'CHALLENGES', 'import-questions': 'CHALLENGES', 'export-questions': 'CHALLENGES',
      exams: 'CHALLENGES', challenge_definitions: 'CHALLENGES', challenge_instances: 'CHALLENGES', assignments: 'CHALLENGES', results: 'CHALLENGES', recalibrator: 'CHALLENGES',
      audit: 'DESK', settings: 'DESK', recycle: 'DESK', health: 'DESK'
    };

    // Mobile Bottom Tab Panels -> Primary Domain
    const domainToPanelMap = {
      AFFAIRS: 'affairs', BLUEPRINTS: 'blueprints', CHALLENGES: 'challenges', DESK: 'desk',
      DATABASE: 'blueprints', CLASS: 'blueprints', STUDENT: 'blueprints', EXAM: 'challenges',
      ACADEMY: 'blueprints', BLUEPRINT: 'challenges' // Legacy mappings
    };

    const tabDefaultSections = {
      affairs: 'profile',
      blueprints: 'institutions',
      challenges: 'subjects',
      desk: 'audit',
      database: 'subjects', class: 'programs', student: 'students', exam: 'exams',
      academy: 'institutions', blueprint: 'subjects' // Legacy mappings
    };

    // Section alias map to guarantee 100% backward compatibility
    const aliasSectionMap = {
      'academy-institutions': 'institutions',
      'academy-programs': 'programs',
      'academy-batches': 'batches',
      'academy-students': 'students',
      'academy-import': 'import-students',
      'blueprint-subjects': 'subjects',
      'blueprint-topics': 'topics',
      'blueprint-bank': 'questions',
      'blueprint-wordtypes': 'question_types',
      'blueprint-import': 'import-questions',
      'blueprint-export': 'export-questions',
      'challenges-hub': 'exams',
      'challenges-assignments': 'assignments',
      'challenges-results': 'results',
      'challenges-recalibrator': 'recalibrator',
      'desk-audit': 'audit',
      'desk-settings': 'settings',
      'desk-recycle': 'recycle',
      'desk-health': 'health'
    };

    async function updateAdminKpiBanner() {
      try {
        const [stds, asms, atts, profs] = await Promise.all([
          adminFetchAll('students'),
          adminFetchAll('exams'),
          adminFetchAll('attempts'),
          adminFetchAll('user_professionals')
        ]);
        const kpiAcad = document.getElementById('kpi-blueprints');
        if (kpiAcad) kpiAcad.textContent = stds.filter(s => !s.deleted_at).length;
        const kpiChal = document.getElementById('kpi-challenges');
        if (kpiChal) kpiChal.textContent = asms.filter(a => !a.deleted_at && a.exam_status === 'published').length;
        const kpiDesk = document.getElementById('kpi-desk');
        if (kpiDesk) kpiDesk.textContent = atts.length;
        const kpiAffairs = document.getElementById('kpi-affairs');
        if (kpiAffairs) kpiAffairs.textContent = profs ? profs.length : 0;
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

    // â”€â”€ Auth â”€â”€
    const session = getAdminSession();
    if (session) showConsole();

    document.getElementById('admin-login-btn').addEventListener('click', async () => {
      const user = document.getElementById('admin-username').value.trim();
      const pass = document.getElementById('admin-password').value;
      if (!user || !pass) { showToast('Please enter credentials.', 'warning'); return; }

      showLoading('Authenticatingâ€¦');
      try {
        // 1. Primary Check: Master credentials (admin / admin123) or custom saved password
        const savedCustomPass = localStorage.getItem('tec_admin_custom_password');
        const isMaster = (user.toLowerCase() === 'admin' && (pass === 'admin123' || (savedCustomPass && pass === savedCustomPass)));

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
        if (user.toLowerCase() === 'admin' && pass === 'admin123') {
          setAdminSession({ admin_id: 'admin-master', username: 'admin' });
          showToast('Welcome, Administrator!', 'success');
          showConsole();
        } else {
          showToast(e.message || 'Authentication failed. Please check your credentials.', 'error');
        }
      }
    });

    document.getElementById('admin-password').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('admin-login-btn').click();
    });

    document.getElementById('admin-logout-btn').addEventListener('click', () => {
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
        const studentId = hash.replace('profile-', '');
        activatePrimaryTab('blueprints');
        openStudentProfile(studentId, [], true);
      } else {
        activatePrimaryTab('challenges');
        loadSection('exams', true);
      }
      initConnectionBanner(); // Check live DB connection and show status banner
    }
    
    window.addEventListener('popstate', (e) => {
      const hash = window.location.hash.substring(1);
      const targetSec = aliasSectionMap[hash] || hash;
      if (targetSec && (sectionTitles[targetSec] || targetSec === 'students')) {
        loadSection(targetSec, true);
      } else if (hash && hash.startsWith('profile-')) {
        const studentId = hash.replace('profile-', '');
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
          affairs: 'AFFAIRS',
          blueprints: 'BLUEPRINTS',
          challenges: 'CHALLENGES',
          desk: 'DESK',
          academy: 'BLUEPRINTS', // Legacy fallback
          blueprint: 'CHALLENGES' // Legacy fallback
        };
        domainEl.textContent = domainNameMap[panel.toLowerCase()] || panel.toUpperCase();
      }
    }

    // â”€â”€ Topbar Domain Switcher Click (removed â€” no domain pill elements exist) â”€â”€

    // â”€â”€ Mobile Bottom Tab Switching â”€â”€
    mobileTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panel = tab.dataset.panel;
        activatePrimaryTab(panel);
        loadSection(tabDefaultSections[panel]);
      });
    });

    // â”€â”€ Sidebar Toggle for Mobile â”€â”€
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

    // â”€â”€ Sub-nav item click â”€â”€
    document.querySelectorAll('.admin-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadSection(item.dataset.sub);
        if (window.innerWidth <= 1024) closeSidebar();
      });
    });

    // â”€â”€ Global String & HTML Utilities â”€â”€
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

    function formatExamDisplayName(exam, classContext = '') {
      if (!exam) return 'â€”';
      const parts = [];
      if (exam.institutions?.name) parts.push(`[${exam.institutions.name}]`);
      if (classContext) parts.push(`[${classContext}]`);
      if (exam.subjects?.name) parts.push(exam.subjects.name);
      if (exam.levels?.name) {
        const lvl = String(exam.levels.name);
        parts.push(lvl.toLowerCase().includes('level') ? lvl : `Level ${lvl}`);
      }
      if (exam.exam_type) parts.push(exam.exam_type);
      if (exam.exam_title) parts.push(exam.exam_title);
      return parts.length > 0 ? parts.join(' Â· ') : (exam.exam_title || 'Exam');
    }

    // â”€â”€ DB Connection Status Banner â”€â”€
    async function initConnectionBanner() {
      const banner = document.getElementById('db-connection-banner');
      const statusDot = document.getElementById('db-status-dot');
      const statusText = document.getElementById('db-status-text');
      if (!banner) return;

      // Show checking state Ã¢â‚¬â€ use CSS classes, not inline styles
      statusText.textContent = 'Checking database connectionÃ¢â‚¬Â¦';

      const result = await testSupabaseConnection();
      if (result.connected) {
        statusDot.classList.add('connected');
        banner.classList.add('connected');
        statusText.innerHTML = `<strong>Connected to Supabase</strong> Ã¢â‚¬â€ data is saved permanently to the cloud`;
        setTimeout(() => { banner.style.display = 'none'; }, 4000); // Auto-hide when connected
      } else {
        statusDot.classList.add('error');
        banner.classList.add('error');
        if (result.mode === 'demo') {
          statusText.innerHTML = `<strong>Demo / Offline Mode</strong> Ã¢â‚¬â€ data is in-memory only and will be lost on page reload`;
        } else {
          statusText.innerHTML = `<strong>Database Error</strong> Ã¢â‚¬â€ ${result.error}. <a href="docs/DATABASE.md" target="_blank" style="color:#f87171;">Check setup guide</a>`;
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

    let _currentSection = null;
    async function loadSection(section, skipHistory = false) {
      if (!section) return;
      const rawSection = section;
      section = aliasSectionMap[section] || section;
      if (!skipHistory && window.location.hash.substring(1) !== rawSection) {
        window.history.pushState(null, '', `#${rawSection}`);
      }
      _currentSection = section;
      if (typeof window._cleanupProfileView === 'function') {
        window._cleanupProfileView();
        window._cleanupProfileView = null;
      }
      const domain = sectionDomainMap[section] || 'BLUEPRINTS';
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
      area.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>LoadingÃ¢â‚¬Â¦</p></div>';

      // Set up Add button
      document.getElementById('add-record-btn').onclick = () => {
        if (section === 'exams') {
          openAssessmentBuilder(null);
        } else {
          openCrudModal(section, null);
        }
      };
      document.getElementById('add-record-btn').style.display = ['audit', 'results', 'progress-view', 'import-students', 'import-questions', 'export-questions', 'recalibrator'].includes(section) ? 'none' : '';

      try {
        switch(section) {
          case 'institutions':        await renderPrograms(area); break;
          case 'subjects':            await renderSubjects(area); break;
          case 'class_instances':     await renderClassInstances(area); break;
          case 'levels':              await renderLevels(area); break;
          case 'topics':              await renderTopics(area); break;
          case 'question_types':          await renderWordTypes(area); break;
          case 'programs':            await _renderClassesModule(area); break;
          case 'batches':             await _renderBatchesModule(area); break;
          case 'students':            await _renderStudentsModule(area); break;
          case 'exams':               await renderExams(area); break;
          case 'questions':           await renderCentralQuestionBank(area); break;
          case 'assignments':         await renderAssignments(area); break;
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
          case 'profile':             await renderProfile(area); break;
          case 'schedule':            await renderSchedule(area); break;
          case 'work_records':        await renderWorkRecords(area); break;
          case 'cv_generator':        await renderCvGenerator(area); break;
          default: area.innerHTML = `<div class="empty-state"><div class="empty-state__icon">Ã°Å¸Å¡Â§</div><h3>${sectionTitles[section] || section}</h3><p>This section is under development.</p></div>`;
        }
      } catch(e) {
        console.error('[loadSection] error:', section, e);
        area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load: ${e.message}</p></div>`;
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
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state__icon">ðŸ¢</div><p>No institutions yet.</p></div></td></tr>'; return; }
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
              <button class="btn btn-outline btn-sm" data-nav-progs="${r.id}" title="View Programs in ${escapeHtml(r.name)}">Programs Ã¢â€ â€™</button>
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

    // â”€â”€ CLASSES (Formerly Subjects) â”€â”€
    async function renderSubjects(area) {
      const [rawData, institutions] = await Promise.all([adminFetchAll('subjects', '*, institutions(name)'), adminFetchAll('institutions')]);
      // Sort by Institution Name (A-Z), then Class Name (A-Z)
      const data = [...rawData].sort((a, b) => {
        const pA = a.institutions?.name || '';
        const pB = b.institutions?.name || '';
        return pA.localeCompare(pB) || (a.name || '').localeCompare(b.name || '');
      });

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Class Blueprints <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage class blueprints grouped by program in alphabetical order</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Program</th>
                <th class="text-left">Class Blueprint Name</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-subjects"></tbody>
          </table>
        </div>
      `;
      const tbody = document.getElementById('tbl-subjects');
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No class blueprints yet.</td></tr>'; return; }
      window._subjRecords = {};
      data.forEach(r => {
        window._subjRecords[r.id] = r;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-muted fw-600">${escapeHtml(r.institutions?.name || 'â€”')}</td>
          <td class="fw-600" style="color:var(--clr-text-1);">${escapeHtml(r.name)}</td>
          <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
          <td class="text-right">
            <div class="d-flex gap-2 justify-end">
              <button class="btn btn-outline btn-sm" data-nav-topics="${r.id}" title="View Topics in ${escapeHtml(r.name)}">Topics Ã¢â€ â€™</button>
              <button class="btn btn-secondary btn-sm" data-edit-subj="${r.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-subj="${r.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('[data-nav-topics]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-nav-topics');
          const rec = window._subjRecords[sid];
          window._filterSubjectId = sid;
          window._filterSubjectName = rec ? rec.name : '';
          loadSection('topics');
        });
      });
      tbody.querySelectorAll('[data-edit-subj]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-edit-subj');
          const rec = window._subjRecords[sid];
          if (rec) openCrudModal('subjects', rec);
        });
      });
      tbody.querySelectorAll('[data-del-subj]').forEach(btn => {
        btn.addEventListener('click', () => {
          const sid = btn.getAttribute('data-del-subj');
          const rec = window._subjRecords[sid];
          if (rec) window._deleteRecord('subjects', sid, rec.name || 'Class Blueprint');
        });
      });
    }

    // â”€â”€ LEVELS â”€â”€
    async function renderLevels(area) {
      const [rawData, allClasses] = await Promise.all([
        adminFetchAll('levels', '*, subjects(name, institution_id, institutions(name))'),
        adminFetchAll('programs', 'id, name, institution_id')
      ]);
      const classMap = {};
      allClasses.forEach(c => { classMap[c.id] = c; });

      // Sort by Institution Name (A-Z), Program Name, Subject Name (A-Z), then level_number ascending
      const data = [...rawData].sort((a, b) => {
        const pA = a.subjects?.institutions?.name || '';
        const pB = b.subjects?.institutions?.name || '';
        const cA = (a.program_id && classMap[a.program_id]?.name) || '';
        const cB = (b.program_id && classMap[b.program_id]?.name) || '';
        const sA = a.subjects?.name || '';
        const sB = b.subjects?.name || '';
        return pA.localeCompare(pB) || cA.localeCompare(cB) || sA.localeCompare(sB) || (a.level_number - b.level_number) || (a.name || '').localeCompare(b.name || '');
      });

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Levels <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Curriculum progression tiers ordered by program, class, subject, and level rank</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Program</th>
                <th class="text-left">Class</th>
                <th class="text-left">Class Blueprint</th>
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
        if (!r.institution_id && r.subjects?.institution_id) {
          r.institution_id = r.subjects.institution_id;
        }
        window._levelRecords[r.id] = r;
      });

      data.forEach(r => {
        const progName = r.subjects?.institutions?.name || 'â€”';
        const programName = (r.program_id && classMap[r.program_id]?.name) ? classMap[r.program_id].name : 'All Programs';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge badge-neutral">${escapeHtml(progName)}</span></td>
          <td><span class="badge badge-neutral">${escapeHtml(programName)}</span></td>
          <td class="text-muted fw-600">${escapeHtml(r.subjects?.name || 'â€”')}</td>
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


    // â”€â”€ INDIVIDUAL STUDENT PROFILE (Detailed Progress, Correct/Incorrect Counts, Batch Navigation) â”€â”€
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
      area.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading student profile &amp; question answer historyâ€¦</p></div>';

      try {
        const sb = await getSupabase();

        // 1. Fetch student record with relations
        const { data: student, error: stErr } = await sb
          .from('students')
          .select('*, programs(id, name, institution_id, institutions(name)), institutions(id, name), batches(id, name)')
          .eq('id', studentId)
          .single();

        if (stErr || !student) {
          throw new Error(stErr?.message || 'Student record not found.');
        }

        // 2. Fetch student\'s attempts with exams and attempt_answers
        const { data: rawAttempts, error: attErr } = await sb
          .from('attempts')
          .select('*, exams(id, exam_title, exam_type, answer_type, time_limit_minutes, subjects(id, name), levels(id, name, level_number)), attempt_answers(*)')
          .eq('student_id', studentId)
          .in('status', ['submitted', 'auto_submitted'])
          .order('submitted_at', { ascending: false });

        if (attErr) {
          console.warn('Could not fetch student attempts:', attErr);
        }

        const allAttempts = rawAttempts || [];

        // 3. Identify highest-scoring attempt per unique exam
        const bestAttemptMap = new Map();
        allAttempts.forEach(att => {
          const pct = parseFloat(att.percentage || att.score || 0);
          const existing = bestAttemptMap.get(att.exam_id);
          if (!existing || pct > parseFloat(existing.percentage || existing.score || 0)) {
            bestAttemptMap.set(att.exam_id, att);
          }
        });

        const bestAttempts = Array.from(bestAttemptMap.values());
        const bestAttemptIds = new Set(bestAttempts.map(a => a.id));

        // 4. Compute KPIs (Best attempt per exam only â€” per agreement)
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
        const programName = student.programs?.name || 'â€”';
        const institutionName = student.institutions?.name || student.programs?.institutions?.name || 'â€”';

        area.innerHTML = `
          <div class="student-profile-view animate-fade-in" style="display:flex; flex-direction:column; gap:20px;">
            <!-- Top Navigation Bar -->
            <div class="d-flex align-center justify-between flex-wrap gap-3 p-4 rounded" style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border);">
              <div class="d-flex align-center gap-3">
                <button class="btn btn-secondary btn-sm" id="btn-back-to-students" style="display:inline-flex; align-items:center; gap:6px;">
                  <span>â†</span> Back to Students
                </button>
                <div class="d-flex align-center gap-2">
                  <span class="badge badge-info" style="font-size:0.8rem;">ðŸ‘¥ Batch: ${escapeHtml(batchName)}</span>
                </div>
              </div>

              <!-- Next / Prev Controls -->
              ${batchStudentIds.length > 0 ? `
                <div class="d-flex align-center gap-2">
                  <button class="btn btn-secondary btn-sm" id="btn-prev-student" ${!hasPrev ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} title="Previous Student (ArrowLeft)">
                    â—€ Previous
                  </button>
                  <span class="text-xs fw-700 text-muted" style="padding:0 6px;">${positionText}</span>
                  <button class="btn btn-secondary btn-sm" id="btn-next-student" ${!hasNext ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : ''} title="Next Student (ArrowRight)">
                    Next â–¶
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
                    <span class="text-xs text-muted">ID: <code style="font-size:0.75rem;">${escapeHtml(student.id.substring(0, 8))}â€¦</code></span>
                  </div>
                  <h2 style="font-size:1.35rem; font-weight:800; margin:0 0 2px; color:var(--clr-text-1);">${escapeHtml(displayName)}</h2>
                  <p class="text-xs text-muted" style="margin:0;">ðŸ‘¥ Batch: <strong>${escapeHtml(batchName)}</strong></p>
                </div>
              </div>

              <!-- Right: Detailed Enrollment & Academic Record Card -->
              <div class="glass-card p-5" style="border-radius:24px; display:flex; flex-direction:column; justify-content:space-between; box-sizing:border-box;">
                <div>
                  <div class="d-flex align-center justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <h3 style="font-size:1.15rem; font-weight:800; margin:0; color:var(--clr-text-1);">ðŸŽ“ Student Enrollment &amp; Demographics</h3>
                      <p class="text-xs text-muted" style="margin:2px 0 0;">Official class registration and student profile data</p>
                    </div>
                    <button class="btn btn-secondary btn-sm" id="btn-edit-current-student" style="display:inline-flex; align-items:center; gap:6px;">
                      âœï¸ Edit Student
                    </button>
                  </div>

                  <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:14px; margin-top:16px;">
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">ðŸ¢ Program</div>
                      <div class="fw-700 text-sm mt-1" style="color:var(--clr-text-1);">${escapeHtml(institutionName)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">ðŸ« Class</div>
                      <div class="fw-700 text-sm mt-1" style="color:var(--clr-text-1);">${escapeHtml(programName)}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">ðŸ‘¤ Gender</div>
                      <div class="fw-700 text-sm mt-1" style="text-transform:capitalize; color:var(--clr-text-1);">${escapeHtml(student.gender || 'â€”')}</div>
                    </div>
                    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--clr-border); border-radius:14px; padding:12px 14px;">
                      <div class="text-xs text-muted" style="font-weight:600; text-transform:uppercase;">ðŸŽ‚ Age / Birth Date</div>
                      <div class="fw-700 text-sm mt-1" style="color:var(--clr-text-1);">${ageDisplay} <span class="text-xs text-muted fw-400">(${escapeHtml(student.birth_date || 'â€”')})</span></div>
                    </div>
                  </div>
                </div>

                <div style="margin-top:16px; padding-top:12px; border-top:1px solid var(--clr-border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
                  <span class="text-xs text-muted">Created: ${student.created_at ? new Date(student.created_at).toLocaleDateString() : 'â€”'}</span>
                  <span class="badge badge-neutral" style="font-size:0.75rem;">Account Status: ${student.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>
            </div>

            <!-- Detailed Answer Stats: Exams, Correct, Incorrect -->
            <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:16px;">
              <div class="glass-card p-4 text-center">
                <div class="text-xs text-muted mb-1" style="font-weight:700; letter-spacing:0.05em;">EXAMS COMPLETED</div>
                <div class="fw-800" style="font-size:2rem; color:var(--clr-text-1);">${bestAttempts.length}</div>
                <div class="text-xs text-muted mt-1">${allAttempts.length} total attempt${allAttempts.length === 1 ? '' : 's'}</div>
              </div>
              <div class="glass-card p-4 text-center" style="border-top:3px solid #10b981;">
                <div class="text-xs text-muted mb-1" style="font-weight:700; letter-spacing:0.05em; color:#10b981;">âœ… CORRECT ANSWERS</div>
                <div class="fw-800" style="font-size:2rem; color:#10b981;">${totalCorrect}</div>
                <div class="text-xs text-muted mt-1">From best attempts</div>
              </div>
              <div class="glass-card p-4 text-center" style="border-top:3px solid #ef4444;">
                <div class="text-xs text-muted mb-1" style="font-weight:700; letter-spacing:0.05em; color:#ef4444;">âŒ INCORRECT ANSWERS</div>
                <div class="fw-800" style="font-size:2rem; color:#ef4444;">${totalIncorrect}</div>
                <div class="text-xs text-muted mt-1">${totalMinor > 0 ? `+ ${totalMinor} minor error${totalMinor === 1 ? '' : 's'}` : '0 minor errors'}</div>
              </div>
            </div>

            <!-- Detailed Exam Breakdown -->
            <div class="glass-card p-5">
              <div class="d-flex align-center justify-between mb-3 flex-wrap gap-2">
                <div>
                  <h3 style="font-size:1.15rem; font-weight:700; margin:0;">ðŸ“‹ Exam Performance &amp; Question History</h3>
                  <p class="text-xs text-muted">Click any exam row below to inspect question-level answers and correct vs. incorrect breakdown</p>
                </div>
                <span class="badge badge-neutral">${allAttempts.length} Attempt${allAttempts.length === 1 ? '' : 's'} Logged</span>
              </div>

              ${allAttempts.length === 0 ? `
                <div class="empty-state p-6 text-center">
                  <div style="font-size:2.5rem; margin-bottom:8px;">ðŸ“</div>
                  <h4 style="font-weight:700;">No Exams Taken Yet</h4>
                  <p class="text-xs text-muted">This student hasn't completed or submitted any exams yet.</p>
                </div>
              ` : `
                <div class="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Exam Title</th>
                        <th>Subject</th>
                        <th class="text-center">Score</th>
                        <th class="text-center">Grade</th>
                        <th class="text-center">âœ… Correct</th>
                        <th class="text-center">âš ï¸ Half</th>
                        <th class="text-center">âŒ Incorrect</th>
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
                        const examTitle = att.exams?.exam_title || 'Exam';
                        const subjectName = att.exams?.subjects?.name || 'â€”';
                        const submitDate = att.submitted_at ? new Date(att.submitted_at).toLocaleString() : 'â€”';
                        const rowId = `att-row-${att.id}`;
                        const detailId = `att-detail-${att.id}`;

                        return `
                          <tr id="${rowId}" class="clickable-attempt-row" data-att-id="${att.id}" style="cursor:pointer; transition:background 0.15s;">
                            <td class="fw-600">
                              <div class="d-flex align-center gap-2">
                                <span class="toggle-arrow" id="arrow-${att.id}" style="font-size:0.75rem; color:var(--clr-text-muted); transition:transform 0.2s;">â–¶</span>
                                <span>${escapeHtml(examTitle)}</span>
                                ${isBest ? `<span class="badge badge-success" style="font-size:0.65rem;" title="Highest score attempt for this exam">â­ Best</span>` : ''}
                              </div>
                            </td>
                            <td class="text-sm text-muted">${escapeHtml(subjectName)}</td>
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
                                <h4 class="text-sm fw-700 mb-3" style="color:var(--clr-text-1);">
                                  Questions &amp; Answers Breakdown (${answers.length} Questions)
                                </h4>

                                ${answers.length === 0 ? `
                                  <p class="text-xs text-muted">No individual question snapshot records stored for this attempt.</p>
                                ` : `
                                  <div style="display:flex; flex-direction:column; gap:10px;">
                                    ${[...answers].sort((a, b) => (a.question_order || 0) - (b.question_order || 0)).map((ans, qIdx) => {
                                      const evalRes = (ans.evaluation_result || 'Unknown').toLowerCase();
                                      const sc = parseFloat(ans.score || 0);
                                      let statusBadge = '<span class="badge badge-danger">âŒ Incorrect (0 pt)</span>';
                                      if (evalRes === 'correct' || sc >= 1) {
                                        statusBadge = '<span class="badge badge-success">âœ… Correct (+1 pt)</span>';
                                      } else if (evalRes.includes('minor') || (sc > 0 && sc < 1)) {
                                        statusBadge = '<span class="badge badge-warning">âš ï¸ Minor Error (+0.5 pt)</span>';
                                      }
                                      
                                      const qText = ans.question_snapshot || `Question #${qIdx + 1}`;
                                      const studentAns = ans.student_answer || '(No Answer)';
                                      const correctAns = ans.correct_answer_snapshot || 'â€”';

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
              if (arrow) arrow.textContent = isNowHidden ? 'â–¶' : 'â–¼';
            }
          });
        });

      } catch(err) {
        console.error('Failed to render student profile:', err);
        area.innerHTML = `
          <div class="empty-state p-6 text-center">
            <div style="font-size:2.5rem; margin-bottom:8px;">âš ï¸</div>
            <h4 class="text-danger">Failed to load student profile</h4>
            <p class="text-xs text-muted mb-4">${escapeHtml(err.message)}</p>
            <button class="btn btn-secondary btn-sm" id="btn-err-back">â† Back to Students</button>
          </div>
        `;
        document.getElementById('btn-err-back')?.addEventListener('click', () => loadSection('students'));
      }
    }

    // â”€â”€ EXAM MANAGEMENT HUB (Restored & Elevated) â”€â”€


// Global edit/delete handlers
window._editRecord = async (section, id, jsonStr) => {
  const record = JSON.parse(jsonStr);
  await openCrudModal(section, record);
};

let _deleteSection, _deleteId;
window._deleteRecord = (section, id, name) => {
  _deleteSection = section; _deleteId = id;
  document.getElementById('delete-modal-message').textContent = `Soft-delete "${name}"? Historical data is preserved.`;
  document.getElementById('delete-modal').classList.remove('hidden');
};

document.getElementById('delete-confirm-btn').addEventListener('click', async () => {
  try {
    await adminSoftDelete(_deleteSection, _deleteId);
    showToast('Record deleted.', 'success');
    document.getElementById('delete-modal').classList.add('hidden');
    loadSection(_currentSection);
  } catch(e) { showToast(e.message, 'error'); }
});

// Modal close handlers
['close-crud-modal','crud-cancel-btn'].forEach(id => document.getElementById(id)?.addEventListener('click', () => document.getElementById('crud-modal')?.classList.add('hidden')));
['delete-cancel-btn'].forEach(id => document.getElementById(id)?.addEventListener('click', () => document.getElementById('delete-modal')?.classList.add('hidden')));

window.openCrudModal = openCrudModal;
window.openDuplicateStudentsModal = openDuplicateStudentsModal;
window.openDuplicateQuestionsModal = openDuplicateQuestionsModal;
window.loadSection = loadSection;
window.openStudentProfile = openStudentProfile;

