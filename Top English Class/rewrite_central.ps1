$content = Get-Content -Raw -Encoding UTF8 'js/admin/central-assessment.js'

$imports = @'
import {
  fetchGlobalSubjects,
  fetchWordTypes,
  createWordType,
  toggleWordType,
  fetchTopics,
  createTopic,
  updateTopic,
  deleteTopic,
  fetchCentralQuestions,
  createCentralQuestion,
  updateCentralQuestion,
  deleteCentralQuestion,
  fetchChallengeDefinitions,
  publishChallengeDefinition,
  fetchChallengeDefinitionQuestions,
  fetchChallengeInstances,
  createChallengeInstance,
  adminFetchAll,
  adminSoftDelete,
  clearAdminCache,
  fetchClasses,
  fetchClassInstances
} from '../api.js';
'@

$content = $content -replace "(?s)import \{[\s\S]*?\} from '\.\./api\.js';", $imports

$content = $content -replace "(?s)export async function renderAssignments\(area\) \{.*?\}\s*\}", @'
// ============================================================
// 4. ASSIGNMENTS MANAGEMENT (Challenge Instances)
// ============================================================
export async function renderAssignments(area) {
  showLoading();
  try {
    const [instances, definitions, batches, classInsts, classes] = await Promise.all([
      fetchChallengeInstances(),
      fetchChallengeDefinitions(),
      adminFetchAll('batches'),
      fetchClassInstances(),
      fetchClasses()
    ]);
    hideLoading();

    area.innerHTML = `
      <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
        <div>
          <h2 class="section-title text-gradient">Assessment Assignments (Challenge Instances)</h2>
          <p class="section-subtitle">Control assessment access by Batch (Class Instance)</p>
        </div>
        <div>
          <button class="btn btn-primary btn-sm" id="btn-assign-assessment">+ New Assignment</button>
        </div>
      </div>

      <div class="table-responsive card" style="background:rgba(255,255,255,0.02);border:1px solid var(--clr-border);">
        <table class="data-table">
          <thead>
            <tr>
              <th>Assessment</th>
              <th>Type</th>
              <th>Assigned Target</th>
              <th>Availability Window</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody id="assignments-tbody">
            ${renderAssignmentRows(instances)}
          </tbody>
        </table>
      </div>
    `;

    document.getElementById('btn-assign-assessment').onclick = () => {
      openAssignmentModal({ definitions, batches, classInsts, classes }, async () => {
        await renderAssignments(area);
      });
    };

    document.getElementById('assignments-tbody').addEventListener('click', async (e) => {
      const delBtn = e.target.closest('.btn-revoke-assignment');
      if (delBtn) {
        const id = delBtn.dataset.id;
        if (confirm('Revoke this assessment assignment?')) {
          showLoading();
          try {
            await adminSoftDelete('challenge_instances', id);
            showToast('Assignment revoked.', 'success');
            await renderAssignments(area);
          } catch (err) {
            showToast(err.message, 'error');
          } finally {
            hideLoading();
          }
        }
      }
    });

  } catch (err) {
    hideLoading();
    area.innerHTML = `<div class="empty-state"><p class="text-danger">Failed to load assignments: ${err.message}</p></div>`;
  }
}

