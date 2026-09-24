import { adminFetchAll, adminInsert, adminUpdate, adminSoftDelete, adminHardDelete } from '../api.js?v=4.7.0';
import { getSupabase } from '../supabase.js?v=4.7.0';
import { generateExecutiveCV } from './cv-export.js?v=4.7.0';
import { getBustedAvatarUrl } from '../utils/avatar-engine.js?v=4.7.0';
import { showToast } from '../app.js?v=4.7.0';

async function ensureProfessionalProfile() {
  const records = await adminFetchAll('user_professionals');
  if (records && records.length > 0) {
    return records[0];
  }
  return null;
}

export async function renderDashboard(container) {
  const profile = await ensureProfessionalProfile();
  
  // Fetch some metrics for the dashboard
  const [students, classes, classMeetings] = await Promise.all([
    adminFetchAll('students'),
    adminFetchAll('classes'),
    adminFetchAll('class_meetings', '*, class_instances(classes(name))')
  ]);
  
  const activeStudents = students.filter(s => s.is_active).length;
  const activeClasses = classes.filter(c => c.is_active).length;
  
  const upcomingMeetings = classMeetings
    .filter(m => m.status === 'scheduled')
    .sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date))
    .slice(0, 5);

  container.innerHTML = `
    <div class="header-actions">
      <h2>Executive Dashboard</h2>
      <button class="btn btn-primary" id="btn-export-cv">📄 Export Executive CV (A4)</button>
    </div>
    
    <div style="display: flex; gap: 2rem; margin-top: 1.5rem; flex-wrap: wrap;">
      
      <!-- LEFT ZONE (65%) -->
      <div style="flex: 6.5; min-width: 300px; display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Key Metrics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem;">
          <div class="glass-card" style="padding: 1.5rem; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 800; color: var(--clr-primary);">${activeStudents}</div>
            <div class="text-muted text-sm text-uppercase fw-700">Active Students</div>
          </div>
          <div class="glass-card" style="padding: 1.5rem; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 800; color: var(--clr-accent-1);">${activeClasses}</div>
            <div class="text-muted text-sm text-uppercase fw-700">Active Classes</div>
          </div>
          <div class="glass-card" style="padding: 1.5rem; text-align: center;">
            <div style="font-size: 2.5rem; font-weight: 800; color: #10b981;">${upcomingMeetings.length}</div>
            <div class="text-muted text-sm text-uppercase fw-700">Upcoming Classes</div>
          </div>
        </div>

        <!-- Attention Radar -->
        <div class="glass-card" style="padding: 1.5rem;">
          <h3 style="margin-top:0;">&#128225; Attention Radar</h3>
          <p class="text-muted text-sm mb-3">Students requiring attention or recent alerts</p>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Program</th>
                  <th>Flag</th>
                </tr>
              </thead>
              <tbody>
                <tr><td colspan="3" class="text-center text-muted">All systems nominal. No immediate attention required.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        
      </div>
      
      <!-- RIGHT ZONE (35%) -->
      <div style="flex: 3.5; min-width: 250px; display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Admin Dossier -->
        <div class="glass-card" style="padding: 1.5rem; position: relative;">
          ${profile ? 
            `<div style="display: flex; gap: 1rem; align-items: center;">
              <div class="avatar-3x4" style="width: 80px; height: 106px; background: var(--clr-primary); color: white; display: flex; align-items: center; justify-content: center; font-size: 2rem; border-radius: 8px; overflow: hidden;">
                ${profile.photo_url ? `<img src="${profile.photo_url}" style="width:100%;height:100%;object-fit:cover;">` : (profile.full_name ? profile.full_name.charAt(0).toUpperCase() : 'A')}
              </div>
              <div>
                <h3 style="margin: 0;">${profile.full_name || 'Admin'}</h3>
                <div class="text-muted text-sm">${profile.title || 'Administrator'}</div>
              </div>
            </div>
            <p class="text-sm mt-3" style="line-height: 1.4;">${profile.bio ? profile.bio.substring(0, 150) + '...' : 'No biography provided.'}</p>`
           : 
            `<h3 style="margin-top:0;">Admin Dossier</h3>
            <p class="text-muted text-sm">No profile configured.</p>
            <button class="btn btn-secondary btn-sm mt-2" onclick="window.openCrudModal('user_professionals', null)">Create Profile</button>`
          }
        </div>

        <!-- Live Timetable -->
        <div class="glass-card" style="padding: 1.5rem;">
          <h3 style="margin-top:0;">&#128197; Live Timetable</h3>
          <div style="display: flex; flex-direction: column; gap: 0.8rem; margin-top: 1rem;">
            ${upcomingMeetings.length === 0 ? '<div class="text-muted text-sm">No scheduled meetings.</div>' : upcomingMeetings.map(m => 
              `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(255,255,255,0.03); border-radius: 8px; border: 1px solid var(--clr-border);">
                <div>
                  <div class="fw-700 text-sm">${m.class_instances?.classes?.name || 'Class Meeting'}</div>
                  <div class="text-xs text-muted">Meeting #${m.meeting_number}</div>
                </div>
                <div class="text-right">
                  <div class="text-xs">${new Date(m.scheduled_date).toLocaleDateString()}</div>
                  <div class="text-xs fw-700 text-info">${new Date(m.scheduled_date).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
                </div>
              </div>`
            ).join('')}
          </div>
        </div>
        
      </div>
    </div>
    
    <!-- BOTTOM DRAWER -->
    <div style="display: flex; gap: 2rem; margin-top: 1.5rem; flex-wrap: wrap;">
      <!-- Scratchpad -->
      <div class="glass-card" style="flex: 1; min-width: 250px; padding: 1.5rem;">
        <h3 style="margin-top:0;">&#128201; Workspace Scratchpad</h3>
        <textarea style="width: 100%; height: 120px; background: rgba(0,0,0,0.1); border: 1px solid var(--clr-border); border-radius: 8px; padding: 0.8rem; color: var(--clr-text-1); font-family: inherit; resize: none;" placeholder="Jot down quick notes here..."></textarea>
      </div>
      
      <!-- Audit Logs Preview -->
      <div class="glass-card" style="flex: 1; min-width: 250px; padding: 1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">&#128737;&#65039; System Audit</h3>
          <button class="btn btn-ghost btn-sm" onclick="window.loadSection('audit')">View All</button>
        </div>
        <div class="text-muted text-sm mt-3">Recent system events are logged securely. Monitor activity in the detailed Audit Log section.</div>
      </div>
    </div>
  `;

  const btn = document.getElementById('btn-export-cv');
  if(btn) {
    btn.addEventListener('click', async () => {
      if (!profile) {
        alert("Please create an Admin Profile first before generating a CV.");
        return;
      }
      
      const [workRecords, skills] = await Promise.all([
        adminFetchAll('work_records'),
        adminFetchAll('professional_skills')
      ]);
      
      generateExecutiveCV(
        profile, 
        workRecords.filter(r => r.user_professional_id === profile.id), 
        skills.filter(s => s.user_professional_id === profile.id)
      );
    });
  }
}

