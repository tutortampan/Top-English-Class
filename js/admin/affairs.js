import { adminFetchAll, adminInsert, adminUpdate, adminSoftDelete, adminHardDelete } from '../api.js?v=4.0.5';
import { getSupabase } from '../supabase.js?v=4.0.5';

let currentProfessionalId = null;

async function ensureProfessionalProfile() {
  const records = await adminFetchAll('user_professionals');
  if (records && records.length > 0) {
    currentProfessionalId = records[0].id;
    return records[0];
  }
  return null;
}

export async function renderProfile(container) {
  const profile = await ensureProfessionalProfile();
  
  if (!profile) {
    container.innerHTML = `
      <div class="header-actions">
        <h2>My Profile</h2>
        <button class="btn btn-primary" id="btn-create-profile">Create Profile</button>
      </div>
      <div class="empty-state">
        <div class="empty-state__icon">??</div>
        <h3>No Profile Found</h3>
        <p>Set up your professional profile to begin.</p>
      </div>
    `;
    document.getElementById('btn-create-profile').onclick = () => window.openCrudModal('user_professionals', null);
    return;
  }

  container.innerHTML = `
    <div class="header-actions">
      <h2>My Profile</h2>
      <button class="btn btn-secondary" id="btn-edit-profile">Edit Profile</button>
    </div>
    <div class="card" style="margin-top: 1rem;">
      <h3>${profile.full_name || 'Unnamed Profile'}</h3>
      <p class="text-secondary">${profile.title || ''}</p>
      <div style="margin-top: 1rem;">
        <strong>Email:</strong> ${profile.contact_email || '-'}<br/>
        <strong>Phone:</strong> ${profile.contact_phone || '-'}
      </div>
      <div style="margin-top: 1rem;">
        <strong>Biography:</strong><br/>
        <p style="white-space: pre-wrap;">${profile.bio || 'No biography provided.'}</p>
      </div>
    </div>
  `;
  document.getElementById('btn-edit-profile').onclick = () => window.openCrudModal('user_professionals', profile.id, profile);
}

