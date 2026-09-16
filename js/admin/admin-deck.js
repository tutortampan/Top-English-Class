import { adminFetchAll, adminInsert, adminUpdate, adminSoftDelete, adminHardDelete } from '../api.js?v=4.1.0';
import { getSupabase } from '../supabase.js?v=4.1.0';
import { generateExecutiveCV } from './cv-export.js?v=4.1.0';

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
      <button class="btn btn-primary" id="btn-export-cv">ðŸ“„ Export Executive CV (A4)</button>
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
          <h3 style="margin-top:0;">ðŸ“¡ Attention Radar</h3>
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
          <h3 style="margin-top:0;">ðŸ—“ï¸  Live Timetable</h3>
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
        <h3 style="margin-top:0;">ðŸ“  Workspace Scratchpad</h3>
        <textarea style="width: 100%; height: 120px; background: rgba(0,0,0,0.1); border: 1px solid var(--clr-border); border-radius: 8px; padding: 0.8rem; color: var(--clr-text-1); font-family: inherit; resize: none;" placeholder="Jot down quick notes here..."></textarea>
      </div>
      
      <!-- Audit Logs Preview -->
      <div class="glass-card" style="flex: 1; min-width: 250px; padding: 1.5rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0;">ðŸ›¡ï¸  System Audit</h3>
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
