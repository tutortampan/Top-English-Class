
    import {
      adminFetchAll, adminInsert, adminUpdate, adminSoftDelete, adminHardDelete,
      mergeDuplicateStudents, detectDuplicateStudents, mergeStudentPair,
      detectDuplicateQuestions, resequenceExamQuestions, resolveDuplicateQuestionGroup, batchResolveExamDuplicateQuestions,
      fetchInstitutions, fetchPrograms, fetchBatches, formatStudentName,
      testSupabaseConnection, previewRecalibrateExam, applyRecalibrateExam, isPassing, calculatePercentage,
      clearAdminCache
    } from '../api.js?v=1.4';
    import { parseExcelWorkbook, processStudentImportRows, processQuestionImportRows } from '../excel-parser.js?v=1.4';
    import { setAdminSession, getAdminSession, clearAdminSession } from '../session.js?v=1.4';
    import { showToast, showLoading, hideLoading, getGrade } from '../app.js?v=1.4';
    import { getSupabase } from '../supabase.js?v=1.4';
    import { openAssessmentBuilder } from './exam-builder.js?v=1.4';
    import { renderStudents as _renderStudentsModule } from './student-management.js?v=1.4';
    import { renderClasses as _renderClassesModule, renderBatches as _renderBatchesModule } from './program-management.js?v=1.4';
    import { renderTopics, renderWordTypes, renderCentralQuestionBank, renderAssignments, renderCentralQuestionImport } from './central-assessment.js?v=1.4';

    // â”€â”€ Primary Tab Switching Variables â”€â”€
    const mobileTabs = document.querySelectorAll('.mobile-tab');

    // ── ABCD Primary Architecture Section Titles ──
    const sectionTitles = {
      institutions: 'Institutions', programs: 'Programs', batches: 'Batches', students: 'Students Roster', 'import-students': 'Import Students', 'progress-view': 'Student Progress',
      subjects: 'Curriculum Subjects', levels: 'Levels', topics: 'Question Groups & Topics', questions: 'Central Question Bank', word_types: 'Word Types & Lexicon', 'import-questions': 'Import Questions', 'export-questions': 'Export Questions',
      exams: 'All Challenges', assignments: 'Assignments & Rosters', results: 'Challenge Results', recalibrator: 'Recalibration Engine',
      audit: 'Activity & Audit Logs', settings: 'System Settings'
    };

    // ABCD 4-Domain Mapping
    const sectionDomainMap = {
      institutions: 'ACADEMY', programs: 'ACADEMY', batches: 'ACADEMY', students: 'ACADEMY', 'import-students': 'ACADEMY', 'progress-view': 'ACADEMY',
      subjects: 'BLUEPRINT', levels: 'BLUEPRINT', topics: 'BLUEPRINT', questions: 'BLUEPRINT', word_types: 'BLUEPRINT', 'import-questions': 'BLUEPRINT', 'export-questions': 'BLUEPRINT',
      exams: 'CHALLENGES', assignments: 'CHALLENGES', results: 'CHALLENGES', recalibrator: 'CHALLENGES',
      audit: 'DESK', settings: 'DESK'
    };

    // Mobile Bottom Tab Panels -> Primary Domain
    const domainToPanelMap = {
      ACADEMY: 'academy', BLUEPRINT: 'blueprint', CHALLENGES: 'challenges', DESK: 'desk',
      DATABASE: 'blueprint', CLASS: 'academy', STUDENT: 'academy', EXAM: 'challenges'
    };

    const tabDefaultSections = {
      academy: 'institutions',
      blueprint: 'subjects',
      challenges: 'exams',
      desk: 'audit',
      database: 'subjects', class: 'programs', student: 'students', exam: 'exams'
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
      'blueprint-wordtypes': 'word_types',
      'blueprint-import': 'import-questions',
      'blueprint-export': 'export-questions',
      'challenges-hub': 'exams',
      'challenges-assignments': 'assignments',
      'challenges-results': 'results',
      'challenges-recalibrator': 'recalibrator',
      'desk-audit': 'audit',
      'desk-settings': 'settings'
    };

    async function updateAdminKpiBanner() {
      try {
        const [stds, qList, asms, atts] = await Promise.all([
          adminFetchAll('students'),
          adminFetchAll('questions'),
          adminFetchAll('exams'),
          adminFetchAll('attempts')
        ]);
        const kpiAcad = document.getElementById('kpi-academy');
        if (kpiAcad) kpiAcad.textContent = stds.filter(s => !s.deleted_at).length;
        const kpiQ = document.getElementById('kpi-qbank');
        if (kpiQ) kpiQ.textContent = qList.filter(q => !q.deleted_at).length;
        const kpiAsm = document.getElementById('kpi-assessments');
        if (kpiAsm) kpiAsm.textContent = asms.filter(a => !a.deleted_at && a.exam_status === 'published').length;
        const kpiAtt = document.getElementById('kpi-attempts');
        if (kpiAtt) kpiAtt.textContent = atts.length;
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
        showToast('Invalid admin credentials. Use admin / admin123', 'error');
      } catch(e) {
        hideLoading();
        if (user.toLowerCase() === 'admin' && pass === 'admin123') {
          setAdminSession({ admin_id: 'admin-master', username: 'admin' });
          showToast('Welcome, Administrator!', 'success');
          showConsole();
        } else {
          showToast(e.message || 'Authentication failed. Use admin / admin123', 'error');
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
        activatePrimaryTab('academy');
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
          academy: 'ACADEMY',
          blueprint: 'BLUEPRINT',
          challenges: 'CHALLENGES',
          desk: 'DESK'
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

      // Show checking state
      statusDot.style.background = '#facc15';
      statusText.textContent = 'Checking database connectionâ€¦';

      const result = await testSupabaseConnection();
      if (result.connected) {
        statusDot.style.background = '#34d399';
        statusDot.style.boxShadow = '0 0 6px #34d399';
        statusText.innerHTML = `<strong>Connected to Supabase</strong> â€” data is saved permanently to the cloud`;
        banner.style.borderColor = 'rgba(52,211,153,0.3)';
        banner.style.background = 'rgba(52,211,153,0.07)';
        setTimeout(() => banner.style.display = 'none', 4000); // Auto-hide when connected
      } else {
        statusDot.style.background = '#f87171';
        statusDot.style.boxShadow = '0 0 8px #f87171';
        statusDot.style.animation = 'pulse 1.5s infinite';
        if (result.mode === 'demo') {
          statusText.innerHTML = `<strong>Demo / Offline Mode</strong> â€” data is in-memory only and will be lost on page reload`;
        } else {
          statusText.innerHTML = `<strong>Database Error</strong> â€” ${result.error}. <a href="docs/DATABASE.md" target="_blank" style="color:#f87171;">Check setup guide</a>`;
        }
      banner.style.borderColor = 'rgba(248,113,113,0.4)';
        banner.style.background = 'rgba(248,113,113,0.08)';
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
      const domain = sectionDomainMap[section] || 'BLUEPRINT';
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
      area.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading…</p></div>';

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
          case 'levels':              await renderLevels(area); break;
          case 'topics':              await renderTopics(area); break;
          case 'word_types':          await renderWordTypes(area); break;
          case 'programs':            await _renderClassesModule(area); break;
          case 'batches':             await _renderBatchesModule(area); break;
          case 'students':            await _renderStudentsModule(area); break;
          case 'exams':               await renderExams(area); break;
          case 'questions':           await renderCentralQuestionBank(area); break;
          case 'assignments':         await renderAssignments(area); break;
          case 'results':             await renderResults(area); break;
          case 'progress-view':       await renderProgressView(area); break;
          case 'audit':               await renderAuditLog(area); break;
          case 'settings':            await renderSettings(area); break;
          case 'import-students':     await renderImportStudents(area); break;
          case 'import-questions':    await renderCentralQuestionImport(area); break;
          case 'export-questions':    renderExportQuestions(area); break;
          case 'recalibrator':        await renderRecalibrator(area); break;
          default: area.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🚧</div><h3>${sectionTitles[section] || section}</h3><p>This section is under development.</p></div>`;
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
              <button class="btn btn-outline btn-sm" data-nav-progs="${r.id}" title="View Programs in ${escapeHtml(r.name)}">Programs →</button>
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

    // â”€â”€ SUBJECTS â”€â”€
    async function renderSubjects(area) {
      const [rawData, institutions] = await Promise.all([adminFetchAll('subjects', '*, institutions(name)'), adminFetchAll('institutions')]);
      // Sort by Institution Name (A-Z), then Subject Name (A-Z)
      const data = [...rawData].sort((a, b) => {
        const pA = a.institutions?.name || '';
        const pB = b.institutions?.name || '';
        return pA.localeCompare(pB) || (a.name || '').localeCompare(b.name || '');
      });

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Subjects <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage subjects grouped by program in alphabetical order</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Program</th>
                <th class="text-left">Subject Name</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-subjects"></tbody>
          </table>
        </div>
      `;
      const tbody = document.getElementById('tbl-subjects');
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No subjects yet.</td></tr>'; return; }
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
              <button class="btn btn-outline btn-sm" data-nav-topics="${r.id}" title="View Topics in ${escapeHtml(r.name)}">Topics →</button>
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
          if (rec) window._deleteRecord('subjects', sid, rec.name || 'Subject');
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
                <th class="text-left">Subject</th>
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
    async function renderExams(area) {
      const [rawData, allQuestions, allClasses] = await Promise.all([
        adminFetchAll('exams', '*, subjects(name), levels(name, level_number), institutions(name)'),
        adminFetchAll('questions', 'id, exam_id'),
        adminFetchAll('programs', 'id, name')
      ]);

      const classMap = {};
      allClasses.forEach(c => { classMap[c.id] = c; });
      const examMap = {};
      rawData.forEach(e => { examMap[e.id] = e; });

      // Enforce strict alphabetical ordering by exam title (A to Z)
      const data = [...rawData].sort((a, b) => (a.exam_title || '').localeCompare(b.exam_title || ''));

      // Calculate KPI metrics
      const totalExams = data.length;
      const publishedCount = data.filter(e => e.exam_status === 'published').length;
      const draftCount = data.filter(e => e.exam_status === 'draft').length;
      const totalQuestions = allQuestions.length;

      area.innerHTML = `
        <!-- Exam Management Overview Hero -->
        <div class="exam-hero">
          <div class="d-flex align-center justify-between flex-wrap gap-4">
            <div>
              <h2 class="section-title text-gradient" style="font-size:1.75rem;">Challenges Hub (C — CHALLENGES)</h2>
              <p class="section-subtitle">Assessment execution: configure challenges, assign cohorts, schedule time windows, inspect results & recalibrate</p>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-primary btn-sm" id="hub-add-exam">+ Create Challenge</button>
              <button class="btn btn-secondary btn-sm" id="hub-btn-assignments">👥 Assignments & Rosters</button>
              <button class="btn btn-secondary btn-sm" id="hub-btn-results">🏆 Results</button>
              <button class="btn btn-secondary btn-sm" id="hub-btn-recalibrate">⚖️ Recalibrate</button>
              <button class="btn btn-warning btn-sm" id="hub-resolve-q" style="font-weight:700;">⚡ Resolve Duplicates</button>
            </div>
          </div>

          <!-- KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-icon">ðŸ“</div>
              <div>
                <div class="kpi-val">${totalExams}</div>
                <div class="kpi-lbl">Total Exams</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon" style="color:var(--clr-success,#4ade80);">âœ“</div>
              <div>
                <div class="kpi-val" style="color:var(--clr-success,#4ade80);">${publishedCount}</div>
                <div class="kpi-lbl">Published Exams</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon" style="color:var(--clr-warning,#fbbf24);">â³</div>
              <div>
                <div class="kpi-val" style="color:var(--clr-warning,#fbbf24);">${draftCount}</div>
                <div class="kpi-lbl">Draft / Inactive</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon" style="color:var(--clr-accent-1);">â“</div>
              <div>
                <div class="kpi-val">${totalQuestions}</div>
                <div class="kpi-lbl">Questions in Bank</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Filter & Search Toolbar -->
        <div class="d-flex align-center justify-between flex-wrap gap-3 mb-4">
          <div class="pill-filter-bar" id="exam-status-pills">
            <button class="pill-filter-btn active" data-status="all">All Exams (${totalExams})</button>
            <button class="pill-filter-btn" data-status="published">Published (${publishedCount})</button>
            <button class="pill-filter-btn" data-status="draft">Draft (${draftCount})</button>
            <button class="pill-filter-btn" data-status="unpublished">Unpublished</button>
            <button class="pill-filter-btn" data-status="archived">Archived</button>
          </div>
          <div class="search-bar" style="max-width:320px;">
            <span class="search-icon">ðŸ”</span>
            <input type="text" id="exam-search-input" placeholder="Search exams by title, subjectâ€¦" />
          </div>
        </div>

        <!-- Exams Table -->
        <div class="table-wrap table-compact">
          <table style="width: 100%; min-width: 850px;">
            <thead>
              <tr>
                <th class="text-left" style="width: 35%;">EXAM DETAILS</th>
                <th class="text-left" style="width: 25%;">CONFIGURATION</th>
                <th class="text-center" style="width: 10%;">CONTENT</th>
                <th class="text-center" style="width: 12%;">STATUS</th>
                <th class="text-right" style="width: 18%;">ACTIONS</th>
              </tr>
            </thead>
            <tbody id="tbl-exams"></tbody>
          </table>
        </div>
      `;

      // Wire Quick Action buttons
      document.getElementById('hub-add-exam')?.addEventListener('click', () => openAssessmentBuilder(null));
      document.getElementById('hub-btn-assignments')?.addEventListener('click', () => loadSection('assignments'));
      document.getElementById('hub-btn-results')?.addEventListener('click', () => loadSection('results'));
      document.getElementById('hub-btn-recalibrate')?.addEventListener('click', () => loadSection('recalibrator'));
      document.getElementById('hub-resolve-q')?.addEventListener('click', () => openDuplicateQuestionsModal());

      const tbody = document.getElementById('tbl-exams');
      window._examRecords = {};
      data.forEach(r => { window._examRecords[r.id] = r; });

      let currentStatusFilter = 'all';
      let currentQuery = '';

      const renderExamRows = () => {
        tbody.innerHTML = '';
        const filtered = data.filter(r => {
          const matchStatus = currentStatusFilter === 'all' || r.exam_status === currentStatusFilter;
          const matchQuery = !currentQuery ||
            (r.exam_title || '').toLowerCase().includes(currentQuery) ||
            (r.institutions?.name || '').toLowerCase().includes(currentQuery) ||
            (r.subjects?.name || '').toLowerCase().includes(currentQuery) ||
            (r.program_id && classMap[r.program_id]?.name || '').toLowerCase().includes(currentQuery) ||
            (r.levels?.name || '').toLowerCase().includes(currentQuery) ||
            `level ${toLevelLetter(r.levels?.level_number || 1)}`.toLowerCase().includes(currentQuery) ||
            `order ${r.exam_order || '1'}`.toLowerCase().includes(currentQuery) ||
            (r.exam_type || '').toLowerCase().includes(currentQuery) ||
            formatAnswerType(r.answer_type).toLowerCase().includes(currentQuery) ||
            (r.exam_status || '').toLowerCase().includes(currentQuery) ||
            (r.question_order || '').toLowerCase().includes(currentQuery);
          return matchStatus && matchQuery;
        });

        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted p-5">No exams match the selected filter.</td></tr>';
          return;
        }

        const statusColors = { published: 'badge-success', draft: 'badge-neutral', unpublished: 'badge-warning', archived: 'badge-danger' };

        filtered.forEach(r => {
          const qCount = allQuestions.filter(q => q.exam_id === r.id).length;
          const programName = r.program_id && classMap[r.program_id]?.name ? classMap[r.program_id].name : 'All Programs';
          const prereqExam = r.prerequisite_exam_id && examMap[r.prerequisite_exam_id];
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <div class="fw-800" style="color:var(--clr-text-1); font-size:1rem; letter-spacing: 0.02em;">${escapeHtml(r.exam_title)}</div>
              <div class="text-muted text-xs mt-1 fw-600 d-flex gap-2 flex-wrap align-center">
                <span><span class="text-accent">CLASS:</span> ${escapeHtml(programName)}</span>
                <span>â€¢</span>
                <span><span class="text-accent">SUBJ:</span> ${escapeHtml(r.subjects?.name || 'â€”')}</span>
                <span>â€¢</span>
                <span><span class="badge badge-primary" style="font-size:0.6rem; padding: 2px 6px;">LVL ${toLevelLetter(r.levels?.level_number || 1)}</span></span>
                <span><span class="badge badge-neutral" style="font-size:0.6rem; padding: 2px 6px;">ORD ${escapeHtml(r.exam_order || '1')}</span></span>
              </div>
              ${prereqExam ? `<div class="mt-2"><span class="badge badge-warning text-xs">ðŸ”’ Prereq: ${escapeHtml(prereqExam.exam_title)}</span></div>` : ''}
            </td>
            <td>
              <div class="d-flex flex-wrap gap-1">
                <span class="badge badge-info text-xs" title="Answer Type">${formatAnswerType(r.answer_type)}</span>
                <span class="badge ${r.question_order === 'random' ? 'badge-primary' : 'badge-neutral'} text-xs" title="Question Delivery">${r.question_order === 'random' ? 'ðŸ”€ Random' : 'ðŸ”¢ Seq'}</span>
                <span class="badge badge-neutral text-xs" title="Exam Category">${escapeHtml(r.exam_type || 'Daily')}</span>
              </div>
              <div class="text-muted text-xs mt-2 fw-600">
                â± ${r.time_limit_minutes || 60} min &nbsp; | &nbsp; ðŸŽ¯ Pass: ${r.minimum_required_score || 60}%
              </div>
            </td>
            <td class="text-center">
              <span class="badge ${qCount > 0 ? 'badge-info' : 'badge-danger'} fw-700" style="font-size: 0.8rem;">${qCount} Qs</span>
            </td>
            <td class="text-center">
              <span class="badge ${statusColors[r.exam_status] || 'badge-neutral'} fw-700" style="text-transform: uppercase; letter-spacing: 1px;">${r.exam_status}</span>
            </td>
            <td class="text-right">
              <div class="d-flex gap-1 justify-end flex-wrap">
                <button class="btn btn-outline btn-sm" onclick="window._filterExamResults='${r.id}'; window.loadSection('results');" title="View Results for this Challenge">Results →</button>
                <button class="btn btn-outline btn-sm" onclick="window._filterRecalibrateExam='${r.id}'; window.loadSection('recalibrator');" title="Recalibrate this Challenge">Recalibrate ⚖️</button>
                <button class="btn btn-secondary btn-sm" onclick="window._duplicateExam('${r.id}')" title="Duplicate Exam">Copy</button>
                <button class="btn ${r.exam_status === 'published' ? 'btn-danger' : 'btn-success'} btn-sm" onclick="window._publishExam('${r.id}', '${r.exam_status}')">
                  ${r.exam_status === 'published' ? 'Unpublish' : 'Publish'}
                </button>
                <button class="btn btn-secondary btn-sm" data-edit-exam="${r.id}">Edit</button>
                <button class="btn btn-secondary btn-sm" style="color: var(--clr-accent-1);" data-del-exam="${r.id}">Del</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });

        tbody.querySelectorAll('[data-edit-exam]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const eid = btn.getAttribute('data-edit-exam');
            const rec = window._examRecords[eid];
            if (rec) await openAssessmentBuilder(rec.id);
          });
        });
        tbody.querySelectorAll('[data-del-exam]').forEach(btn => {
          btn.addEventListener('click', () => {
            const eid = btn.getAttribute('data-del-exam');
            const rec = window._examRecords[eid];
            if (rec) window._deleteRecord('exams', eid, rec.exam_title || 'Exam');
          });
        });
      };

      renderExamRows();

      // Filter pills listener
      document.querySelectorAll('#exam-status-pills .pill-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('#exam-status-pills .pill-filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          currentStatusFilter = btn.dataset.status;
          renderExamRows();
        });
      });

      // Search input listener
      document.getElementById('exam-search-input')?.addEventListener('input', (e) => {
        currentQuery = e.target.value.toLowerCase().trim();
        renderExamRows();
      });
    }

    // Publish/Unpublish helper
    window._publishExam = async (examId, currentStatus) => {
      const newStatus = currentStatus === 'published' ? 'unpublished' : 'published';
      try {
        await adminUpdate('exams', examId, { exam_status: newStatus });
        showToast(`Exam ${newStatus}.`, 'success');
        loadSection('exams');
      } catch(e) { showToast(e.message, 'error'); }
    };

    // Duplicate Exam helper
    window._duplicateExam = async (examId) => {
      const rec = window._examRecords[examId];
      if (!rec) return;
      if (!confirm(`Are you sure you want to duplicate "${rec.exam_title}"?`)) return;
      
      showLoading('Duplicating exam and questions...');
      try {
        const { getSupabase } = await import('./js/supabase.js');
        const sb = getSupabase();
        
        // 1. Fetch original questions
        const { data: questions, error: qErr } = await sb.from('questions').select('*').eq('exam_id', examId);
        if (qErr) throw new Error(qErr.message);

        // 2. Duplicate Exam
        const newExam = { ...rec };
        delete newExam.id;
        delete newExam.created_at;
        delete newExam.updated_at;
        delete newExam.deleted_at;
        delete newExam.subjects;
        delete newExam.levels;
        delete newExam.institutions;
        newExam.exam_title = `${newExam.exam_title} (Copy)`;
        newExam.exam_status = 'draft'; // Prevent accidental publishing of duplicate

        const { data: createdExam, error: eErr } = await sb.from('exams').insert([newExam]).select().single();
        if (eErr) throw new Error(eErr.message);

        // 3. Duplicate Questions
        if (questions && questions.length > 0) {
          const newQuestions = questions.map(q => {
            const newQ = { ...q, exam_id: createdExam.id };
            delete newQ.id;
            delete newQ.created_at;
            delete newQ.updated_at;
            delete newQ.deleted_at;
            return newQ;
          });
          const { error: qInsertErr } = await sb.from('questions').insert(newQuestions);
          if (qInsertErr) throw new Error(qInsertErr.message);
        }

        // 4. Duplicate Class Assignments
        const { data: assignments } = await sb.from('exam_programs').select('program_id').eq('exam_id', examId);
        if (assignments && assignments.length > 0) {
           const newAssignments = assignments.map(a => ({ exam_id: createdExam.id, program_id: a.program_id }));
           const { error: assignErr } = await sb.from('exam_programs').insert(newAssignments);
           if (assignErr) throw new Error(assignErr.message);
        }

        showToast('Exam duplicated successfully!', 'success');
        loadSection('exams');
      } catch (e) {
        console.error(e);
        showToast('Error duplicating exam: ' + e.message, 'error');
      } finally {
        hideLoading();
      }
    };

    // â”€â”€ QUESTIONS â”€â”€
    async function renderQuestions(area) {
      const [questions, exams] = await Promise.all([
        adminFetchAll('questions', '*, exam_sections(title, exams(id, exam_title, exam_type, institutions(name), subjects(name), levels(name, level_number)))'),
        adminFetchAll('exams', 'id, exam_title, exam_type, institutions(name), subjects(name), levels(name, level_number)')
      ]);

      // Strict alphabetical sorting on exams list
      const sortedExams = [...exams].sort((a, b) => (a.exam_title || '').localeCompare(b.exam_title || ''));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Questions <span class="count-chip">${questions.length} Total</span></h2>
            <p class="section-subtitle">Question item bank for examinations</p>
          </div>
        </div>
        <div class="filter-bar mb-4 d-flex gap-3 align-center flex-wrap">
          <div style="min-width: 320px;">
            <select id="question-exam-filter" class="form-control">
              <option value="">-- Filter by Exam (All Exams) --</option>
              ${sortedExams.map(e => `<option value="${e.id}">${escapeHtml(formatExamDisplayName(e))}</option>`).join('')}
            </select>
          </div>
          <div class="search-bar" style="max-width:320px;">
            <span class="search-icon">ðŸ”</span>
            <input type="text" id="question-search-filter" placeholder="Search question textâ€¦" />
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-center" style="width:60px;">No</th>
                <th class="text-left">Question Text</th>
                <th class="text-left">Correct Answer</th>
                <th class="text-center">Answer Type</th>
                <th class="text-left">Exam Title</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-questions"></tbody>
          </table>
        </div>
      `;

      const tbody = document.getElementById('tbl-questions');
      const examSelect = document.getElementById('question-exam-filter');
      const searchInput = document.getElementById('question-search-filter');

      window._qRecords = {};
      questions.forEach(q => { window._qRecords[q.id] = q; });

      const renderList = () => {
        const selectedExamId = examSelect.value;
        const query = searchInput.value.toLowerCase().trim();

        const filtered = questions.filter(q => {
          const matchExam = !selectedExamId || (q.exam_sections && q.exam_sections.exams && q.exam_sections.exams.id === selectedExamId);
          const matchSearch = !query || (q.question_text || '').toLowerCase().includes(query) || (q.correct_answer || '').toLowerCase().includes(query);
          return matchExam && matchSearch;
        });

        // Sort by question order
        filtered.sort((a, b) => (a.question_order || 0) - (b.question_order || 0));

        tbody.innerHTML = '';
        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">No questions found for this filter.</td></tr>';
          return;
        }

        filtered.forEach(q => {
          const tr = document.createElement('tr');
          const answerDisplay = (q.correct_answer || 'â€”').slice(0, 40) + ((q.correct_answer?.length > 40) ? 'â€¦' : '');
          const examDisplay = (q.exam_sections && q.exam_sections.exams) ? formatExamDisplayName(q.exam_sections.exams) + ` (Sec: ${q.exam_sections.title})` : 'â€”';
          tr.innerHTML = `
            <td class="text-center text-muted fw-700">${q.question_order}</td>
            <td class="fw-600">${escapeHtml(q.question_text?.slice(0,70))}${q.question_text?.length > 70 ? 'â€¦' : ''}</td>
            <td class="text-sm" style="color:var(--clr-success,#4ade80);font-family:monospace;">${escapeHtml(answerDisplay)}</td>
            <td class="text-center"><span class="badge badge-info">${formatAnswerType(q.answer_type)}</span></td>
            <td class="text-muted text-sm">${escapeHtml(examDisplay)}</td>
            <td class="text-right">
              <div class="d-flex gap-2 justify-end">
                <button class="btn btn-secondary btn-sm" data-edit-q="${q.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-del-q="${q.id}">Delete</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });

        tbody.querySelectorAll('[data-edit-q]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const qid = btn.getAttribute('data-edit-q');
            const rec = window._qRecords[qid];
            if (rec) await openCrudModal('questions', rec);
          });
        });

        tbody.querySelectorAll('[data-del-q]').forEach(btn => {
          btn.addEventListener('click', () => {
            const qid = btn.getAttribute('data-del-q');
            const rec = window._qRecords[qid];
            if (rec) window._deleteRecord('questions', qid, `Question #${rec.question_order}`);
          });
        });
      };

      renderList();
      examSelect.addEventListener('change', renderList);
      searchInput.addEventListener('input', renderList);
    }

    // â”€â”€ RESULTS (Student Submissions with Batch Grouping) â”€â”€
    async function renderResults(area) {
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

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Results <span class="count-chip" id="res-count-chip">${allData.length} Total</span></h2>
            <p class="section-subtitle">Student exam attempt submissions grouped and filterable by Program, Class, and Batch</p>
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
    async function renderProgressView(area) {
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

          countChip.textContent = \`\${filtered.length} of \${allData.length}\`;

          if (!filtered.length) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-5">No progression records match the selected filters.</td></tr>';
            return;
          }

          tbody.innerHTML = filtered.map(r => \`
            <tr>
              <td class="fw-600" style="color:var(--clr-text-1);">\${formatStudentName(r.student?.name, r.student?.gender) || 'â€”'}</td>
              <td class="text-muted text-sm">\${escapeHtml(r.student?.programs?.institutions?.name || 'â€”')}</td>
              <td class="text-muted text-sm">\${escapeHtml(r.student?.programs?.name || 'â€”')}</td>
              <td><span class="badge \${r.student?.batches?.name ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">\${escapeHtml(r.student?.batches?.name || 'Unassigned')}</span></td>
              <td class="fw-600 text-sm">\${escapeHtml(r.assessmentTitle || 'â€”')}</td>
              <td class="text-center"><span class="badge badge-primary">Level \${toLevelLetter(r.levelNumber)} \${escapeHtml(r.levelName || '')}</span></td>
              <td class="text-center">
                <span class="badge \${r.is_completed ? 'badge-success' : r.is_in_progress ? 'badge-warning' : 'badge-neutral'}">
                  \${r.is_completed ? 'âœ“ Completed' : r.is_in_progress ? 'â–¶ In Progress' : 'ðŸ”’ Not Started'}
                </span>
              </td>
              <td class="text-center">
                <div class="progress-pill">
                  <div class="progress-pill-fill" style="width:\${r.is_completed ? 100 : r.is_in_progress ? 50 : 0}%;"></div>
                </div>
              </td>
            </tr>
          \`).join('');
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
        area.innerHTML = \`<div class="p-5 text-center text-error">Failed to load progression data: \${err.message}</div>\`;
      }
    }
    // â”€â”€ AUDIT LOG â”€â”€
    async function renderAuditLog(area) {
      const data = await adminFetchAll('audit_logs');
      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Audit Log <span class="count-chip">${data.length} Events</span></h2>
            <p class="section-subtitle">Security and administrative actions trail</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Timestamp</th>
                <th class="text-center">Actor Role</th>
                <th class="text-left">Action</th>
                <th class="text-left">Entity Type</th>
                <th class="text-center">IP Address</th>
              </tr>
            </thead>
            <tbody>
              ${(data || []).map(r => `
                <tr>
                  <td class="text-sm text-muted">${new Date(r.created_at).toLocaleString()}</td>
                  <td class="text-center"><span class="badge badge-info">${r.actor_role || 'ADMIN'}</span></td>
                  <td class="fw-600 text-sm">${r.action}</td>
                  <td class="text-muted text-sm">${r.entity_type || 'â€”'}</td>
                  <td class="text-center text-muted text-sm">${r.ip_address || 'â€”'}</td>
                </tr>
              `).join('')}
              ${!(data?.length) ? '<tr><td colspan="5" class="text-center text-muted p-4">No audit events yet.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      `;
    }


    // ── SETTINGS & SYSTEM TOOLS (D — DESK) ──
    async function renderSettings(area) {
      const sb = await getSupabase();
      const { data } = await sb.from('site_settings').select('*');
      const settings = Object.fromEntries((data || []).map(r => [r.key, r.value]));
      const currentCustomPass = localStorage.getItem('tec_admin_custom_password') || '';

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title text-gradient">System Settings & Administration (D — DESK)</h2>
            <p class="section-subtitle">Platform configuration, security credentials, system tools & diagnostic telemetry</p>
          </div>
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:1.5rem;align-items:start;">
          <!-- 1. Site Configuration Card -->
          <div class="glass-card p-6">
            <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">🌐 Global Platform Configuration</h3>
            <div class="form-group">
              <label class="form-label">Site Name</label>
              <input class="form-control" id="setting-site_name" value="${escapeHtml(settings.site_name || 'TOP ENGLISH CLASS')}" />
            </div>
            <div class="form-group">
              <label class="form-label">Passing Threshold (%)</label>
              <input class="form-control" type="number" id="setting-passing_threshold" value="${escapeHtml(settings.passing_threshold || '60')}" min="0" max="100" />
            </div>
            <div class="form-group">
              <label class="form-label">Login Background URL (optional)</label>
              <input class="form-control" id="setting-login_background_url" value="${escapeHtml(settings.login_background_url || '')}" placeholder="https://…" />
            </div>
            <button class="btn btn-primary btn-sm" id="save-settings-btn">Save Configuration</button>
          </div>

          <!-- 2. Security & Credentials Card -->
          <div class="glass-card p-6">
            <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">🔒 Security & Administrator Access</h3>
            <p class="text-xs text-muted mb-3">Configure local administrator credentials or manage system authentication overrides.</p>
            <div class="form-group">
              <label class="form-label">Master Admin Username</label>
              <input class="form-control" value="admin" disabled style="opacity:0.7;" />
            </div>
            <div class="form-group">
              <label class="form-label">Custom Admin Password Override</label>
              <input class="form-control" type="password" id="setting-custom-password" placeholder="Leave empty to use default (admin123)" value="${escapeHtml(currentCustomPass)}" />
              <div class="text-xs text-muted mt-1">Leave blank to use default 'admin123' master key.</div>
            </div>
            <button class="btn btn-secondary btn-sm" id="btn-save-admin-password">Update Admin Password</button>
          </div>

          <!-- 3. System Tools & Diagnostics Card -->
          <div class="glass-card p-6" style="grid-column:1/-1;">
            <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">🛠️ System Tools & Diagnostics</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:1rem;">
              <div style="background:var(--clr-surface-2);padding:1rem;border-radius:8px;border:1px solid var(--clr-border);">
                <div class="fw-600 text-sm mb-1">Database Connectivity & Latency</div>
                <div class="text-xs text-muted mb-3" id="diag-db-status">Testing cloud database connection...</div>
                <button class="btn btn-secondary btn-xs" id="btn-diag-test-conn">⚡ Test Latency</button>
              </div>

              <div style="background:var(--clr-surface-2);padding:1rem;border-radius:8px;border:1px solid var(--clr-border);">
                <div class="fw-600 text-sm mb-1">Local Browser Cache</div>
                <div class="text-xs text-muted mb-3">Clear client-side cached queries, rosters, and question indexes.</div>
                <button class="btn btn-secondary btn-xs" id="btn-diag-clear-cache">🗑️ Flush Cache</button>
              </div>

              <div style="background:var(--clr-surface-2);padding:1rem;border-radius:8px;border:1px solid var(--clr-border);">
                <div class="fw-600 text-sm mb-1">Activity & Audit Logs</div>
                <div class="text-xs text-muted mb-3">Inspect system changes, logins, exams published, and student updates.</div>
                <button class="btn btn-outline btn-xs" id="btn-diag-view-audit">📜 View Audit Log →</button>
              </div>
            </div>
          </div>
        </div>
      `;

      // Handlers
      document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const pairs = [
          ['site_name', document.getElementById('setting-site_name').value],
          ['passing_threshold', document.getElementById('setting-passing_threshold').value],
          ['login_background_url', document.getElementById('setting-login_background_url').value],
        ];
        for (const [key, value] of pairs) {
          await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        }
        showToast('Settings saved successfully.', 'success');
      });

      document.getElementById('btn-save-admin-password').addEventListener('click', () => {
        const customPass = document.getElementById('setting-custom-password').value.trim();
        if (customPass) {
          localStorage.setItem('tec_admin_custom_password', customPass);
          showToast('Custom admin password saved. You can log in with your new password.', 'success');
        } else {
          localStorage.removeItem('tec_admin_custom_password');
          showToast('Custom password cleared. Default password (admin123) restored.', 'info');
        }
      });

      const dbStatusEl = document.getElementById('diag-db-status');
      const runConnTest = async () => {
        if (!dbStatusEl) return;
        dbStatusEl.textContent = 'Measuring latency...';
        const start = performance.now();
        const res = await testSupabaseConnection();
        const latency = Math.round(performance.now() - start);
        if (res.connected) {
          dbStatusEl.innerHTML = `<span class="text-success">Connected to Cloud DB</span> (${latency}ms roundtrip)`;
        } else {
          dbStatusEl.innerHTML = `<span class="text-danger">Offline / Error</span>: ${res.error || 'Check network'}`;
        }
      };
      runConnTest();
      document.getElementById('btn-diag-test-conn')?.addEventListener('click', runConnTest);

      document.getElementById('btn-diag-clear-cache')?.addEventListener('click', () => {
        if (typeof clearAdminCache === 'function') clearAdminCache();
        showToast('Local admin cache cleared.', 'success');
      });

      document.getElementById('btn-diag-view-audit')?.addEventListener('click', () => {
        loadSection('audit');
      });
    }

    // â”€â”€ EXAM RECALIBRATOR (Phases 15, 16, 17) â”€â”€
    async function renderRecalibrator(area) {
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
    async function renderImportStudents(area) {
      showLoading('Loading institutions & programsâ€¦');
      const [allProgs, allCls, allBatches, allLevels] = await Promise.all([
        adminFetchAll('institutions'),
        adminFetchAll('programs', '*, institutions(name)'),
        adminFetchAll('batches'),
        adminFetchAll('levels')
      ]);
      hideLoading();

      const sortedPrograms = allProgs.filter(p => !p.deleted_at && p.is_active).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedClasses = allCls.filter(c => !c.deleted_at && c.is_active).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedBatches = allBatches.filter(b => !b.deleted_at && b.is_active).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedLevels = allLevels.filter(l => !l.deleted_at && l.is_active).sort((a, b) => (a.level_number || 0) - (b.level_number || 0));

      area.innerHTML = `
        <div style="height: calc(100vh - 80px); display: flex; flex-direction: column; overflow: hidden; margin: -40px; padding: 40px;">
          <div class="section-header" style="flex-shrink: 0;">
            <div>
              <h2 class="section-title text-gradient" style="font-size:1.6rem;">Import Students (Excel / CSV)</h2>
              <p class="section-subtitle">Upload student data in bulk using an Excel spreadsheet (.xlsx / .xls) or CSV file. PINs will be automatically hashed (SHA-256) for security.</p>
            </div>
            <div class="d-flex gap-2">
              <button class="btn btn-secondary btn-sm" id="btn-back-to-students">Back to Students</button>
              <button class="btn btn-primary btn-sm" id="btn-dl-student-template">ðŸ“¥ Download Student Template (.xlsx)</button>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-6 align-stretch" style="flex: 1; overflow: hidden;">
            
            <!-- IMPORT BOX (Left side / Top on mobile) -->
            <div class="glass-card p-6" style="flex: 1; min-width: 300px; max-width: calc(50% - 12px); height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
              <div class="d-flex flex-column gap-4 mb-4">
                <div class="form-group w-100">
                  <label class="form-label">1. Target Program (Default / Override)</label>
                  <select class="form-control" id="import-student-program">
                    <option value="">- Use Program from Excel File -</option>
                    ${sortedPrograms.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Program.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">2. Target Class (Default / Override)</label>
                  <select class="form-control" id="import-student-class">
                    <option value="">- Use Class from Excel File -</option>
                    ${sortedClasses.map(c => `<option value="${c.id}" data-prog="${c.institution_id}">[${escapeHtml(c.institutions?.name || 'Program')}] ${escapeHtml(c.name)}</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Class.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">3. Target Batch (Default / Override)</label>
                  <select class="form-control" id="import-student-batch" disabled>
                    <option value="">- Select Program First -</option>
                  </select>
                  <span class="text-muted text-xs mt-1">Select to assign all students in the file to this Batch.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">4. Target Level (Optional / Override)</label>
                  <select class="form-control" id="import-student-level">
                    <option value="">- Use Level from Excel File / None -</option>
                    ${sortedLevels.map(l => `<option value="${l.id}">Level ${toLevelLetter(l.level_number)} (${escapeHtml(l.name)})</option>`).join('')}
                  </select>
                  <span class="text-muted text-xs mt-1">Optional. Level is managed manually.</span>
                </div>

                <div class="form-group w-100">
                  <label class="form-label">5. Select Spreadsheet File (.xlsx / .xls / .csv)</label>
                  <input type="file" class="form-control" id="import-students-file" accept=".xlsx,.xls,.csv" />
                </div>
              </div>

              <!-- Format Guide Box -->
              <div class="p-4 rounded mt-auto" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);">
                <div class="d-flex align-center justify-between flex-wrap gap-2 mb-2">
                  <span class="text-sm fw-700 text-gradient">STUDENT SPREADSHEET COLUMN FORMAT</span>
                  <span class="badge badge-info" style="font-size:0.75rem;">Supports English Columns</span>
                </div>
                <div class="text-xs text-muted d-flex flex-column gap-1">
                  <div>â€¢ <b>Name:</b> Column <code>NAME</code>, <code>Student Name</code> (Required).</div>
                  <div>â€¢ <b>Gender (Optional):</b> Column <code>GENDER</code>. <em>If left blank, students will select their own gender (Mr. / Miss) upon first login.</em></div>
                  <div>â€¢ <b>Birth Date / Age:</b> Column <code>BIRTH_DATE</code> or <code>AGE</code> (Format: YYYY-MM-DD or age number).</div>
                  <div>â€¢ <b>PIN:</b> Column <code>PIN</code> or <code>Password</code> (Defaults to <code>1234</code> if left blank).</div>
                  <div>â€¢ <b>Program &amp; Class &amp; Batch:</b> If left blank in the Excel file, the Target Program, Class, and Batch selected above will be used.</div>
                </div>
              </div>
            </div>

            <!-- Preview Container (Right side / Bottom on mobile) -->
            <div id="import-students-preview-wrap" class="hidden" style="flex: 1; min-width: 300px; height: 100%;">
              <div class="glass-card p-6" style="display: flex; flex-direction: column; height: 100%;">
                <div class="d-flex align-center justify-between flex-wrap gap-4 mb-4 pb-3" style="border-bottom:1px solid var(--clr-border); flex-shrink: 0;">
                  <div>
                    <h3 class="fw-700 text-gradient" style="font-size:1.25rem;">Student Data Preview</h3>
                    <p class="text-sm text-muted" id="students-preview-summary">0 students read from file.</p>
                  </div>
                  <div class="d-flex align-center gap-3">
                    <button class="btn btn-secondary btn-sm" id="btn-cancel-students-import">Cancel</button>
                    <button class="btn btn-primary btn-sm" id="btn-confirm-students-import">âœ“ Confirm &amp; Save Students</button>
                  </div>
                </div>

                <!-- Stats Chips -->
                <div class="d-flex gap-3 flex-wrap mb-4" id="students-preview-stat-chips" style="flex-shrink: 0;">
                  <span class="badge badge-info" id="chip-total-students">Total: 0</span>
                  <span class="badge badge-success" id="chip-valid-students">Ready to Import: 0</span>
                  <span class="badge badge-warning" id="chip-warn-students">Merged with Existing: 0</span>
                </div>

                <div class="table-wrap table-compact mb-2" style="flex: 1; overflow-y: auto; overflow-x: auto; max-height: none;">
                  <table style="width: 100%; table-layout: fixed; min-width: 700px;">
                    <thead>
                      <tr>
                        <th class="text-center" style="width:5%;">#</th>
                        <th class="text-left" style="width:25%;">Student Name</th>
                        <th class="text-center" style="width:8%;">Gender</th>
                        <th class="text-center" style="width:12%;">Birth Date/Age</th>
                        <th class="text-left" style="width:12%;">Program</th>
                        <th class="text-left" style="width:12%;">Class</th>
                        <th class="text-left" style="width:10%;">Batch</th>
                        <th class="text-center" style="width:8%;">PIN</th>
                        <th class="text-center" style="width:8%;">Status</th>
                      </tr>
                    </thead>
                    <tbody id="tbl-preview-students"></tbody>
                  </table>
                </div>
              </div>
            </div>

          </div>
        </div>
      `;

      // Back button
      document.getElementById('btn-back-to-students')?.addEventListener('click', () => loadSection('students'));

      // Download Student Template
      document.getElementById('btn-dl-student-template')?.addEventListener('click', () => {
        const sampleData = [
          {
            'NO': 1,
            'NAME': 'Alexander Wright',
            'GENDER': 'male',
            'BIRTH_DATE': '2010-05-14',
            'PIN': '1234',
            'PROGRAM': sortedPrograms[0]?.name || 'General English Program',
            'CLASS': sortedClasses[0]?.name || 'Class A',
            'BATCH': 'Batch 2026-A'
          },
          {
            'NO': 2,
            'NAME': 'Beatrix Potter',
            'GENDER': 'female',
            'BIRTH_DATE': '2011-09-22',
            'PIN': '1234',
            'PROGRAM': sortedPrograms[0]?.name || 'General English Program',
            'CLASS': sortedClasses[0]?.name || 'Class A',
            'BATCH': 'Batch 2026-A'
          },
          {
            'NO': 3,
            'NAME': 'Christopher Nolan',
            'GENDER': '', // Optional: leave blank if students will choose their own gender upon first login
            'BIRTH_DATE': '2010-11-03',
            'PIN': '5678',
            'PROGRAM': sortedPrograms[0]?.name || 'General English Program',
            'CLASS': sortedClasses[1]?.name || sortedClasses[0]?.name || 'Class B',
            'BATCH': 'Batch 2026-B'
          }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Student Data');
        XLSX.writeFile(wb, 'Template_Student_Import.xlsx');
        showToast('Student template downloaded successfully.', 'success');
      });

      // Program -> Class -> Batch cascading filter in top dropdowns
      const progSelect = document.getElementById('import-student-program');
      const classSelect = document.getElementById('import-student-class');
      const batchSelect = document.getElementById('import-student-batch');

      const updateBatchDropdown = (selectedClassId) => {
        batchSelect.innerHTML = `<option value="">â€” Use Batch from Excel File â€”</option>`;
        if (!selectedClassId) {
          batchSelect.disabled = true;
          batchSelect.innerHTML = `<option value="">- Select Program First -</option>`;
          return;
        }
        batchSelect.disabled = false;
        const filteredBatches = sortedBatches.filter(b => b.program_id === selectedClassId && !b.deleted_at);
        filteredBatches.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          batchSelect.appendChild(opt);
        });
      };

      progSelect?.addEventListener('change', () => {
        const selectedProg = progSelect.value;
        let visibleClassCount = 0;
        let lastVisibleClass = null;

        Array.from(classSelect.options).forEach(opt => {
          if (!opt.value) return; // Keep default option
          const optProg = opt.getAttribute('data-prog');
          const isVisible = (!selectedProg || optProg === selectedProg);
          opt.style.display = isVisible ? '' : 'none';
          if (isVisible) {
            visibleClassCount++;
            lastVisibleClass = opt.value;
          }
        });
        if (selectedProg && classSelect.selectedOptions[0]?.style.display === 'none') {
          classSelect.value = '';
        }

        // Auto-Select Program if only 1 is available for this Program
        if (visibleClassCount === 1 && selectedProg) {
          classSelect.value = lastVisibleClass;
        }

        updateBatchDropdown(classSelect.value);
      });

      classSelect?.addEventListener('change', () => {
        updateBatchDropdown(classSelect.value);
      });

      // Streamlined UI: Auto-select Program if only 1 exists
      if (sortedPrograms.length === 1 && progSelect) {
        progSelect.value = sortedPrograms[0].id;
        progSelect.dispatchEvent(new Event('change'));
      }

      let parsedStudentsState = [];

      // File parser
      document.getElementById('import-students-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showLoading('Reading spreadsheet fileâ€¦');
        const reader = new FileReader();
        reader.onload = async (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheet = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheet];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!jsonRows.length) {
              hideLoading();
              showToast('Spreadsheet file is empty.', 'warning');
              return;
            }

            // Fetch existing students to detect and merge duplicate names in the same class
            const existingStudents = await adminFetchAll('students');
            const existingStudentsMap = new Map();
            existingStudents.forEach(s => {
              if (s.deleted_at) return;
              const key = `${(s.name || '').toLowerCase().trim()}::${s.program_id}`;
              if (!existingStudentsMap.has(key)) {
                existingStudentsMap.set(key, s);
              }
            });

            const selectedProgId = document.getElementById('import-student-program').value;
            const selectedClassId = document.getElementById('import-student-class').value;
            const selectedBatchId = document.getElementById('import-student-batch')?.value;
            const selectedLevelId = document.getElementById('import-student-level')?.value;
            const selectedProg = sortedPrograms.find(p => p.id === selectedProgId);
            const selectedClass = sortedClasses.find(c => c.id === selectedClassId);
            const selectedBatch = sortedBatches.find(b => b.id === selectedBatchId);
            const selectedLevel = sortedLevels.find(l => l.id === selectedLevelId);

            // Map for deduplicating within the file batch itself
            const batchMap = new Map();
            let duplicateMergedInFileCount = 0;

            jsonRows.forEach((row, idx) => {
              const rawName = getRowVal(row, ['name', 'studentname', 'nama', 'namasiswa', 'fullname', 'pesertadidik']);
              if (!rawName) return; // Skip empty row
              const name = rawName.trim();

              // Gender mapping (optional: if omitted, student assigns it upon first entering console)
              const rawGender = getRowVal(row, ['gender', 'jeniskelamin', 'jk', 'sex', 'lp']).toLowerCase().trim();
              let gender = null;
              if (rawGender.startsWith('m') || rawGender.startsWith('l') || rawGender.includes('laki') || rawGender.includes('pria')) {
                gender = 'male';
              } else if (rawGender.startsWith('f') || rawGender.startsWith('p') || rawGender.startsWith('w') || rawGender.includes('perempuan') || rawGender.includes('wanita')) {
                gender = 'female';
              }

              // Birth Date / Age
              const rawBirth = getRowVal(row, ['birthdate', 'dob', 'tanggallahir', 'tgllahir', 'tgl', 'birth_date']);
              const rawAge = getRowVal(row, ['age', 'usia']);
              let birthDate = '';
              let ageDisplay = 'â€”';

              if (rawBirth) {
                if (!isNaN(rawBirth) && Number(rawBirth) > 1000) {
                  const dateObj = new Date((Number(rawBirth) - 25569) * 86400 * 1000);
                  birthDate = dateObj.toISOString().split('T')[0];
                } else {
                  const parsedDate = new Date(rawBirth);
                  if (!isNaN(parsedDate.getTime())) {
                    birthDate = parsedDate.toISOString().split('T')[0];
                  }
                }
              }

              if (!birthDate && rawAge) {
                const ageNum = parseInt(rawAge, 10);
                if (!isNaN(ageNum) && ageNum > 0 && ageNum < 100) {
                  const year = new Date().getFullYear() - ageNum;
                  birthDate = `${year}-01-01`;
                }
              }

              if (birthDate) {
                ageDisplay = calculateAgeFromBirthDate(birthDate);
              }

              // PIN
              let pin = getRowVal(row, ['pin', 'password', 'pass', 'kodepin', 'pin_hash']);
              if (!pin) pin = '1234';

              // Program & Class
              const rowProgName = getRowVal(row, ['program', 'programname', 'namaprogram']);
              const rowClassName = getRowVal(row, ['class', 'classname', 'kelas', 'namakelas']);
              const rowBatchName = getRowVal(row, ['batch', 'batchname', 'namabatch', 'angkatan', 'gelombang']);

              let finalProgId = selectedProgId;
              let finalProgName = selectedProg?.name || '';
              if (!finalProgId && rowProgName) {
                const matchedP = sortedPrograms.find(p => p.name.toLowerCase().trim() === rowProgName.toLowerCase().trim());
                if (matchedP) {
                  finalProgId = matchedP.id;
                  finalProgName = matchedP.name;
                }
              }
              if (!finalProgId && sortedPrograms.length > 0) {
                finalProgId = sortedPrograms[0].id;
                finalProgName = sortedPrograms[0].name;
              }

              let finalClassId = selectedClassId;
              let finalClassName = selectedClass?.name || '';
              if (!finalClassId && rowClassName) {
                const matchedC = sortedClasses.find(c => c.name.toLowerCase().trim() === rowClassName.toLowerCase().trim() && (!finalProgId || c.institution_id === finalProgId));
                if (matchedC) {
                  finalClassId = matchedC.id;
                  finalClassName = matchedC.name;
                  if (!finalProgId && matchedC.institution_id) {
                    finalProgId = matchedC.institution_id;
                    finalProgName = matchedC.institutions?.name || '';
                  }
                }
              }
              if (!finalClassId) {
                const firstClassInProg = sortedClasses.find(c => c.institution_id === finalProgId) || sortedClasses[0];
                if (firstClassInProg) {
                  finalClassId = firstClassInProg.id;
                  finalClassName = firstClassInProg.name;
                }
              }

              let finalBatchId = selectedBatchId || null;
              let finalBatchName = selectedBatch?.name || '';
              // Batch auto-resolve: check existing batches, then schedule auto-create
              const resolvedBatchName = rowBatchName || finalBatchName;
              if (!finalBatchId && resolvedBatchName && finalClassId) {
                // Look in current sortedBatches (already loaded, may include previously auto-created ones)
                const matchedB = sortedBatches.find(b =>
                  b.program_id === finalClassId &&
                  b.name.toLowerCase().trim() === resolvedBatchName.toLowerCase().trim() &&
                  !b.deleted_at
                );
                if (matchedB) {
                  finalBatchId = matchedB.id;
                  finalBatchName = matchedB.name;
                } else if (resolvedBatchName) {
                  // Flag for auto-creation at save time
                  finalBatchId = null;
                  finalBatchName = resolvedBatchName.trim(); // Will be created on confirm
                }
              }

              const batchKey = `${name.toLowerCase()}::${finalClassId}`;

              if (batchMap.has(batchKey)) {
                // Intra-batch duplicate in file: merge into existing entry in batch
                duplicateMergedInFileCount++;
                const existingBatchItem = batchMap.get(batchKey);
                if (!existingBatchItem.birthDate && birthDate) {
                  existingBatchItem.birthDate = birthDate;
                  existingBatchItem.ageDisplay = ageDisplay;
                }
                if (!existingBatchItem.batchId && finalBatchId) {
                  existingBatchItem.batchId = finalBatchId;
                  existingBatchItem.batchName = finalBatchName;
                }
                if (existingBatchItem.pin === '1234' && pin !== '1234') {
                  existingBatchItem.pin = pin;
                }
                existingBatchItem.duplicateInFile = true;
                return;
              }

              // Check if student already in database
              const existingDbStudent = existingStudentsMap.get(batchKey);
              let status = 'valid';
              let statusMsg = 'âœ¨ New Student';
              let isExisting = false;
              let existingId = null;

              if (!finalClassId) {
                status = 'error';
                statusMsg = 'No Class Assigned';
              } else if (existingDbStudent) {
                status = 'merge';
                statusMsg = 'ðŸ”„ Merge Existing';
                isExisting = true;
                existingId = existingDbStudent.id;
              }

              // Optional Level mapping
              const rowLevelName = getRowVal(row, ['level', 'levelname', 'namalevel', 'tingkat', 'lvl']);
              let finalLevelId = selectedLevelId || null;
              let finalLevelName = selectedLevel?.name || '';
              if (!finalLevelId && rowLevelName) {
                const matchedL = sortedLevels.find(l => l.name.toLowerCase().trim() === rowLevelName.toLowerCase().trim() || String(l.level_number) === rowLevelName.trim());
                if (matchedL) {
                  finalLevelId = matchedL.id;
                  finalLevelName = matchedL.name;
                }
              }

              const item = {
                no: idx + 1,
                name: formatStudentName(name, gender),
                gender,
                birthDate: birthDate || null,
                ageDisplay,
                pin,
                institutionId: finalProgId,
                institutionName: finalProgName || 'Program',
                programId: finalClassId,
                programName: finalClassName || 'Class',
                batchId: finalBatchId,
                batchName: finalBatchName || 'â€”',
                levelId: finalLevelId,
                levelName: finalLevelName || '',
                status,
                statusMsg,
                isExisting,
                existingId,
                duplicateInFile: false
              };

              batchMap.set(batchKey, item);
            });

            parsedStudentsState = Array.from(batchMap.values()).map((item, index) => {
              item.no = index + 1;
              return item;
            });

            hideLoading();

            if (!parsedStudentsState.length) {
              showToast('No valid student data found in the spreadsheet.', 'warning');
              return;
            }

            renderPreviewTable(duplicateMergedInFileCount);
          } catch(err) {
            hideLoading();
            showToast('Failed to process file: ' + err.message, 'error');
          }
        };
        reader.readAsArrayBuffer(file);
      });

      function renderPreviewTable(dupInFile = 0) {
        const wrap = document.getElementById('import-students-preview-wrap');
        const tbody = document.getElementById('tbl-preview-students');
        if (!wrap || !tbody) return;

        wrap.classList.remove('hidden');
        tbody.innerHTML = '';

        let newCount = 0;
        let mergeCount = 0;

        const LIMIT = 50;
        parsedStudentsState.forEach((s, i) => {
          if (s.status === 'valid') newCount++;
          else if (s.status === 'merge') mergeCount++;

          if (i < LIMIT) {
            const tr = document.createElement('tr');
            let badgeHtml = '';
            if (s.status === 'valid') {
              badgeHtml = `<span class="badge badge-success">âœ¨ New Student</span>`;
            } else if (s.status === 'merge') {
              badgeHtml = `<span class="badge badge-info">ðŸ”„ Merge / Update</span>`;
            } else {
              badgeHtml = `<span class="badge badge-danger">Error</span>`;
            }

            if (s.duplicateInFile) {
              badgeHtml += ` <span class="badge badge-warning ml-1" title="Dimerge dari baris kembar dalam spreadsheet">âš¡ Dimerge dari File</span>`;
            }

            const genderBadge = s.gender === 'male'
              ? '<span class="badge badge-primary">ðŸ‘¨ Male</span>'
              : s.gender === 'female'
              ? '<span class="badge badge-accent">ðŸ‘© Female</span>'
              : '<span class="badge badge-neutral" style="font-size:0.7rem;" title="Student will select gender upon first login">â³ Unassigned</span>';

            tr.innerHTML = `
              <td class="text-center text-muted fw-700">${i + 1}</td>
              <td class="fw-600">${escapeHtml(s.name)}</td>
              <td class="text-center">${genderBadge}</td>
              <td class="text-center text-muted text-sm">${escapeHtml(s.birthDate || 'â€”')} <span class="badge badge-info ml-1" style="font-size:0.7rem;">${escapeHtml(s.ageDisplay)}</span></td>
              <td class="text-muted text-sm">${escapeHtml(s.institutionName)}</td>
              <td class="fw-600 text-sm">${escapeHtml(s.programName)}</td>
              <td class="text-sm fw-600" style="color:var(--clr-accent-1);">${escapeHtml(s.batchName || 'â€”')}</td>
              <td class="text-center text-sm" style="font-family:monospace;letter-spacing:2px;">â€¢â€¢â€¢â€¢ <span class="text-muted text-xs" title="PIN: ${escapeHtml(s.pin)}">(${escapeHtml(s.pin)})</span></td>
              <td class="text-center">${badgeHtml}</td>
            `;
            tbody.appendChild(tr);
          } else if (i === LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="9" class="text-center text-muted fw-600 py-3" style="font-size: 0.85rem;">... and ${parsedStudentsState.length - LIMIT} more rows.</td>`;
            tbody.appendChild(tr);
          }
        });

        document.getElementById('students-preview-summary').textContent = `${parsedStudentsState.length} students ready to be processed (${newCount} new records, ${mergeCount} existing records merged).`;
        document.getElementById('chip-total-students').textContent = `Total: ${parsedStudentsState.length}`;
        document.getElementById('chip-valid-students').textContent = `âœ¨ Baru: ${newCount}`;
        document.getElementById('chip-warn-students').textContent = `ðŸ”„ Merge: ${mergeCount}`;

        const saveBtn = document.getElementById('btn-confirm-students-import');
        if (saveBtn) {
          saveBtn.textContent = `Save & Merge (${parsedStudentsState.length} Students)`;
        }
      }

      // Cancel button
      document.getElementById('btn-cancel-students-import')?.addEventListener('click', () => {
        document.getElementById('import-students-preview-wrap')?.classList.add('hidden');
        document.getElementById('import-students-file').value = '';
        parsedStudentsState = [];
      });

      // Confirm & Save
      document.getElementById('btn-confirm-students-import')?.addEventListener('click', async () => {
        const readyStudents = parsedStudentsState.filter(s => s.status !== 'error');
        if (!readyStudents.length) {
          showToast('No students are ready to be saved.', 'warning');
          return;
        }

              showLoading(`Processing ${readyStudents.length} students (saving new & merging existing)â€¦`);
        try {
          let insertedCount = 0;
          let mergedCount = 0;

          // â”€â”€ Auto-create missing batches first (before saving students) â”€â”€
          // Collect unique (programId, batchName) pairs that don't have a batchId yet
          const batchesToCreate = new Map(); // key: programId::batchName -> { programId, batchName }
          for (const s of readyStudents) {
            if (!s.batchId && s.batchName && s.batchName !== 'â€”' && s.programId) {
              const key = `${s.programId}::${s.batchName.toLowerCase().trim()}`;
              if (!batchesToCreate.has(key)) {
                batchesToCreate.set(key, { programId: s.programId, batchName: s.batchName.trim() });
              }
            }
          }

          // Create missing batches and build a lookup map
          const newBatchMap = new Map(); // key: programId::batchName -> id
          for (const [key, { programId, batchName }] of batchesToCreate.entries()) {
            try {
              const newBatch = await adminInsert('batches', {
                program_id: programId,
                name: batchName,
                is_active: true
              });
              newBatchMap.set(key, newBatch.id);
              // Also push into sortedBatches so it's available for subsequent rows
              sortedBatches.push({ id: newBatch.id, program_id: programId, name: batchName, is_active: true });
              showToast(`Batch "${batchName}" auto-created.`, 'info');
            } catch(batchErr) {
              console.warn(`Could not auto-create batch "${batchName}":`, batchErr.message);
            }
          }

          // Resolve batch IDs for students that needed auto-creation
          for (const s of readyStudents) {
            if (!s.batchId && s.batchName && s.batchName !== 'â€”' && s.programId) {
              const key = `${s.programId}::${s.batchName.toLowerCase().trim()}`;
              if (newBatchMap.has(key)) s.batchId = newBatchMap.get(key);
            }
          }

          // â”€â”€ Safe student write helper: retries without extended columns if DB schema is old â”€â”€
          let _dbHasBatchId = true;  // Assume yes, will be set to false on first schema error
          let _dbHasBirthDate = true;
          let _dbHasProgramId = true;
          let _dbHasLevelId = true;

          async function safeStudentInsert(payload) {
            // Remove null/undefined batch_id if DB doesn't have the column
            const p = { ...payload };
            if (!_dbHasBatchId) delete p.batch_id;
            if (!_dbHasBirthDate) delete p.birth_date;
            if (!_dbHasProgramId) delete p.institution_id;
            
            try {
              return await adminInsert('students', p);
            } catch (e) {
              if (e.message && e.message.toLowerCase().includes('batch_id')) {
                _dbHasBatchId = false;
                showToast('âš ï¸ Column batch_id missing in DB â€” saving without batch. Run the SQL patch to fix this.', 'warning');
                delete p.batch_id;
                return await adminInsert('students', p);
              }
              if (e.message && e.message.toLowerCase().includes('birth_date')) {
                _dbHasBirthDate = false;
                delete p.birth_date;
                return await adminInsert('students', p);
              }
              if (e.message && e.message.toLowerCase().includes('institution_id')) {
                _dbHasProgramId = false;
                delete p.institution_id;
                return await adminInsert('students', p);
              }
              throw e;
            }
          }

          async function safeStudentUpdate(id, payload) {
            const p = { ...payload };
            if (!_dbHasBatchId) delete p.batch_id;
            if (!_dbHasBirthDate) delete p.birth_date;
            if (!_dbHasProgramId) delete p.institution_id;
            
            try {
              return await adminUpdate('students', id, p);
            } catch (e) {
              if (e.message && e.message.toLowerCase().includes('batch_id')) {
                _dbHasBatchId = false;
                showToast('âš ï¸ Column batch_id missing in DB â€” saving without batch. Run the SQL patch to fix this.', 'warning');
                delete p.batch_id;
                return await adminUpdate('students', id, p);
              }
              if (e.message && e.message.toLowerCase().includes('birth_date')) {
                _dbHasBirthDate = false;
                delete p.birth_date;
                return await adminUpdate('students', id, p);
              }
              if (e.message && e.message.toLowerCase().includes('institution_id')) {
                _dbHasProgramId = false;
                delete p.institution_id;
                return await adminUpdate('students', id, p);
              }
              throw e;
            }
          }

          for (const s of readyStudents) {
            if (s.isExisting && s.existingId) {
              const payload = {
                institution_id: s.institutionId,
                program_id: s.programId,
                batch_id: s.batchId || null,
                birth_date: s.birthDate,
                is_active: true,
                deleted_at: null,
                updated_at: new Date().toISOString()
              };
              if (s.gender) {
                payload.gender = s.gender;
                payload.name = formatStudentName(s.name, s.gender);
              } else {
                payload.name = s.name;
              }
              if (s.pin && s.pin !== '1234') {
                payload.pin_hash = await hashPin(s.pin);
              }
              await safeStudentUpdate(s.existingId, payload);
              mergedCount++;
            } else {
              const hashed = await hashPin(s.pin || '1234');
              const payload = {
                name: formatStudentName(s.name, s.gender),
                institution_id: s.institutionId,
                program_id: s.programId,
                batch_id: s.batchId || null,
                gender: s.gender || null,
                birth_date: s.birthDate,
                pin_hash: hashed,
                is_active: true
              };
              await safeStudentInsert(payload);
              insertedCount++;
            }
          }

          hideLoading();
          const batchWarning = !_dbHasBatchId ? ' (batch_id column missing â€” run SQL patch to enable full batch support)' : '';
          showToast(`Done! ${insertedCount} new students added, ${mergedCount} updated/merged!${batchWarning}`, 'success');
          
          // Stay on page and reset preview box
          document.getElementById('import-students-preview-wrap').classList.add('hidden');
          document.getElementById('import-students-file').value = '';
          parsedStudentsState = [];
        } catch(err) {
          hideLoading();
          showToast('Import error: ' + err.message, 'error');
        }
      });
    }

    function renderImportQuestions(area) {
      area.innerHTML = `
        <div style="height: calc(100vh - 80px); display: flex; flex-direction: column; overflow: hidden; margin: -40px; padding: 40px;">
          <div class="section-header" style="flex-shrink: 0;">
            <div>
              <h2 class="section-title">Import Questions (Excel)</h2>
              <p class="section-subtitle">Select Exam & Exam Type first to view the correct Excel template format before uploading a file.</p>
            </div>
          </div>

          <div class="d-flex flex-wrap gap-6 align-stretch" style="flex: 1; overflow: hidden;">
            
            <!-- IMPORT BOX (Left side / Top on mobile) -->
            <div class="glass-card p-6" style="flex: 1; min-width: 300px; max-width: calc(50% - 12px); height: 100%; overflow-y: auto; display: flex; flex-direction: column;">
              <div class="d-flex flex-column gap-4 mb-4">
                <div class="form-group w-100">
                  <label class="form-label">1. Select Target Exam</label>
                  <select class="form-control" id="import-exam-select"><option value="">Loading exams…</option></select>
                </div>
                <div class="form-group w-100">
                  <label class="form-label">2. Exam Type (Answer Method)</label>
                  <select class="form-control" id="import-exam-type-select">
                    <option value="written">Written (Type)</option>
                    <option value="speech_to_text">Speech to Text (Suara)</option>
                    <option value="multiple_choice">Multiple Choice</option>
                    <option value="dropdown">Drop-down</option>
                  </select>
                </div>
                <div class="form-group w-100">
                  <label class="form-label">3. Select Excel File (.xlsx / .xls)</label>
                  <input type="file" class="form-control" id="import-questions-file" accept=".xlsx,.xls,.csv" />
                </div>
              </div>

              <!-- Required Columns Preview Box -->
              <div class="p-4 rounded mb-4" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);">
                <div class="d-flex align-center justify-between flex-wrap gap-3 mb-2">
                  <span class="text-xs fw-700 text-gradient" id="format-title-badge">WRITTEN EXCEL FORMAT</span>
                  <button class="btn btn-primary btn-sm w-100 mt-2" id="download-template-btn">ðŸ“¥ Download Template</button>
                </div>
                <p class="text-xs text-muted mb-2" id="format-desc-label">First row header arrangement:</p>
                <div class="p-2 rounded text-xs mb-3" style="background:rgba(0,0,0,0.3);border:1px dashed var(--clr-border);font-family:monospace;overflow-x:auto;white-space:nowrap;" id="format-columns-code">
                  PROG | CLASS | LVL | WK | DAY | TYPE | NO | Q | A
                </div>
              </div>

              <!-- Quick Template Download Bar for All 4 Exam Types -->
              <div class="p-4 rounded mt-auto" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);">
                <div class="text-xs fw-700 text-muted uppercase mb-3">Other Templates:</div>
                <div class="d-flex flex-column gap-2">
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-written">ðŸ“„ Written (Type)</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-speech">ðŸŽ™ï¸ Speech to Text</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-mc">ðŸ”˜ Multiple Choice</button>
                  <button class="btn btn-secondary btn-sm text-left" id="dl-tmpl-dropdown">â–¼ Drop-down</button>
                </div>
              </div>
            </div>

            <!-- PREVIEW BOX (Right side / Bottom on mobile) -->
            <div id="import-preview-container" class="hidden" style="flex: 1; min-width: 300px; height: 100%;">
              <div class="glass-card p-6" style="display: flex; flex-direction: column; height: 100%;">
                <div class="d-flex align-center justify-between flex-wrap gap-4 mb-4" style="flex-shrink: 0;">
                  <div>
                    <h3 class="text-gradient m-0" id="preview-summary-title">Preview Parsing Results</h3>
                    <p class="text-muted text-sm mt-1">Review questions data before saving.</p>
                  </div>
                  <div>
                    <span class="badge badge-primary p-2" id="preview-exam-type-badge" style="font-size:0.85rem;">Exam Type: WRITTEN</span>
                  </div>
                </div>

                <div class="table-wrap table-compact mb-5" style="flex: 1; overflow-y: auto; overflow-x: auto; max-height: none;">
                  <table style="width: 100%; table-layout: fixed; min-width: 500px;">
                    <thead>
                      <tr>
                        <th style="width:10%;">NO</th>
                        <th style="width:60%;">QUESTION</th>
                        <th style="width:30%;">ANSWER</th>
                      </tr>
                    </thead>
                    <tbody id="tbl-import-preview"></tbody>
                  </table>
                </div>

                <div class="d-flex justify-between align-center flex-wrap gap-3" style="flex-shrink: 0;">
                  <span class="text-muted text-sm" id="preview-count-label">0 questions siap di-import.</span>
                  <div class="d-flex gap-2">
                    <button class="btn btn-secondary" id="cancel-import-btn">Cancel</button>
                    <button class="btn btn-primary" id="confirm-save-import-btn">ðŸ’¾ Save Questions</button>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      `;

      let parsedQuestionsState = [];
      let fetchedExamsList = [];

      const formatInfos = {
        written: {
          title: 'FORMAT KOLOM EXCEL WRITTEN (KETIK TULISAN)',
          desc: 'Students answer by typing the translation/word. Requires 11 standard columns:',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'MENCAPAI', ANSWER: 'ACHIEVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'MENYELESAIKAN DENGAN SUKSES', ANSWER: 'ACCOMPLISH' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 3, QUESTION: 'MENGEMBANGKAN', ANSWER: 'DEVELOP' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 4, QUESTION: 'MENINGKATKAN', ANSWER: 'IMPROVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 5, QUESTION: 'BERSPESIALISASI', ANSWER: 'SPECIALISE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 6, QUESTION: 'MEMENUHI KUALIFIKASI', ANSWER: 'QUALIFY' },
            { PROGRAM: 'CEC', CLASS: 'Camp', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 7, QUESTION: 'BERKONTRIBUSI', ANSWER: 'CONTRIBUTE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 8, QUESTION: 'MENUNJUKKAN', ANSWER: 'DEMONSTRATE' }
          ]
        },
        speech_to_text: {
          title: 'FORMAT KOLOM EXCEL SPEECH TO TEXT (SUARA US/UK)',
          desc: 'Students answer by speaking a sentence via microphone. Requires 11 standard columns:',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'MENCAPAI', ANSWER: 'ACHIEVE' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'MENYELESAIKAN DENGAN SUKSES', ANSWER: 'ACCOMPLISH' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 3, QUESTION: 'MENGEMBANGKAN', ANSWER: 'DEVELOP' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 4, QUESTION: 'MENINGKATKAN', ANSWER: 'IMPROVE' }
          ]
        },
        multiple_choice: {
          title: 'FORMAT KOLOM EXCEL MULTIPLE CHOICE (PILIHAN GANDA)',
          desc: 'Students select one answer from multiple choices (A, B, C, D). Requires 4 separate option columns:',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER | OPTION A | OPTION B | OPTION C | OPTION D',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'She ___ to school every day.', ANSWER: 'walks', 'OPTION A': 'walks', 'OPTION B': 'walk', 'OPTION C': 'walking', 'OPTION D': 'walked' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'They ___ playing football now.', ANSWER: 'are', 'OPTION A': 'are', 'OPTION B': 'is', 'OPTION C': 'am', 'OPTION D': 'was' }
          ]
        },
        dropdown: {
          title: 'FORMAT KOLOM EXCEL DROP-DOWN (MENU TARIK)',
          desc: 'Students select an answer from a dropdown menu (Mendukung 2 s/d 10 opsi: OPTION A, B, C, D, E, F, G, H, I, J atau OPTION 1 s/d 10).',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER | OPTION A | OPTION B | ... | OPTION J (hingga 10 opsi)',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'Select the correct pronoun for a group including yourself.', ANSWER: 'We', 'OPTION A': 'They', 'OPTION B': 'We', 'OPTION C': 'He', 'OPTION D': 'You', 'OPTION E': 'It' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'Choose past tense of go:', ANSWER: 'went', 'OPTION A': 'go', 'OPTION B': 'went', 'OPTION C': 'gone', 'OPTION D': 'going' }
          ]
        }
      };

      function updateFormatDisplay(typeKey) {
        const info = formatInfos[typeKey] || formatInfos.written;
        document.getElementById('format-title-badge').textContent = info.title;
        document.getElementById('format-desc-label').textContent = info.desc;
        document.getElementById('format-columns-code').textContent = info.columns;
        const previewBadge = document.getElementById('preview-exam-type-badge');
        if (previewBadge) previewBadge.textContent = `Exam Type: ${typeKey.replace('_',' ').toUpperCase()}`;

        if (parsedQuestionsState.length) {
          parsedQuestionsState.forEach(q => { q.answerType = typeKey; });
          renderPreviewTable();
        }
      }

      adminFetchAll('exams').then(exams => {
        fetchedExamsList = exams;
        const sortedExams = [...exams].sort((a, b) => {
          const nameA = `${a.exam_type ? a.exam_type + ' - ' : ''}${a.exam_title}`;
          const nameB = `${b.exam_type ? b.exam_type + ' - ' : ''}${b.exam_title}`;
          return nameA.localeCompare(nameB);
        });
        const sel = document.getElementById('import-exam-select');
        sel.innerHTML = '<option value="">â€” Select Target Exam â€”</option>' +
          sortedExams.map(e => `<option value="${e.id}">${escapeHtml(formatExamDisplayName(e))} (${formatAnswerType(e.answer_type)})</option>`).join('');
      });

      document.getElementById('import-exam-select').addEventListener('change', (e) => {
        const examId = e.target.value;
        const selectedExam = fetchedExamsList.find(x => x.id === examId);
        if (selectedExam) {
          const atype = selectedExam.answer_type || 'written';
          document.getElementById('import-exam-type-select').value = atype;
          updateFormatDisplay(atype);
        }
      });

      document.getElementById('import-exam-type-select').addEventListener('change', (e) => {
        updateFormatDisplay(e.target.value);
      });

      // Download helper
      function downloadTemplateForType(typeKey) {
        const info = formatInfos[typeKey] || formatInfos.written;
        const ws = XLSX.utils.json_to_sheet(info.sample);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Template');
        XLSX.writeFile(wb, `Template_${typeKey}_Exam.xlsx`);
        showToast(`Template ${typeKey.replace('_',' ')} downloaded successfully.`, 'success');
      }

      // Download template for selected format
      document.getElementById('download-template-btn').addEventListener('click', () => {
        const currentType = document.getElementById('import-exam-type-select').value || 'written';
        downloadTemplateForType(currentType);
      });

      // Quick template download buttons
      document.getElementById('dl-tmpl-written')?.addEventListener('click', () => downloadTemplateForType('written'));
      document.getElementById('dl-tmpl-speech')?.addEventListener('click', () => downloadTemplateForType('speech_to_text'));
      document.getElementById('dl-tmpl-mc')?.addEventListener('click', () => downloadTemplateForType('multiple_choice'));
      document.getElementById('dl-tmpl-dropdown')?.addEventListener('click', () => downloadTemplateForType('dropdown'));

      document.getElementById('import-questions-file').addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showLoading('Reading Excel file previewâ€¦');
        const reader = new FileReader();

        reader.onload = (evt) => {
          try {
            const data = new Uint8Array(evt.target.result);
            const workbook = XLSX.read(data, { type: 'array' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

            if (!jsonRows.length) {
              hideLoading();
              showToast('Excel file is empty.', 'warning');
              return;
            }

            // Get target exam answer_type from selected Exam
            const examId = document.getElementById('import-exam-select').value;
            const selectedExam = fetchedExamsList.find(x => x.id === examId);
            let defaultAnswerType = selectedExam?.answer_type || 'written';

            parsedQuestionsState = [];
            jsonRows.forEach((row, i) => {
              const questionText = getRowVal(row, ['question', 'questions', 'pertanyaan', 'indonesia', 'text', 'prompt']);
              const correctAnswer = getRowVal(row, ['answer', 'jawaban', 'kunci', 'kuncijawaban', 'english', 'correctanswer', 'solution']);
              const rawNo = getRowVal(row, ['no', 'nomor', 'number', 'order', 'urutan']);
              const qNo = parseInt(rawNo || (i + 1), 10);
              const subject = getRowVal(row, ['subject', 'matapelajaran', 'mapel']);
              const title = getRowVal(row, ['title', 'examtitle', 'judul']);
              const week = getRowVal(row, ['week', 'minggu']);
              const day = getRowVal(row, ['day', 'hari']);
              const type = getRowVal(row, ['type', 'examtype', 'tipe', 'jenisquestions']);

              if (!questionText || !correctAnswer) return;

              // Extract options: Check separate OPTION A..J or OPTION 1..10 (2 to 10 options)
              let extractedOptions = [];
              const optionKeysLetter = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
              optionKeysLetter.forEach(ltr => {
                const val = getRowVal(row, ['option ' + ltr.toLowerCase(), 'option' + ltr.toLowerCase(), 'opsi ' + ltr.toLowerCase(), 'opsi' + ltr.toLowerCase(), 'pilihan ' + ltr.toLowerCase(), 'pilihan' + ltr.toLowerCase(), ltr.toLowerCase()]);
                if (val !== undefined && String(val).trim() !== '') {
                  extractedOptions.push(String(val).trim());
                }
              });

              if (extractedOptions.length === 0) {
                for (let num = 1; num <= 10; num++) {
                  const val = getRowVal(row, ['option ' + num, 'option' + num, 'opsi ' + num, 'opsi' + num, 'pilihan ' + num, 'pilihan' + num]);
                  if (val !== undefined && String(val).trim() !== '') {
                    extractedOptions.push(String(val).trim());
                  }
                }
              }

              let optionsJson = null;
              if (extractedOptions.length > 0) {
                optionsJson = extractedOptions;
              } else {
                const rawOptions = getRowVal(row, ['options', 'opsi', 'pilihan', 'pilihanganda']);
                if (rawOptions) {
                  if (typeof rawOptions === 'string' && rawOptions.startsWith('[')) {
                    try { optionsJson = JSON.parse(rawOptions); } catch { optionsJson = rawOptions.split(',').map(s => s.trim()).filter(Boolean); }
                  } else if (typeof rawOptions === 'string') {
                    optionsJson = rawOptions.split(',').map(s => s.trim()).filter(Boolean);
                  }
                }
              }

              const program = getRowVal(row, ['program', 'programname', 'namaprogram']) || selectedExam?.institutions?.name || 'CEC';
              const programName = getRowVal(row, ['class', 'classname', 'kelas', 'namakelas']) || 'Camp';
              const level = getRowVal(row, ['level', 'tingkat', 'levelnumber']) || selectedExam?.levels?.name || '3rd Step';

              parsedQuestionsState.push({
                order: isNaN(qNo) ? (i + 1) : qNo,
                questionText: String(questionText).trim(),
                correctAnswer: String(correctAnswer).trim(),
                answerType: defaultAnswerType,
                optionsJson: optionsJson,
                program, programName, subject, level, title, week, day, type
              });
            });

            hideLoading();
            if (!parsedQuestionsState.length) {
              showToast('No valid question rows found in Excel file.', 'warning');
              return;
            }

            renderPreviewTable();
            document.getElementById('import-preview-container').classList.remove('hidden');
          } catch(err) {
            hideLoading();
            showToast(`Error parsing file: ${err.message}`, 'error');
          }
        };

        reader.readAsArrayBuffer(file);
      });

      function renderPreviewTable() {
        const tbody = document.getElementById('tbl-import-preview');

        // Build simple <thead> focusing only on NO, QUESTION, ANSWER
        const theadContainer = document.querySelector('#import-preview-container table thead');
        if (theadContainer) {
          theadContainer.innerHTML = `
            <tr>
              <th style="width:10%;" class="text-center">NO</th>
              <th style="width:60%;">QUESTION</th>
              <th style="width:30%;">ANSWER</th>
            </tr>
          `;
        }

        const tableElem = document.querySelector('#import-preview-container table');
        if (tableElem) {
          tableElem.style.minWidth = '500px';
          tableElem.style.width = '100%';
        }

        tbody.innerHTML = '';

        const LIMIT = 50;
        parsedQuestionsState.forEach((item, idx) => {
          if (idx < LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
              <td class="text-muted fw-700 text-center" style="font-size:0.8rem;">${item.order}</td>
              <td class="fw-600" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem; max-width:200px;" title="${escapeHtml(item.questionText)}">${escapeHtml(item.questionText)}</td>
              <td class="text-success fw-700" style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.8rem; max-width:100px;" title="${escapeHtml(item.correctAnswer)}">${escapeHtml(item.correctAnswer)}</td>
            `;
            tbody.appendChild(tr);
          } else if (idx === LIMIT) {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td colspan="3" class="text-center text-muted fw-600 py-3" style="font-size: 0.85rem;">... and ${parsedQuestionsState.length - LIMIT} more rows.</td>`;
            tbody.appendChild(tr);
          }
        });

        document.getElementById('preview-count-label').textContent = `${parsedQuestionsState.length} questions siap di-import.`;
      }

      // Batch apply global answer type
      document.getElementById('apply-global-answer-type')?.addEventListener('click', () => {
        const val = document.getElementById('global-answer-type-select').value;
        parsedQuestionsState.forEach(q => { q.answerType = val; });
        renderPreviewTable();
        showToast(`Set all questions answer type to ${val.replace('_',' ')}`, 'info');
      });

      document.getElementById('cancel-import-btn')?.addEventListener('click', () => {
        document.getElementById('import-preview-container').classList.add('hidden');
        document.getElementById('import-questions-file').value = '';
        parsedQuestionsState = [];
      });

      document.getElementById('confirm-save-import-btn')?.addEventListener('click', async () => {
        const examId = document.getElementById('import-exam-select').value;
        if (!examId) { showToast('Please select a target exam before saving.', 'warning'); return; }
        if (!parsedQuestionsState.length) { showToast('No questions to save.', 'warning'); return; }

        showLoading('Menyimpan & merge questions ke databaseâ€¦');
        try {
          const sb = await getSupabase();
          const { data: secs } = await sb.from('exam_sections').select('id').eq('exam_id', examId).order('section_order').limit(1);
          if (!secs || !secs.length) { hideLoading(); showToast('No sections found in this exam.', 'error'); return; }
          const defaultSectionId = secs[0].id;

          const existingQuestions = await adminFetchAll('questions', '*', { section_id: defaultSectionId });
          const orderMap = new Map();
          const textMap = new Map();
          existingQuestions.forEach(q => {
            if (q.question_order != null) orderMap.set(Number(q.question_order), q);
            if (q.question_text) textMap.set(q.question_text.toLowerCase().trim(), q);
          });

          let insertedCount = 0;
          let mergedCount = 0;

          // Resolve duplicate 'order' numbers within the uploaded batch (common copy-paste error)
          const batchMap = new Map();
          const batchUsedOrders = new Set();
          
          parsedQuestionsState.forEach(q => {
            let safeOrder = q.order != null ? Number(q.order) : 1;
            // If this order number is already used by another question in this upload, auto-increment it
            while (batchUsedOrders.has(safeOrder)) {
              safeOrder++;
            }
            batchUsedOrders.add(safeOrder);
            q.order = safeOrder; // Update the order to the safe, unique order
            
            // Now safely use order as the batch key without risk of overwriting
            const key = `order::${q.order}`;
            batchMap.set(key, q);
          });

          for (const q of batchMap.values()) {
            const payload = {
              section_id: defaultSectionId,
              question_order: q.order,
              question_text: q.questionText,
              correct_answer: q.correctAnswer,
              answer_type: q.answerType,
              options_json: q.optionsJson,
              metadata: { subject: q.subject, title: q.title, week: q.week, day: q.day, type: q.type },
              updated_at: new Date().toISOString()
            };

            const existing = (q.order != null ? orderMap.get(Number(q.order)) : null) || textMap.get(q.questionText.toLowerCase().trim());
            if (existing) {
              await adminUpdate('questions', existing.id, payload);
              mergedCount++;
            } else {
              await adminInsert('questions', payload);
              insertedCount++;
            }
          }

          hideLoading();
          showToast(`Successfully saved ${insertedCount + mergedCount} questions (${insertedCount} new, ${mergedCount} merged/updated)!`, 'success');
          
          // Reset view but stay on the page as requested
          document.getElementById('import-preview-container').classList.add('hidden');
          document.getElementById('import-questions-file').value = '';
          parsedQuestionsState = [];
          
        } catch(err) {
          hideLoading();
          showToast(`Save error: ${err.message}`, 'error');
        }
      });
    }

    async function renderExportQuestions(area) {
      const exams = await adminFetchAll('exams', '*, institutions(name), subjects(name), levels(name)');
      area.innerHTML = `
        <div class="section-header"><div><h2 class="section-title">Export Questions (Excel)</h2></div></div>
        <div class="glass-card p-8" style="max-width:640px;">
          <p class="text-muted mb-4">Export questions from an exam into an Excel workbook formatted with standard columns:</p>
          <div class="mb-5 p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);font-size:0.75rem;font-family:monospace;">
            PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER
          </div>
          <div class="form-group"><label class="form-label">Select Exam to Export</label>
            <select class="form-control" id="export-exam-select">
              <option value="">â€” Select Exam â€”</option>
              ${[...exams].sort((a, b) => {
                const labelA = `${a.exam_type ? a.exam_type + ' - ' : ''}${a.exam_title}`;
                const labelB = `${b.exam_type ? b.exam_type + ' - ' : ''}${b.exam_title}`;
                return labelA.localeCompare(labelB);
              }).map(e => `<option value="${e.id}">${e.exam_type ? e.exam_type + ' - ' : ''}${e.exam_title}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary mt-2" id="export-questions-btn">ðŸ“¤ Download Excel (.xlsx)</button>
        </div>
      `;

      document.getElementById('export-questions-btn').addEventListener('click', async () => {
        const examId = document.getElementById('export-exam-select').value;
        if (!examId) { showToast('Please select an exam to export.', 'warning'); return; }

        const selectedExam = exams.find(e => e.id === examId);
        showLoading('Preparing Excel exportâ€¦');

        try {
          const sb = await getSupabase();
          const { data: sections } = await sb.from('exam_sections').select('id').eq('exam_id', examId);
          const sectionIds = (sections || []).map(s => s.id);
          const [qRes, examClasses] = await Promise.all([
            sb.from('questions').select('*').in('section_id', sectionIds),
            sb.from('exam_programs').select('programs(name)').eq('exam_id', examId)
          ]);
          const questions = qRes.data || [];

          const sortedQuestions = questions.sort((a,b) => (a.question_order || 0) - (b.question_order || 0));
          const programName = examClasses?.data?.[0]?.programs?.name || 'Camp';

          const excelData = sortedQuestions.map((q, idx) => ({
            'PROGRAM': selectedExam?.institutions?.name || 'CEC',
            'CLASS': programName,
            'SUBJECT': q.metadata?.subject || selectedExam?.subjects?.name || 'Vocab',
            'LEVEL': selectedExam?.levels?.name || '3rd Step',
            'TITLE': q.metadata?.title || selectedExam?.exam_title || 'Practice 1',
            'WEEK': q.metadata?.week || '1',
            'DAY': q.metadata?.day || '1',
            'TYPE': q.metadata?.type || selectedExam?.exam_type || '1 - VERB',
            'NO': q.question_order || (idx + 1),
            'QUESTION': q.question_text || '',
            'ANSWER': q.correct_answer || ''
          }));

          if (!excelData.length) {
            hideLoading();
            showToast('No questions found for this exam.', 'warning');
            return;
          }

          const worksheet = XLSX.utils.json_to_sheet(excelData, {
            header: ['PROGRAM', 'CLASS', 'SUBJECT', 'LEVEL', 'TITLE', 'WEEK', 'DAY', 'TYPE', 'NO', 'QUESTION', 'ANSWER']
          });

          // Set column widths
          worksheet['!cols'] = [
            { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 6 }, { wch: 35 }, { wch: 25 }
          ];

          const workbook = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(workbook, worksheet, 'Questions');

          const fileName = `${(selectedExam?.exam_title || 'Exam').replace(/\s+/g, '_')}_Questions.xlsx`;
          XLSX.writeFile(workbook, fileName);

          hideLoading();
          showToast(`Exported ${excelData.length} questions to ${fileName}`, 'success');
        } catch(err) {
          hideLoading();
          showToast(`Export error: ${err.message}`, 'error');
        }
      });
    }

    // â”€â”€ CRUD Modal â”€â”€
    const crudModal = document.getElementById('crud-modal');
    const crudForm  = document.getElementById('crud-form');
    let _editId = null;

    const formFields = {
      institutions: [
        { id: 'name', label: 'Institution Name', type: 'text', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      subjects: [
        { id: 'name', label: 'Subject Name', type: 'text', required: true },
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      levels: [
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true, uiOnly: true },
        { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: false, dependsOn: 'institution_id' },
        { id: 'subject_id', label: 'Subject', type: 'select', source: 'subjects', required: true, dependsOn: 'institution_id' },
        { id: 'level_number', label: 'Level Number', type: 'number', required: true, placeholder: 'e.g. 1' },
        { id: 'name', label: 'Level Name', type: 'text', required: true, placeholder: 'e.g. Level 1 - Beginner' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      programs: [
        { id: 'name', label: 'Program Name', type: 'text', required: true },
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      batches: [
        { id: 'institution_id', label: 'Program (filter only)', type: 'select', source: 'institutions', required: false, uiOnly: true },
        { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: true, dependsOn: 'institution_id' },
        { id: 'name', label: 'Batch Name', type: 'text', required: true, placeholder: 'e.g. Batch 2026-A' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      students: [
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: true, dependsOn: 'institution_id' },
        { id: 'batch_id', label: 'Batch', type: 'select', source: 'batches', required: false, dependsOn: 'program_id' },
        
        { id: 'name', label: 'Full Name', type: 'text', required: true },
        { id: 'gender', label: 'Gender', type: 'select', options: [
          { value: '', label: 'â€” Unassigned (Student will choose) â€”' },
          { value: 'male', label: 'Male (Mr.)' },
          { value: 'female', label: 'Female (Miss)' }
        ]},
        { id: 'birth_date', label: 'Birth Date', type: 'date' },
        { id: 'pin_hash', label: 'PIN (4 digits)', type: 'password', placeholder: '****' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      exams: [
        { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
        { id: 'program_id', label: 'Class (Optional / Assigned)', type: 'select', source: 'programs', required: false, dependsOn: 'institution_id' },
        { id: 'subject_id', label: 'Subject', type: 'select', source: 'subjects', required: false, dependsOn: 'institution_id' },
        { id: 'exam_type', label: 'Exam Type', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Final'], required: true, defaultValue: 'Daily' },
        
        { id: 'exam_order', label: 'Order (1, 2, 3...)', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10'], required: true, defaultValue: '1' },
        { id: 'exam_title', label: 'Exam Title (Auto-Generated)', type: 'text', required: true, placeholder: 'Auto-generated as: [Program] [Class] [Subject] [Type] [Level] [Order]' },
        { id: 'prerequisite_exam_id', label: 'Prerequisite Exam (Optional)', type: 'select', source: 'exams', required: false },
        { id: 'minimum_required_score', label: 'Passing Score % (Default: 60%)', type: 'number', required: true, defaultValue: 60 },
        { id: 'prerequisite_min_score', label: 'Prerequisite Min % (Default: 60%)', type: 'number', required: false, defaultValue: 60 },
        { id: 'time_limit_minutes', label: 'Global Time Limit (minutes)', type: 'number', required: true, defaultValue: 60 },
        { id: 'exam_status', label: 'Exam Status', type: 'select', options: ['published','draft','unpublished','archived'], required: true },
        { id: 'question_order', label: 'Question Order', type: 'select', options: [{ value: 'sequential', label: 'Sequential' }, { value: 'random', label: 'Random' }], required: true },
        { id: 'retake_allowed', label: 'Retake Allowed', type: 'checkbox' },
        { id: 'max_attempts', label: 'Max Attempts (blank = unlimited)', type: 'number' },
      ],
      questions: [
        { id: 'question_text', label: 'Question Text', type: 'textarea', required: true },
        { id: 'question_order', label: 'Order', type: 'number', required: true },
        { id: 'section_id', label: 'Section', type: 'select', source: 'exam_sections', required: true },
        { id: 'answer_type', label: 'Answer Type', type: 'select', options: [
          {value:'multiple_choice',label:'Multiple Choice'},
          {value:'dropdown',label:'Dropdown'},
          {value:'speech_to_text',label:'Speaking Test'},
          {value:'written',label:'Written Test'}
        ], required: true },
        { id: 'correct_answer', label: 'Correct Answer', type: 'text', required: true, placeholder: 'e.g. run / jog / sprint  (use / ; or | to separate multiple accepted answers)' },
        { id: 'options_json', label: 'Options (separated by / ; or JSON array)', type: 'textarea', placeholder: 'e.g. Option A / Option B / Option C  (use / or ; to separate choices)' },
        { id: 'metadata', label: 'Metadata / Word Type', type: 'text', placeholder: 'e.g. 1 - VERB' },
      ],
    };

    async function openCrudModal(section, record) {
      _currentSection = section;
      _editId = record?.id || null;
      document.getElementById('crud-modal-title').textContent = record ? `Edit ${sectionTitles[section]}` : `Add ${sectionTitles[section]}`;

      crudForm.innerHTML = '';
      const fields = formFields[section];
      if (!fields) {
        crudForm.innerHTML = `<p class="text-muted">Form for "${section}" not yet configured.</p>`;
        crudModal.classList.remove('hidden');
        return;
      }

      const formGrid = document.createElement('div');
      formGrid.className = 'form-grid';

      for (const f of fields) {
        const group = document.createElement('div');
        const isFull = ['exam_title', 'question_text', 'options_json', 'name'].includes(f.id) || f.type === 'textarea';
        group.className = `form-group ${isFull ? 'form-group-full' : ''}`;

        const label = document.createElement('label');
        label.className = 'form-label';
        label.setAttribute('for', `field-${f.id}`);
        label.textContent = f.label;
        group.appendChild(label);

        if (f.type === 'select' && f.source) {
          const sel = document.createElement('select');
          sel.className = 'form-control';
          sel.id = `field-${f.id}`;
          sel.name = f.id;
          if (f.required) sel.required = true;
          if (f.id === 'prerequisite_exam_id') {
            sel.innerHTML = `<option value="">None (Optional)</option>`;
            sel.disabled = false;

            sel.innerHTML = `<option value="">â€” No Level / Optional â€”</option>`;
            sel.disabled = false;
          } else if (!f.dependsOn) {
            sel.innerHTML = `<option value="">â€” Select â€”</option>`;
            const opts = await adminFetchAll(f.source);
            opts.forEach(o => {
              const opt = document.createElement('option');
              opt.value = o.id;
              opt.textContent = o.name || o.title || o.exam_title || o.id;
              if (record && record[f.id] === o.id) opt.selected = true;
              sel.appendChild(opt);
            });
          } else {
            sel.innerHTML = `<option value="">â€” Select Previous First â€”</option>`;
            sel.disabled = true;
          }
          group.appendChild(sel);
        } else if (f.type === 'select' && f.options) {
          const sel = document.createElement('select');
          sel.className = 'form-control';
          sel.id = `field-${f.id}`;
          sel.name = f.id;
          if (f.required) sel.required = true;
          sel.innerHTML = `<option value="">â€” Select â€”</option>` + f.options.map(o => {
            const val = typeof o === 'object' ? o.value : o;
            const labelStr = typeof o === 'object' ? o.label : o;
            const isSelected = record?.[f.id] === val || (!record && val === 'sequential');
            return `<option value="${val}" ${isSelected ? 'selected' : ''}>${labelStr}</option>`;
          }).join('');
          group.appendChild(sel);
        } else if (f.type === 'textarea') {
          const ta = document.createElement('textarea');
          ta.className = 'form-control';
          ta.id = `field-${f.id}`;
          ta.name = f.id;
          ta.rows = 2;
          if (f.required) ta.required = true;
          if (f.placeholder) ta.placeholder = f.placeholder;
          if (record?.[f.id]) ta.value = typeof record[f.id] === 'object' ? JSON.stringify(record[f.id]) : record[f.id];
          group.appendChild(ta);
        } else if (f.type === 'checkbox') {
          const wrap = document.createElement('div');
          wrap.className = 'd-flex align-center gap-3 mt-1';
          const inp = document.createElement('input');
          inp.type = 'checkbox';
          inp.id = `field-${f.id}`;
          inp.name = f.id;
          inp.style.width = '18px';
          inp.style.height = '18px';
          inp.style.cursor = 'pointer';
          if (record ? record[f.id] : true) inp.checked = true;
          wrap.appendChild(inp);
          group.appendChild(wrap);
        } else {
          const inp = document.createElement('input');
          inp.className = 'form-control';
          inp.type = f.type || 'text';
          inp.id = `field-${f.id}`;
          inp.name = f.id;
          if (f.required) inp.required = true;
          if (f.placeholder) inp.placeholder = f.placeholder;
          if (record?.[f.id] !== undefined) inp.value = record[f.id];
          else if (f.defaultValue !== undefined) inp.value = f.defaultValue;
          group.appendChild(inp);
        }

        formGrid.appendChild(group);
      }

      crudForm.appendChild(formGrid);

      const progSelect = crudForm.querySelector('#field-institution_id');
      const classSelect = crudForm.querySelector('#field-program_id');
      const batchSelect = crudForm.querySelector('#field-batch_id');
      const subjectSelect = crudForm.querySelector('#field-subject_id');

      if (prereqSelect) {
        prereqSelect.disabled = false;
        const isNoneSelected = !record || !record.prerequisite_exam_id;
        prereqSelect.innerHTML = `<option value="" ${isNoneSelected ? 'selected' : ''}>None (Optional)</option>`;
        const allExams = await adminFetchAll('exams');
        const eligible = allExams.filter(e => !e.deleted_at && e.id !== _editId);
        eligible.sort((a, b) => (a.exam_title || '').localeCompare(b.exam_title || '')).forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id;
          opt.textContent = e.exam_title || e.display_name || e.id;
          if (record && record.prerequisite_exam_id === e.id) opt.selected = true;
          prereqSelect.appendChild(opt);
        });
        updatePrereqRequirement();
      }

      let _titleManuallyEdited = Boolean(_editId && record?.exam_title);
      const triggerAutoTitle = () => {
        if (_titleManuallyEdited || !titleInput || _currentSection !== 'exams') return;
        const pText = progSelect && progSelect.selectedIndex > 0 ? progSelect.options[progSelect.selectedIndex].textContent.trim() : '';
        const cText = classSelect && classSelect.selectedIndex > 0 ? classSelect.options[classSelect.selectedIndex].textContent.trim() : '';
        const sText = subjectSelect && subjectSelect.selectedIndex > 0 ? subjectSelect.options[subjectSelect.selectedIndex].textContent.trim() : '';
        const typeText = examTypeInput ? examTypeInput.value.trim() : '';
        const selectedLvlOpt = levelSelect && levelSelect.selectedIndex > 0 ? levelSelect.options[levelSelect.selectedIndex] : null;
        const lvlText = selectedLvlOpt ? (selectedLvlOpt.getAttribute('data-level-letter') || selectedLvlOpt.textContent.trim()) : '';
        const ordText = orderSelect ? orderSelect.value.trim() : '';

        const parts = [pText, cText, sText, typeText, lvlText, ordText].filter(Boolean);
        if (parts.length > 0) {
          titleInput.value = parts.join(' ');
        }
      };

      if (titleInput && _currentSection === 'exams') {
        titleInput.addEventListener('input', () => {
          _titleManuallyEdited = true;
        });
      }

      const populateLevelsForSection = async () => {
        if (!levelSelect) return;
        levelSelect.innerHTML = `<option value="">â€” No Level / Optional â€”</option>`;
        levelSelect.disabled = false;

        try {
          const allLevels = await adminFetchAll('levels');
          let activeLevels = allLevels.filter(l => !l.deleted_at);

          const selSubjId = subjectSelect ? subjectSelect.value : null;
          if (selSubjId) {
            const subjectSpecific = activeLevels.filter(l => l.subject_id === selSubjId);
            if (subjectSpecific.length > 0) {
              activeLevels = subjectSpecific;
            }
          }

          const seen = new Set();
          activeLevels.sort((a, b) => (Number(a.level_number) || 0) - (Number(b.level_number) || 0)).forEach(l => {
            if (!seen.has(l.id)) {
              seen.add(l.id);
              const opt = document.createElement('option');
              opt.value = l.id;
              const letter = toLevelLetter(l.level_number);
              const displayName = l.name ? (l.name.toLowerCase().includes('level') ? l.name : `Level ${letter} (${l.name})`) : `Level ${letter}`;
              opt.textContent = displayName;
              opt.setAttribute('data-level-letter', letter);
              opt.setAttribute('data-level-num', l.level_number);

              levelSelect.appendChild(opt);
            }
          });
        } catch (lvlErr) {
          console.warn('Level population notice:', lvlErr);
        }

        updatePrereqRequirement();
        triggerAutoTitle();
      };

      if (progSelect && classSelect) {
        const populateBatchesForClass = async (selectedClassId) => {
          if (!batchSelect) return;
          batchSelect.innerHTML = `<option value="">â€” Select Batch â€”</option>`;
          if (!selectedClassId) {
            batchSelect.disabled = true;
            batchSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
            return;
          }
          batchSelect.disabled = false;
          const allBatches = await adminFetchAll('batches');
          const filteredBatches = allBatches.filter(b => b.program_id === selectedClassId && !b.deleted_at);
          filteredBatches.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            if (record && record.batch_id === b.id) opt.selected = true;
            batchSelect.appendChild(opt);
          });
        };

        const populateClassesForProgram = async (selectedProgId) => {
          classSelect.innerHTML = `<option value="">${_currentSection === 'levels' ? 'â€” Select Program (Optional / All Programs) â€”' : 'â€” Select Program â€”'}</option>`;
          if (batchSelect) {
            batchSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
            batchSelect.disabled = true;
          }
          if (!selectedProgId) {
            classSelect.disabled = true;
            return;
          }
          classSelect.disabled = false;
          const allClasses = await adminFetchAll('programs');
          const filteredClasses = allClasses.filter(c => c.institution_id === selectedProgId && !c.deleted_at);
          filteredClasses.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (record && record.program_id === c.id) opt.selected = true;
            classSelect.appendChild(opt);
          });
          if (classSelect.value) {
            await populateBatchesForClass(classSelect.value);
          }
          await populateLevelsForSection();
          triggerAutoTitle();
        };

        const initialProgId = record?.institution_id || (record?.programs?.institution_id) || (record?.subjects?.institution_id) || progSelect.value;
        if (initialProgId) {
          progSelect.value = initialProgId;
          await populateClassesForProgram(initialProgId);
          if (record?.program_id) {
            classSelect.value = record.program_id;
            await populateBatchesForClass(record.program_id);
            if (record?.batch_id && batchSelect) {
              batchSelect.value = record.batch_id;
            }
          }
        } else {
          classSelect.disabled = true;
          classSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
        }

        progSelect.addEventListener('change', async (e) => {
          await populateClassesForProgram(e.target.value);
        });
        classSelect.addEventListener('change', async (e) => {
          if (typeof populateBatchesForClass === 'function') {
            await populateBatchesForClass(e.target.value);
          }
          await populateLevelsForSection();
          triggerAutoTitle();
        });
      }

      // Program -> Subject -> Level cascading dependencies
      if (progSelect && subjectSelect) {
        const populateSubjectsForProgram = async (selectedProgId) => {
          subjectSelect.innerHTML = `<option value="">â€” Select Subject â€”</option>`;
          if (!selectedProgId) {
            subjectSelect.disabled = true;
            return;
          }
          subjectSelect.disabled = false;
          const allSubjects = await adminFetchAll('subjects');
          const filteredSubjects = allSubjects.filter(s => s.institution_id === selectedProgId && !s.deleted_at);
          filteredSubjects.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (record && record.subject_id === s.id) opt.selected = true;
            subjectSelect.appendChild(opt);
          });
          await populateLevelsForSection();
          triggerAutoTitle();
        };

        const initialProgIdForSubject = record?.institution_id || (record?.subjects?.institution_id) || progSelect?.value;
        if (initialProgIdForSubject) {
          await populateSubjectsForProgram(initialProgIdForSubject);
        } else {
          subjectSelect.disabled = true;
          subjectSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
        }

        progSelect.addEventListener('change', async (e) => {
          await populateSubjectsForProgram(e.target.value);
        });
        subjectSelect.addEventListener('change', async () => {
          await populateLevelsForSection();
          triggerAutoTitle();
        });
      }

      if (levelSelect) {
        levelSelect.addEventListener('change', () => {
          updatePrereqRequirement();
          triggerAutoTitle();
        });
      }
      if (orderSelect) {
        orderSelect.addEventListener('change', () => {
          updatePrereqRequirement();
          triggerAutoTitle();
        });
      }
      if (examTypeInput) {
        examTypeInput.addEventListener('change', triggerAutoTitle);
        examTypeInput.addEventListener('input', triggerAutoTitle);
      }


      crudModal.classList.remove('hidden');
    }

    crudForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fields = formFields[_currentSection];
      if (!fields) return;

      const payload = {};
      for (const f of fields) {
        if (f.uiOnly) continue; // Skip UI-only fields (e.g. program filter for levels)
        const el = document.getElementById(`field-${f.id}`);
        if (!el) continue;
        if (f.type === 'checkbox') payload[f.id] = el.checked;
        else if (f.type === 'number') payload[f.id] = el.value ? parseFloat(el.value) : null;
        else if (f.id === 'options_json') {
          if (!el.value || !el.value.trim()) {
            payload[f.id] = null;
          } else {
            const raw = el.value.trim();
            if (raw.startsWith('[') && raw.endsWith(']')) {
              try {
                payload[f.id] = JSON.parse(raw);
              } catch {
                if (/[;/|]/.test(raw)) {
                  payload[f.id] = raw.replace(/^[\[\]"']+|[\[\]"']+$/g, '').split(/[;/|]/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
                } else {
                  payload[f.id] = raw.replace(/^[\[\]"']+|[\[\]"']+$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
                }
              }
            } else if (/[;/|]/.test(raw)) {
              payload[f.id] = raw.split(/[;/|]/).map(s => s.trim()).filter(Boolean);
            } else if (raw.includes(',')) {
              payload[f.id] = raw.split(',').map(s => s.trim()).filter(Boolean);
            } else {
              payload[f.id] = [raw];
            }
          }
        }
        else if (f.type === 'password' && _editId && !el.value) continue; // Don't overwrite PIN if empty on edit
        else if (f.type === 'password' && el.value) {
          payload[f.id] = await hashPin(el.value);
        }
        else payload[f.id] = el.value || null;
      }

      // Prerequisite Exam Validation: Must fill if level and order are not Level A and Order 1
      if (_currentSection === 'exams') {
        // Prerequisite logic handled in Assessment Builder
      }

      // Never send display_name (Postgres GENERATED ALWAYS STORED column causes 428C9)
      delete payload.display_name;

      const targetTable = _currentSection.replace('-', '_');
      if (_currentSection === 'students' && payload.name) {
        payload.name = formatStudentName(payload.name, payload.gender);
      }
      try {
        let payloadToSave = { ...payload };
        if (_editId) {
          try {
            await adminUpdate(targetTable, _editId, payloadToSave);
          } catch (err) {
            if (targetTable === 'levels' && payloadToSave.program_id && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
              delete payloadToSave.program_id;
              await adminUpdate(targetTable, _editId, payloadToSave);
            } else if (targetTable === 'exams') {
              let retried = false;
              if ('program_id' in payloadToSave && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.program_id;
                retried = true;
              }
              if ('prerequisite_exam_id' in payloadToSave && (err.message?.includes('prerequisite') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.prerequisite_exam_id;
                retried = true;
              }
              if ('exam_order' in payloadToSave && (err.message?.includes('order') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.exam_order;
                retried = true;
              }
              if (retried) {
                await adminUpdate(targetTable, _editId, payloadToSave);
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
          showToast('Record updated.', 'success');
        } else {
          // If manually adding a student, check if identical student already exists in same class
          if (_currentSection === 'students') {
            const existingList = await adminFetchAll('students');
            const existingMatch = existingList.find(s => !s.deleted_at && s.program_id === payload.program_id && (formatStudentName(s.name, s.gender) || '').toLowerCase().trim() === (payload.name || '').toLowerCase().trim());
            if (existingMatch) {
              await adminUpdate('students', existingMatch.id, { ...payload, updated_at: new Date().toISOString() });
              showToast('A student with this name already exists in the class. Data successfully merged/updated!', 'success');
              crudModal.classList.add('hidden');
              loadSection('students');
              return;
            }
          }
          try {
            await adminInsert(targetTable, payloadToSave);
          } catch (err) {
            if (targetTable === 'levels' && payloadToSave.program_id && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
              delete payloadToSave.program_id;
              await adminInsert(targetTable, payloadToSave);
            } else if (targetTable === 'exams') {
              let retried = false;
              if ('program_id' in payloadToSave && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.program_id;
                retried = true;
              }
              if ('prerequisite_exam_id' in payloadToSave && (err.message?.includes('prerequisite') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.prerequisite_exam_id;
                retried = true;
              }
              if ('exam_order' in payloadToSave && (err.message?.includes('order') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.exam_order;
                retried = true;
              }
              if (retried) {
                await adminInsert(targetTable, payloadToSave);
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
          showToast('Record added.', 'success');
        }
        crudModal.classList.add('hidden');
        loadSection(_currentSection);
      } catch(e) {
        showToast('Save failed: ' + e.message, 'error');
      }
    });

    async function hashPin(pin) {
      // Simple SHA-256 hash for display â€” use server-side bcrypt in production
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
      return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
    }

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
        loadSection(_deleteSection);
      } catch(e) { showToast(e.message, 'error'); }
    });

    // Modal close handlers
    ['close-crud-modal','crud-cancel-btn'].forEach(id => document.getElementById(id).addEventListener('click', () => crudModal.classList.add('hidden')));
    ['delete-cancel-btn'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden')));

    // --- DUPLICATE STUDENTS MODAL LOGIC ---
    const dupStudModal = document.getElementById('duplicate-students-modal');
    const dupStudContent = document.getElementById('dup-students-content');
    let currentDupStudScope = 'same_class';
    let dupStudentGroups = [];

    async function openDuplicateStudentsModal() {
      dupStudModal.classList.remove('hidden');
      await loadDuplicateStudents(currentDupStudScope);
    }

    document.getElementById('close-dup-students-modal')?.addEventListener('click', () => {
      dupStudModal.classList.add('hidden');
      loadSection('students'); // Refresh list when closed
    });

    document.querySelectorAll('.dup-stud-tab-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.dup-stud-tab-btn').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        const target = e.currentTarget;
        target.classList.remove('btn-secondary');
        target.classList.add('btn-primary');
        currentDupStudScope = target.dataset.scope;
        await loadDuplicateStudents(currentDupStudScope);
      });
    });

    async function loadDuplicateStudents(scope) {
      dupStudContent.innerHTML = '<div class="empty-state p-6 text-center"><div class="spinner"></div><p>Scanning for duplicates...</p></div>';
      try {
        const duplicateGroups = await detectDuplicateStudents(scope);
        dupStudentGroups = duplicateGroups;
        
        // Update counters
        const totalDups = duplicateGroups.reduce((acc, g) => acc + (g.candidates.length - 1), 0);
        if (scope === 'same_class') document.getElementById('dup-stud-same-count').textContent = totalDups;
        else document.getElementById('dup-stud-cross-count').textContent = totalDups;

        if (dupStudentGroups.length === 0) {
          dupStudContent.innerHTML = '<div class="empty-state p-6 text-center"><p>âœ… No duplicate students found.</p></div>';
          return;
        }

        let html = '';
        dupStudentGroups.forEach((group, gIdx) => {
          html += `
            <div class="card p-4 mb-4" style="border-left:4px solid var(--clr-primary);">
              <div class="fw-700 mb-2">Duplicate Group ${gIdx + 1} â€” Name: "${escapeHtml(group.name)}"</div>
              <table class="table-sm w-100 mb-3 text-sm">
                <thead>
                  <tr>
                    <th>Student Info</th>
                    <th>Demographics</th>
                    <th>Academic History</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
          `;
          group.candidates.forEach((student, sIdx) => {
            html += `
                  <tr style="${sIdx === 0 ? 'background:rgba(74, 222, 128, 0.1);' : ''}">
                    <td>${student.id.substring(0,8)}...</td>
                    <td>${escapeHtml(student.programs?.name || '-')}</td>
                    <td>${escapeHtml(student.institutions?.name || '-')}</td>
                    <td>${new Date(student.created_at).toLocaleString()}</td>
                    <td>${sIdx === 0 ? '<span class="badge badge-success">Primary Target</span>' : `<button class="btn btn-warning btn-sm btn-merge-student" data-primary="${group.recommendedPrimaryId}" data-secondary="${student.id}">Merge to Primary</button>`}</td>
                  </tr>
            `;
          });
          html += `
                </tbody>
              </table>
            </div>
          `;
        });
        dupStudContent.innerHTML = html;

        // Attach merge listeners
        document.querySelectorAll('.btn-merge-student').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const primaryId = e.currentTarget.dataset.primary;
            const secondaryId = e.currentTarget.dataset.secondary;
            if(!confirm('Merge this student into the primary? All exam attempts and progress will be transferred, and this duplicate profile will be soft-deleted. This cannot be undone.')) return;
            
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<div class="spinner" style="width:12px;height:12px;"></div>';
            try {
              const res = await mergeStudentPair(primaryId, secondaryId);
              showToast(`Successfully merged student! Transferred ${res.transferredAttempts || 0} attempts and ${res.transferredProgress || 0} progress records.`, 'success');
              await loadDuplicateStudents(currentDupStudScope); // Refresh
            } catch(err) {
              showToast(`Merge failed: ${err.message}`, 'error');
              e.currentTarget.disabled = false;
              e.currentTarget.textContent = 'Merge to Primary';
            }
          });
        });

      } catch(err) {
        dupStudContent.innerHTML = `<div class="empty-state p-6 text-center text-danger"><p>Error loading duplicates: ${err.message}</p></div>`;
      }
    }

    document.getElementById('btn-merge-all-visible-students')?.addEventListener('click', async () => {
      if (dupStudentGroups.length === 0) return;
      if (!confirm(`Are you sure you want to quick-merge ALL ${dupStudentGroups.length} visible groups into their respective primary profiles?`)) return;
      
      showLoading('Batch merging duplicate students...');
      try {
        let successCount = 0;
        for (const group of dupStudentGroups) {
          const primaryId = group[0].id;
          for (let i = 1; i < group.length; i++) {
            await mergeStudentPair(primaryId, group[i].id);
            successCount++;
          }
        }
        hideLoading();
        showToast(`Successfully processed batch merge (${successCount} records merged).`, 'success');
        await loadDuplicateStudents(currentDupStudScope);
      } catch (err) {
        hideLoading();
        showToast(`Batch merge interrupted: ${err.message}`, 'error');
        await loadDuplicateStudents(currentDupStudScope);
      }
    });

    // --- DUPLICATE QUESTIONS MODAL LOGIC ---
    const dupQModal = document.getElementById('duplicate-questions-modal');
    const dupQContent = document.getElementById('dup-questions-content');
    const dupQExamSelect = document.getElementById('dup-q-exam-select');

    async function openDuplicateQuestionsModal() {
      dupQModal.classList.remove('hidden');
      
      // Populate exam select
      try {
        const exams = await adminFetchAll('exams', 'id, exam_title, exam_status');
        const sortedExams = exams.sort((a, b) => a.exam_title.localeCompare(b.exam_title));
        dupQExamSelect.innerHTML = '<option value="">â€” All Exams (Global Search) â€”</option>' + 
          sortedExams.map(e => `<option value="${e.id}">${escapeHtml(e.exam_title)} (${e.exam_status})</option>`).join('');
      } catch(e) { console.error("Could not load exams for duplicate select:", e); }
        
      await loadDuplicateQuestions();
    }

    document.getElementById('close-dup-questions-modal')?.addEventListener('click', () => {
      dupQModal.classList.add('hidden');
    });

    dupQExamSelect?.addEventListener('change', () => loadDuplicateQuestions());

    async function loadDuplicateQuestions() {
      dupQContent.innerHTML = '<div class="empty-state p-6 text-center"><div class="spinner"></div><p>Scanning for duplicate questions...</p></div>';
      try {
        const examId = dupQExamSelect.value || null;
        const data = await detectDuplicateQuestions(examId);
        
        document.getElementById('dup-q-same-count').textContent = data.totalSameExamDupCount;

        if (data.sameExamDuplicates.length === 0) {
          dupQContent.innerHTML = '<div class="empty-state p-6 text-center"><p>âœ… No duplicate questions found.</p></div>';
          return;
        }

        let html = '';
        data.sameExamDuplicates.forEach((group, gIdx) => {
          // Group by exam
          const examTitle = group.examTitle || 'Unknown Exam';
          const primaryQ = group.candidates[0];
          
          let optsDisplay = '';
          if (primaryQ.options_json) {
            try {
              const opts = typeof primaryQ.options_json === 'string' ? JSON.parse(primaryQ.options_json) : primaryQ.options_json;
              optsDisplay = Array.isArray(opts) ? opts.join(' | ') : String(primaryQ.options_json);
            } catch(e) {
              optsDisplay = String(primaryQ.options_json);
            }
          }

          html += `
            <div class="card p-4 mb-4" style="border-left:4px solid var(--clr-warning);">
              <div class="d-flex justify-between align-center mb-2 flex-wrap gap-2">
                <div class="fw-700">Duplicate Question in: ${escapeHtml(examTitle)}</div>
                <button class="btn btn-warning btn-sm btn-resolve-q-group" data-primary="${primaryQ.id}">Auto-Resolve Group</button>
              </div>
              <div class="text-sm mb-3 px-3 py-2 rounded" style="background:var(--clr-surface-2); border:1px solid var(--clr-border);">
                <div class="mb-2"><strong>Text:</strong> ${escapeHtml(primaryQ.question_text)}</div>
                ${optsDisplay ? `<div class="mb-2 text-muted"><strong>Options:</strong> ${escapeHtml(optsDisplay)}</div>` : ''}
                <div class="text-muted"><strong>Correct Answer:</strong> ${escapeHtml(primaryQ.correct_answer || '-')}</div>
              </div>
              <table class="table-sm w-100 text-xs">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Order</th>
                    <th>Answer Type</th>
                    <th>Answers Count</th>
                    <th>Created At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
          `;
          group.candidates.forEach((q, qIdx) => {
            html += `
                  <tr style="${qIdx === 0 ? 'background:rgba(74, 222, 128, 0.1);' : 'background:rgba(239, 68, 68, 0.05);'}">
                    <td>${q.id.substring(0,8)}...</td>
                    <td>${q.question_order}</td>
                    <td>${escapeHtml(q.answer_type)}</td>
                    <td class="fw-700 text-primary">${q.answersCount || 0}</td>
                    <td>${new Date(q.created_at).toLocaleString()}</td>
                    <td>${qIdx === 0 ? '<span class="badge badge-success">Primary (Kept)</span>' : '<span class="badge badge-error">Duplicate (Will Remove)</span>'}</td>
                  </tr>
            `;
          });
          html += `
                </tbody>
              </table>
            </div>
          `;
        });
        dupQContent.innerHTML = html;

        // Attach resolve listeners
        document.querySelectorAll('.btn-resolve-q-group').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const primaryId = e.currentTarget.dataset.primary;
            // Find the group based on primaryId
            const group = data.sameExamDuplicates.find(g => g.recommendedPrimaryId === primaryId);
            if(!group) return;
            
            if(!confirm('Resolve this duplicate question group? All student answers tied to the duplicates will be repointed to the primary question, and the duplicates will be hard-deleted. Finally, the exam questions will be re-sequenced.')) return;
            
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<div class="spinner" style="width:12px;height:12px;"></div>';
            try {
              let count = 0;
              for (let i = 1; i < group.candidates.length; i++) {
                await resolveDuplicateQuestionGroup(group.recommendedPrimaryId, group.candidates[i].id, false);
                count++;
              }
              await resequenceExamQuestions(group.examId);
              showToast(`Resolved! Repointed answers. ${count} duplicates removed.`, 'success');
              await loadDuplicateQuestions(); // Refresh
            } catch(err) {
              showToast(`Resolve failed: ${err.message}`, 'error');
              e.currentTarget.disabled = false;
              e.currentTarget.textContent = 'Auto-Resolve Group';
            }
          });
        });

      } catch(err) {
        dupQContent.innerHTML = `<div class="empty-state p-6 text-center text-danger"><p>Error loading duplicates: ${err.message}</p></div>`;
      }
    }

    document.getElementById('btn-resolve-all-visible-questions')?.addEventListener('click', async () => {
      const examId = dupQExamSelect.value || null;
      if (!examId) {
        showToast('Please select a specific Exam from the filter to perform Batch Auto-Resolve.', 'warning');
        return;
      }
      
      if (!confirm(`Are you sure you want to batch resolve ALL duplicate questions for this exam? This is irreversible.`)) return;
      
      showLoading('Batch resolving duplicate questions...');
      try {
        const res = await batchResolveExamDuplicateQuestions(examId);
        hideLoading();
        showToast(`Successfully processed exam: repointed ${res.totalRepointedAnswers} answers across ${res.groupsResolved} duplicate groups.`, 'success');
        await loadDuplicateQuestions();
      } catch (err) {
        hideLoading();
        showToast(`Batch resolve failed: ${err.message}`, 'error');
        await loadDuplicateQuestions();
      }
    });

    // Sidebar toggle for mobile
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('admin-sidebar').classList.toggle('open');
    });
    if (window.innerWidth <= 1024) document.getElementById('sidebar-toggle').style.display = 'flex';
  

w i n d o w . o p e n C r u d M o d a l   =   o p e n C r u d M o d a l ; 
 
 w i n d o w . o p e n D u p l i c a t e S t u d e n t s M o d a l   =   o p e n D u p l i c a t e S t u d e n t s M o d a l ; 
 
 w i n d o w . l o a d S e c t i o n   =   l o a d S e c t i o n ; 
 
 w i n d o w . o p e n S t u d e n t P r o f i l e   =   o p e n S t u d e n t P r o f i l e ; 
 
 