export async function renderSchedule(container) {
  // Fetch class instances and class meetings for personal schedule
  const [classInstances, classMeetings] = await Promise.all([
    adminFetchAll('class_instances', '*, classes(name)'),
    adminFetchAll('class_meetings', '*, class_instances(classes(name))')
  ]);
  const activeInstances = classInstances.filter(ci => ci.status === 'active');
  
  let html = `
    <div class="header-actions">
      <h2>Personal Schedule</h2>
    </div>
    <div class="data-grid" style="margin-top: 1rem;">
      <h3>Class Instances</h3>
      <table>
        <thead>
          <tr>
            <th>Class Name</th>
            <th>Schedule</th>
            <th>Start Date</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (activeInstances.length === 0) {
    html += `<tr><td colspan="3" class="text-center">No active class schedules found.</td></tr>`;
  } else {
    activeInstances.forEach(ci => {
      let scheduleText = '';
      try {
        const parsed = JSON.parse(ci.recurring_schedule);
        scheduleText = Array.isArray(parsed) ? parsed.join(', ') : ci.recurring_schedule;
      } catch (e) {
        scheduleText = ci.recurring_schedule || 'N/A';
      }
      
      html += `
        <tr>
          <td>${ci.classes?.name || ci.class_id || '-'}</td>
          <td>${scheduleText}</td>
          <td>${ci.start_date ? new Date(ci.start_date).toLocaleDateString() : '-'}</td>
        </tr>
      `;
    });
  }
  
  html += `</tbody></table></div>`;

  html += `
    <div class="data-grid" style="margin-top: 2rem;">
      <h3>Upcoming Meetings</h3>
      <table>
        <thead>
          <tr>
            <th>Class</th>
            <th>Meeting #</th>
            <th>Scheduled Date</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
  `;

  if (!classMeetings || classMeetings.length === 0) {
    html += `<tr><td colspan="4" class="text-center">No class meetings found.</td></tr>`;
  } else {
    const upcoming = classMeetings.filter(m => m.status === 'scheduled').sort((a,b) => new Date(a.scheduled_date) - new Date(b.scheduled_date)).slice(0, 10);
    if (upcoming.length === 0) {
      html += `<tr><td colspan="4" class="text-center">No scheduled meetings.</td></tr>`;
    } else {
      upcoming.forEach(m => {
        html += `
          <tr>
            <td>${m.class_instances?.classes?.name || '-'}</td>
            <td>${m.meeting_number}</td>
            <td>${new Date(m.scheduled_date).toLocaleString()}</td>
            <td><span class="badge badge-info">${m.status}</span></td>
          </tr>
        `;
      });
    }
  }

  html += `</tbody></table></div>`;
  container.innerHTML = html;
}

export async function renderWorkRecords(container) {
  const profile = await ensureProfessionalProfile();
  if (!profile) {
    container.innerHTML = `<div class="empty-state"><h3>Profile Required</h3><p>Please create a profile first.</p></div>`;
    return;
  }
  
  const records = await adminFetchAll('work_records');
  const myRecords = records.filter(r => r.user_professional_id === profile.id);
  
  let html = `
    <div class="header-actions">
      <h2>Work Records</h2>
      <button class="btn btn-primary" id="btn-add-work">Add Record</button>
    </div>
    <div class="data-grid" style="margin-top: 1rem;">
      <table>
        <thead>
          <tr>
            <th>Company</th>
            <th>Role</th>
            <th>Duration</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  if (myRecords.length === 0) {
    html += `<tr><td colspan="4" class="text-center">No work records found.</td></tr>`;
  } else {
    myRecords.sort((a,b) => new Date(b.start_date) - new Date(a.start_date)).forEach(r => {
      html += `
        <tr>
          <td><strong>${r.company_name}</strong></td>
          <td>${r.role_title}</td>
          <td>${r.start_date} — ${r.end_date || 'Present'}</td>
          <td>
            <button class="btn btn-ghost btn-sm btn-edit-work" data-id="${r.id}">Edit</button>
            <button class="btn btn-ghost btn-sm btn-del-work text-danger" data-id="${r.id}">Delete</button>
          </td>
        </tr>
      `;
    });
  }
  
  html += `</tbody></table></div>`;
  
  html += `
    <div class="header-actions" style="margin-top: 3rem;">
      <h2>Professional Skills</h2>
      <button class="btn btn-primary" id="btn-add-skill">Add Skill</button>
    </div>
    <div class="data-grid" style="margin-top: 1rem;">
      <table>
        <thead>
          <tr>
            <th>Skill</th>
            <th>Proficiency</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
  `;
  
  const skills = await adminFetchAll('professional_skills');
  const mySkills = skills.filter(s => s.user_professional_id === profile.id);
  
  if (mySkills.length === 0) {
    html += `<tr><td colspan="3" class="text-center">No skills found.</td></tr>`;
  } else {
    mySkills.forEach(s => {
      html += `
        <tr>
          <td><strong>${s.skill_name}</strong></td>
          <td>${s.proficiency_level}</td>
          <td>
            <button class="btn btn-ghost btn-sm btn-edit-skill" data-id="${s.id}">Edit</button>
            <button class="btn btn-ghost btn-sm btn-del-skill text-danger" data-id="${s.id}">Delete</button>
          </td>
        </tr>
      `;
    });
  }
  
  html += `</tbody></table></div>`;
  
  container.innerHTML = html;
  
  document.getElementById('btn-add-work').onclick = () => {
    window.openCrudModal('work_records', null, { user_professional_id: profile.id });
  };
  
  document.querySelectorAll('.btn-edit-work').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const rec = myRecords.find(r => r.id === id);
      window.openCrudModal('work_records', id, rec);
    };
  });
  
  document.querySelectorAll('.btn-del-work').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Delete this work record?')) {
        await adminHardDelete('work_records', btn.dataset.id);
        window.loadSection('work_records');
      }
    };
  });
  
  document.getElementById('btn-add-skill').onclick = () => {
    window.openCrudModal('professional_skills', null, { user_professional_id: profile.id });
  };
  
  document.querySelectorAll('.btn-edit-skill').forEach(btn => {
    btn.onclick = () => {
      const id = btn.dataset.id;
      const rec = mySkills.find(s => s.id === id);
      window.openCrudModal('professional_skills', id, rec);
    };
  });
  
  document.querySelectorAll('.btn-del-skill').forEach(btn => {
    btn.onclick = async () => {
      if (confirm('Delete this skill?')) {
        await adminHardDelete('professional_skills', btn.dataset.id);
        window.loadSection('work_records');
      }
    };
  });
}