function renderAssignmentRows(list) {
  if (!list || !list.length) {
    return `<tr><td colspan="6" class="text-center p-4 text-muted">No active assignments. Click "+ New Assignment" to assign an assessment.</td></tr>`;
  }
  return list.map(a => {
    const targetName = a.class_instances?.batches?.name 
      ? `👥 Batch: ${escapeHtml(a.class_instances.batches.name)} (${escapeHtml(a.class_instances.classes?.name || 'Class')})`
      : `👥 Unknown Target`;

    const windowText = (a.availability_start || a.availability_end)
      ? `${a.availability_start ? new Date(a.availability_start).toLocaleDateString() : 'Now'} → ${a.availability_end ? new Date(a.availability_end).toLocaleDateString() : 'Forever'}`
      : '<span class="text-success">Always Open</span>';

    return `
      <tr>
        <td><strong>${escapeHtml(a.title_override || a.challenge_definitions?.title || 'Assessment')}</strong></td>
        <td><span class="badge badge-info">${escapeHtml(a.challenge_definitions?.challenge_type || 'EVALUATION')}</span></td>
        <td>${targetName}</td>
        <td><small>${windowText}</small></td>
        <td><span class="badge badge-success">${escapeHtml(a.status || 'DRAFT')}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-ghost btn-sm text-danger btn-revoke-assignment" data-id="${a.id}" title="Revoke Assignment">🗑️ Revoke</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openAssignmentModal({ definitions, batches, classInsts, classes }, onSaved) {
  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:500px;">
      <div class="modal-header d-flex justify-between align-center p-3" style="border-bottom:1px solid var(--clr-border);">
        <h3 class="modal-title" style="margin:0;font-size:1.2rem;">Assign Assessment</h3>
        <button class="btn btn-ghost btn-sm" id="close-asgn-modal" style="font-size:1.2rem;">&times;</button>
      </div>
      <div class="modal-body p-4">
        <div class="form-group mb-3">
          <label class="form-label">Select Assessment (Challenge Definition) *</label>
          <select class="form-control" id="asgn-assessment-id">
            ${definitions.map(a => `<option value="${a.id}" data-class="${a.class_id}">${escapeHtml(a.title)} (${escapeHtml(a.challenge_type)})</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Assignment Mode *</label>
          <select class="form-control" id="asgn-mode">
            <option value="BATCH">Batch (Class Instance)</option>
          </select>
        </div>
        <div class="form-group mb-3" id="asgn-batch-group">
          <label class="form-label">Select Batch *</label>
          <select class="form-control" id="asgn-batch-id">
            ${batches.map(b => `<option value="${b.id}">${escapeHtml(b.name)}</option>`).join('')}
          </select>
          <small class="text-muted text-xs">Note: A Class Instance must exist for the selected Batch and the Assessment's Class.</small>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Availability Start (Optional)</label>
          <input type="datetime-local" class="form-control" id="asgn-start" />
        </div>
        <div class="form-group mb-4">
          <label class="form-label">Availability End (Optional)</label>
          <input type="datetime-local" class="form-control" id="asgn-end" />
        </div>
        <div class="d-flex justify-end gap-2">
          <button class="btn btn-secondary btn-sm" id="cancel-asgn-btn">Cancel</button>
          <button class="btn btn-primary btn-sm" id="save-asgn-btn">Save Assignment</button>
        </div>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#close-asgn-modal').onclick = close;
  modal.querySelector('#cancel-asgn-btn').onclick = close;

  modal.querySelector('#save-asgn-btn').onclick = async () => {
    const asmSelect = modal.querySelector('#asgn-assessment-id');
    const definitionId = asmSelect.value;
    const classId = asmSelect.options[asmSelect.selectedIndex]?.dataset.class;
    const batchId = modal.querySelector('#asgn-batch-id').value;
    const startVal = modal.querySelector('#asgn-start').value;
    const endVal = modal.querySelector('#asgn-end').value;

    const ci = classInsts.find(c => c.batch_id === batchId && c.class_id === classId);
    if (!ci) {
      showToast('No Class Instance found for this Batch and the Assessment\'s Class. Please assign this batch to the class first.', 'error');
      return;
    }

    showLoading();
    try {
      await createChallengeInstance({
        class_instance_id: ci.id,
        challenge_definition_id: definitionId,
        availability_start: startVal ? new Date(startVal).toISOString() : null,
        availability_end: endVal ? new Date(endVal).toISOString() : null,
        status: 'READY'
      });
      showToast('Assignment created.', 'success');
      close();
      if (onSaved) onSaved();
    } catch (err) {
      showToast(err.message, 'error');
    } finally {
      hideLoading();
    }
  };
}
'@

[IO.File]::WriteAllText('js/admin/central-assessment-fixed.js', $content, [System.Text.Encoding]::UTF8)