// ---------------------------------------------------------------------------
// PANEL A: SUB-VIEW 1 - MY PROFILE
// ---------------------------------------------------------------------------
export async function renderAdminProfile(container) {
  let profile = await ensureProfessionalProfile();
  
  container.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title">Administrator Profile</h2>
        <p class="section-subtitle">Manage your executive identity, 3:4 avatar, and professional credentials.</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-secondary btn-sm" id="btn-profile-export-cv">📄 Export Executive CV (A4)</button>
      </div>
    </div>

    <div style="display: flex; gap: 2rem; flex-wrap: wrap; margin-top: 1rem;">
      <!-- Avatar 3:4 Box (Left) -->
      <div class="glass-card" style="flex: 1; min-width: 280px; max-width: 340px; padding: 1.5rem; text-align: center;">
        <h4 style="margin: 0 0 1rem 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--clr-text-2);">Executive Avatar (3:4)</h4>
        <div style="width: 180px; height: 240px; margin: 0 auto; border-radius: 12px; overflow: hidden; border: 2px solid var(--clr-border); position: relative; background: rgba(0,0,0,0.2);">
          <img id="admin-avatar-preview" src="${getBustedAvatarUrl(profile?.photo_url)}" alt="Avatar" style="width: 100%; height: 100%; object-fit: cover;" />
          <div id="avatar-loading-overlay" class="hidden" style="position: absolute; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center;">
            <div class="spinner"></div>
          </div>
        </div>
        <div style="margin-top: 1.25rem;">
          <label for="admin-avatar-input" class="btn btn-secondary btn-sm" style="cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;">
            📸 Change Photo (3:4 Crop)
          </label>
          <input type="file" id="admin-avatar-input" accept="image/*" style="display: none;" />
          <div class="text-xs text-muted mt-2">Target: 300x400 WebP &bull; Max 80KB &bull; 35% Top Bias</div>
        </div>
      </div>

      <!-- Profile Form (Right) -->
      <div class="glass-card" style="flex: 2.5; min-width: 320px; padding: 1.75rem;">
        <h4 style="margin: 0 0 1.25rem 0; font-size: 0.95rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--clr-text-2);">Professional Credentials</h4>
        
        <form id="admin-profile-form">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group">
              <label class="form-label">Full Name *</label>
              <input type="text" class="form-control" id="adm-full-name" value="${profile?.full_name || ''}" placeholder="e.g. Dr. Alexander Vance" required />
            </div>
            <div class="form-group">
              <label class="form-label">Professional Title</label>
              <input type="text" class="form-control" id="adm-title" value="${profile?.title || ''}" placeholder="e.g. Lead Academic Director" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group">
              <label class="form-label">Email Address</label>
              <input type="email" class="form-control" id="adm-email" value="${profile?.contact_email || profile?.email || ''}" placeholder="director@topscore.edu" />
            </div>
            <div class="form-group">
              <label class="form-label">Contact Phone</label>
              <input type="tel" class="form-control" id="adm-phone" value="${profile?.contact_phone || profile?.phone || ''}" placeholder="+62 812-3456-7890" />
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
            <div class="form-group">
              <label class="form-label">Tahun Lahir</label>
              <input type="number" class="form-control" id="adm-birth-year" value="${profile?.cv_data?.birth_year || ''}" placeholder="e.g. 1985" min="1900" max="2100" />
            </div>
            <div class="form-group">
              <label class="form-label">Pendidikan Terakhir</label>
              <input type="text" class="form-control" id="adm-education" value="${profile?.cv_data?.education || ''}" placeholder="e.g. M.Ed. in TESOL" />
            </div>
          </div>

          <div class="form-group mb-3">
            <label class="form-label">Riwayat Kerja (Opsional)</label>
            <textarea class="form-control" id="adm-work-history" rows="2" placeholder="Brief summary of your professional experience...">${profile?.cv_data?.work_history || ''}</textarea>
          </div>

          <div class="form-group mb-4">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label class="form-label mb-0">Executive Biography (~350 characters for A4 CV)</label>
              <div class="d-flex align-center gap-2">
                <button type="button" class="btn btn-secondary btn-sm py-0" id="btn-auto-bio" style="font-size: 0.75rem; padding: 2px 8px;">✨ Auto-Generate Bio</button>
                <span id="adm-bio-counter" class="text-xs text-muted">0 / 350</span>
              </div>
            </div>
            <textarea class="form-control mt-2" id="adm-bio" rows="4" style="resize: vertical; font-family: inherit; line-height: 1.4;" placeholder="Brief summary of professional leadership, academic expertise, and teaching philosophies...">${profile?.bio || ''}</textarea>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 0.75rem; border-top: 1px solid var(--clr-border); padding-top: 1rem;">
            <button type="submit" class="btn btn-primary" id="btn-save-admin-profile">💾 Save Profile</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Character counter for bio
  const bioInput = document.getElementById('adm-bio');
  const bioCounter = document.getElementById('adm-bio-counter');
  const updateBioCounter = () => {
    const len = bioInput.value.length;
    bioCounter.textContent = `${len} / 350`;
    bioCounter.style.color = len > 350 ? 'var(--clr-danger, #ef4444)' : 'var(--clr-text-3)';
  };
  bioInput.addEventListener('input', updateBioCounter);
  updateBioCounter();

  // Auto-Generate Bio
  document.getElementById('btn-auto-bio').addEventListener('click', () => {
    const fullName = document.getElementById('adm-full-name').value.trim() || 'Administrator';
    const title = document.getElementById('adm-title').value.trim() || 'Education Professional';
    const education = document.getElementById('adm-education').value.trim() || 'Higher Education';
    const workHist = document.getElementById('adm-work-history').value.trim();

    let autoBio = `${fullName} is an experienced ${title} with a strong background in ${education}. Leveraging expertise in academic leadership and curriculum design, they are dedicated to fostering excellence and innovation in educational environments.`;
    
    if (workHist) {
      autoBio += ` Prior experience includes ${workHist}.`;
    }

    if (autoBio.length > 350) {
      autoBio = autoBio.substring(0, 347) + '...';
    }

    bioInput.value = autoBio;
    updateBioCounter();
    window.isProfileDirty = true;
    showToast('Auto-generated biography applied!', 'success');
  });

  // Dirty State Monitoring
  const form = document.getElementById('admin-profile-form');
  form.addEventListener('input', () => { window.isProfileDirty = true; });

  // Avatar Upload Handling (3:4 Admin Pipeline)
  const avatarInput = document.getElementById('admin-avatar-input');
  avatarInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const overlay = document.getElementById('avatar-loading-overlay');
    overlay.classList.remove('hidden');

    try {
      const { processAndCompressAvatar } = await import('../utils/avatar-engine.js');
      const compressedDataUrl = await processAndCompressAvatar(file, 'admin');

      // Optimistic preview
      document.getElementById('admin-avatar-preview').src = compressedDataUrl;

      // Save directly to profile
      if (profile && profile.id) {
        await adminUpdate('user_professionals', profile.id, { photo_url: compressedDataUrl });
        profile.photo_url = compressedDataUrl;
      } else {
        const created = await adminInsert('user_professionals', { 
          full_name: document.getElementById('adm-full-name').value || 'Administrator',
          photo_url: compressedDataUrl 
        });
        profile = created;
      }
      showToast('3:4 Executive Avatar processed and saved!', 'success');
    } catch (err) {
      showToast('Avatar processing failed: ' + err.message, 'error');
    } finally {
      overlay.classList.add('hidden');
      avatarInput.value = '';
    }
  });

  // Profile Form Save
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-admin-profile');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const payload = {
      full_name: document.getElementById('adm-full-name').value.trim(),
      title: document.getElementById('adm-title').value.trim(),
      contact_email: document.getElementById('adm-email').value.trim(),
      contact_phone: document.getElementById('adm-phone').value.trim(),
      bio: document.getElementById('adm-bio').value.trim(),
      cv_data: {
        ...(profile?.cv_data || {}),
        birth_year: document.getElementById('adm-birth-year').value.trim(),
        education: document.getElementById('adm-education').value.trim(),
        work_history: document.getElementById('adm-work-history').value.trim()
      }
    };

    try {
      if (profile && profile.id) {
        await adminUpdate('user_professionals', profile.id, payload);
      } else {
        profile = await adminInsert('user_professionals', payload);
      }
      window.isProfileDirty = false;
      showToast('Administrator profile updated successfully!', 'success');
    } catch (err) {
      showToast('Failed to save profile: ' + err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save Profile';
    }
  });

  // Export CV Button
  document.getElementById('btn-profile-export-cv')?.addEventListener('click', async () => {
    if (!profile) {
      showToast('Please save your profile first.', 'warning');
      return;
    }
    const [workRecords, skills] = await Promise.all([
      adminFetchAll('work_records'),
      adminFetchAll('professional_skills')
    ]);
    generateExecutiveCV(
      profile, 
      workRecords.filter(r => r.user_professional_id === profile.id), 
      skills.filter(s => s.user_professional_id === profile.id)
    );
  });
}