export async function renderCvGenerator(container) {
  const profile = await ensureProfessionalProfile();
  if (!profile) {
    container.innerHTML = `<div class="empty-state"><h3>Profile Required</h3><p>Please create a profile first.</p></div>`;
    return;
  }
  
  container.innerHTML = `
    <div class="header-actions">
      <h2>CV Generator</h2>
      <button class="btn btn-primary" onclick="window.print()">Print / Export PDF</button>
    </div>
    <div class="card" style="margin-top: 1rem; padding: 2rem; background: #fff; color: #000;">
      <h1 style="border-bottom: 2px solid #000; padding-bottom: 0.5rem;">${profile.full_name || 'CV'}</h1>
      <h3 style="color: #555; margin-top: 0.5rem;">${profile.title || ''}</h3>
      <p style="margin-top: 1rem;"><strong>Email:</strong> ${profile.contact_email || ''} | <strong>Phone:</strong> ${profile.contact_phone || ''}</p>
      
      <div style="margin-top: 2rem;">
        <h4 style="text-transform: uppercase; border-bottom: 1px solid #ccc;">Summary</h4>
        <p style="margin-top: 0.5rem; white-space: pre-wrap;">${profile.bio || ''}</p>
      </div>
      
      <div style="margin-top: 2rem;" id="cv-work-records">
        <h4 style="text-transform: uppercase; border-bottom: 1px solid #ccc;">Experience</h4>
      </div>
      
      <div style="margin-top: 2rem;" id="cv-skills">
        <h4 style="text-transform: uppercase; border-bottom: 1px solid #ccc;">Skills</h4>
      </div>
    </div>
  `;
  
  const records = await adminFetchAll('work_records');
  const myRecords = records.filter(r => r.user_professional_id === profile.id).sort((a,b) => new Date(b.start_date) - new Date(a.start_date));
  const workDiv = document.getElementById('cv-work-records');
  myRecords.forEach(r => {
    workDiv.innerHTML += `
      <div style="margin-top: 1rem;">
        <div style="display: flex; justify-content: space-between;">
          <strong>${r.role_title}</strong>
          <span>${r.start_date} — ${r.end_date || 'Present'}</span>
        </div>
        <div><em>${r.company_name}</em></div>
        <p style="margin-top: 0.5rem; white-space: pre-wrap;">${r.description || ''}</p>
      </div>
    `;
  });
  
  const skills = await adminFetchAll('professional_skills');
  const mySkills = skills.filter(s => s.user_professional_id === profile.id);
  const skillsDiv = document.getElementById('cv-skills');
  let skillHtml = '<ul style="margin-top: 0.5rem; padding-left: 1.5rem;">';
  mySkills.forEach(s => {
    skillHtml += `<li><strong>${s.skill_name}</strong> - ${s.proficiency_level}</li>`;
  });
  skillHtml += '</ul>';
  skillsDiv.innerHTML += skillHtml;
}
