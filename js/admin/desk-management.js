import { adminFetchAll, adminFetchDeleted, adminRestore, clearAdminCache, testSupabaseConnection } from '../api.js?v=4.0.5';
import { getSupabase } from '../supabase.js?v=4.0.5';
import { showToast, showLoading, hideLoading } from '../app.js?v=4.0.5';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

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


    // â”€â”€ SETTINGS & SYSTEM TOOLS (D — DESK) â”€â”€
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
            <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">ðŸŒ Global Platform Configuration</h3>
            <div class="form-group">
              <label class="form-label">Site Name</label>
              <input class="form-control" id="setting-site_name" value="${escapeHtml(settings.site_name || 'TOPS CORE')}" />
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
            <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">ðŸ”’ Security & Administrator Access</h3>
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
            <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">ðŸ› ï¸ System Tools & Diagnostics</h3>
            <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(240px, 1fr));gap:1rem;">
              <div style="background:var(--clr-surface-2);padding:1rem;border-radius:8px;border:1px solid var(--clr-border);">
                <div class="fw-600 text-sm mb-1">Database Connectivity & Latency</div>
                <div class="text-xs text-muted mb-3" id="diag-db-status">Testing cloud database connection...</div>
                <button class="btn btn-secondary btn-xs" id="btn-diag-test-conn">âš¡ Test Latency</button>
              </div>

              <div style="background:var(--clr-surface-2);padding:1rem;border-radius:8px;border:1px solid var(--clr-border);">
                <div class="fw-600 text-sm mb-1">Local Browser Cache</div>
                <div class="text-xs text-muted mb-3">Clear client-side cached queries, rosters, and question indexes.</div>
                <button class="btn btn-secondary btn-xs" id="btn-diag-clear-cache">ðŸ—‘ï¸ Flush Cache</button>
              </div>

              <div style="background:var(--clr-surface-2);padding:1rem;border-radius:8px;border:1px solid var(--clr-border);">
                <div class="fw-600 text-sm mb-1">Activity & Audit Logs</div>
                <div class="text-xs text-muted mb-3">Inspect system changes, logins, exams published, and student updates.</div>
                <button class="btn btn-outline btn-xs" id="btn-diag-view-audit">ðŸ“œ View Audit Log â†’</button>
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


    async function renderDataHealth(container) {
      container.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Data Health <span class="count-chip">Diagnostics</span></h2>
            <p class="section-subtitle">Scan the database for integrity issues, duplicates, and orphaned records</p>
          </div>
        </div>

        <div class="grid" style="grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem; margin-top: 0.5rem;">
          
          <!-- Students Duplicate Engine -->
          <div class="card d-flex flex-col gap-3">
            <div class="d-flex align-center gap-3">
              <div style="font-size:2rem; background:rgba(59, 130, 246, 0.1); padding:0.5rem; border-radius:10px;">ðŸ‘¤</div>
              <div>
                <h3 class="fw-700">Student Profile Duplicates</h3>
                <div class="text-xs text-muted">Scans for identical names within the same class</div>
              </div>
            </div>
            <p style="font-size:0.85rem; color:var(--clr-text-2);">
              Automatically detect students who accidentally registered twice. You can merge their profiles safely, transferring all past exam progress to the primary account.
            </p>
            <button class="btn btn-primary mt-auto" id="btn-health-scan-students">
              <span class="nav-icon">ðŸ”</span> Scan Students
            </button>
          </div>

          <!-- Question Duplicate Engine -->
          <div class="card d-flex flex-col gap-3">
            <div class="d-flex align-center gap-3">
              <div style="font-size:2rem; background:rgba(250, 204, 21, 0.1); padding:0.5rem; border-radius:10px;">âš¡</div>
              <div>
                <h3 class="fw-700">Question Bank Duplicates</h3>
                <div class="text-xs text-muted">Scans for duplicate text or order conflicts</div>
              </div>
            </div>
            <p style="font-size:0.85rem; color:var(--clr-text-2);">
              Detect duplicate questions inside the same exam, or identically worded questions spread across multiple exams. Bulk-resolve them to keep the blueprint clean.
            </p>
            <button class="btn btn-warning mt-auto" id="btn-health-scan-questions" style="color:#000;">
              <span class="nav-icon">ðŸ”</span> Scan Questions
            </button>
          </div>

        </div>
      `;

      document.getElementById('btn-health-scan-students').addEventListener('click', () => {
        openDuplicateStudentsModal();
      });

      document.getElementById('btn-health-scan-questions').addEventListener('click', () => {
        openDuplicateQuestionsModal();
      });
    }


    async function renderRecycleBin(container) {
      container.innerHTML = `
        <div class="section-header">
          <div>
            <h2 class="section-title">Recycle Bin <span class="count-chip">Soft-Deleted</span></h2>
            <p class="section-subtitle">Restore soft-deleted Students, Exams, Programs and Questions. Hard-delete is permanent.</p>
          </div>
        </div>
        <div class="d-flex gap-2 mb-3" style="margin-top:0.5rem;">
          <select id="recycle-table-select" class="form-control" style="max-width:200px;">
            <option value="students">Students</option>
            <option value="exams">Exams</option>
            <option value="programs">Programs</option>
            <option value="questions">Questions</option>
          </select>
          <button class="btn btn-secondary" id="recycle-refresh-btn">Load Deleted</button>
        </div>
        <div class="table-wrap" id="recycle-results">
          <div class="p-4 text-center text-muted" style="font-size:0.875rem;">Select an entity type and click Load Deleted.</div>
        </div>
      `;

      const loadDeleted = async () => {
        const table = document.getElementById('recycle-table-select').value;
        const resDiv = document.getElementById('recycle-results');
        resDiv.innerHTML = '<div class="p-4 text-center"><div class="spinner"></div> Loading...</div>';
        
        try {
          const data = await adminFetchDeleted(table);
          if (!data || data.length === 0) {
            resDiv.innerHTML = `<div class="p-4 text-center text-muted">No deleted records found in ${table}.</div>`;
            return;
          }

          let html = `
            <table>
              <thead>
                <tr>
                  <th class="text-left" style="width:4rem;">ID</th>
                  <th class="text-left">Name / Title</th>
                  <th class="text-center">Deleted At</th>
                  <th class="text-right" style="width:120px;">Actions</th>
                </tr>
              </thead>
              <tbody>
          `;
          data.forEach(item => {
            const name = item.name || item.title || item.question_text?.substring(0,30) + '...' || 'Unnamed';
            html += `
              <tr>
                <td style="font-family:monospace; font-size:0.8rem;">${item.id}</td>
                <td><strong>${escapeHtml(name)}</strong></td>
                <td>${new Date(item.deleted_at).toLocaleString()}</td>
                <td>
                  <button class="btn btn-outline btn-xs restore-btn" data-table="${table}" data-id="${item.id}">Restore</button>
                </td>
              </tr>
            `;
          });
          html += `</tbody></table>`;
          resDiv.innerHTML = html;

          resDiv.querySelectorAll('.restore-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
              const t = e.target.dataset.table;
              const id = e.target.dataset.id;
              if (confirm('Are you sure you want to restore this record?')) {
                showLoading('Restoring...');
                try {
                  await adminRestore(t, id);
                  hideLoading();
                  showToast('Record restored successfully.', 'success');
                  loadDeleted();
                } catch(err) {
                  hideLoading();
                  showToast('Failed to restore: ' + err.message, 'error');
                }
              }
            });
          });
        } catch(err) {
          resDiv.innerHTML = `<div class="p-4 text-center text-red-500">Error: ${escapeHtml(err.message)}</div>`;
        }
      };

      document.getElementById('recycle-refresh-btn').addEventListener('click', loadDeleted);
      loadDeleted();
    }


export { renderAuditLog, renderSettings, renderDataHealth, renderRecycleBin };
