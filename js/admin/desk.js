/**
 * js/admin/desk.js
 * PILAR [D] DATA — SYSTEM ADMINISTRATION, SECURITY & HEALTH
 * Modules:
 * 1. Recycle Bin (Centralized Data Recovery & Gated Hard Purge)
 * 2. Activity & Audit Logs (Immutable Event Trail)
 * 3. Data Health & Connectivity (Real-Time Sync, Latency, Storage, Diagnostics)
 * 4. Site Settings & API Cost Guard (API Key Vault & Rate Limiting)
 */

import {
  adminFetchAll,
  adminFetchDeleted,
  adminRestore,
  adminHardDelete,
  clearAdminCache,
  testSupabaseConnection
} from '../api.js?v=4.4.1';
import { getSupabase } from '../supabase.js?v=4.4.1';
import { showToast, showLoading, hideLoading } from '../app.js?v=4.4.1';
import { openDuplicateStudentsModal, openDuplicateQuestionsModal } from './crud-modals.js?v=4.4.1';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ============================================================
// MODULE 1: RECYCLE BIN (CENTRALIZED DATA RECOVERY & GATED PURGE)
// ============================================================

export async function renderRecycleBin(container) {
  container.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-2 mb-4">
      <div>
        <h2 class="section-title text-gradient">Recycle Bin <span class="count-chip" id="recycle-total-chip">Loading...</span></h2>
        <p class="section-subtitle">Centralized data recovery for soft-deleted Students, Classes, Assessments, and Questions</p>
      </div>
      <div class="d-flex gap-2 align-center">
        <button class="btn btn-secondary btn-sm" id="recycle-refresh-all-btn">&#x21bb; Refresh Bin</button>
      </div>
    </div>

    <!-- Filter Tabs -->
    <div class="d-flex gap-2 flex-wrap mb-3" id="recycle-type-tabs">
      <button class="btn btn-primary btn-xs recycle-tab-btn" data-type="all">All Entities</button>
      <button class="btn btn-secondary btn-xs recycle-tab-btn" data-type="students">Students</button>
      <button class="btn btn-secondary btn-xs recycle-tab-btn" data-type="programs">Classes (Programs)</button>
      <button class="btn btn-secondary btn-xs recycle-tab-btn" data-type="exams">Assessments (Exams)</button>
      <button class="btn btn-secondary btn-xs recycle-tab-btn" data-type="questions">Questions</button>
    </div>

    <!-- Aggregated Table -->
    <div class="antigravity-card p-4">
      <div class="table-wrap" id="recycle-results-wrap">
        <div class="p-5 text-center text-muted"><div class="spinner"></div> Scanning Recycle Bin...</div>
      </div>
    </div>

    <!-- Gated Hard Purge Modal Container -->
    <div id="purge-modal-container"></div>
  `;

  let currentDeletedRecords = [];
  let currentFilterType = 'all';

  const fetchAllDeleted = async () => {
    const wrap = document.getElementById('recycle-results-wrap');
    const chip = document.getElementById('recycle-total-chip');
    if (wrap) wrap.innerHTML = '<div class="p-5 text-center text-muted"><div class="spinner"></div> Scanning Recycle Bin...</div>';

    try {
      const [stds, progs, exams, quests] = await Promise.all([
        adminFetchDeleted('students').catch(() => []),
        adminFetchDeleted('programs').catch(() => []),
        adminFetchDeleted('exams').catch(() => []),
        adminFetchDeleted('questions').catch(() => [])
      ]);

      const items = [
        ...stds.map(r => ({ ...r, _table: 'students', _entityType: 'Student', _name: r.name || 'Unnamed Student' })),
        ...progs.map(r => ({ ...r, _table: 'programs', _entityType: 'Class', _name: r.name || 'Unnamed Class' })),
        ...exams.map(r => ({ ...r, _table: 'exams', _entityType: 'Assessment', _name: r.exam_title || r.title || 'Unnamed Assessment' })),
        ...quests.map(r => ({ ...r, _table: 'questions', _entityType: 'Question', _name: r.question_text || 'Unnamed Question' }))
      ];

      items.sort((a, b) => new Date(b.deleted_at) - new Date(a.deleted_at));
      currentDeletedRecords = items;
      if (chip) chip.textContent = `${items.length} Soft-Deleted`;

      renderTable();
    } catch (err) {
      if (wrap) wrap.innerHTML = `<div class="p-4 text-center text-danger">Error loading recycle bin: ${escapeHtml(err.message)}</div>`;
    }
  };

  const renderTable = () => {
    const wrap = document.getElementById('recycle-results-wrap');
    if (!wrap) return;

    let filtered = currentDeletedRecords;
    if (currentFilterType !== 'all') {
      filtered = currentDeletedRecords.filter(r => r._table === currentFilterType);
    }

    if (!filtered.length) {
      wrap.innerHTML = `<div class="p-5 text-center text-muted">Recycle bin is empty for selected filter.</div>`;
      return;
    }

    let html = `
      <table class="table w-100">
        <thead>
          <tr>
            <th style="width:110px;">Entity Type</th>
            <th>Name / Description</th>
            <th class="text-center" style="width:180px;">Deleted At</th>
            <th class="text-right" style="width:190px;">Actions</th>
          </tr>
        </thead>
        <tbody>
    `;

    filtered.forEach(item => {
      const badgeClass =
        item._entityType === 'Student' ? 'badge-info' :
        item._entityType === 'Class' ? 'badge-success' :
        item._entityType === 'Assessment' ? 'badge-warning' : 'badge-neutral';

      html += `
        <tr>
          <td><span class="badge ${badgeClass}" style="font-size:0.75rem;">${item._entityType}</span></td>
          <td>
            <div class="fw-600" style="color:var(--clr-text-1);">${escapeHtml(item._name)}</div>
            <div class="text-xs text-muted" style="font-family:monospace;">ID: ${item.id}</div>
          </td>
          <td class="text-center text-sm text-muted">${item.deleted_at ? new Date(item.deleted_at).toLocaleString() : '&mdash;'}</td>
          <td class="text-right">
            <button class="btn btn-secondary btn-xs btn-restore-item" data-table="${item._table}" data-id="${item.id}" data-name="${escapeHtml(item._name)}" title="Restore to active view">
              &#9851; Restore
            </button>
            <button class="btn btn-danger btn-xs btn-purge-item" data-table="${item._table}" data-id="${item.id}" data-name="${escapeHtml(item._name)}" title="Permanently delete from database" style="margin-left:4px;">
              &#128128; Purge
            </button>
          </td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    wrap.innerHTML = html;

    // Attach Restore Listeners
    wrap.querySelectorAll('.btn-restore-item').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const table = e.currentTarget.dataset.table;
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;

        showLoading('Restoring record...');
        try {
          await adminRestore(table, id);
          
          // Write to audit log
          const sb = await getSupabase();
          await sb.from('audit_logs').insert({
            actor_role: 'ADMIN',
            action: 'RESTORE_RECORD',
            entity_type: table,
            entity_id: id,
            new_value: { name, restored_at: new Date().toISOString() }
          }).catch(() => {});

          hideLoading();
          showToast(`Restored "${name}" successfully!`, 'success');
          fetchAllDeleted();
        } catch (err) {
          hideLoading();
          showToast('Failed to restore: ' + err.message, 'error');
        }
      });
    });

    // Attach Purge Listeners (Gated Red Modal)
    wrap.querySelectorAll('.btn-purge-item').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const table = e.currentTarget.dataset.table;
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;
        openPurgeConfirmationModal(table, id, name, fetchAllDeleted);
      });
    });
  };

  // Tabs listener
  document.querySelectorAll('.recycle-tab-btn').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.recycle-tab-btn').forEach(b => {
        b.classList.remove('btn-primary');
        b.classList.add('btn-secondary');
      });
      e.currentTarget.classList.remove('btn-secondary');
      e.currentTarget.classList.add('btn-primary');
      currentFilterType = e.currentTarget.dataset.type;
      renderTable();
    });
  });

  document.getElementById('recycle-refresh-all-btn')?.addEventListener('click', fetchAllDeleted);
  fetchAllDeleted();
}

