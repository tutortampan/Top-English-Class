import { adminFetchAll, adminInsert, adminSoftDelete } from '../api.js?v=4.7.5';
import { showToast } from '../app.js?v=4.7.5';
import { openAssessmentBuilder } from './assessment-builder.js?v=4.7.5';
import { openAssessmentBuilderModal as openVocabWizard } from './vocab-vault.js?v=4.7.5';

window.handleCreateClassAssessment = (classId, className) => {
  if ((className || '').toLowerCase().includes('vocab')) {
    openVocabWizard(null, { classId: classId, className: className, assessmentType: 'VOCAB_MASTERY' });
  } else {
    openAssessmentBuilder(null, classId);
  }
};

export async function renderClasses(area) {
  let [data, levels] = await Promise.all([
    adminFetchAll('classes', '*, levels(name)'),
    adminFetchAll('levels', '*')
  ]);
  const sortedData = [...(data || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  levels = (levels || []).sort((a, b) => a.level_number - b.level_number);

  area.innerHTML = `
    <div class="section-header">
      <div class="d-flex align-center justify-between flex-wrap gap-4" style="width:100%;">
        <div>
          <h2 class="section-title">Classes (Subjects) <span class="count-chip">${sortedData.length} Total</span></h2>
          <p class="section-subtitle">Manage all English classes in alphabetical order</p>
        </div>
        <button class="btn btn-primary btn-sm" id="btn-add-class-global">+ Add Class</button>
      </div>
    </div>
    <div class="table-wrap mt-4">
      <table>
        <thead>
          <tr>
            <th class="text-left">Class Name</th>
            <th class="text-center">Status</th>
            <th class="text-center">Created Date</th>
            <th class="text-right">Actions</th>
          </tr>
        </thead>
        <tbody id="tbl-classes"></tbody>
      </table>
    </div>
  `;

  const tbody = document.getElementById('tbl-classes');
  if (!sortedData.length) { 
    tbody.innerHTML = '<tr><td colspan="4"><div class="empty-state"><div class="empty-state__icon">&#128218;</div><p>No classes found.</p></div></td></tr>'; 
  } else {
    sortedData.forEach(r => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="fw-600">
          ${r.name.replace(/</g, '&lt;')}
          <div class="text-xs text-muted mt-1" style="font-weight: normal;">Level: ${r.levels?.name || 'Unassigned'}</div>
        </td>
        <td class="text-center"><span class="badge ${r.is_active ? 'badge-success' : 'badge-neutral'}">${r.is_active ? 'Active' : 'Inactive'}</span></td>
        <td class="text-center text-muted text-sm">${new Date(r.created_at).toLocaleDateString()}</td>
        <td class="text-right">
          <div class="d-flex gap-2 justify-end">
            <button class="btn btn-primary btn-sm" onclick="window.handleCreateClassAssessment('${r.id}', '${(r.name || '').replace(/'/g, "\\'").replace(/"/g, "&quot;")}')">&#10133; New Assessment</button>
            <button class="btn btn-danger btn-sm" data-del-class="${r.id}">Delete</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  // Hook up Add Class
  document.getElementById('btn-add-class-global')?.addEventListener('click', () => {
    const nameEl   = document.getElementById('add-class-name');
    const levelSelect = document.getElementById('add-class-level-id');
    const labelEl  = document.getElementById('add-class-level-label');
    const modalEl  = document.getElementById('add-class-modal');
    if (!nameEl || !modalEl) return;
    
    nameEl.value = '';
    if (levelSelect) {
      levelSelect.innerHTML = '<option value="">Select Level...</option>';
      levels.forEach(l => {
        levelSelect.innerHTML += `<option value="${l.id}">${l.name}</option>`;
      });
      levelSelect.value = '';
    }
    if (labelEl) labelEl.textContent = 'New Class';
    modalEl.classList.remove('hidden');

    const saveBtn    = document.getElementById('add-class-save-btn');
    const newSaveBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newSaveBtn, saveBtn);

    newSaveBtn.addEventListener('click', async () => {
      const name = nameEl.value.trim();
      const level_id = levelSelect ? levelSelect.value : null;
      if (!name) return showToast('Class name is required', 'error');
      if (!level_id) return showToast('Level is required', 'error');
      try {
        newSaveBtn.disabled = true;
        newSaveBtn.textContent = 'Saving...';
        await adminInsert('classes', { name, level_id, status: 'active', is_active: true });
        showToast('Class created successfully!', 'success');
        modalEl.classList.add('hidden');
        renderClasses(area);
      } catch (err) {
        showToast('Error creating class: ' + err.message, 'error');
      } finally {
        newSaveBtn.disabled = false;
        newSaveBtn.textContent = 'Save Class';
      }
    });
  });

  // Hook up Delete
  tbody.querySelectorAll('[data-del-class]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cid = btn.getAttribute('data-del-class');
      if (!confirm('Are you sure you want to delete this class? This may hide it from existing cohorts.')) return;
      try {
        await adminSoftDelete('classes', cid);
        showToast('Class deleted', 'success');
        renderClasses(area);
      } catch (e) {
        showToast('Error deleting class', 'error');
      }
    });
  });
}
