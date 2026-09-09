
    import { adminFetchAll, adminInsert, adminUpdate, adminSoftDelete, adminHardDelete, mergeDuplicateStudents, fetchPrograms, fetchClasses, fetchBatches, formatStudentName, testSupabaseConnection } from './js/api.js';
    import { setAdminSession, getAdminSession, clearAdminSession } from './js/session.js';
    import { showToast, showLoading, hideLoading, getGrade } from './js/app.js';
    import { getSupabase } from './js/supabase.js';

    // ── Primary Tab Switching Variables ──
    const primaryTabs = document.querySelectorAll('.primary-tab');
    const mobileTabs = document.querySelectorAll('.mobile-tab');
    const domainPills = document.querySelectorAll('.domain-pill');
    const subnavs = { database: 'subnav-database', class: 'subnav-class', student: 'subnav-student', exam: 'subnav-exam' };
    const tabDefaultSections = { database: 'programs', class: 'classes', student: 'students', exam: 'exams' };

    const sectionDomainMap = {
      programs: 'database', subjects: 'database', levels: 'database', audit: 'database', settings: 'database',
      classes: 'class', batches: 'class',
      students: 'student', 'import-students': 'student', 'progress-view': 'student',
      exams: 'exam', questions: 'exam', results: 'exam',
      'import-questions': 'exam', 'export-questions': 'exam'
    };

    // ── Auth ──
    const session = getAdminSession();
    if (session) showConsole();

    document.getElementById('admin-login-btn').addEventListener('click', async () => {
      const user = document.getElementById('admin-username').value.trim();
      const pass = document.getElementById('admin-password').value;
      if (!user || !pass) { showToast('Please enter credentials.', 'warning'); return; }

      showLoading('Authenticating…');
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
      activatePrimaryTab('class');
      loadSection('classes');
      initConnectionBanner(); // Check live DB connection and show status banner
    }

    function activatePrimaryTab(panel) {
      // Sidebar primary tabs
      primaryTabs.forEach(t => {
        const isAct = t.dataset.panel === panel;
        t.classList.toggle('active', isAct);
        t.setAttribute('aria-selected', isAct ? 'true' : 'false');
      });
      // Topbar quick pills
      domainPills.forEach(p => p.classList.toggle('active', p.dataset.panel === panel));
      // Mobile bottom tabs
      mobileTabs.forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
      // Show/hide sub-navs
      Object.entries(subnavs).forEach(([key, id]) => {
        document.getElementById(id)?.classList.toggle('hidden', key !== panel);
      });
    }

    primaryTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panel = tab.dataset.panel;
        activatePrimaryTab(panel);
        loadSection(tabDefaultSections[panel]);
      });
    });

    // ── Topbar Domain Switcher Click ──
    domainPills.forEach(pill => {
      pill.addEventListener('click', () => {
        const panel = pill.dataset.panel;
        activatePrimaryTab(panel);
        loadSection(tabDefaultSections[panel]);
      });
    });

    // ── Mobile Bottom Tab Switching ──
    mobileTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        const panel = tab.dataset.panel;
        activatePrimaryTab(panel);
        loadSection(tabDefaultSections[panel]);
      });
    });

    // ── Sidebar Toggle for Mobile ──
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

    // ── Sub-nav item click ──
    document.querySelectorAll('.admin-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        loadSection(item.dataset.sub);
        if (window.innerWidth <= 1024) closeSidebar();
      });
    });

    // ── Section Titles ──
    const sectionTitles = {
      programs: 'Programs', subjects: 'Subjects', levels: 'Levels', audit: 'Audit Log', settings: 'Site Settings',
      classes: 'Classes', batches: 'Batches',
      students: 'Students', 'import-students': 'Import Students', 'progress-view': 'Student Progress',
      exams: 'Exams', questions: 'Questions', results: 'Results',
      'import-questions': 'Import Questions (Excel)', 'export-questions': 'Export Questions (Excel)',
    };

    // ── Global String & HTML Utilities ──
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
      if (!exam) return '—';
      const parts = [];
      if (exam.programs?.name) parts.push(`[${exam.programs.name}]`);
      if (classContext) parts.push(`[${classContext}]`);
      if (exam.subjects?.name) parts.push(exam.subjects.name);
      if (exam.levels?.name) {
        const lvl = String(exam.levels.name);
        parts.push(lvl.toLowerCase().includes('level') ? lvl : `Level ${lvl}`);
      }
      if (exam.exam_type) parts.push(exam.exam_type);
      if (exam.exam_title) parts.push(exam.exam_title);
      return parts.length > 0 ? parts.join(' · ') : (exam.exam_title || 'Exam');
    }

    // ── DB Connection Status Banner ──
    async function initConnectionBanner() {
      const banner = document.getElementById('db-connection-banner');
      const statusDot = document.getElementById('db-status-dot');
      const statusText = document.getElementById('db-status-text');
      if (!banner) return;

      // Show checking state
      statusDot.style.background = '#facc15';
      statusText.textContent = 'Checking database connection…';

      const result = await testSupabaseConnection();
      if (result.connected) {
        statusDot.style.background = '#34d399';
        statusDot.style.boxShadow = '0 0 6px #34d399';
        statusText.innerHTML = `<strong>Connected to Supabase</strong> — data is saved permanently to the cloud`;
        banner.style.borderColor = 'rgba(52,211,153,0.3)';
        banner.style.background = 'rgba(52,211,153,0.07)';
        setTimeout(() => banner.style.display = 'none', 4000); // Auto-hide when connected
      } else {
        statusDot.style.background = '#f87171';
        statusDot.style.boxShadow = '0 0 8px #f87171';
        statusDot.style.animation = 'pulse 1.5s infinite';
        if (result.mode === 'demo') {
          statusText.innerHTML = `<strong>Demo / Offline Mode</strong> — data is in-memory only and will be lost on page reload`;
        } else {
          statusText.innerHTML = `<strong>Database Error</strong> — ${result.error}. <a href="docs/DATABASE.md" target="_blank" style="color:#f87171;">Check setup guide</a>`;
        }
        banner.style.borderColor = 'rgba(248,113,113,0.4)';
        banner.style.background = 'rgba(248,113,113,0.08)';
      }
    }

    async function loadSection(section) {
      const domain = sectionDomainMap[section] || 'database';
      activatePrimaryTab(domain);

      // Highlight active sub-nav item
      document.querySelectorAll('.admin-nav-item').forEach(i => {
        i.classList.toggle('active', i.dataset.sub === section);
      });

      document.getElementById('topbar-title').textContent = sectionTitles[section] || section;
      const area = document.getElementById('admin-content-area');
      area.innerHTML = '<div class="empty-state"><div class="spinner"></div><p>Loading…</p></div>';

      // Set up Add button
      document.getElementById('add-record-btn').onclick = () => openCrudModal(section, null);
      document.getElementById('add-record-btn').style.display = ['audit', 'results', 'progress-view', 'import-students', 'import-questions', 'export-questions'].includes(section) ? 'none' : '';

      try {
        switch(section) {
          case 'programs':        await renderPrograms(area); break;
          case 'subjects':        await renderSubjects(area); break;
          case 'levels':          await renderLevels(area); break;
          case 'classes':         await renderClasses(area); break;
          case 'batches':         await renderBatches(area); break;
          case 'students':        await renderStudents(area); break;
          case 'exams':           await renderExams(area); break;
          case 'questions':       await renderQuestions(area); break;
          case 'results':         await renderResults(area); break;
          case 'progress-view':   await renderProgressView(area); break;
          case 'audit':           await renderAuditLog(area); break;
          case 'settings':        await renderSettings(area); break;
          case 'import-students': await renderImportStudents(area); break;
          case 'import-questions': renderImportQuestions(area); break;
          case 'export-questions': renderExportQuestions(area); break;
          default: area.innerHTML = `<div class="empty-state"><div class="empty-state__icon">🚧</div><h3>${sectionTitles[section] || section}</h3><p>This section is under development.</p></div>`;
        }
      } catch(e) {
        area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load: ${e.message}</p></div>`;
      }
    }

    // ── PROGRAMS ──
    async function renderPrograms(area) {
      const rawData = await adminFetchAll('programs');
      // Enforce strict alphabetical ordering
      const data = [...rawData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Programs <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage English learning programs in alphabetical order</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Program Name</th>
                <th class="text-center">Status</th>
                <th class="text-center">Created Date</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-programs"></tbody>
          </table>
        </div>
      `;
      const tbody = document.getElementById('tbl-programs');
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state__icon">🏢</div><p>No programs yet.</p></div></td></tr>'; return; }
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
              <button class="btn btn-secondary btn-sm" data-edit-prog="${r.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-prog="${r.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('[data-edit-prog]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-edit-prog');
          const rec = window._progRecords[pid];
          if (rec) openCrudModal('programs', rec);
        });
      });
      tbody.querySelectorAll('[data-del-prog]').forEach(btn => {
        btn.addEventListener('click', () => {
          const pid = btn.getAttribute('data-del-prog');
          const rec = window._progRecords[pid];
          if (rec) window._deleteRecord('programs', pid, rec.name || 'Program');
        });
      });
    }

    // ── SUBJECTS ──
    async function renderSubjects(area) {
      const [rawData, programs] = await Promise.all([adminFetchAll('subjects', '*, programs(name)'), adminFetchAll('programs')]);
      // Sort by Program Name (A-Z), then Subject Name (A-Z)
      const data = [...rawData].sort((a, b) => {
        const pA = a.programs?.name || '';
        const pB = b.programs?.name || '';
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
          <td class="text-muted fw-600">${escapeHtml(r.programs?.name || '—')}</td>
          <td class="fw-600" style="color:var(--clr-text-1);">${escapeHtml(r.name)}</td>
          <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
          <td class="text-right">
            <div class="d-flex gap-2 justify-end">
              <button class="btn btn-secondary btn-sm" data-edit-subj="${r.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-subj="${r.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
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

    // ── LEVELS ──
    async function renderLevels(area) {
      const [rawData, allClasses] = await Promise.all([
        adminFetchAll('levels', '*, subjects(name, program_id, programs(name))'),
        adminFetchAll('classes', 'id, name, program_id')
      ]);
      const classMap = {};
      allClasses.forEach(c => { classMap[c.id] = c; });

      // Sort by Program Name (A-Z), Class Name, Subject Name (A-Z), then level_number ascending
      const data = [...rawData].sort((a, b) => {
        const pA = a.subjects?.programs?.name || '';
        const pB = b.subjects?.programs?.name || '';
        const cA = (a.class_id && classMap[a.class_id]?.name) || '';
        const cB = (b.class_id && classMap[b.class_id]?.name) || '';
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
        if (!r.program_id && r.subjects?.program_id) {
          r.program_id = r.subjects.program_id;
        }
        window._levelRecords[r.id] = r;
      });

      data.forEach(r => {
        const progName = r.subjects?.programs?.name || '—';
        const className = (r.class_id && classMap[r.class_id]?.name) ? classMap[r.class_id].name : 'All Classes';
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td><span class="badge badge-neutral">${escapeHtml(progName)}</span></td>
          <td><span class="badge badge-neutral">${escapeHtml(className)}</span></td>
          <td class="text-muted fw-600">${escapeHtml(r.subjects?.name || '—')}</td>
          <td class="text-center"><span class="badge badge-primary">Level ${r.level_number}</span></td>
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

    // ── CLASSES ──
    async function renderClasses(area) {
      const rawData = await adminFetchAll('classes', '*, programs(name)');
      // Sort by Program Name (A-Z), then Class Name (A-Z)
      const data = [...rawData].sort((a, b) => {
        const pA = a.programs?.name || '';
        const pB = b.programs?.name || '';
        return pA.localeCompare(pB) || (a.name || '').localeCompare(b.name || '');
      });

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Classes <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage student classrooms ordered alphabetically by program and name</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Program</th>
                <th class="text-left">Class Name</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-classes"></tbody>
          </table>
        </div>
      `;
      const tbody = document.getElementById('tbl-classes');
      if (!data.length) { tbody.innerHTML = '<tr><td colspan="4" class="text-center text-muted p-4">No classes yet.</td></tr>'; return; }
      window._classRecords = {};
      data.forEach(r => {
        window._classRecords[r.id] = r;
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td class="text-muted fw-600">${escapeHtml(r.programs?.name || '—')}</td>
          <td class="fw-600">${escapeHtml(r.name)}</td>
          <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
          <td class="text-right">
            <div class="d-flex gap-2 justify-end">
              <button class="btn btn-secondary btn-sm" data-edit-class="${r.id}">Edit</button>
              <button class="btn btn-danger btn-sm" data-del-class="${r.id}">Delete</button>
            </div>
          </td>
        `;
        tbody.appendChild(tr);
      });

      tbody.querySelectorAll('[data-edit-class]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-edit-class');
          const rec = window._classRecords[cid];
          if (rec) openCrudModal('classes', rec);
        });
      });
      tbody.querySelectorAll('[data-del-class]').forEach(btn => {
        btn.addEventListener('click', () => {
          const cid = btn.getAttribute('data-del-class');
          const rec = window._classRecords[cid];
          if (rec) window._deleteRecord('classes', cid, rec.name || 'Class');
        });
      });
    }

    // Helper function to calculate age from birth date string (YYYY-MM-DD)
    function calculateAgeFromBirthDate(birthDateStr) {
      if (!birthDateStr) return '—';
      const birthDate = new Date(birthDateStr);
      if (isNaN(birthDate.getTime())) return '—';
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      return age >= 0 ? `${age} yrs` : '—';
    }

    // ── BATCHES (Hierarchy: Program -> Class -> Batch) ──
    async function renderBatches(area) {
      const [rawData, allStudents] = await Promise.all([
        adminFetchAll('batches', '*, classes(name, program_id, programs(name))'),
        adminFetchAll('students')
      ]);

      // Sort by Program (A-Z), Class (A-Z), Batch Name (A-Z)
      const data = [...rawData].sort((a, b) => {
        const progA = a.classes?.programs?.name || '';
        const progB = b.classes?.programs?.name || '';
        if (progA !== progB) return progA.localeCompare(progB);
        const clsA = a.classes?.name || '';
        const clsB = b.classes?.name || '';
        if (clsA !== clsB) return clsA.localeCompare(clsB);
        return (a.name || '').localeCompare(b.name || '');
      });

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Batches <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage class batches in the hierarchy: Program › Class › Batch</p>
          </div>
          <button class="btn btn-primary btn-sm" id="batches-add-shortcut">+ Add Batch</button>
        </div>

        <div class="filter-bar mb-4">
          <div class="search-bar" style="max-width:420px;">
            <span class="search-icon">🔍</span>
            <input type="text" id="batch-filter" placeholder="Search by batch, class, or program…" />
          </div>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Batch Name</th>
                <th class="text-left">Program</th>
                <th class="text-left">Class</th>
                <th class="text-center">Enrolled Students</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-batches"></tbody>
          </table>
        </div>
      `;

      document.getElementById('batches-add-shortcut')?.addEventListener('click', () => openCrudModal('batches', null));

      const tbody = document.getElementById('tbl-batches');
      window._batchRecords = {};
      data.forEach(r => { window._batchRecords[r.id] = r; });

      const renderRows = (filtered) => {
        tbody.innerHTML = '';
        if (!filtered.length) { tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted p-4">No batches found.</td></tr>'; return; }
        filtered.forEach(r => {
          const studentCount = allStudents.filter(s => s.batch_id === r.id && !s.deleted_at).length;
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="fw-600" style="color:var(--clr-text-1);">${escapeHtml(r.name)}</td>
            <td class="text-muted text-sm">${escapeHtml(r.classes?.programs?.name || '—')}</td>
            <td class="text-muted text-sm">${escapeHtml(r.classes?.name || '—')}</td>
            <td class="text-center"><span class="badge badge-info">${studentCount} students</span></td>
            <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-danger'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
            <td class="text-right">
              <div class="d-flex gap-2 justify-end">
                <button class="btn btn-secondary btn-sm" data-edit-batch="${r.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-del-batch="${r.id}">Delete</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });

        tbody.querySelectorAll('[data-edit-batch]').forEach(btn => {
          btn.addEventListener('click', () => {
            const bid = btn.getAttribute('data-edit-batch');
            const rec = window._batchRecords[bid];
            if (rec) openCrudModal('batches', rec);
          });
        });
        tbody.querySelectorAll('[data-del-batch]').forEach(btn => {
          btn.addEventListener('click', () => {
            const bid = btn.getAttribute('data-del-batch');
            const rec = window._batchRecords[bid];
            if (rec) window._deleteRecord('batches', bid, rec.name || 'Batch');
          });
        });
      };

      renderRows(data);
      document.getElementById('batch-filter')?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase();
        renderRows(data.filter(r => (r.name || '').toLowerCase().includes(q) || (r.classes?.name || '').toLowerCase().includes(q) || (r.classes?.programs?.name || '').toLowerCase().includes(q)));
      });
    }

    // ── STUDENTS (With Batch, Overall Score & Global Grade) ──
    async function renderStudents(area) {
      const [rawData, allAttempts] = await Promise.all([
        adminFetchAll('students', '*, classes(name), programs(name), batches(name)'),
        adminFetchAll('attempts')
      ]);
      // Default: alphabetical by student name
      const data = [...rawData].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      // Sort state: { col, dir } — dir is 'asc', 'desc', or null (default)
      let sortState = { col: 'name', dir: 'asc' };

      // Detect duplicate students within the same class
      const dupMap = new Map();
      data.forEach(s => {
        if (s.deleted_at) return;
        const key = `${s.class_id}::${(s.name || '').toLowerCase().trim()}`;
        if (!dupMap.has(key)) dupMap.set(key, []);
        dupMap.get(key).push(s);
      });
      const duplicateGroups = Array.from(dupMap.values()).filter(g => g.length > 1);
      const totalDuplicates = duplicateGroups.reduce((acc, g) => acc + (g.length - 1), 0);
      const duplicateIds = new Set(duplicateGroups.flatMap(g => g.map(s => s.id)));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Students <span class="count-chip">${data.length} Total</span></h2>
            <p class="section-subtitle">Manage enrolled students listed in alphabetical order with Batch, Overall Score &amp; Global Grade</p>
          </div>
          <div class="d-flex gap-2">
            ${totalDuplicates > 0 ? `<button class="btn btn-warning btn-sm" id="students-merge-shortcut" style="font-weight:700;">🔄 Merge Duplikat (${totalDuplicates})</button>` : ''}
            <button class="btn btn-secondary btn-sm" id="students-import-shortcut">📥 Import Students</button>
            <button class="btn btn-primary btn-sm" id="students-add-shortcut">+ Add Student</button>
          </div>
        </div>

        ${totalDuplicates > 0 ? `
          <div class="mb-4 p-3 rounded d-flex align-center justify-between" style="background:rgba(245,158,11,0.15);border:1px solid rgba(245,158,11,0.4);color:#fef3c7;">
            <div class="d-flex align-center gap-3">
              <span style="font-size:1.4rem;">⚠️</span>
              <div>
                <div class="fw-700 text-sm">Terdeteksi ${totalDuplicates} Data Siswa Kembar / Duplikat!</div>
                <div class="text-xs text-muted" style="color:rgba(255,255,255,0.85)!important;">
                  Ditemukan ${duplicateGroups.length} grup nama siswa dengan data kembar di kelas yang sama. Gabungkan sekarang untuk menyatukan nilai, riwayat ujian, dan progres mereka.
                </div>
              </div>
            </div>
            <button class="btn btn-warning btn-sm" id="btn-banner-merge-duplicates" style="background:#f59e0b;color:#000;font-weight:700;border:none;white-space:nowrap;">
              🔄 Gabungkan Semua Duplikat
            </button>
          </div>
        ` : ''}

        <div class="filter-bar mb-4">
          <div class="search-bar" style="max-width:420px;">
            <span class="search-icon">🔍</span>
            <input type="text" id="student-filter" placeholder="Search by student name, class, batch…" />
          </div>
        </div>
        <div class="table-wrap">
          <table id="students-table">
            <thead>
              <tr>
                <th class="text-left sortable-th" data-col="name" style="cursor:pointer;user-select:none;">Student Name <span class="sort-icon" data-col="name"></span></th>
                <th class="text-left sortable-th" data-col="program" style="cursor:pointer;user-select:none;">Program <span class="sort-icon" data-col="program"></span></th>
                <th class="text-left sortable-th" data-col="class" style="cursor:pointer;user-select:none;">Class <span class="sort-icon" data-col="class"></span></th>
                <th class="text-left sortable-th" data-col="batch" style="cursor:pointer;user-select:none;">Batch <span class="sort-icon" data-col="batch"></span></th>
                <th class="text-center sortable-th" data-col="gender" style="cursor:pointer;user-select:none;">Gender <span class="sort-icon" data-col="gender"></span></th>
                <th class="text-center">Birth Date / Age</th>
                <th class="text-center sortable-th" data-col="score" style="cursor:pointer;user-select:none;">Overall Score <span class="sort-icon" data-col="score"></span></th>
                <th class="text-center sortable-th" data-col="grade" style="cursor:pointer;user-select:none;">Global Grade <span class="sort-icon" data-col="grade"></span></th>
                <th class="text-center sortable-th" data-col="status" style="cursor:pointer;user-select:none;">Status <span class="sort-icon" data-col="status"></span></th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-students"></tbody>
          </table>
        </div>
      `;

      // Wire merge duplicates buttons
      const runMergeDuplicates = async () => {
        if (!confirm(`Gabungkan ${totalDuplicates} profil siswa kembar ke dalam profil utama? Seluruh riwayat ujian dan progres akan disatukan.`)) return;
        showLoading('Menggabungkan data siswa kembar…');
        try {
          const res = await mergeDuplicateStudents();
          hideLoading();
          showToast(`Berhasil menggabungkan ${res.mergedCount} data siswa ganda dari ${res.groupsCount} grup!`, 'success');
          loadSection('students');
        } catch(err) {
          hideLoading();
          showToast(`Gagal merge siswa: ${err.message}`, 'error');
        }
      };

      document.getElementById('students-merge-shortcut')?.addEventListener('click', runMergeDuplicates);
      document.getElementById('btn-banner-merge-duplicates')?.addEventListener('click', runMergeDuplicates);

      // Wire shortcut buttons
      document.getElementById('students-import-shortcut')?.addEventListener('click', () => loadSection('import-students'));
      document.getElementById('students-add-shortcut')?.addEventListener('click', () => openCrudModal('students', null));

      const tbody = document.getElementById('tbl-students');
      window._studentRecords = {};
      data.forEach(r => { window._studentRecords[r.id] = r; });

      // ── Pre-compute scores for each student (needed for sorting too) ──
      const studentScoreMap = new Map(); // id -> { score: number, grade: string }
      data.forEach(r => {
        const studentAttempts = allAttempts.filter(a => a.student_id === r.id && ['submitted', 'auto_submitted'].includes(a.status));
        if (studentAttempts.length > 0) {
          const examBestScores = new Map();
          for (const att of studentAttempts) {
            const score = parseFloat(att.percentage || att.score || 0);
            if (!examBestScores.has(att.exam_id) || score > examBestScores.get(att.exam_id)) {
              examBestScores.set(att.exam_id, score);
            }
          }
          const scores = Array.from(examBestScores.values());
          const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
          const overallScore = Math.round(avg * 10) / 10;
          studentScoreMap.set(r.id, { score: overallScore, grade: getGrade(overallScore) });
        }
      });

      // Grade order for sort: S > A > B > C > D > E > F
      const GRADE_ORDER = { S: 7, A: 6, B: 5, C: 4, D: 3, E: 2, F: 1, '—': 0 };

      // ── Sort function ──
      function getSortedData(baseData) {
        const { col, dir } = sortState;
        if (!dir) return baseData; // null = default (already alphabetical by name)
        const mult = dir === 'asc' ? 1 : -1;
        return [...baseData].sort((a, b) => {
          let va, vb;
          switch (col) {
            case 'name':    va = (a.name || '').toLowerCase(); vb = (b.name || '').toLowerCase(); break;
            case 'program': va = (a.programs?.name || '').toLowerCase(); vb = (b.programs?.name || '').toLowerCase(); break;
            case 'class':   va = (a.classes?.name || '').toLowerCase(); vb = (b.classes?.name || '').toLowerCase(); break;
            case 'batch':   va = (a.batches?.name || '').toLowerCase(); vb = (b.batches?.name || '').toLowerCase(); break;
            case 'gender':  va = (a.gender || '').toLowerCase(); vb = (b.gender || '').toLowerCase(); break;
            case 'score':   va = studentScoreMap.get(a.id)?.score ?? -1; vb = studentScoreMap.get(b.id)?.score ?? -1; return mult * (va - vb);
            case 'grade':   va = GRADE_ORDER[studentScoreMap.get(a.id)?.grade ?? '—'] ?? 0; vb = GRADE_ORDER[studentScoreMap.get(b.id)?.grade ?? '—'] ?? 0; return mult * (va - vb);
            case 'status':  va = a.is_active ? 1 : 0; vb = b.is_active ? 1 : 0; return mult * (va - vb);
            default:        return 0;
          }
          return mult * va.localeCompare(vb);
        });
      }

      // ── Update sort header icons ──
      function updateSortIcons() {
        document.querySelectorAll('#students-table .sort-icon').forEach(el => {
          const col = el.dataset.col;
          if (col === sortState.col) {
            el.textContent = sortState.dir === 'asc' ? ' ▲' : sortState.dir === 'desc' ? ' ▼' : '';
            el.style.color = 'var(--clr-accent-1, #a78bfa)';
          } else {
            el.textContent = ' ⇅';
            el.style.color = 'rgba(255,255,255,0.2)';
          }
        });
      }

      let currentFilter = '';

      const renderRows = (sourceData) => {
        const sorted = getSortedData(sourceData);
        tbody.innerHTML = '';
        if (!sorted.length) { tbody.innerHTML = '<tr><td colspan="10" class="text-center text-muted p-4">No students found.</td></tr>'; return; }
        sorted.forEach(r => {
          const ageDisplay = calculateAgeFromBirthDate(r.birth_date);
          const isDuplicate = duplicateIds.has(r.id);
          const scoreInfo = studentScoreMap.get(r.id);
          let overallScoreDisplay = '<span class="text-muted">—</span>';
          let globalGradeDisplay = '<span class="text-muted">—</span>';
          if (scoreInfo) {
            overallScoreDisplay = `<span class="fw-700 text-sm" style="color:var(--clr-accent-1);">${scoreInfo.score.toFixed(1)}%</span>`;
            globalGradeDisplay = `<span class="grade-badge grade-${scoreInfo.grade}" style="width:28px;height:28px;font-size:0.8rem;display:inline-flex;">${scoreInfo.grade}</span>`;
          }
          const displayName = formatStudentName(r.name, r.gender);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td class="fw-600" style="color:var(--clr-text-1);">
              ${escapeHtml(displayName)}
              ${isDuplicate ? `<span class="badge badge-warning ml-2" style="font-size:0.65rem;" title="Duplicate student in this class">Duplikat</span>` : ''}
            </td>
            <td class="text-muted text-sm">${escapeHtml(r.programs?.name || '—')}</td>
            <td class="text-muted text-sm">${escapeHtml(r.classes?.name || '—')}</td>
            <td class="text-sm fw-600" style="color:var(--clr-accent-1);">${escapeHtml(r.batches?.name || '—')}</td>
            <td class="text-center text-muted text-sm" style="text-transform:capitalize;">${escapeHtml(r.gender || '—')}</td>
            <td class="text-center text-muted text-sm">${escapeHtml(r.birth_date || '—')} <span class="badge badge-info ml-1" style="font-size:0.7rem;">${ageDisplay}</span></td>
            <td class="text-center">${overallScoreDisplay}</td>
            <td class="text-center">${globalGradeDisplay}</td>
            <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-danger'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
            <td class="text-right">
              <div class="d-flex gap-2 justify-end">
                <button class="btn btn-secondary btn-sm" data-edit-student="${r.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-del-student="${r.id}">Delete</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });

        tbody.querySelectorAll('[data-edit-student]').forEach(btn => {
          btn.addEventListener('click', () => {
            const sid = btn.getAttribute('data-edit-student');
            const rec = window._studentRecords[sid];
            if (rec) openCrudModal('students', rec);
          });
        });
        tbody.querySelectorAll('[data-del-student]').forEach(btn => {
          btn.addEventListener('click', () => {
            const sid = btn.getAttribute('data-del-student');
            const rec = window._studentRecords[sid];
            if (rec) window._deleteRecord('students', sid, rec.name || 'Student');
          });
        });
      };

      // Filter helper
      function getFilteredData() {
        if (!currentFilter) return data;
        return data.filter(r =>
          (r.name || '').toLowerCase().includes(currentFilter) ||
          (r.classes?.name || '').toLowerCase().includes(currentFilter) ||
          (r.batches?.name || '').toLowerCase().includes(currentFilter) ||
          (r.programs?.name || '').toLowerCase().includes(currentFilter) ||
          (r.gender || '').toLowerCase().includes(currentFilter)
        );
      }

      // Initial render
      updateSortIcons();
      renderRows(getFilteredData());

      // Search filter
      document.getElementById('student-filter')?.addEventListener('input', (e) => {
        currentFilter = e.target.value.toLowerCase();
        renderRows(getFilteredData());
      });

      // ── Sortable header clicks ──
      document.querySelectorAll('#students-table .sortable-th').forEach(th => {
        th.addEventListener('click', () => {
          const col = th.dataset.col;
          if (sortState.col === col) {
            // Cycle: asc → desc → null (default = asc)
            if (sortState.dir === 'asc') sortState.dir = 'desc';
            else if (sortState.dir === 'desc') { sortState.col = 'name'; sortState.dir = 'asc'; }
            else sortState.dir = 'asc';
          } else {
            sortState.col = col;
            sortState.dir = 'asc';
          }
          updateSortIcons();
          renderRows(getFilteredData());
        });
        // Hover style
        th.style.transition = 'background 0.15s';
        th.addEventListener('mouseenter', () => th.style.background = 'rgba(255,255,255,0.04)');
        th.addEventListener('mouseleave', () => th.style.background = '');
      });
    }

    // ── EXAM MANAGEMENT HUB (Restored & Elevated) ──
    async function renderExams(area) {
      const [rawData, allQuestions] = await Promise.all([
        adminFetchAll('exams', '*, subjects(name), levels(name, level_number), programs(name)'),
        adminFetchAll('questions', 'id, exam_id')
      ]);

      // Enforce strict alphabetical ordering by exam title
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
              <h2 class="section-title text-gradient" style="font-size:1.75rem;">Exam Management Hub</h2>
              <p class="section-subtitle">Create, organize, publish, and inspect all online examinations</p>
            </div>
            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-primary btn-sm" id="hub-add-exam">+ Create Exam</button>
              <button class="btn btn-secondary btn-sm" id="hub-import-q">📥 Import Questions</button>
              <button class="btn btn-secondary btn-sm" id="hub-export-q">📤 Export Questions</button>
            </div>
          </div>

          <!-- KPI Cards -->
          <div class="kpi-grid">
            <div class="kpi-card">
              <div class="kpi-icon">📝</div>
              <div>
                <div class="kpi-val">${totalExams}</div>
                <div class="kpi-lbl">Total Exams</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon" style="color:var(--clr-success,#4ade80);">✓</div>
              <div>
                <div class="kpi-val" style="color:var(--clr-success,#4ade80);">${publishedCount}</div>
                <div class="kpi-lbl">Published Exams</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon" style="color:var(--clr-warning,#fbbf24);">⏳</div>
              <div>
                <div class="kpi-val" style="color:var(--clr-warning,#fbbf24);">${draftCount}</div>
                <div class="kpi-lbl">Draft / Inactive</div>
              </div>
            </div>
            <div class="kpi-card">
              <div class="kpi-icon" style="color:var(--clr-accent-1);">❓</div>
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
            <span class="search-icon">🔍</span>
            <input type="text" id="exam-search-input" placeholder="Search exams by title, subject…" />
          </div>
        </div>

        <!-- Exams Table -->
        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th class="text-left">Exam Title</th>
                <th class="text-left">Subject</th>
                <th class="text-center">Level</th>
                <th class="text-center">Exam Type</th>
                <th class="text-center">Answer Type</th>
                <th class="text-center">Question Order</th>
                <th class="text-center">Status</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody id="tbl-exams"></tbody>
          </table>
        </div>
      `;

      // Wire Quick Action buttons
      document.getElementById('hub-add-exam')?.addEventListener('click', () => openCrudModal('exams', null));
      document.getElementById('hub-import-q')?.addEventListener('click', () => loadSection('import-questions'));
      document.getElementById('hub-export-q')?.addEventListener('click', () => loadSection('export-questions'));

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
            (r.programs?.name || '').toLowerCase().includes(currentQuery) ||
            (r.subjects?.name || '').toLowerCase().includes(currentQuery) ||
            (r.levels?.name || '').toLowerCase().includes(currentQuery) ||
            `level ${r.levels?.level_number || ''}`.toLowerCase().includes(currentQuery) ||
            (r.exam_type || '').toLowerCase().includes(currentQuery) ||
            (r.answer_type || '').replace('_',' ').toLowerCase().includes(currentQuery) ||
            (r.exam_status || '').toLowerCase().includes(currentQuery) ||
            (r.question_order || '').toLowerCase().includes(currentQuery);
          return matchStatus && matchQuery;
        });

        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-5">No exams match the selected filter.</td></tr>';
          return;
        }

        const statusColors = { published: 'badge-success', draft: 'badge-neutral', unpublished: 'badge-warning', archived: 'badge-danger' };

        filtered.forEach(r => {
          const fullDisplayName = formatExamDisplayName(r);
          const tr = document.createElement('tr');
          tr.innerHTML = `
            <td>
              <div class="fw-700" style="color:var(--clr-text-1);font-size:0.95rem;">${escapeHtml(r.exam_title)}</div>
              <div class="text-xs text-gradient mt-1" style="font-size:0.75rem;">${escapeHtml(fullDisplayName)}</div>
              <div class="text-muted text-xs mt-1">⏱ ${r.time_limit_minutes || 30} min · Pass: ${r.minimum_required_score || 60}%</div>
            </td>
            <td class="text-muted fw-600">${escapeHtml(r.subjects?.name || '—')}</td>
            <td class="text-center"><span class="badge badge-primary">L${r.levels?.level_number || ''} ${escapeHtml(r.levels?.name || '')}</span></td>
            <td class="text-center"><span class="badge badge-neutral text-xs">${escapeHtml(r.exam_type || '—')}</span></td>
            <td class="text-center text-sm"><span class="badge badge-info text-xs">${(r.answer_type || '').replace('_',' ')}</span></td>
            <td class="text-center"><span class="badge ${r.question_order === 'random' ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">${r.question_order === 'random' ? '🔀 Random' : '🔢 Sequential'}</span></td>
            <td class="text-center">
              <span class="status-dot ${r.exam_status}"></span>
              <span class="badge ${statusColors[r.exam_status] || 'badge-neutral'}">${r.exam_status}</span>
            </td>
            <td class="text-right">
              <div class="d-flex gap-2 justify-end">
                <button class="btn btn-success btn-sm" onclick="window._publishExam('${r.id}', '${r.exam_status}')">${r.exam_status === 'published' ? 'Unpublish' : 'Publish'}</button>
                <button class="btn btn-secondary btn-sm" data-edit-exam="${r.id}">Edit</button>
                <button class="btn btn-danger btn-sm" data-del-exam="${r.id}">Delete</button>
              </div>
            </td>
          `;
          tbody.appendChild(tr);
        });

        tbody.querySelectorAll('[data-edit-exam]').forEach(btn => {
          btn.addEventListener('click', async () => {
            const eid = btn.getAttribute('data-edit-exam');
            const rec = window._examRecords[eid];
            if (rec) await openCrudModal('exams', rec);
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

    // ── QUESTIONS ──
    async function renderQuestions(area) {
      const [questions, exams] = await Promise.all([
        adminFetchAll('questions', '*, exams(exam_title, exam_type, programs(name), subjects(name), levels(name, level_number))'),
        adminFetchAll('exams', 'id, exam_title, exam_type, programs(name), subjects(name), levels(name, level_number)')
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
            <span class="search-icon">🔍</span>
            <input type="text" id="question-search-filter" placeholder="Search question text…" />
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
          const matchExam = !selectedExamId || q.exam_id === selectedExamId;
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
          const answerDisplay = (q.correct_answer || '—').slice(0, 40) + ((q.correct_answer?.length > 40) ? '…' : '');
          const examDisplay = formatExamDisplayName(q.exams);
          tr.innerHTML = `
            <td class="text-center text-muted fw-700">${q.question_order}</td>
            <td class="fw-600">${escapeHtml(q.question_text?.slice(0,70))}${q.question_text?.length > 70 ? '…' : ''}</td>
            <td class="text-sm" style="color:var(--clr-success,#4ade80);font-family:monospace;">${escapeHtml(answerDisplay)}</td>
            <td class="text-center"><span class="badge badge-info">${(q.answer_type||'').replace('_',' ')}</span></td>
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

    // ── RESULTS (Student Submissions with Batch Grouping) ──
    async function renderResults(area) {
      const [rawData, allPrograms, allClasses, allBatches] = await Promise.all([
        adminFetchAll('attempts', '*, students(name, gender, batch_id, batches(name), class_id, classes(name, program_id, programs(name))), exams(exam_title, exam_type)'),
        adminFetchAll('programs'),
        adminFetchAll('classes'),
        adminFetchAll('batches')
      ]);

      const submittedOnly = rawData.filter(r => ['submitted', 'auto_submitted'].includes(r.status));
      // Default: sort alphabetically by Student Name (A-Z)
      const allData = [...submittedOnly].sort((a, b) => (a.students?.name || '').localeCompare(b.students?.name || ''));

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

        <!-- Filter Bar -->
        <div class="filter-bar mb-4 p-3 rounded d-flex gap-3 align-center flex-wrap" style="background:var(--clr-surface-2);border:1px solid var(--clr-border);">
          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Program</label>
            <select id="res-filter-prog" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">— All Programs —</option>
              ${(allPrograms || []).filter(p => !p.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Class</label>
            <select id="res-filter-class" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">— All Classes —</option>
              ${(allClasses || []).filter(c => !c.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => `<option value="${c.id}" data-prog="${c.program_id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Batch (Group)</label>
            <select id="res-filter-batch" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">— All Batches —</option>
              ${(allBatches || []).filter(b => !b.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(b => `<option value="${b.id}" data-class="${b.class_id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          </div>

          <div style="flex:1;min-width:220px;">
            <label class="text-xs text-muted d-block mb-1">Search Student / Exam</label>
            <input type="text" id="res-filter-search" class="form-control" placeholder="Type student name or exam title…" style="padding:6px 10px;font-size:0.85rem;">
          </div>

          <div class="d-flex align-end" style="padding-top:18px;">
            <button class="btn btn-ghost btn-sm" id="res-btn-reset" title="Reset all filters">✕ Reset</button>
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
                <th class="text-center">Submitted At</th>
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
          const studentProgId = r.students?.classes?.programs?.id || r.students?.classes?.program_id;
          if (pId && studentProgId !== pId) return false;
          if (cId && r.students?.class_id !== cId) return false;
          if (bId && r.students?.batch_id !== bId) return false;
          if (q) {
            const sName = (r.students?.name || '').toLowerCase();
            const eTitle = (r.exams?.exam_title || '').toLowerCase();
            const eType = (r.exams?.exam_type || '').toLowerCase();
            if (!sName.includes(q) && !eTitle.includes(q) && !eType.includes(q)) return false;
          }
          return true;
        });

        countChip.textContent = `${filtered.length} of ${allData.length}`;

        if (!filtered.length) {
          tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted p-5">No submitted results match the selected filters.</td></tr>';
          return;
        }

        tbody.innerHTML = filtered.map(r => `
          <tr>
            <td class="fw-600" style="color:var(--clr-text-1);">${formatStudentName(r.students?.name, r.students?.gender) || '—'}</td>
            <td class="text-muted text-sm">${escapeHtml(r.students?.classes?.programs?.name || '—')}</td>
            <td class="text-muted text-sm">${escapeHtml(r.students?.classes?.name || '—')}</td>
            <td><span class="badge ${r.students?.batches?.name ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">${escapeHtml(r.students?.batches?.name || 'Unassigned')}</span></td>
            <td class="text-sm fw-600">${r.exams?.exam_type ? escapeHtml(r.exams.exam_type) + ' — ' : ''}${escapeHtml(r.exams?.exam_title || '—')}</td>
            <td class="text-center fw-700" style="color:var(--clr-primary);">${parseFloat(r.percentage || 0).toFixed(1)}%</td>
            <td class="text-center"><span class="grade-badge grade-${r.grade || 'F'}" style="width:30px;height:30px;font-size:0.85rem;">${r.grade || '—'}</span></td>
            <td class="text-center text-muted text-xs">${r.submitted_at ? new Date(r.submitted_at).toLocaleString() : '—'}</td>
          </tr>
        `).join('');
      };

      progSelect.addEventListener('change', () => { updateClassOptions(); renderTable(); });
      classSelect.addEventListener('change', () => { updateBatchOptions(); renderTable(); });
      batchSelect.addEventListener('change', renderTable);
      searchInput.addEventListener('input', renderTable);
      document.getElementById('res-btn-reset')?.addEventListener('click', () => {
        progSelect.value = '';
        classSelect.value = '';
        batchSelect.value = '';
        searchInput.value = '';
        updateClassOptions();
        renderTable();
      });

      renderTable();
    }

    // ── STUDENT PROGRESS (Level Progression with Batch Grouping) ──
    async function renderProgressView(area) {
      const [rawData, allPrograms, allClasses, allBatches] = await Promise.all([
        adminFetchAll('progress', '*, students(name, gender, batch_id, batches(name), class_id, classes(name, program_id, programs(name))), subjects(name), levels(name, level_number)'),
        adminFetchAll('programs'),
        adminFetchAll('classes'),
        adminFetchAll('batches')
      ]);

      // Default: sort alphabetically by Student Name (A-Z)
      const allData = [...rawData].sort((a, b) => (a.students?.name || '').localeCompare(b.students?.name || ''));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Student Progress <span class="count-chip" id="prog-count-chip">${allData.length} Records</span></h2>
            <p class="section-subtitle">Level unlock progression and completion status grouped and filterable by Program, Class, and Batch</p>
          </div>
        </div>

        <!-- Filter Bar -->
        <div class="filter-bar mb-4 p-3 rounded d-flex gap-3 align-center flex-wrap" style="background:var(--clr-surface-2);border:1px solid var(--clr-border);">
          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Program</label>
            <select id="prog-filter-prog" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">— All Programs —</option>
              ${(allPrograms || []).filter(p => !p.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Class</label>
            <select id="prog-filter-class" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">— All Classes —</option>
              ${(allClasses || []).filter(c => !c.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(c => `<option value="${c.id}" data-prog="${c.program_id}">${escapeHtml(c.name)}</option>`).join('')}
            </select>
          </div>

          <div style="min-width:180px;">
            <label class="text-xs text-muted d-block mb-1">Filter Batch (Group)</label>
            <select id="prog-filter-batch" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
              <option value="">— All Batches —</option>
              ${(allBatches || []).filter(b => !b.deleted_at).sort((a,b) => (a.name||'').localeCompare(b.name||'')).map(b => `<option value="${b.id}" data-class="${b.class_id}">${escapeHtml(b.name)}</option>`).join('')}
            </select>
          </div>

          <div style="flex:1;min-width:220px;">
            <label class="text-xs text-muted d-block mb-1">Search Student / Subject</label>
            <input type="text" id="prog-filter-search" class="form-control" placeholder="Type student name or subject…" style="padding:6px 10px;font-size:0.85rem;">
          </div>

          <div class="d-flex align-end" style="padding-top:18px;">
            <button class="btn btn-ghost btn-sm" id="prog-btn-reset" title="Reset all filters">✕ Reset</button>
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
                <th class="text-left">Subject</th>
                <th class="text-center">Current Level</th>
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
          const studentProgId = r.students?.classes?.programs?.id || r.students?.classes?.program_id;
          if (pId && studentProgId !== pId) return false;
          if (cId && r.students?.class_id !== cId) return false;
          if (bId && r.students?.batch_id !== bId) return false;
          if (q) {
            const sName = (r.students?.name || '').toLowerCase();
            const sSubj = (r.subjects?.name || '').toLowerCase();
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
            <td class="fw-600" style="color:var(--clr-text-1);">${formatStudentName(r.students?.name, r.students?.gender) || '—'}</td>
            <td class="text-muted text-sm">${escapeHtml(r.students?.classes?.programs?.name || '—')}</td>
            <td class="text-muted text-sm">${escapeHtml(r.students?.classes?.name || '—')}</td>
            <td><span class="badge ${r.students?.batches?.name ? 'badge-info' : 'badge-neutral'}" style="font-size:0.75rem;">${escapeHtml(r.students?.batches?.name || 'Unassigned')}</span></td>
            <td class="fw-600 text-sm">${escapeHtml(r.subjects?.name || '—')}</td>
            <td class="text-center"><span class="badge badge-primary">L${r.levels?.level_number || '1'} ${escapeHtml(r.levels?.name || '')}</span></td>
            <td class="text-center">
              <span class="badge ${r.is_completed ? 'badge-success' : r.is_unlocked ? 'badge-info' : 'badge-neutral'}">
                ${r.is_completed ? '✓ Completed' : r.is_unlocked ? '▶ Unlocked' : '🔒 Locked'}
              </span>
            </td>
            <td class="text-center">
              <div class="progress-pill">
                <div class="progress-pill-fill" style="width:${r.is_completed ? 100 : r.is_unlocked ? 50 : 0}%;"></div>
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
    }

    // ── AUDIT LOG ──
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
                  <td class="text-muted text-sm">${r.entity_type || '—'}</td>
                  <td class="text-center text-muted text-sm">${r.ip_address || '—'}</td>
                </tr>
              `).join('')}
              ${!(data?.length) ? '<tr><td colspan="5" class="text-center text-muted p-4">No audit events yet.</td></tr>' : ''}
            </tbody>
          </table>
        </div>
      `;
    }


    // ── SETTINGS ──
    async function renderSettings(area) {
      const sb = await getSupabase();
      const { data } = await sb.from('site_settings').select('*');
      const settings = Object.fromEntries((data || []).map(r => [r.key, r.value]));
      area.innerHTML = `
        <div class="section-header"><div><h2 class="section-title">Site Settings</h2></div></div>
        <div class="glass-card p-8" style="max-width:560px;">
          <div class="form-group">
            <label class="form-label">Site Name</label>
            <input class="form-control" id="setting-site_name" value="${settings.site_name || 'TOP ENGLISH CLASS'}" />
          </div>
          <div class="form-group">
            <label class="form-label">Passing Threshold (%)</label>
            <input class="form-control" type="number" id="setting-passing_threshold" value="${settings.passing_threshold || '60'}" min="0" max="100" />
          </div>
          <div class="form-group">
            <label class="form-label">Login Background URL (optional)</label>
            <input class="form-control" id="setting-login_background_url" value="${settings.login_background_url || ''}" placeholder="https://…" />
          </div>
          <button class="btn btn-primary" id="save-settings-btn">Save Settings</button>
        </div>
      `;
      document.getElementById('save-settings-btn').addEventListener('click', async () => {
        const pairs = [
          ['site_name', document.getElementById('setting-site_name').value],
          ['passing_threshold', document.getElementById('setting-passing_threshold').value],
          ['login_background_url', document.getElementById('setting-login_background_url').value],
        ];
        for (const [key, value] of pairs) {
          await sb.from('site_settings').upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });
        }
        showToast('Settings saved.', 'success');
      });
    }

    // ── Import placeholders ──
    // ── Student Import Engine (Excel / CSV) ──
    async function renderImportStudents(area) {
      const [programs, classes, allBatches] = await Promise.all([
        adminFetchAll('programs'),
        adminFetchAll('classes', '*, programs(name)'),
        adminFetchAll('batches', '*, classes(name)')
      ]);

      const sortedPrograms = [...programs].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedClasses = [...classes].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      const sortedBatches = [...allBatches].sort((a, b) => (a.name || '').localeCompare(b.name || ''));

      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title text-gradient" style="font-size:1.6rem;">Import Students (Excel / CSV)</h2>
            <p class="section-subtitle">Unggah data siswa sekaligus menggunakan spreadsheet Excel (.xlsx / .xls) atau file CSV. PIN akan otomatis di-hash (SHA-256) demi keamanan.</p>
          </div>
          <div class="d-flex gap-2">
            <button class="btn btn-secondary btn-sm" id="btn-back-to-students">← Back to Students</button>
            <button class="btn btn-primary btn-sm" id="btn-dl-student-template">📥 Unduh Template Siswa (.xlsx)</button>
          </div>
        </div>

        <div class="glass-card p-6 mb-6" style="max-width:980px;">
          <div class="form-grid mb-4">
            <div class="form-group">
              <label class="form-label">1. Target Program (Default / Override)</label>
              <select class="form-control" id="import-student-program">
                <option value="">— Gunakan Program dari File Excel —</option>
                ${sortedPrograms.map(p => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('')}
              </select>
              <span class="text-muted text-xs mt-1">Pilih jika ingin menetapkan semua siswa di file ke Program ini.</span>
            </div>

            <div class="form-group">
              <label class="form-label">2. Target Class (Default / Override)</label>
              <select class="form-control" id="import-student-class">
                <option value="">— Gunakan Kelas dari File Excel —</option>
                ${sortedClasses.map(c => `<option value="${c.id}" data-prog="${c.program_id}">[${escapeHtml(c.programs?.name || 'Program')}] ${escapeHtml(c.name)}</option>`).join('')}
              </select>
              <span class="text-muted text-xs mt-1">Pilih jika ingin menetapkan semua siswa di file ke Kelas ini.</span>
            </div>

            <div class="form-group">
              <label class="form-label">3. Target Batch (Default / Override)</label>
              <select class="form-control" id="import-student-batch" disabled>
                <option value="">— Pilih Kelas Terlebih Dahulu —</option>
              </select>
              <span class="text-muted text-xs mt-1">Pilih jika ingin menetapkan semua siswa di file ke Batch ini.</span>
            </div>

            <div class="form-group form-group-full">
              <label class="form-label">4. Pilih File Spreadsheet (.xlsx / .xls / .csv)</label>
              <div class="d-flex align-center gap-3">
                <input type="file" class="form-control" id="import-students-file" accept=".xlsx,.xls,.csv" style="flex:1;" />
              </div>
            </div>
          </div>

          <!-- Format Guide Box -->
          <div class="p-4 rounded mb-2" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);">
            <div class="d-flex align-center justify-between flex-wrap gap-2 mb-2">
              <span class="text-sm fw-700 text-gradient">FORMAT KOLOM SPREADSHEET SISWA</span>
              <span class="badge badge-info" style="font-size:0.75rem;">Mendukung Kolom Bahasa Indonesia &amp; English</span>
            </div>
            <div class="text-xs text-muted d-flex flex-column gap-1">
              <div>• <b>Name:</b> Kolom <code>NAME</code>, <code>Nama</code>, <code>Student Name</code>, atau <code>Nama Siswa</code> (Wajib).</div>
              <div>• <b>Gender (Opsional):</b> Kolom <code>GENDER</code>, <code>JK</code>, atau <code>Jenis Kelamin</code> (Menerima: male, female, L, P). <em>Jika dikosongkan, siswa akan memilih gendernya sendiri (Mr. / Miss) saat pertama kali masuk ke dashboard.</em></div>
              <div>• <b>Birth Date / Age:</b> Kolom <code>BIRTH_DATE</code>, <code>Tgl Lahir</code>, atau <code>AGE</code>/<code>Usia</code> (Format: YYYY-MM-DD atau angka usia).</div>
              <div>• <b>PIN:</b> Kolom <code>PIN</code> atau <code>Password</code> (Otomatis default ke <code>1234</code> jika dikosongkan).</div>
              <div>• <b>Program &amp; Class &amp; Batch:</b> Jika dikosongkan di file Excel, akan menggunakan Target Program, Class &amp; Batch yang dipilih di atas.</div>
            </div>
          </div>
        </div>

        <!-- Preview Container -->
        <div id="import-students-preview-wrap" class="hidden">
          <div class="glass-card p-6 mb-6">
            <div class="d-flex align-center justify-between flex-wrap gap-4 mb-4 pb-3" style="border-bottom:1px solid var(--clr-border);">
              <div>
                <h3 class="fw-700 text-gradient" style="font-size:1.25rem;">Preview Data Siswa</h3>
                <p class="text-sm text-muted" id="students-preview-summary">0 siswa terbaca dari file.</p>
              </div>
              <div class="d-flex align-center gap-3">
                <button class="btn btn-secondary btn-sm" id="btn-cancel-students-import">Batalkan</button>
                <button class="btn btn-primary btn-sm" id="btn-confirm-students-import">✓ Konfirmasi &amp; Simpan Siswa</button>
              </div>
            </div>

            <!-- Stats Chips -->
            <div class="d-flex gap-3 flex-wrap mb-4" id="students-preview-stat-chips">
              <span class="badge badge-info" id="chip-total-students">Total: 0</span>
              <span class="badge badge-success" id="chip-valid-students">Siap Diimpor: 0</span>
              <span class="badge badge-warning" id="chip-warn-students">Dimerge Existing: 0</span>
            </div>

            <div class="table-wrap" style="max-height:450px;overflow-y:auto;">
              <table>
                <thead>
                  <tr>
                    <th class="text-center" style="width:50px;">#</th>
                    <th class="text-left">Nama Siswa</th>
                    <th class="text-center">Gender</th>
                    <th class="text-center">Tgl Lahir / Usia</th>
                    <th class="text-left">Program</th>
                    <th class="text-left">Kelas</th>
                    <th class="text-left">Batch</th>
                    <th class="text-center">PIN Awal</th>
                    <th class="text-center">Status</th>
                  </tr>
                </thead>
                <tbody id="tbl-preview-students"></tbody>
              </table>
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
            'GENDER': '', // Opsional: kosongkan jika siswa akan memilih gender sendiri saat login pertama
            'BIRTH_DATE': '2010-11-03',
            'PIN': '5678',
            'PROGRAM': sortedPrograms[0]?.name || 'General English Program',
            'CLASS': sortedClasses[1]?.name || sortedClasses[0]?.name || 'Class B',
            'BATCH': 'Batch 2026-B'
          }
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Data Siswa');
        XLSX.writeFile(wb, 'Template_Student_Import.xlsx');
        showToast('Template siswa berhasil diunduh.', 'success');
      });

      // Program -> Class -> Batch cascading filter in top dropdowns
      const progSelect = document.getElementById('import-student-program');
      const classSelect = document.getElementById('import-student-class');
      const batchSelect = document.getElementById('import-student-batch');

      const updateBatchDropdown = (selectedClassId) => {
        batchSelect.innerHTML = `<option value="">— Gunakan Batch dari File Excel —</option>`;
        if (!selectedClassId) {
          batchSelect.disabled = true;
          batchSelect.innerHTML = `<option value="">— Pilih Kelas Terlebih Dahulu —</option>`;
          return;
        }
        batchSelect.disabled = false;
        const filteredBatches = sortedBatches.filter(b => b.class_id === selectedClassId && !b.deleted_at);
        filteredBatches.forEach(b => {
          const opt = document.createElement('option');
          opt.value = b.id;
          opt.textContent = b.name;
          batchSelect.appendChild(opt);
        });
      };

      progSelect?.addEventListener('change', () => {
        const selectedProg = progSelect.value;
        Array.from(classSelect.options).forEach(opt => {
          if (!opt.value) return; // Keep default option
          const optProg = opt.getAttribute('data-prog');
          opt.style.display = (!selectedProg || optProg === selectedProg) ? '' : 'none';
        });
        if (selectedProg && classSelect.selectedOptions[0]?.style.display === 'none') {
          classSelect.value = '';
        }
        updateBatchDropdown(classSelect.value);
      });

      classSelect?.addEventListener('change', () => {
        updateBatchDropdown(classSelect.value);
      });

      let parsedStudentsState = [];

      // File parser
      document.getElementById('import-students-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        showLoading('Membaca file spreadsheet…');
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
              showToast('File spreadsheet kosong.', 'warning');
              return;
            }

            // Fetch existing students to detect and merge duplicate names in the same class
            const existingStudents = await adminFetchAll('students');
            const existingStudentsMap = new Map();
            existingStudents.forEach(s => {
              if (s.deleted_at) return;
              const key = `${(s.name || '').toLowerCase().trim()}::${s.class_id}`;
              if (!existingStudentsMap.has(key)) {
                existingStudentsMap.set(key, s);
              }
            });

            const selectedProgId = document.getElementById('import-student-program').value;
            const selectedClassId = document.getElementById('import-student-class').value;
            const selectedBatchId = document.getElementById('import-student-batch')?.value;
            const selectedProg = sortedPrograms.find(p => p.id === selectedProgId);
            const selectedClass = sortedClasses.find(c => c.id === selectedClassId);
            const selectedBatch = sortedBatches.find(b => b.id === selectedBatchId);

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
              let ageDisplay = '—';

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
                const matchedC = sortedClasses.find(c => c.name.toLowerCase().trim() === rowClassName.toLowerCase().trim() && (!finalProgId || c.program_id === finalProgId));
                if (matchedC) {
                  finalClassId = matchedC.id;
                  finalClassName = matchedC.name;
                  if (!finalProgId && matchedC.program_id) {
                    finalProgId = matchedC.program_id;
                    finalProgName = matchedC.programs?.name || '';
                  }
                }
              }
              if (!finalClassId) {
                const firstClassInProg = sortedClasses.find(c => c.program_id === finalProgId) || sortedClasses[0];
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
                  b.class_id === finalClassId &&
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
              let statusMsg = '✨ Siswa Baru';
              let isExisting = false;
              let existingId = null;

              if (!finalClassId) {
                status = 'error';
                statusMsg = 'No Class Assigned';
              } else if (existingDbStudent) {
                status = 'merge';
                statusMsg = '🔄 Merge Existing';
                isExisting = true;
                existingId = existingDbStudent.id;
              }

              const item = {
                no: idx + 1,
                name: formatStudentName(name, gender),
                gender,
                birthDate: birthDate || null,
                ageDisplay,
                pin,
                programId: finalProgId,
                programName: finalProgName || 'Program',
                classId: finalClassId,
                className: finalClassName || 'Class',
                batchId: finalBatchId,
                batchName: finalBatchName || '—',
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
              showToast('Tidak ada data siswa yang valid ditemukan dalam spreadsheet.', 'warning');
              return;
            }

            renderPreviewTable(duplicateMergedInFileCount);
          } catch(err) {
            hideLoading();
            showToast('Gagal memproses file: ' + err.message, 'error');
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

        parsedStudentsState.forEach((s, i) => {
          if (s.status === 'valid') newCount++;
          else if (s.status === 'merge') mergeCount++;

          const tr = document.createElement('tr');
          let badgeHtml = '';
          if (s.status === 'valid') {
            badgeHtml = `<span class="badge badge-success">✨ Siswa Baru</span>`;
          } else if (s.status === 'merge') {
            badgeHtml = `<span class="badge badge-info">🔄 Merge / Update</span>`;
          } else {
            badgeHtml = `<span class="badge badge-danger">Error</span>`;
          }

          if (s.duplicateInFile) {
            badgeHtml += ` <span class="badge badge-warning ml-1" title="Dimerge dari baris kembar dalam spreadsheet">⚡ Dimerge dari File</span>`;
          }

          const genderBadge = s.gender === 'male'
            ? '<span class="badge badge-primary">👨 Male</span>'
            : s.gender === 'female'
            ? '<span class="badge badge-accent">👩 Female</span>'
            : '<span class="badge badge-neutral" style="font-size:0.7rem;" title="Siswa akan memilih gender saat login pertama">⏳ Unassigned</span>';

          tr.innerHTML = `
            <td class="text-center text-muted fw-700">${i + 1}</td>
            <td class="fw-600">${escapeHtml(s.name)}</td>
            <td class="text-center">${genderBadge}</td>
            <td class="text-center text-muted text-sm">${escapeHtml(s.birthDate || '—')} <span class="badge badge-info ml-1" style="font-size:0.7rem;">${escapeHtml(s.ageDisplay)}</span></td>
            <td class="text-muted text-sm">${escapeHtml(s.programName)}</td>
            <td class="fw-600 text-sm">${escapeHtml(s.className)}</td>
            <td class="text-sm fw-600" style="color:var(--clr-accent-1);">${escapeHtml(s.batchName || '—')}</td>
            <td class="text-center text-sm" style="font-family:monospace;letter-spacing:2px;">•••• <span class="text-muted text-xs" title="PIN: ${escapeHtml(s.pin)}">(${escapeHtml(s.pin)})</span></td>
            <td class="text-center">${badgeHtml}</td>
          `;
          tbody.appendChild(tr);
        });

        document.getElementById('students-preview-summary').textContent = `${parsedStudentsState.length} siswa siap diproses (${newCount} data baru, ${mergeCount} data existing di-merge).`;
        document.getElementById('chip-total-students').textContent = `Total: ${parsedStudentsState.length}`;
        document.getElementById('chip-valid-students').textContent = `✨ Baru: ${newCount}`;
        document.getElementById('chip-warn-students').textContent = `🔄 Merge: ${mergeCount}`;

        const saveBtn = document.getElementById('btn-confirm-students-import');
        if (saveBtn) {
          saveBtn.textContent = `Simpan & Merge (${parsedStudentsState.length} Siswa)`;
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
          showToast('Tidak ada siswa yang siap disimpan.', 'warning');
          return;
        }

              showLoading(`Processing ${readyStudents.length} students (saving new & merging existing)…`);
        try {
          let insertedCount = 0;
          let mergedCount = 0;

          // ── Auto-create missing batches first (before saving students) ──
          // Collect unique (classId, batchName) pairs that don't have a batchId yet
          const batchesToCreate = new Map(); // key: classId::batchName -> { classId, batchName }
          for (const s of readyStudents) {
            if (!s.batchId && s.batchName && s.batchName !== '—' && s.classId) {
              const key = `${s.classId}::${s.batchName.toLowerCase().trim()}`;
              if (!batchesToCreate.has(key)) {
                batchesToCreate.set(key, { classId: s.classId, batchName: s.batchName.trim() });
              }
            }
          }

          // Create missing batches and build a lookup map
          const newBatchMap = new Map(); // key: classId::batchName -> id
          for (const [key, { classId, batchName }] of batchesToCreate.entries()) {
            try {
              const newBatch = await adminInsert('batches', {
                class_id: classId,
                name: batchName,
                is_active: true
              });
              newBatchMap.set(key, newBatch.id);
              // Also push into sortedBatches so it's available for subsequent rows
              sortedBatches.push({ id: newBatch.id, class_id: classId, name: batchName, is_active: true });
              showToast(`Batch "${batchName}" dibuat otomatis.`, 'info');
            } catch(batchErr) {
              console.warn(`Could not auto-create batch "${batchName}":`, batchErr.message);
            }
          }

          // Resolve batch IDs for students that needed auto-creation
          for (const s of readyStudents) {
            if (!s.batchId && s.batchName && s.batchName !== '—' && s.classId) {
              const key = `${s.classId}::${s.batchName.toLowerCase().trim()}`;
              if (newBatchMap.has(key)) s.batchId = newBatchMap.get(key);
            }
          }

          // ── Safe student write helper: retries without extended columns if DB schema is old ──
          let _dbHasBatchId = true;  // Assume yes, will be set to false on first schema error
          let _dbHasBirthDate = true;
          let _dbHasProgramId = true;

          async function safeStudentInsert(payload) {
            // Remove null/undefined batch_id if DB doesn't have the column
            const p = { ...payload };
            if (!_dbHasBatchId) delete p.batch_id;
            if (!_dbHasBirthDate) delete p.birth_date;
            if (!_dbHasProgramId) delete p.program_id;
            try {
              return await adminInsert('students', p);
            } catch (e) {
              if (e.message && e.message.toLowerCase().includes('batch_id')) {
                _dbHasBatchId = false;
                showToast('⚠️ Column batch_id missing in DB — saving without batch. Run the SQL patch to fix this.', 'warning');
                delete p.batch_id;
                return await adminInsert('students', p);
              }
              if (e.message && e.message.toLowerCase().includes('birth_date')) {
                _dbHasBirthDate = false;
                delete p.birth_date;
                return await adminInsert('students', p);
              }
              if (e.message && e.message.toLowerCase().includes('program_id')) {
                _dbHasProgramId = false;
                delete p.program_id;
                return await adminInsert('students', p);
              }
              throw e;
            }
          }

          async function safeStudentUpdate(id, payload) {
            const p = { ...payload };
            if (!_dbHasBatchId) delete p.batch_id;
            if (!_dbHasBirthDate) delete p.birth_date;
            if (!_dbHasProgramId) delete p.program_id;
            try {
              return await adminUpdate('students', id, p);
            } catch (e) {
              if (e.message && e.message.toLowerCase().includes('batch_id')) {
                _dbHasBatchId = false;
                showToast('⚠️ Column batch_id missing in DB — saving without batch. Run the SQL patch to fix this.', 'warning');
                delete p.batch_id;
                return await adminUpdate('students', id, p);
              }
              if (e.message && e.message.toLowerCase().includes('birth_date')) {
                _dbHasBirthDate = false;
                delete p.birth_date;
                return await adminUpdate('students', id, p);
              }
              if (e.message && e.message.toLowerCase().includes('program_id')) {
                _dbHasProgramId = false;
                delete p.program_id;
                return await adminUpdate('students', id, p);
              }
              throw e;
            }
          }

          for (const s of readyStudents) {
            if (s.isExisting && s.existingId) {
              const payload = {
                program_id: s.programId,
                class_id: s.classId,
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
                program_id: s.programId,
                class_id: s.classId,
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
          const batchWarning = !_dbHasBatchId ? ' (batch_id column missing — run SQL patch to enable full batch support)' : '';
          showToast(`Done! ${insertedCount} new students added, ${mergedCount} updated/merged!${batchWarning}`, 'success');
          loadSection('students');
        } catch(err) {
          hideLoading();
          showToast('Import error: ' + err.message, 'error');
        }
      });
    }

    function renderImportQuestions(area) {
      area.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Import Questions (Excel)</h2>
            <p class="section-subtitle">Pilih Exam & Exam Type terlebih dahulu untuk melihat format template Excel yang sesuai sebelum mengunggah file.</p>
          </div>
        </div>

        <div class="glass-card p-6 mb-6" style="max-width:900px;">
          <div class="form-grid mb-4">
            <div class="form-group">
              <label class="form-label">1. Select Target Exam</label>
              <select class="form-control" id="import-exam-select"><option value="">Loading exams…</option></select>
            </div>
            <div class="form-group">
              <label class="form-label">2. Select / Override Exam Type (Cara Menjawab)</label>
              <select class="form-control" id="import-exam-type-select">
                <option value="written">Written (Ketik)</option>
                <option value="speech_to_text">Speech to Text (Suara US/UK)</option>
                <option value="multiple_choice">Multiple Choice (Pilihan Ganda)</option>
                <option value="dropdown">Drop-down (Pilihan Menu Tarik)</option>
              </select>
            </div>
            <div class="form-group form-group-full">
              <label class="form-label">3. Select Excel File (.xlsx / .xls / .csv)</label>
              <input type="file" class="form-control" id="import-questions-file" accept=".xlsx,.xls,.csv" />
            </div>
          </div>

          <!-- Required Columns Preview Box -->
          <div class="p-4 rounded mb-4" style="background:rgba(99,102,241,0.08);border:1px solid rgba(99,102,241,0.25);">
            <div class="d-flex align-center justify-between flex-wrap gap-3 mb-2">
              <span class="text-sm fw-700 text-gradient" id="format-title-badge">FORMAT KOLOM EXCEL KETIK (WRITTEN)</span>
              <button class="btn btn-primary btn-sm" id="download-template-btn">📥 Unduh Template Format Ini</button>
            </div>
            <p class="text-xs text-muted mb-2" id="format-desc-label">File Excel wajib memiliki susunan header kolom berikut pada baris pertama:</p>
            <div class="p-2 rounded text-xs mb-3" style="background:rgba(0,0,0,0.3);border:1px dashed var(--clr-border);font-family:monospace;overflow-x:auto;" id="format-columns-code">
              PROGRAM | CLASS | LEVEL | WEEK | DAY | TYPE | NO | INDONESIA | ENGLISH
            </div>
          </div>

          <!-- Quick Template Download Bar for All 4 Exam Types -->
          <div class="p-4 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);">
            <div class="text-xs fw-700 text-muted uppercase mb-3">Unduh Langsung Template Excel Per Jenis Exam:</div>
            <div class="d-flex flex-wrap gap-2">
              <button class="btn btn-secondary btn-sm" id="dl-tmpl-written">📄 Template Written (Ketik)</button>
              <button class="btn btn-secondary btn-sm" id="dl-tmpl-speech">🎙️ Template Speech to Text (Suara)</button>
              <button class="btn btn-secondary btn-sm" id="dl-tmpl-mc">🔘 Template Multiple Choice (Pilihan Ganda)</button>
              <button class="btn btn-secondary btn-sm" id="dl-tmpl-dropdown">▼ Template Drop-down</button>
            </div>
          </div>
        </div>

        <!-- Preview & Configuration Container -->
        <div id="import-preview-container" class="hidden">
          <div class="glass-card p-6 mb-6">
            <div class="d-flex align-center justify-between flex-wrap gap-4 mb-4">
              <div>
                <h3 class="text-gradient" id="preview-summary-title">Pratinjau Hasil Parsing Excel</h3>
                <p class="text-muted text-sm">Periksa data soal, kunci jawaban, serta opsi sebelum disimpan ke database.</p>
              </div>
              <div>
                <span class="badge badge-primary p-2" id="preview-exam-type-badge" style="font-size:0.85rem;">Exam Type: WRITTEN</span>
              </div>
            </div>

            <div class="table-wrap table-compact mb-5" style="max-height: 480px; overflow-y: auto; overflow-x: hidden;">
              <table style="width: 100%; table-layout: fixed;">
                <thead>
                  <tr>
                    <th style="width:3%;">NO</th>
                    <th style="width:5%;">PROG</th>
                    <th style="width:6%;">CLASS</th>
                    <th style="width:7%;">SUBJ</th>
                    <th style="width:7%;">LEVEL</th>
                    <th style="width:8%;">TITLE</th>
                    <th style="width:4%;" class="text-center">WK</th>
                    <th style="width:4%;" class="text-center">DAY</th>
                    <th style="width:7%;">TYPE</th>
                    <th style="width:23%;">QUESTION</th>
                    <th style="width:14%;">ANSWER</th>
                    <th style="width:3%;">A</th>
                    <th style="width:3%;">B</th>
                    <th style="width:3%;">C</th>
                    <th style="width:3%;">D</th>
                  </tr>
                </thead>
                <tbody id="tbl-import-preview"></tbody>
              </table>
            </div>

            <div class="d-flex justify-between align-center">
              <span class="text-muted text-sm" id="preview-count-label">0 soal siap di-import.</span>
              <div class="d-flex gap-3">
                <button class="btn btn-secondary" id="cancel-import-btn">Batal</button>
                <button class="btn btn-primary" id="confirm-save-import-btn">💾 Konfirmasi & Simpan Semua Soal</button>
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
          desc: 'Siswa menjawab dengan mengetikkan terjemahan/kata. Membutuhkan 11 kolom standar:',
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
          desc: 'Siswa menjawab dengan mengucapkan kalimat via mikrofon. Membutuhkan 11 kolom standar:',
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
          desc: 'Siswa memilih salah satu jawaban dari pilihan ganda (A, B, C, D). Membutuhkan 4 kolom opsi terpisah:',
          columns: 'PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER | OPTION A | OPTION B | OPTION C | OPTION D',
          sample: [
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 1, QUESTION: 'She ___ to school every day.', ANSWER: 'walks', 'OPTION A': 'walks', 'OPTION B': 'walk', 'OPTION C': 'walking', 'OPTION D': 'walked' },
            { PROGRAM: 'CEC', CLASS: 'Camp', SUBJECT: 'Vocab', LEVEL: '3rd Step', TITLE: 'Practice 1', WEEK: '1', DAY: '1', TYPE: '1 - VERB', NO: 2, QUESTION: 'They ___ playing football now.', ANSWER: 'are', 'OPTION A': 'are', 'OPTION B': 'is', 'OPTION C': 'am', 'OPTION D': 'was' }
          ]
        },
        dropdown: {
          title: 'FORMAT KOLOM EXCEL DROP-DOWN (MENU TARIK)',
          desc: 'Siswa memilih jawaban dari menu pilihan dropdown (Mendukung 2 s/d 10 opsi: OPTION A, B, C, D, E, F, G, H, I, J atau OPTION 1 s/d 10).',
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
        sel.innerHTML = '<option value="">— Pilih Target Exam —</option>' +
          sortedExams.map(e => `<option value="${e.id}">${escapeHtml(formatExamDisplayName(e))} (${(e.answer_type||'written').replace('_',' ')})</option>`).join('');
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
        showToast(`Template ${typeKey.replace('_',' ')} berhasil diunduh.`, 'success');
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

        showLoading('Reading Excel file preview…');
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
              const questionText = getRowVal(row, ['question', 'soal', 'pertanyaan', 'indonesia', 'text', 'prompt']);
              const correctAnswer = getRowVal(row, ['answer', 'jawaban', 'kunci', 'kuncijawaban', 'english', 'correctanswer', 'solution']);
              const rawNo = getRowVal(row, ['no', 'nomor', 'number', 'order', 'urutan']);
              const qNo = parseInt(rawNo || (i + 1), 10);
              const subject = getRowVal(row, ['subject', 'matapelajaran', 'mapel']);
              const title = getRowVal(row, ['title', 'examtitle', 'judul']);
              const week = getRowVal(row, ['week', 'minggu']);
              const day = getRowVal(row, ['day', 'hari']);
              const type = getRowVal(row, ['type', 'examtype', 'tipe', 'jenissoal']);

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

              const program = getRowVal(row, ['program', 'programname', 'namaprogram']) || selectedExam?.programs?.name || 'CEC';
              const className = getRowVal(row, ['class', 'classname', 'kelas', 'namakelas']) || 'Camp';
              const level = getRowVal(row, ['level', 'tingkat', 'levelnumber']) || selectedExam?.levels?.name || '3rd Step';

              parsedQuestionsState.push({
                order: isNaN(qNo) ? (i + 1) : qNo,
                questionText: String(questionText).trim(),
                correctAnswer: String(correctAnswer).trim(),
                answerType: defaultAnswerType,
                optionsJson: optionsJson,
                program, className, subject, level, title, week, day, type
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
        const currentExamType = document.getElementById('import-exam-type-select')?.value || 'written';
        const hasOptions = ['multiple_choice', 'dropdown'].includes(currentExamType);

        // Dynamically build <thead> columns based on whether exam type has options
        const theadContainer = document.querySelector('#import-preview-container table thead');
        if (theadContainer) {
          theadContainer.innerHTML = `
            <tr>
              <th style="width:3%;" class="text-center">NO</th>
              <th style="width:5%;">PROG</th>
              <th style="width:5%;">CLASS</th>
              <th style="width:6%;">SUBJ</th>
              <th style="width:7%;">LEVEL</th>
              <th style="width:7%;">TITLE</th>
              <th style="width:3%;" class="text-center">WK</th>
              <th style="width:3%;" class="text-center">DAY</th>
              <th style="width:7%;">TYPE</th>
              <th style="${hasOptions ? 'width:28%;' : 'width:38%;'}">QUESTION</th>
              <th style="${hasOptions ? 'width:14%;' : 'width:18%;'}">ANSWER</th>
              ${hasOptions ? `
                <th style="width:3.25%;">A</th>
                <th style="width:3.25%;">B</th>
                <th style="width:3.25%;">C</th>
                <th style="width:3.25%;">D</th>
              ` : ''}
            </tr>
          `;
        }

        const tableElem = document.querySelector('#import-preview-container table');
        if (tableElem) {
          tableElem.style.minWidth = '0';
          tableElem.style.width = '100%';
        }

        tbody.innerHTML = '';

        parsedQuestionsState.forEach((item, idx) => {
          const tr = document.createElement('tr');
          const opts = Array.isArray(item.optionsJson) ? item.optionsJson : [];
          const optA = opts[0] || '';
          const optB = opts[1] || '';
          const optC = opts[2] || '';
          const optD = opts[3] || '';

          tr.innerHTML = `
            <td class="text-muted fw-700 text-center">${item.order}</td>
            <td class="text-xs fw-600">${item.program || 'CEC'}</td>
            <td class="text-xs text-muted">${item.className || 'Camp'}</td>
            <td class="text-xs fw-600">${item.subject || 'Vocab'}</td>
            <td class="text-xs text-muted">${item.level || '3rd Step'}</td>
            <td class="text-xs text-muted">${item.title || 'Practice 1'}</td>
            <td class="text-xs text-center">${item.week || '1'}</td>
            <td class="text-xs text-center">${item.day || '1'}</td>
            <td class="text-xs"><span class="badge badge-neutral" style="font-size:0.65rem;">${item.type || '1 - VERB'}</span></td>
            <td class="fw-600">${item.questionText}</td>
            <td class="text-success fw-700">${item.correctAnswer}</td>
            ${hasOptions ? `
              <td class="text-xs ${optA === item.correctAnswer ? 'text-success fw-700' : 'text-muted'}">${optA || '—'}</td>
              <td class="text-xs ${optB === item.correctAnswer ? 'text-success fw-700' : 'text-muted'}">${optB || '—'}</td>
              <td class="text-xs ${optC === item.correctAnswer ? 'text-success fw-700' : 'text-muted'}">${optC || '—'}</td>
              <td class="text-xs ${optD === item.correctAnswer ? 'text-success fw-700' : 'text-muted'}">${optD || '—'}</td>
            ` : ''}
          `;
          tbody.appendChild(tr);
        });

        document.getElementById('preview-count-label').textContent = `${parsedQuestionsState.length} soal siap di-import.`;
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

        showLoading('Menyimpan & merge soal ke database…');
        try {
          const existingQuestions = await adminFetchAll('questions', '*', { exam_id: examId });
          const orderMap = new Map();
          const textMap = new Map();
          existingQuestions.forEach(q => {
            if (q.question_order != null) orderMap.set(Number(q.question_order), q);
            if (q.question_text) textMap.set(q.question_text.toLowerCase().trim(), q);
          });

          let insertedCount = 0;
          let mergedCount = 0;

          // Deduplicate within the file batch by order or text
          const batchMap = new Map();
          parsedQuestionsState.forEach(q => {
            const key = q.order != null ? `order::${q.order}` : `text::${q.questionText.toLowerCase().trim()}`;
            batchMap.set(key, q);
          });

          for (const q of batchMap.values()) {
            const payload = {
              exam_id: examId,
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
          showToast(`Berhasil menyimpan ${insertedCount + mergedCount} soal (${insertedCount} baru, ${mergedCount} di-merge/update)!`, 'success');
          loadSection('questions');
        } catch(err) {
          hideLoading();
          showToast(`Save error: ${err.message}`, 'error');
        }
      });
    }

    async function renderExportQuestions(area) {
      const exams = await adminFetchAll('exams', '*, programs(name), subjects(name), levels(name)');
      area.innerHTML = `
        <div class="section-header"><div><h2 class="section-title">Export Questions (Excel)</h2></div></div>
        <div class="glass-card p-8" style="max-width:640px;">
          <p class="text-muted mb-4">Export questions from an exam into an Excel workbook formatted with standard columns:</p>
          <div class="mb-5 p-3 rounded" style="background:rgba(255,255,255,0.03);border:1px solid var(--clr-border);font-size:0.75rem;font-family:monospace;">
            PROGRAM | CLASS | SUBJECT | LEVEL | TITLE | WEEK | DAY | TYPE | NO | QUESTION | ANSWER
          </div>
          <div class="form-group"><label class="form-label">Select Exam to Export</label>
            <select class="form-control" id="export-exam-select">
              <option value="">— Select Exam —</option>
              ${[...exams].sort((a, b) => {
                const labelA = `${a.exam_type ? a.exam_type + ' - ' : ''}${a.exam_title}`;
                const labelB = `${b.exam_type ? b.exam_type + ' - ' : ''}${b.exam_title}`;
                return labelA.localeCompare(labelB);
              }).map(e => `<option value="${e.id}">${e.exam_type ? e.exam_type + ' - ' : ''}${e.exam_title}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-primary mt-2" id="export-questions-btn">📤 Download Excel (.xlsx)</button>
        </div>
      `;

      document.getElementById('export-questions-btn').addEventListener('click', async () => {
        const examId = document.getElementById('export-exam-select').value;
        if (!examId) { showToast('Please select an exam to export.', 'warning'); return; }

        const selectedExam = exams.find(e => e.id === examId);
        showLoading('Preparing Excel export…');

        try {
          const [questions, examClasses] = await Promise.all([
            adminFetchAll('questions', '*', { exam_id: examId }),
            getSupabase().then(sb => sb.from('exam_classes').select('classes(name)').eq('exam_id', examId))
          ]);

          const sortedQuestions = questions.sort((a,b) => (a.question_order || 0) - (b.question_order || 0));
          const className = examClasses?.data?.[0]?.classes?.name || 'Camp';

          const excelData = sortedQuestions.map((q, idx) => ({
            'PROGRAM': selectedExam?.programs?.name || 'CEC',
            'CLASS': className,
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

    // ── CRUD Modal ──
    const crudModal = document.getElementById('crud-modal');
    const crudForm  = document.getElementById('crud-form');
    let _currentSection = null, _editId = null;

    const formFields = {
      programs: [
        { id: 'name', label: 'Program Name', type: 'text', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      subjects: [
        { id: 'name', label: 'Subject Name', type: 'text', required: true },
        { id: 'program_id', label: 'Program', type: 'select', source: 'programs', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      levels: [
        { id: 'program_id', label: 'Program', type: 'select', source: 'programs', required: true, uiOnly: true },
        { id: 'class_id', label: 'Class', type: 'select', source: 'classes', required: false, dependsOn: 'program_id' },
        { id: 'subject_id', label: 'Subject', type: 'select', source: 'subjects', required: true, dependsOn: 'program_id' },
        { id: 'level_number', label: 'Level Number', type: 'number', required: true, placeholder: 'e.g. 1' },
        { id: 'name', label: 'Level Name', type: 'text', required: true, placeholder: 'e.g. Level 1 - Beginner' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      classes: [
        { id: 'name', label: 'Class Name', type: 'text', required: true },
        { id: 'program_id', label: 'Program', type: 'select', source: 'programs', required: true },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      batches: [
        { id: 'program_id', label: 'Program (filter only)', type: 'select', source: 'programs', required: false, uiOnly: true },
        { id: 'class_id', label: 'Class', type: 'select', source: 'classes', required: true, dependsOn: 'program_id' },
        { id: 'name', label: 'Batch Name', type: 'text', required: true, placeholder: 'e.g. Batch 2026-A' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      students: [
        { id: 'program_id', label: 'Program', type: 'select', source: 'programs', required: true },
        { id: 'class_id', label: 'Class', type: 'select', source: 'classes', required: true, dependsOn: 'program_id' },
        { id: 'batch_id', label: 'Batch', type: 'select', source: 'batches', required: false, dependsOn: 'class_id' },
        { id: 'name', label: 'Full Name', type: 'text', required: true },
        { id: 'gender', label: 'Gender', type: 'select', options: [
          { value: '', label: '— Unassigned (Student will choose) —' },
          { value: 'male', label: 'Male (Mr.)' },
          { value: 'female', label: 'Female (Miss)' }
        ]},
        { id: 'birth_date', label: 'Birth Date', type: 'date' },
        { id: 'pin_hash', label: 'PIN (4 digits)', type: 'password', placeholder: '****' },
        { id: 'is_active', label: 'Active', type: 'checkbox' },
      ],
      exams: [
        { id: 'exam_title', label: 'Exam Title', type: 'text', required: true },
        { id: 'exam_type', label: 'Exam Type', type: 'text', required: true, placeholder: 'e.g. Mid-Term' },
        { id: 'program_id', label: 'Program', type: 'select', source: 'programs', required: true },
        { id: 'subject_id', label: 'Subject', type: 'select', source: 'subjects', required: true, dependsOn: 'program_id' },
        { id: 'level_id', label: 'Level', type: 'select', source: 'levels', required: true, dependsOn: 'subject_id' },
        { id: 'answer_type', label: 'Answer Type', type: 'select', options: ['dropdown','multiple_choice','speech_to_text','written'], required: true },
        { id: 'exam_status', label: 'Exam Status', type: 'select', options: ['draft','published','unpublished','archived'], required: true },
        { id: 'question_order', label: 'Question Order (Urutan Soal)', type: 'select', options: [{ value: 'sequential', label: 'Berurutan (Sequential)' }, { value: 'random', label: 'Acak (Random)' }], required: true },
        { id: 'time_limit_minutes', label: 'Time Limit (minutes)', type: 'number', required: true },
        { id: 'retake_allowed', label: 'Retake Allowed', type: 'checkbox' },
        { id: 'max_attempts', label: 'Max Attempts (blank = unlimited)', type: 'number' },
      ],
      questions: [
        { id: 'question_text', label: 'Question Text', type: 'textarea', required: true },
        { id: 'question_order', label: 'Order', type: 'number', required: true },
        { id: 'exam_id', label: 'Exam', type: 'select', source: 'exams', required: true },
        { id: 'answer_type', label: 'Answer Type', type: 'select', options: ['dropdown','multiple_choice','speech_to_text','written'], required: true },
        { id: 'correct_answer', label: 'Correct Answer', type: 'text', required: true },
        { id: 'options_json', label: 'Options (JSON array)', type: 'textarea', placeholder: '["Option A","Option B","Option C"]' },
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
          // Skip initial population for dependent dropdowns (handled by dependency logic below)
          if (!f.dependsOn) {
            sel.innerHTML = `<option value="">— Select —</option>`;
            const opts = await adminFetchAll(f.source);
            opts.forEach(o => {
              const opt = document.createElement('option');
              opt.value = o.id;
              opt.textContent = o.name || o.exam_title || o.id;
              if (record && record[f.id] === o.id) opt.selected = true;
              sel.appendChild(opt);
            });
          } else {
            sel.innerHTML = `<option value="">— Select Previous First —</option>`;
            sel.disabled = true;
          }
          group.appendChild(sel);
        } else if (f.type === 'select' && f.options) {
          const sel = document.createElement('select');
          sel.className = 'form-control';
          sel.id = `field-${f.id}`;
          sel.name = f.id;
          if (f.required) sel.required = true;
          sel.innerHTML = `<option value="">— Select —</option>` + f.options.map(o => {
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
          group.appendChild(inp);
        }

        formGrid.appendChild(group);
      }

      crudForm.appendChild(formGrid);

      // Program -> Class -> Batch dependency logic (Strict hierarchy: Program -> Class -> Batch)
      const progSelect = crudForm.querySelector('#field-program_id');
      const classSelect = crudForm.querySelector('#field-class_id');
      const batchSelect = crudForm.querySelector('#field-batch_id');

      if (progSelect && classSelect) {
        const populateBatchesForClass = async (selectedClassId) => {
          if (!batchSelect) return;
          batchSelect.innerHTML = `<option value="">— Select Batch —</option>`;
          if (!selectedClassId) {
            batchSelect.disabled = true;
            batchSelect.innerHTML = `<option value="">— Select Class First —</option>`;
            return;
          }
          batchSelect.disabled = false;
          const allBatches = await adminFetchAll('batches');
          const filteredBatches = allBatches.filter(b => b.class_id === selectedClassId && !b.deleted_at);
          filteredBatches.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            if (record && record.batch_id === b.id) opt.selected = true;
            batchSelect.appendChild(opt);
          });
        };

        const populateClassesForProgram = async (selectedProgId) => {
          classSelect.innerHTML = `<option value="">${_currentSection === 'levels' ? '— Select Class (Optional / All Classes) —' : '— Select Class —'}</option>`;
          if (batchSelect) {
            batchSelect.innerHTML = `<option value="">— Select Class First —</option>`;
            batchSelect.disabled = true;
          }
          if (!selectedProgId) {
            classSelect.disabled = true;
            return;
          }
          classSelect.disabled = false;
          const allClasses = await adminFetchAll('classes');
          const filteredClasses = allClasses.filter(c => c.program_id === selectedProgId && !c.deleted_at);
          filteredClasses.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (record && record.class_id === c.id) opt.selected = true;
            classSelect.appendChild(opt);
          });
          if (classSelect.value) {
            await populateBatchesForClass(classSelect.value);
          }
        };

        const initialProgId = record?.program_id || (record?.classes?.program_id) || (record?.subjects?.program_id) || progSelect.value;
        if (initialProgId) {
          progSelect.value = initialProgId;
          await populateClassesForProgram(initialProgId);
          if (record?.class_id) {
            classSelect.value = record.class_id;
            await populateBatchesForClass(record.class_id);
            if (record?.batch_id && batchSelect) {
              batchSelect.value = record.batch_id;
            }
          }
        } else {
          classSelect.disabled = true;
          classSelect.innerHTML = `<option value="">— Select Program First —</option>`;
        }

        progSelect.addEventListener('change', async (e) => {
          await populateClassesForProgram(e.target.value);
        });
      }

      // Program -> Subject -> Level cascading dependencies
      const subjectSelect = crudForm.querySelector('#field-subject_id');
      const levelSelect = crudForm.querySelector('#field-level_id');

      if (progSelect && subjectSelect) {
        const populateSubjectsForProgram = async (selectedProgId) => {
          subjectSelect.innerHTML = `<option value="">— Select Subject —</option>`;
          if (levelSelect) {
            levelSelect.innerHTML = `<option value="">— Select Subject First —</option>`;
            levelSelect.disabled = true;
          }
          if (!selectedProgId) {
            subjectSelect.disabled = true;
            return;
          }
          subjectSelect.disabled = false;
          const allSubjects = await adminFetchAll('subjects');
          const filteredSubjects = allSubjects.filter(s => s.program_id === selectedProgId);
          filteredSubjects.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (record && record.subject_id === s.id) opt.selected = true;
            subjectSelect.appendChild(opt);
          });
        };

        const initialProgIdForSubject = record?.program_id || (record?.subjects?.program_id) || progSelect?.value;
        if (initialProgIdForSubject) {
          await populateSubjectsForProgram(initialProgIdForSubject);
        } else {
          subjectSelect.disabled = true;
          subjectSelect.innerHTML = `<option value="">— Select Program First —</option>`;
        }

        progSelect.addEventListener('change', async (e) => {
          await populateSubjectsForProgram(e.target.value);
        });
      }

      if (subjectSelect && levelSelect) {
        const populateLevelsForSubject = async (selectedSubjId) => {
          levelSelect.innerHTML = `<option value="">— Select Level —</option>`;
          if (!selectedSubjId) {
            levelSelect.disabled = true;
            return;
          }
          levelSelect.disabled = false;
          const allLevels = await adminFetchAll('levels');
          const filteredLevels = allLevels.filter(l => l.subject_id === selectedSubjId);
          filteredLevels.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(l => {
            const opt = document.createElement('option');
            opt.value = l.id;
            opt.textContent = l.name;
            if (record && record.level_id === l.id) opt.selected = true;
            levelSelect.appendChild(opt);
          });
        };

        const initialSubjIdForLevel = record?.subject_id || subjectSelect?.value;
        if (initialSubjIdForLevel) {
          await populateLevelsForSubject(initialSubjIdForLevel);
        } else {
          levelSelect.disabled = true;
          levelSelect.innerHTML = `<option value="">— Select Subject First —</option>`;
        }

        subjectSelect.addEventListener('change', async (e) => {
          await populateLevelsForSubject(e.target.value);
        });
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
          try { payload[f.id] = el.value ? JSON.parse(el.value) : null; } catch { showToast('Invalid JSON in Options field.', 'error'); return; }
        }
        else if (f.type === 'password' && _editId && !el.value) continue; // Don't overwrite PIN if empty on edit
        else if (f.type === 'password' && el.value) {
          // Hash PIN client-side (browser) — real implementation should use Edge Function
          payload[f.id] = await hashPin(el.value);
        }
        else payload[f.id] = el.value || null;
      }

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
            if (targetTable === 'levels' && payloadToSave.class_id && (err.message?.includes('class_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
              delete payloadToSave.class_id;
              await adminUpdate(targetTable, _editId, payloadToSave);
            } else {
              throw err;
            }
          }
          showToast('Record updated.', 'success');
        } else {
          // If manually adding a student, check if identical student already exists in same class
          if (_currentSection === 'students') {
            const existingList = await adminFetchAll('students');
            const existingMatch = existingList.find(s => !s.deleted_at && s.class_id === payload.class_id && (formatStudentName(s.name, s.gender) || '').toLowerCase().trim() === (payload.name || '').toLowerCase().trim());
            if (existingMatch) {
              await adminUpdate('students', existingMatch.id, { ...payload, updated_at: new Date().toISOString() });
              showToast('Siswa dengan nama ini sudah ada di kelas tersebut. Data berhasil di-merge/update!', 'success');
              crudModal.classList.add('hidden');
              loadSection('students');
              return;
            }
          }
          try {
            await adminInsert(targetTable, payloadToSave);
          } catch (err) {
            if (targetTable === 'levels' && payloadToSave.class_id && (err.message?.includes('class_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
              delete payloadToSave.class_id;
              await adminInsert(targetTable, payloadToSave);
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
      // Simple SHA-256 hash for display — use server-side bcrypt in production
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

    // Sidebar toggle for mobile
    document.getElementById('sidebar-toggle').addEventListener('click', () => {
      document.getElementById('admin-sidebar').classList.toggle('open');
    });
    if (window.innerWidth <= 1024) document.getElementById('sidebar-toggle').style.display = 'flex';
  
