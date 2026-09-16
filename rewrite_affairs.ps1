$content = Get-Content -Raw -Encoding UTF8 'js/admin/affairs.js'

$replacement = @'
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
'@

$content = $content -replace '(?s)export async function renderSchedule\(container\) \{.*?html \+= `</tbody></table></div>`;\s*container\.innerHTML = html;\s*\}', $replacement
[IO.File]::WriteAllText('js/admin/affairs.js', $content, [System.Text.Encoding]::UTF8)