// ---------------------------------------------------------------------------
// PANEL A: SUB-VIEW 2 - PERSONAL SCHEDULE (AGENDA VIEW)
// ---------------------------------------------------------------------------
export async function renderAdminSchedule(container) {
  container.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title">Personal Schedule (Agenda View)</h2>
        <p class="section-subtitle">Synced class meetings and live instruction timetables.</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-secondary btn-sm" id="schedule-filter-all">All</button>
        <button class="btn btn-primary btn-sm" id="schedule-filter-scheduled">Upcoming Only</button>
      </div>
    </div>

    <div class="glass-card" style="padding: 1.5rem;">
      <div id="schedule-agenda-list" style="display: flex; flex-direction: column; gap: 1rem;">
        <div class="text-center py-4"><div class="spinner"></div><p class="text-muted mt-2">Loading schedule...</p></div>
      </div>
    </div>
  `;

  try {
    const meetings = await adminFetchAll('class_meetings', '*, class_instances(classes(name), batches(name))');
    const list = document.getElementById('schedule-agenda-list');

    if (!meetings || meetings.length === 0) {
      list.innerHTML = '<div class="text-center py-5 text-muted"><p>No class meetings scheduled.</p></div>';
      return;
    }

    // Sort by scheduled date
    const sorted = meetings.sort((a, b) => new Date(a.scheduled_date) - new Date(b.scheduled_date));

    const renderItems = (filterUpcoming = false) => {
      const now = new Date();
      const items = filterUpcoming 
        ? sorted.filter(m => new Date(m.scheduled_date) >= now && m.status === 'scheduled')
        : sorted;

      if (items.length === 0) {
        list.innerHTML = '<div class="text-center py-4 text-muted"><p>No meetings match the filter.</p></div>';
        return;
      }

      list.innerHTML = items.map(m => {
        const d = new Date(m.scheduled_date);
        const isPast = d < now;
        const className = m.class_instances?.classes?.name || 'Class Session';
        const batchName = m.class_instances?.batches?.name || 'Batch';

        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; background: rgba(255,255,255,0.02); border-radius: 10px; border: 1px solid var(--clr-border); flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1.25rem;">
              <div style="width: 54px; height: 54px; border-radius: 10px; background: ${isPast ? 'rgba(148,163,184,0.1)' : 'rgba(59,130,246,0.15)'}; color: ${isPast ? '#94a3b8' : '#3b82f6'}; display: flex; flex-direction: column; align-items: center; justify-content: center; font-weight: 800;">
                <span style="font-size: 0.75rem; text-transform: uppercase;">${d.toLocaleString('default', { month: 'short' })}</span>
                <span style="font-size: 1.25rem; line-height: 1;">${d.getDate()}</span>
              </div>
              <div>
                <h4 style="margin: 0; font-size: 1.05rem;">${className}</h4>
                <div class="text-xs text-muted mt-1">
                  <span>${batchName}</span> &bull; 
                  <span>Meeting #${m.meeting_number || 1}</span> &bull; 
                  <span>${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
              </div>
            </div>
            <div>
              <span class="badge ${m.status === 'completed' ? 'badge-success' : (isPast ? 'badge-neutral' : 'badge-info')}">
                ${m.status || (isPast ? 'Past' : 'Scheduled')}
              </span>
            </div>
          </div>
        `;
      }).join('');
    };

    renderItems(true);

    document.getElementById('schedule-filter-all')?.addEventListener('click', () => {
      document.getElementById('schedule-filter-all').className = 'btn btn-primary btn-sm';
      document.getElementById('schedule-filter-scheduled').className = 'btn btn-secondary btn-sm';
      renderItems(false);
    });

    document.getElementById('schedule-filter-scheduled')?.addEventListener('click', () => {
      document.getElementById('schedule-filter-scheduled').className = 'btn btn-primary btn-sm';
      document.getElementById('schedule-filter-all').className = 'btn btn-secondary btn-sm';
      renderItems(true);
    });

  } catch (err) {
    document.getElementById('schedule-agenda-list').innerHTML = `<div class="text-danger p-4">Error loading schedule: ${err.message}</div>`;
  }
}