/**
 * Gated Red Confirmation Purge Modal requiring the admin to type "CONFIRM"
 */
function openPurgeConfirmationModal(table, id, name, onComplete) {
  const container = document.getElementById('purge-modal-container');
  if (!container) return;

  container.innerHTML = `
    <div class="purge-modal-overlay" id="purge-modal-backdrop">
      <div class="purge-modal-box">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
          <div style="font-size:2rem;line-height:1;">&#9888;&#65039;</div>
          <div>
            <h3 style="margin:0;font-size:1.25rem;color:#ef4444;font-weight:700;">Permanent Purge Warning</h3>
            <div class="text-xs text-muted">Irreversible Database Action</div>
          </div>
        </div>

        <p style="font-size:0.875rem;line-height:1.5;color:#cbd5e1;margin-bottom:1rem;">
          You are about to permanently purge <strong style="color:#f8fafc;">${escapeHtml(name)}</strong> (<code style="color:#ef4444;">${table}</code>).
          This action will permanently delete this row and cannot be undone.
        </p>

        <div style="margin-bottom:1rem;">
          <label style="font-size:0.75rem;font-weight:700;color:#ef4444;text-transform:uppercase;letter-spacing:0.05em;display:block;margin-bottom:4px;">
            Type "CONFIRM" to unlock permanent purge:
          </label>
          <input type="text" class="purge-confirm-input" id="purge-confirm-text" placeholder="CONFIRM" autocomplete="off" />
        </div>

        <div style="display:flex;justify-content:flex-end;gap:0.75rem;">
          <button class="btn btn-ghost btn-sm" id="btn-purge-cancel">Cancel</button>
          <button class="btn btn-danger btn-sm" id="btn-purge-execute" disabled style="opacity:0.5;cursor:not-allowed;">
            &#128128; Permanently Purge
          </button>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById('purge-confirm-text');
  const execBtn = document.getElementById('btn-purge-execute');
  const cancelBtn = document.getElementById('btn-purge-cancel');
  const backdrop = document.getElementById('purge-modal-backdrop');

  const closeModal = () => {
    container.innerHTML = '';
  };

  input.addEventListener('input', () => {
    const isUnlocked = input.value.trim() === 'CONFIRM';
    execBtn.disabled = !isUnlocked;
    execBtn.style.opacity = isUnlocked ? '1' : '0.5';
    execBtn.style.cursor = isUnlocked ? 'pointer' : 'not-allowed';
  });

  cancelBtn.addEventListener('click', closeModal);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  execBtn.addEventListener('click', async () => {
    if (input.value.trim() !== 'CONFIRM') return;

    closeModal();
    showLoading('Executing permanent purge...');
    try {
      await adminHardDelete(table, id);

      // Audit Log write
      const sb = await getSupabase();
      await sb.from('audit_logs').insert({
        actor_role: 'ADMIN',
        action: 'HARD_PURGE_RECORD',
        entity_type: table,
        entity_id: id,
        new_value: { name, purged_at: new Date().toISOString() }
      }).catch(() => {});

      hideLoading();
      showToast(`Record "${name}" was permanently purged.`, 'warning');
      onComplete?.();
    } catch (err) {
      hideLoading();
      showToast('Purge failed: ' + err.message, 'error');
    }
  });

  input.focus();
}


// ============================================================
// MODULE 2: ACTIVITY & AUDIT LOGS (IMMUTABLE LOGGING)
// ============================================================

export async function renderAuditLog(area) {
  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-2 mb-4">
      <div>
        <h2 class="section-title text-gradient">Activity &amp; Audit Logs <span class="count-chip" id="audit-count-chip">Loading...</span></h2>
        <p class="section-subtitle">Immutable security trail tracking administrative actions, logins, mutations, and anti-cheat triggers</p>
      </div>
      <button class="btn btn-secondary btn-sm" id="audit-refresh-btn">&#x21bb; Refresh Logs</button>
    </div>

    <!-- Filter Toolbar -->
    <div class="antigravity-card p-3 mb-4 d-flex gap-3 align-center flex-wrap" style="border:1px solid var(--clr-border);">
      <div style="min-width:200px;">
        <label class="text-xs text-muted d-block mb-1">Filter Action Category</label>
        <select id="audit-filter-action" class="form-control" style="padding:6px 10px;font-size:0.85rem;">
          <option value="">&mdash; All Event Categories &mdash;</option>
          <option value="AUTH">Logins &amp; Authentication</option>
          <option value="CRUD">CRUD Operations (Create/Delete/Update)</option>
          <option value="CONFIG">Assessment &amp; Site Configurations</option>
          <option value="SECURITY">Security &amp; Anti-Cheat Events</option>
        </select>
      </div>

      <div style="flex:1;min-width:240px;">
        <label class="text-xs text-muted d-block mb-1">Search Actor / Target / Context</label>
        <input type="text" id="audit-search-input" class="form-control" placeholder="Search by actor, entity type, action..." style="padding:6px 10px;font-size:0.85rem;" />
      </div>

      <div class="d-flex align-end" style="padding-top:18px;">
        <button class="btn btn-ghost btn-sm" id="audit-reset-btn">&#10006; Reset</button>
      </div>
    </div>

    <!-- Audit Events Grid/Table -->
    <div class="antigravity-card p-4">
      <div class="table-wrap" id="audit-table-wrap">
        <div class="p-5 text-center text-muted"><div class="spinner"></div> Fetching audit trail...</div>
      </div>
    </div>
  `;

  let allLogs = [];

  const loadLogs = async () => {
    const wrap = document.getElementById('audit-table-wrap');
    const chip = document.getElementById('audit-count-chip');
    if (wrap) wrap.innerHTML = '<div class="p-5 text-center text-muted"><div class="spinner"></div> Fetching audit trail...</div>';

    try {
      const sb = await getSupabase();
      const { data, error } = await sb
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(150);

      if (error) throw error;
      allLogs = data || [];
      if (chip) chip.textContent = `${allLogs.length} Events`;
      renderTable();
    } catch (err) {
      if (wrap) wrap.innerHTML = `<div class="p-4 text-center text-danger">Failed to load audit logs: ${escapeHtml(err.message)}</div>`;
    }
  };

  const renderTable = () => {
    const wrap = document.getElementById('audit-table-wrap');
    if (!wrap) return;

    const cat = document.getElementById('audit-filter-action')?.value || '';
    const q = (document.getElementById('audit-search-input')?.value || '').toLowerCase().trim();

    const filtered = allLogs.filter(r => {
      if (cat === 'AUTH' && !r.action.toLowerCase().includes('login') && !r.action.toLowerCase().includes('auth')) return false;
      if (cat === 'CRUD' && !['create', 'insert', 'delete', 'update', 'restore', 'purge'].some(k => r.action.toLowerCase().includes(k))) return false;
      if (cat === 'CONFIG' && !['config', 'setting', 'threshold', 'time_limit', 'score'].some(k => r.action.toLowerCase().includes(k))) return false;
      if (cat === 'SECURITY' && !['cheat', 'security', 'flag', 'tamper', 'lock'].some(k => r.action.toLowerCase().includes(k))) return false;

      if (q) {
        const actor = (r.actor_role || '') + ' ' + (r.actor_user_id || '');
        const action = r.action || '';
        const entity = (r.entity_type || '') + ' ' + (r.entity_id || '');
        const context = JSON.stringify(r.new_value || {}) + ' ' + JSON.stringify(r.old_value || {});
        const str = `${actor} ${action} ${entity} ${context}`.toLowerCase();
        if (!str.includes(q)) return false;
      }
      return true;
    });

    if (!filtered.length) {
      wrap.innerHTML = `<div class="p-5 text-center text-muted">No audit events match the selected criteria.</div>`;
      return;
    }

    let html = `
      <table class="table w-100">
        <thead>
          <tr>
            <th style="width:170px;">Timestamp</th>
            <th style="width:140px;">Actor</th>
            <th style="width:180px;">Action</th>
            <th>Target Context / Details</th>
          </tr>
        </thead>
        <tbody>
    `;

    filtered.forEach(item => {
      const isSecurity = item.action.toLowerCase().includes('cheat') || item.action.toLowerCase().includes('security') || item.action.toLowerCase().includes('purge');
      const actionBadge = isSecurity ? 'badge-danger' :
                          item.action.toLowerCase().includes('create') || item.action.toLowerCase().includes('restore') ? 'badge-success' :
                          item.action.toLowerCase().includes('login') ? 'badge-info' : 'badge-neutral';

      let detailsText = '';
      if (item.new_value) {
        try {
          const nv = typeof item.new_value === 'string' ? JSON.parse(item.new_value) : item.new_value;
          detailsText = Object.entries(nv).map(([k, v]) => `<span class="text-muted">${escapeHtml(k)}:</span> <strong>${escapeHtml(typeof v === 'object' ? JSON.stringify(v) : v)}</strong>`).join(' | ');
        } catch {
          detailsText = escapeHtml(String(item.new_value));
        }
      } else if (item.entity_type) {
        detailsText = `<span class="text-muted">Entity:</span> <strong>${escapeHtml(item.entity_type)}</strong> (ID: <code style="font-size:0.75rem;">${escapeHtml(item.entity_id || '&mdash;')}</code>)`;
      } else {
        detailsText = '&mdash;';
      }

      html += `
        <tr>
          <td class="text-xs text-muted">${new Date(item.created_at).toLocaleString()}</td>
          <td>
            <span class="badge badge-info" style="font-size:0.7rem;">${escapeHtml(item.actor_role || 'ADMIN')}</span>
            ${item.actor_user_id ? `<div class="text-xs text-muted" style="font-family:monospace;margin-top:2px;">${escapeHtml(item.actor_user_id.substring(0,8))}…</div>` : ''}
          </td>
          <td><span class="badge ${actionBadge}" style="font-size:0.75rem;font-weight:700;">${escapeHtml(item.action)}</span></td>
          <td class="text-xs" style="line-height:1.4;">${detailsText}</td>
        </tr>
      `;
    });

    html += `</tbody></table>`;
    wrap.innerHTML = html;
  };

  document.getElementById('audit-filter-action')?.addEventListener('change', renderTable);
  document.getElementById('audit-search-input')?.addEventListener('input', renderTable);
  document.getElementById('audit-reset-btn')?.addEventListener('click', () => {
    document.getElementById('audit-filter-action').value = '';
    document.getElementById('audit-search-input').value = '';
    renderTable();
  });
  document.getElementById('audit-refresh-btn')?.addEventListener('click', loadLogs);

  loadLogs();
}