// ---------------------------------------------------------------------------
// PANEL A: SUB-VIEW 3 - WORK RECORDS & SKILLS
// ---------------------------------------------------------------------------
export async function renderWorkRecords(container) {
  const profile = await ensureProfessionalProfile();

  container.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title">Work Records &amp; Skills</h2>
        <p class="section-subtitle">Manage professional experiences and competencies for CV export.</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-primary btn-sm" id="btn-add-work-record">+ Add Work Record</button>
      </div>
    </div>

    <div style="display: flex; gap: 2rem; flex-wrap: wrap;">
      <!-- Work Experience Table (Left 65%) -->
      <div class="glass-card" style="flex: 2; min-width: 320px; padding: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.05rem;">🏢 Professional History</h3>
        <div class="table-wrap">
          <table class="table w-100">
            <thead>
              <tr>
                <th>Period</th>
                <th>Role</th>
                <th>Institution</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody id="work-records-tbody">
              <tr><td colspan="4" class="text-center py-4"><div class="spinner"></div></td></tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Skills Chip Cloud (Right 35%) -->
      <div class="glass-card" style="flex: 1; min-width: 260px; padding: 1.5rem;">
        <h3 style="margin: 0 0 1rem 0; font-size: 1.05rem;">🎯 Skills &amp; Competencies</h3>
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem;">
          <input type="text" id="new-skill-input" class="form-control form-control-sm" placeholder="e.g. Pronunciation Testing" />
          <button class="btn btn-primary btn-sm" id="btn-add-skill">Add</button>
        </div>
        <div id="skills-cloud" style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          <div class="spinner"></div>
        </div>
      </div>
    </div>
  `;

  async function loadData() {
    try {
      const [records, skills] = await Promise.all([
        adminFetchAll('work_records'),
        adminFetchAll('professional_skills')
      ]);

      // Render Work Records
      const tbody = document.getElementById('work-records-tbody');
      if (!records || records.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-muted">No work records added yet.</td></tr>';
      } else {
        const sorted = [...records].sort((a, b) => (b.period || b.start_date || '').localeCompare(a.period || a.start_date || ''));
        tbody.innerHTML = sorted.map(r => `
          <tr>
            <td class="fw-600 text-xs">${r.period || r.start_date || 'N/A'}</td>
            <td><strong>${r.role || r.role_title || 'Role'}</strong></td>
            <td class="text-sm text-muted">${r.institution || r.company_name || 'Organization'}</td>
            <td style="text-align: right;">
              <button class="btn btn-danger btn-xs btn-delete-work" data-id="${r.id}">Del</button>
            </td>
          </tr>
        `).join('');

        document.querySelectorAll('.btn-delete-work').forEach(b => {
          b.addEventListener('click', async (e) => {
            if (!confirm('Delete this work record?')) return;
            await adminHardDelete('work_records', e.target.dataset.id);
            showToast('Work record deleted.', 'success');
            loadData();
          });
        });
      }

      // Render Skills
      const cloud = document.getElementById('skills-cloud');
      if (!skills || skills.length === 0) {
        cloud.innerHTML = '<span class="text-muted text-sm">No skills listed. Add some above.</span>';
      } else {
        cloud.innerHTML = skills.map(s => `
          <span class="badge badge-info" style="display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.65rem; font-size: 0.85rem;">
            ${s.skill_name}
            <span class="btn-remove-skill" data-id="${s.id}" style="cursor: pointer; font-weight: 800; margin-left: 0.25rem;">&times;</span>
          </span>
        `).join('');

        document.querySelectorAll('.btn-remove-skill').forEach(b => {
          b.addEventListener('click', async (e) => {
            await adminHardDelete('professional_skills', e.target.dataset.id);
            loadData();
          });
        });
      }
    } catch (err) {
      console.warn('Error loading work records:', err);
    }
  }

  loadData();

  // Add Work Record Action
  document.getElementById('btn-add-work-record')?.addEventListener('click', () => {
    window.openCrudModal('work_records', null, () => loadData());
  });

  // Add Skill Action
  document.getElementById('btn-add-skill')?.addEventListener('click', async () => {
    const input = document.getElementById('new-skill-input');
    const val = input.value.trim();
    if (!val) return;
    try {
      await adminInsert('professional_skills', {
        skill_name: val,
        user_professional_id: profile?.id || null,
        proficiency_level: 'Advanced'
      });
      input.value = '';
      loadData();
      showToast('Skill added!', 'success');
    } catch (err) {
      showToast('Failed to add skill: ' + err.message, 'error');
    }
  });
}

// ---------------------------------------------------------------------------
// PANEL A: SUB-VIEW 4 - CV GENERATOR (INTERACTIVE PREVIEW & 1-PAGE EXPORT)
// ---------------------------------------------------------------------------
export async function renderCVGenerator(container) {
  const profile = await ensureProfessionalProfile();
  const [workRecords, skills] = await Promise.all([
    adminFetchAll('work_records'),
    adminFetchAll('professional_skills')
  ]);

  const pWork = (workRecords || []).filter(r => !profile || r.user_professional_id === profile.id);
  const pSkills = (skills || []).filter(s => !profile || s.user_professional_id === profile.id);

  container.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title">1-Page A4 Executive CV Generator</h2>
        <p class="section-subtitle">Real-time preview formatted strictly to 1 physical A4 portrait page with 8mm 10mm margins.</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-secondary btn-sm" onclick="window.loadSection('profile')">✏️ Edit Profile</button>
        <button class="btn btn-primary btn-sm" id="btn-trigger-a4-print">🖨️ Print / Save as PDF (A4)</button>
      </div>
    </div>

    <!-- Live Preview Sheet (Simulated A4 Dimensions) -->
    <div class="glass-card" style="max-width: 820px; margin: 1.5rem auto; padding: 2.5rem; background: #ffffff; color: #0f172a; border-radius: 8px; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2.5px solid #0f172a; padding-bottom: 0.75rem; margin-bottom: 1rem;">
        <div>
          <h1 style="font-size: 1.6rem; font-weight: 800; margin: 0; color: #0f172a; letter-spacing: -0.02em;">${profile?.full_name || 'Executive Administrator'}</h1>
          <div style="font-size: 9.5pt; font-weight: 700; color: #2563eb; margin-top: 0.2rem; text-transform: uppercase;">${profile?.title || 'Academic Director'}</div>
          <div style="margin-top: 0.35rem; font-size: 8pt; color: #64748b;">
            <span>${profile?.contact_email || profile?.email || 'admin@topscore.edu'}</span> &bull; 
            <span>${profile?.contact_phone || profile?.phone || '+62 812-3456-7890'}</span>
          </div>
        </div>
        <div>
          <img src="${getBustedAvatarUrl(profile?.photo_url)}" alt="Avatar" style="width: 72px; height: 96px; object-fit: cover; border-radius: 4px; border: 1.5px solid #0f172a;" />
        </div>
      </div>

      <!-- Summary -->
      <div style="margin-bottom: 1rem;">
        <h3 style="font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.2rem; margin-bottom: 0.4rem;">Executive Summary</h3>
        <p style="font-size: 8.5pt; line-height: 1.35; color: #334155; margin: 0;">
          ${(profile?.bio && profile.bio.length > 350) ? profile.bio.substring(0, 347) + '...' : (profile?.bio || 'Experienced educational leader specializing in language pedagogy and assessment systems.')}
        </p>
      </div>

      <!-- Experience -->
      <div style="margin-bottom: 1rem;">
        <h3 style="font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.2rem; margin-bottom: 0.4rem;">Professional Experience</h3>
        ${pWork.length > 0 ? pWork.map(w => `
          <div style="margin-bottom: 0.45rem; font-size: 8.5pt;">
            <div style="display: flex; justify-content: space-between;">
              <strong style="color: #0f172a;">${w.role || w.role_title || 'Role'}</strong>
              <span style="color: #64748b; font-size: 8pt;">${w.period || w.start_date || ''}</span>
            </div>
            <div style="color: #2563eb; font-weight: 600; font-size: 8pt;">${w.institution || w.company_name || 'Organization'}</div>
            ${w.description ? `<div style="color: #475569; font-size: 8pt; margin-top: 0.15rem;">${w.description}</div>` : ''}
          </div>
        `).join('') : '<p style="font-size: 8.5pt; color: #64748b; font-style: italic;">No work records configured.</p>'}
      </div>

      <!-- Skills -->
      <div style="margin-bottom: 1.5rem;">
        <h3 style="font-size: 9pt; font-weight: 800; text-transform: uppercase; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 0.2rem; margin-bottom: 0.4rem;">Key Competencies</h3>
        <p style="font-size: 8.5pt; color: #334155; margin: 0;">
          ${pSkills.map(s => s.skill_name).join(' &bull; ') || 'Curriculum Design &bull; Communicative Language Teaching &bull; Digital Testing'}
        </p>
      </div>

      <!-- Footer Anchor -->
      <div style="text-align: center; font-size: 7pt; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 0.35rem;">
        TopsCore LMS &middot; Official Executive Dossier &middot; Exactly 1 Page Fit Guaranteed
      </div>
    </div>
  `;

  document.getElementById('btn-trigger-a4-print')?.addEventListener('click', () => {
    generateExecutiveCV(profile, pWork, pSkills);
  });
}