// ============================================================
// MODULE 3: DATA HEALTH & CONNECTIVITY (TELEMETRY & DIAGNOSTICS)
// ============================================================

export async function renderDataHealth(container) {
  container.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-2 mb-4">
      <div>
        <h2 class="section-title text-gradient">Data Health &amp; Connectivity (Pilar D)</h2>
        <p class="section-subtitle">Real-time database connectivity, WebSocket latency monitoring, storage metrics, and relational integrity diagnostics</p>
      </div>
      <div class="d-flex align-center gap-2" id="sync-heartbeat-badge">
        <span class="heartbeat-dot pulse-emerald" id="health-heartbeat-dot"></span>
        <span class="text-xs fw-700" id="health-heartbeat-text" style="color:#10b981;">Supabase Live</span>
      </div>
    </div>

    <!-- Real-Time Metrics Dashboard -->
    <div class="grid mb-4" style="grid-template-columns:repeat(auto-fit, minmax(220px, 1fr));gap:1rem;">
      <div class="antigravity-card p-4">
        <div class="d-flex justify-between align-center mb-2">
          <span class="text-xs text-muted text-uppercase fw-700">WebSocket / DB Latency</span>
          <button class="btn btn-ghost btn-xs" id="btn-ping-latency" title="Measure latency">&#9889; Ping</button>
        </div>
        <div style="font-size:1.75rem;font-weight:700;color:#38bdf8;" id="metric-latency">Measuring...</div>
        <div class="text-xs text-muted mt-1" id="metric-latency-desc">Testing roundtrip response</div>
      </div>

      <div class="antigravity-card p-4">
        <div class="text-xs text-muted text-uppercase fw-700 mb-2">Storage Usage (Transient Blobs)</div>
        <div style="font-size:1.75rem;font-weight:700;color:#10b981;" id="metric-storage">0.00 MB</div>
        <div class="text-xs text-muted mt-1">Zero audio blobs persisted (Low-Egress)</div>
      </div>

      <div class="antigravity-card p-4">
        <div class="text-xs text-muted text-uppercase fw-700 mb-2">Active Students</div>
        <div style="font-size:1.75rem;font-weight:700;color:#f8fafc;" id="metric-students">&mdash;</div>
        <div class="text-xs text-muted mt-1">Enrolled &amp; active records</div>
      </div>

      <div class="antigravity-card p-4">
        <div class="text-xs text-muted text-uppercase fw-700 mb-2">Assessments &amp; Attempts</div>
        <div style="font-size:1.75rem;font-weight:700;color:#f8fafc;" id="metric-exams">&mdash;</div>
        <div class="text-xs text-muted mt-1" id="metric-attempts-desc">Exam attempts logged</div>
      </div>
    </div>

    <!-- 3 Relational Diagnostic Panels -->
    <div class="grid" style="grid-template-columns:repeat(auto-fit, minmax(300px, 1fr));gap:1.25rem;">
      
      <!-- Panel 1: Students Duplicate Engine -->
      <div class="antigravity-card p-5" style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
        <div>
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
            <div style="font-size:2rem;background:rgba(59,130,246,0.12);padding:0.6rem;border-radius:12px;line-height:1;">&#128100;</div>
            <div>
              <h3 style="font-weight:700;margin:0 0 4px 0;font-size:1.1rem;">Student Profile Duplicates</h3>
              <div class="text-xs text-muted">Identical names within the same cohort</div>
            </div>
          </div>
          <p style="font-size:0.85rem;color:var(--clr-text-2);line-height:1.5;margin:0 0 1.25rem 0;">
            Detect students registered under duplicate records. Safely merge duplicate profiles, transferring historical attempts to the authoritative ID.
          </p>
        </div>
        <button class="btn btn-primary" id="btn-health-scan-students" style="width:100%;font-weight:600;">
          &#128269; Scan Students
        </button>
      </div>

      <!-- Panel 2: Question Duplicate Engine -->
      <div class="antigravity-card p-5" style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
        <div>
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
            <div style="font-size:2rem;background:rgba(250,204,21,0.12);padding:0.6rem;border-radius:12px;line-height:1;">&#9889;</div>
            <div>
              <h3 style="font-weight:700;margin:0 0 4px 0;font-size:1.1rem;">Question Bank Duplicates</h3>
              <div class="text-xs text-muted">Duplicate text or order conflicts</div>
            </div>
          </div>
          <p style="font-size:0.85rem;color:var(--clr-text-2);line-height:1.5;margin:0 0 1.25rem 0;">
            Identify duplicate questions across the centralized question bank or within the same assessment to maintain question uniqueness.
          </p>
        </div>
        <button class="btn btn-warning" id="btn-health-scan-questions" style="width:100%;font-weight:600;color:#000;">
          &#128269; Scan Questions
        </button>
      </div>

      <!-- Panel 3: Orphaned Records & Integrity Scanner -->
      <div class="antigravity-card p-5" style="display:flex;flex-direction:column;justify-content:space-between;height:100%;">
        <div>
          <div style="display:flex;align-items:center;gap:1rem;margin-bottom:1rem;">
            <div style="font-size:2rem;background:rgba(16,185,129,0.12);padding:0.6rem;border-radius:12px;line-height:1;">&#128737;&#65039;</div>
            <div>
              <h3 style="font-weight:700;margin:0 0 4px 0;font-size:1.1rem;">Orphaned Records &amp; Integrity</h3>
              <div class="text-xs text-muted">Audits relational foreign keys &amp; integrity</div>
            </div>
          </div>
          <p style="font-size:0.85rem;color:var(--clr-text-2);line-height:1.5;margin:0 0 1.25rem 0;">
            Audit foreign key integrity. Identify unlinked attempt answers, progress records missing students, and exams with dangling references.
          </p>
        </div>
        <button class="btn btn-success" id="btn-health-scan-orphans" style="width:100%;font-weight:600;background:linear-gradient(135deg, #10b981, #059669);color:#fff;">
          &#128269; Scan Integrity
        </button>
      </div>

    </div>
  `;

  // Measure Latency & Heartbeat
  const checkHealth = async () => {
    const latEl = document.getElementById('metric-latency');
    const latDesc = document.getElementById('metric-latency-desc');
    const dot = document.getElementById('health-heartbeat-dot');
    const text = document.getElementById('health-heartbeat-text');

    const start = performance.now();
    try {
      const res = await testSupabaseConnection();
      const latency = Math.round(performance.now() - start);

      if (latEl) latEl.textContent = `${latency} ms`;

      if (res.connected) {
        if (latency < 400) {
          if (dot) dot.className = 'heartbeat-dot pulse-emerald';
          if (text) { text.textContent = 'Supabase Connected'; text.style.color = '#10b981'; }
          if (latDesc) latDesc.textContent = 'Optimal connection speed';
        } else {
          if (dot) dot.className = 'heartbeat-dot pulse-amber';
          if (text) { text.textContent = 'High Latency'; text.style.color = '#f59e0b'; }
          if (latDesc) latDesc.textContent = 'Moderate response delay';
        }
      } else {
        if (dot) dot.className = 'heartbeat-dot pulse-red';
        if (text) { text.textContent = 'Offline / Disconnected'; text.style.color = '#ef4444'; }
        if (latDesc) latDesc.textContent = res.error || 'Connection failed';
      }
    } catch (e) {
      if (dot) dot.className = 'heartbeat-dot pulse-red';
      if (text) { text.textContent = 'Network Error'; text.style.color = '#ef4444'; }
      if (latEl) latEl.textContent = 'Error';
    }
  };

  // Load Database Counts
  const loadEntityCounts = async () => {
    try {
      const [students, exams, attempts] = await Promise.all([
        adminFetchAll('students').catch(() => []),
        adminFetchAll('exams').catch(() => []),
        adminFetchAll('attempts').catch(() => [])
      ]);

      const activeStds = (students || []).filter(s => !s.deleted_at).length;
      const activeExams = (exams || []).filter(e => !e.deleted_at).length;
      const totalAttempts = (attempts || []).length;

      const sEl = document.getElementById('metric-students');
      if (sEl) sEl.textContent = activeStds;

      const eEl = document.getElementById('metric-exams');
      if (eEl) eEl.textContent = activeExams;

      const aEl = document.getElementById('metric-attempts-desc');
      if (aEl) aEl.textContent = `${totalAttempts} attempts logged`;
    } catch (err) {
      console.warn('Could not load health metrics counts:', err);
    }
  };

  document.getElementById('btn-ping-latency')?.addEventListener('click', checkHealth);
  checkHealth();
  loadEntityCounts();

  // Attach Diagnostic Scanners
  document.getElementById('btn-health-scan-students')?.addEventListener('click', () => {
    if (typeof openDuplicateStudentsModal === 'function') {
      openDuplicateStudentsModal();
    } else if (typeof window.openDuplicateStudentsModal === 'function') {
      window.openDuplicateStudentsModal();
    }
  });

  document.getElementById('btn-health-scan-questions')?.addEventListener('click', () => {
    if (typeof openDuplicateQuestionsModal === 'function') {
      openDuplicateQuestionsModal();
    } else if (typeof window.openDuplicateQuestionsModal === 'function') {
      window.openDuplicateQuestionsModal();
    }
  });

  document.getElementById('btn-health-scan-orphans')?.addEventListener('click', async () => {
    showLoading('Auditing relational database integrity...');
    try {
      const [students, exams, attempts, questions, attemptAnswers, progress] = await Promise.all([
        adminFetchAll('students', 'id, name, deleted_at'),
        adminFetchAll('exams', 'id, exam_title, deleted_at'),
        adminFetchAll('attempts', 'id, student_id, exam_id, status, created_at'),
        adminFetchAll('questions', 'id, exam_id, question_text'),
        adminFetchAll('attempt_answers', 'id, attempt_id'),
        adminFetchAll('progress', 'id, student_id').catch(() => [])
      ]);

      const studentIdSet = new Set((students || []).map(s => s.id));
      const examIdSet = new Set((exams || []).map(e => e.id));
      const attemptIdSet = new Set((attempts || []).map(a => a.id));

      const orphanedAttempts = (attempts || []).filter(a => 
        (a.student_id && !studentIdSet.has(a.student_id)) || 
        (a.exam_id && !examIdSet.has(a.exam_id))
      );

      const orphanedQuestions = (questions || []).filter(q => 
        q.exam_id && !examIdSet.has(q.exam_id)
      );

      const orphanedAnswers = (attemptAnswers || []).filter(ans => 
        ans.attempt_id && !attemptIdSet.has(ans.attempt_id)
      );

      const danglingProgress = (progress || []).filter(p => 
        p.student_id && !studentIdSet.has(p.student_id)
      );

      const totalIssues = orphanedAttempts.length + orphanedQuestions.length + orphanedAnswers.length + danglingProgress.length;

      const resultsHTML = `
        <div style="display:flex;flex-direction:column;gap:1.25rem;">
          <div class="antigravity-card p-4 text-center" style="border:1px solid ${totalIssues === 0 ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'};">
            <div style="font-size:2.5rem;margin-bottom:0.25rem;">${totalIssues === 0 ? '&#9989;' : '&#9888;&#65039;'}</div>
            <h3 style="font-weight:700;margin:0 0 4px 0;color:${totalIssues === 0 ? '#10b981' : '#f59e0b'};">
              ${totalIssues === 0 ? 'All Relational Constraints Healthy' : `${totalIssues} Integrity Issue(s) Detected`}
            </h3>
            <p class="text-xs text-muted" style="margin:0;">
              ${totalIssues === 0 ? 'All exam attempts, questions, answers, and progress records have valid relational parents.' : 'Some records reference missing or unlinked entities.'}
            </p>
          </div>

          <div style="display:grid;grid-template-columns:repeat(2, 1fr);gap:1rem;">
            <div class="antigravity-card p-3">
              <div class="text-xs text-muted mb-1">Orphaned Attempts</div>
              <div style="font-size:1.4rem;font-weight:700;color:${orphanedAttempts.length ? '#ef4444' : '#10b981'};">
                ${orphanedAttempts.length}
              </div>
            </div>
            <div class="antigravity-card p-3">
              <div class="text-xs text-muted mb-1">Orphaned Questions</div>
              <div style="font-size:1.4rem;font-weight:700;color:${orphanedQuestions.length ? '#ef4444' : '#10b981'};">
                ${orphanedQuestions.length}
              </div>
            </div>
            <div class="antigravity-card p-3">
              <div class="text-xs text-muted mb-1">Unlinked Answers</div>
              <div style="font-size:1.4rem;font-weight:700;color:${orphanedAnswers.length ? '#ef4444' : '#10b981'};">
                ${orphanedAnswers.length}
              </div>
            </div>
            <div class="antigravity-card p-3">
              <div class="text-xs text-muted mb-1">Dangling Progress</div>
              <div style="font-size:1.4rem;font-weight:700;color:${danglingProgress.length ? '#ef4444' : '#10b981'};">
                ${danglingProgress.length}
              </div>
            </div>
          </div>
        </div>
      `;

      if (window.openRecordDrawer) {
        window.openRecordDrawer('Database Integrity & Orphan Scan', resultsHTML, '<button class="btn btn-secondary" onclick="closeRecordDrawer()">Close</button>');
      } else {
        showToast(totalIssues === 0 ? 'Database integrity is 100% healthy!' : `${totalIssues} issues found.`, totalIssues === 0 ? 'success' : 'warning');
      }
    } catch (err) {
      showToast('Scan error: ' + err.message, 'error');
    } finally {
      hideLoading();
    }
  });
}


// ============================================================
// MODULE 4: SITE SETTINGS & API COST GUARD (VAULT & RATE LIMITS)
// ============================================================

export async function renderSettings(area) {
  const sb = await getSupabase();
  const { data } = await sb.from('site_settings').select('*');
  const settings = Object.fromEntries((data || []).map(r => [r.key, r.value]));

  // Local config cache
  const currentCustomPass = localStorage.getItem('tec_admin_custom_password') || '';
  const cooldownSecs = settings.ai_cooldown_limit_seconds || localStorage.getItem('ai_cooldown_limit_seconds') || '60';
  const maxAudioSecs = settings.ai_max_audio_duration_seconds || localStorage.getItem('ai_max_audio_duration_seconds') || '180';

  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-2 mb-4">
      <div>
        <h2 class="section-title text-gradient">Site Settings &amp; API Cost Guard (Pilar D)</h2>
        <p class="section-subtitle">Platform configuration, API key vault, security credentials, and AI token bankruptcy prevention limits</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(360px, 1fr));gap:1.5rem;align-items:start;">

      <!-- 1. The Cost Guard Engine Card (Crucial) -->
      <div class="antigravity-card p-5" style="border-color:rgba(239,68,68,0.3);box-shadow:0 20px 40px rgba(239,68,68,0.08);">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
          <div style="font-size:1.5rem;">&#128737;&#65039;</div>
          <div>
            <h3 style="font-size:1.1rem;margin:0;color:#ef4444;font-weight:700;">The Cost Guard Engine</h3>
            <div class="text-xs text-muted">Global AI Token Bankruptcy Defense</div>
          </div>
        </div>
        <p class="text-xs text-muted mb-3" style="line-height:1.4;">
          Strict safety throttles to eliminate infinite looping and runaway LLM token bills. Configured values are broadcast globally to all student examination sessions.
        </p>

        <div class="form-group mb-3">
          <label class="form-label text-sm fw-600">Global Cooldown Limit (Seconds)</label>
          <input class="form-control" type="number" id="setting-ai_cooldown" value="${escapeHtml(cooldownSecs)}" min="5" max="300" />
          <div class="text-xs text-muted mt-1">Mandatory wait time between AI submissions per student (Default: 60s).</div>
        </div>

        <div class="form-group mb-4">
          <label class="form-label text-sm fw-600">Max Audio Recording Duration (Seconds)</label>
          <input class="form-control" type="number" id="setting-ai_max_audio" value="${escapeHtml(maxAudioSecs)}" min="10" max="600" />
          <div class="text-xs text-muted mt-1">Hard ceiling for voice recordings before auto-stopping STT (Default: 180s).</div>
        </div>

        <button class="btn btn-danger btn-sm w-100" id="btn-save-cost-guard" style="font-weight:700;">
          &#128274; Save Cost Guard Limits
        </button>
      </div>

      <!-- 2. Secure API Key Vault Card -->
      <div class="antigravity-card p-5">
        <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:1rem;">
          <div style="font-size:1.5rem;">&#128272;</div>
          <div>
            <h3 style="font-size:1.1rem;margin:0;color:var(--clr-primary);font-weight:700;">API Key Vault</h3>
            <div class="text-xs text-muted">Masked credentials for LLM integration</div>
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label text-sm">OpenAI API Key</label>
          <div class="input-password-wrap">
            <input class="form-control" type="password" id="vault-openai-key" value="${escapeHtml(settings.openai_api_key || '')}" placeholder="sk-..." autocomplete="new-password" />
            <button class="input-password-toggle" type="button" data-target="vault-openai-key" title="Toggle visibility">&#128065;</button>
          </div>
        </div>

        <div class="form-group mb-3">
          <label class="form-label text-sm">Anthropic Claude API Key</label>
          <div class="input-password-wrap">
            <input class="form-control" type="password" id="vault-anthropic-key" value="${escapeHtml(settings.anthropic_api_key || '')}" placeholder="sk-ant-..." autocomplete="new-password" />
            <button class="input-password-toggle" type="button" data-target="vault-anthropic-key" title="Toggle visibility">&#128065;</button>
          </div>
        </div>

        <div class="form-group mb-4">
          <label class="form-label text-sm">Google Gemini API Key</label>
          <div class="input-password-wrap">
            <input class="form-control" type="password" id="vault-gemini-key" value="${escapeHtml(settings.gemini_api_key || '')}" placeholder="AIzaSy..." autocomplete="new-password" />
            <button class="input-password-toggle" type="button" data-target="vault-gemini-key" title="Toggle visibility">&#128065;</button>
          </div>
        </div>

        <button class="btn btn-primary btn-sm w-100" id="btn-save-vault">
          Save API Key Vault
        </button>
      </div>

      <!-- 3. Global Platform Configuration Card -->
      <div class="antigravity-card p-5">
        <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">Global Platform Configuration</h3>
        
        <div class="form-group mb-3">
          <label class="form-label text-sm">Site Name</label>
          <input class="form-control" id="setting-site_name" value="${escapeHtml(settings.site_name || 'TOPS CORE')}" />
        </div>

        <div class="form-group mb-3">
          <label class="form-label text-sm">Passing Threshold (%)</label>
          <input class="form-control" type="number" id="setting-passing_threshold" value="${escapeHtml(settings.passing_threshold || '60')}" min="0" max="100" />
        </div>

        <div class="form-group mb-4">
          <label class="form-label text-sm">Login Background URL (Optional)</label>
          <input class="form-control" id="setting-login_background_url" value="${escapeHtml(settings.login_background_url || '')}" placeholder="https://..." />
        </div>

        <button class="btn btn-secondary btn-sm w-100" id="save-settings-btn">
          Save Site Settings
        </button>
      </div>

      <!-- 4. Security & Administrator Credentials Card -->
      <div class="antigravity-card p-5">
        <h3 style="font-size:1.1rem;margin-bottom:1rem;color:var(--clr-text-1);">Administrator Authentication</h3>
        <p class="text-xs text-muted mb-3">Configure custom local credentials or restore default master admin access.</p>

        <div class="form-group mb-3">
          <label class="form-label text-sm">Master Username</label>
          <input class="form-control" value="admin" disabled style="opacity:0.7;" />
        </div>

        <div class="form-group mb-4">
          <label class="form-label text-sm">Custom Master Password Override</label>
          <div class="input-password-wrap">
            <input class="form-control" type="password" id="setting-custom-password" placeholder="Default: admin123" value="${escapeHtml(currentCustomPass)}" />
            <button class="input-password-toggle" type="button" data-target="setting-custom-password" title="Toggle visibility">&#128065;</button>
          </div>
          <div class="text-xs text-muted mt-1">Leave blank to use default 'admin123' master key.</div>
        </div>

        <button class="btn btn-secondary btn-sm w-100" id="btn-save-admin-password">
          Update Admin Credentials
        </button>
      </div>

    </div>
  `;

  // Password Visibility Toggle Logic
  area.querySelectorAll('.input-password-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const targetId = e.currentTarget.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      if (input.type === 'password') {
        input.type = 'text';
        e.currentTarget.innerHTML = '&#128064;';
      } else {
        input.type = 'password';
        e.currentTarget.innerHTML = '&#128065;';
      }
    });
  });

  // Save Cost Guard Limits
  document.getElementById('btn-save-cost-guard')?.addEventListener('click', async () => {
    const cooldown = document.getElementById('setting-ai_cooldown').value.trim() || '60';
    const maxAudio = document.getElementById('setting-ai_max_audio').value.trim() || '180';

    try {
      await Promise.all([
        sb.from('site_settings').upsert({ key: 'ai_cooldown_limit_seconds', value: cooldown, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        sb.from('site_settings').upsert({ key: 'ai_max_audio_duration_seconds', value: maxAudio, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      ]);

      // Cache locally and expose globally
      localStorage.setItem('ai_cooldown_limit_seconds', cooldown);
      localStorage.setItem('ai_max_audio_duration_seconds', maxAudio);
      window.TOPSCORE_CONFIG = {
        ...(window.TOPSCORE_CONFIG || {}),
        cooldownLimit: parseInt(cooldown, 10),
        maxAudioDuration: parseInt(maxAudio, 10)
      };

      showToast('Cost Guard safety limits saved globally!', 'success');
    } catch (err) {
      showToast('Failed to save Cost Guard limits: ' + err.message, 'error');
    }
  });

  // Save API Key Vault
  document.getElementById('btn-save-vault')?.addEventListener('click', async () => {
    const openaiKey = document.getElementById('vault-openai-key').value.trim();
    const anthropicKey = document.getElementById('vault-anthropic-key').value.trim();
    const geminiKey = document.getElementById('vault-gemini-key').value.trim();

    try {
      await Promise.all([
        sb.from('site_settings').upsert({ key: 'openai_api_key', value: openaiKey, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        sb.from('site_settings').upsert({ key: 'anthropic_api_key', value: anthropicKey, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        sb.from('site_settings').upsert({ key: 'gemini_api_key', value: geminiKey, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      ]);

      showToast('API Key Vault updated securely.', 'success');
    } catch (err) {
      showToast('Failed to update API Key Vault: ' + err.message, 'error');
    }
  });

  // Save General Platform Configuration
  document.getElementById('save-settings-btn')?.addEventListener('click', async () => {
    const siteName = document.getElementById('setting-site_name').value.trim();
    const passThreshold = document.getElementById('setting-passing_threshold').value.trim();
    const bgUrl = document.getElementById('setting-login_background_url').value.trim();

    try {
      await Promise.all([
        sb.from('site_settings').upsert({ key: 'site_name', value: siteName, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        sb.from('site_settings').upsert({ key: 'passing_threshold', value: passThreshold, updated_at: new Date().toISOString() }, { onConflict: 'key' }),
        sb.from('site_settings').upsert({ key: 'login_background_url', value: bgUrl, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      ]);
      showToast('Global site settings saved.', 'success');
    } catch (err) {
      showToast('Failed to save settings: ' + err.message, 'error');
    }
  });

  // Update Custom Admin Password
  document.getElementById('btn-save-admin-password')?.addEventListener('click', () => {
    const customPass = document.getElementById('setting-custom-password').value.trim();
    if (customPass) {
      localStorage.setItem('tec_admin_custom_password', customPass);
      showToast('Custom admin password saved.', 'success');
    } else {
      localStorage.removeItem('tec_admin_custom_password');
      showToast('Custom password cleared. Default (admin123) restored.', 'info');
    }
  });
}
