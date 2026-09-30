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

let currentSelectedClass = null;
let allLevels = [];
let currentArea = null;

export async function renderClasses(area) {
  currentArea = area;
  let [data, levels] = await Promise.all([
    adminFetchAll('classes', '*, levels(name), programs(name), institutions(name)'),
    adminFetchAll('levels', '*')
  ]);
  const sortedData = [...(data || [])].sort((a, b) => (a.name || '').localeCompare(b.name || ''));
  allLevels = (levels || []).sort((a, b) => a.level_number - b.level_number);

  area.innerHTML = `
    <div class="workspace-split" style="display:flex; height:100%; width:100%; overflow:hidden;">
      <!-- Sidebar -->
      <div id="class-sidebar" style="width: 320px; border-right: 1px solid var(--clr-border); background: var(--clr-surface); display:flex; flex-direction:column; flex-shrink:0;">
        <div style="padding:1rem; border-bottom: 1px solid var(--clr-border); display:flex; justify-content:space-between; align-items:center;">
          <h3 style="margin:0; font-size:1.1rem;">Classes Workspace</h3>
          <button class="btn btn-primary btn-sm" id="btn-add-class-global" style="padding:0.25rem 0.5rem;">+ Add</button>
        </div>
        <div id="classes-list" style="flex:1; overflow-y:auto; padding:0.75rem; display:flex; flex-direction:column; gap:0.5rem;">
          <!-- List injected here -->
        </div>
      </div>
      
      <!-- Main Canvas -->
      <div id="class-detail-container" style="flex:1; overflow-y:auto; background:var(--clr-bg-1);">
        <div class="empty-state" style="height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--clr-text-muted);">
          <div style="font-size:3rem; margin-bottom:1rem;">⚡</div>
          <p>Pilih kelas di sidebar kiri untuk membuka ruang kerja operasional.</p>
        </div>
      </div>
    </div>
  `;

  const listContainer = document.getElementById('classes-list');
  
  if (!sortedData.length) {
    listContainer.innerHTML = '<div class="text-muted text-sm text-center" style="padding:1rem;">No classes found.</div>';
  } else {
    sortedData.forEach(cls => {
      // Don't render inactive classes unless we explicitly want them, but let's just render all
      const item = document.createElement('div');
      item.className = 'class-sidebar-item';
      item.style.cssText = 'padding:0.75rem; border-radius:8px; cursor:pointer; border:1px solid transparent; transition:all 0.2s;';
      
      const pName = cls.programs?.name || 'No Program';
      item.innerHTML = `
        <div style="font-weight:600; font-size:0.95rem; color:var(--clr-text-1);">${cls.name.replace(/</g, '&lt;')}</div>
        <div style="font-size:0.75rem; color:var(--clr-text-muted); margin-top:4px; display:flex; justify-content:space-between;">
          <span>${cls.levels?.name || 'Unassigned'}</span>
          <span style="opacity:0.7;">${pName}</span>
        </div>
      `;
      item.dataset.id = cls.id;
      
      item.onmouseover = () => { if(currentSelectedClass?.id !== cls.id) item.style.background = 'var(--clr-surface-2)'; };
      item.onmouseout = () => { if(currentSelectedClass?.id !== cls.id) item.style.background = 'transparent'; };

      item.onclick = () => {
        // Remove active state from all
        Array.from(listContainer.children).forEach(child => {
          child.style.border = '1px solid transparent';
          child.style.background = 'transparent';
        });
        // Apply active state
        item.style.border = '1px solid var(--clr-primary)';
        item.style.background = 'var(--clr-primary-light, rgba(0, 112, 243, 0.05))';
        currentSelectedClass = cls;
        renderClassDetail(cls);
      };

      // If we previously selected this class, render it automatically
      if (currentSelectedClass?.id === cls.id) {
         item.style.border = '1px solid var(--clr-primary)';
         item.style.background = 'var(--clr-primary-light, rgba(0, 112, 243, 0.05))';
         renderClassDetail(cls);
      }

      listContainer.appendChild(item);
    });
  }

  // Hook up Add Class functionality (Preserving old logic)
  document.getElementById('btn-add-class-global')?.addEventListener('click', () => {
    const nameEl   = document.getElementById('add-class-name');
    const levelSelect = document.getElementById('add-class-level-id');
    const labelEl  = document.getElementById('add-class-level-label');
    const modalEl  = document.getElementById('add-class-modal');
    if (!nameEl || !modalEl) return;
    
    nameEl.value = '';
    if (levelSelect) {
      levelSelect.innerHTML = '<option value="">Select Level...</option>';
      allLevels.forEach(l => {
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
        renderClasses(currentArea);
      } catch (err) {
        showToast('Error creating class: ' + err.message, 'error');
      } finally {
        newSaveBtn.disabled = false;
        newSaveBtn.textContent = 'Save Class';
      }
    });
  });
}

function renderClassDetail(cls) {
  const container = document.getElementById('class-detail-container');
  if(!container) return;

  const progName = cls.programs?.name || 'Unassigned Program';
  const instName = cls.institutions?.name || 'Unassigned Institution';
  const lvlName = cls.levels?.name || 'Unassigned Level';
  const statusBadge = cls.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-neutral">Inactive</span>';

  container.innerHTML = `
    <!-- HEADER IDENTITY -->
    <div style="padding: 2rem 2rem 0 2rem; border-bottom: 1px solid var(--clr-border); background: var(--clr-surface);">
      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
        <div>
          <h2 style="margin:0 0 0.75rem 0; font-size:1.6rem; color:var(--clr-text-1);">${cls.name.replace(/</g, '&lt;')}</h2>
          <div style="display:flex; gap:0.5rem; flex-wrap:wrap; font-size:0.8rem;">
            <span class="badge badge-neutral" style="background:var(--clr-surface-2);">&#127970; ${instName}</span>
            <span class="badge badge-neutral" style="background:var(--clr-surface-2);">&#128218; ${progName}</span>
            <span class="badge badge-neutral" style="background:var(--clr-surface-2);">&#11088; ${lvlName}</span>
            ${statusBadge}
          </div>
        </div>
        <div style="display:flex; gap:0.5rem;">
           <button class="btn btn-secondary btn-sm" onclick="window.handleCreateClassAssessment('${cls.id}', '${(cls.name || '').replace(/'/g, "\\'")}')">&#10133; New Assessment</button>
           <button class="btn btn-danger btn-sm" id="btn-del-active-class">Delete</button>
        </div>
      </div>
      
      <!-- 3-TAB NAVIGATION -->
      <div style="display:flex; gap:2rem; margin-top:2rem; border-bottom:1px solid transparent;">
        <div class="workspace-tab active" data-tab="learning-path" style="padding-bottom:0.75rem; cursor:pointer; font-weight:600; color:var(--clr-primary); border-bottom:2px solid var(--clr-primary); font-size:0.95rem;">&#128203; Learning Path & Assessments</div>
        <div class="workspace-tab" data-tab="students" style="padding-bottom:0.75rem; cursor:pointer; font-weight:500; color:var(--clr-text-muted); border-bottom:2px solid transparent; font-size:0.95rem;">&#128101; Students</div>
        <div class="workspace-tab" data-tab="gradebook" style="padding-bottom:0.75rem; cursor:pointer; font-weight:500; color:var(--clr-text-muted); border-bottom:2px solid transparent; font-size:0.95rem;">&#128202; Gradebook</div>
      </div>
    </div>

    <!-- TAB CONTENTS -->
    <div style="padding:2rem;">
      <div id="class-learning-path-container" class="tab-content" style="display:block;">
         <div class="empty-state" style="padding:3rem; text-align:center;">
           <p class="text-muted text-sm">Learning path is empty. This area will display the auto-generated task tree (Tasks 1-7 & Quiz).</p>
         </div>
      </div>
      <div id="class-students-container" class="tab-content" style="display:none;">
         <div class="empty-state" style="padding:3rem; text-align:center;">
            <p class="text-muted text-sm">Student roster and enrollment status will be displayed here.</p>
         </div>
      </div>
      <div id="class-gradebook-container" class="tab-content" style="display:none;">
         <div class="empty-state" style="padding:3rem; text-align:center;">
            <p class="text-muted text-sm">Class grade summaries will be displayed here.</p>
         </div>
      </div>
    </div>
  `;

  // Hook up Delete active class
  document.getElementById('btn-del-active-class')?.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete this class? This may hide it from existing cohorts.')) return;
    try {
      await adminSoftDelete('classes', cls.id);
      showToast('Class deleted', 'success');
      currentSelectedClass = null; // reset selection
      renderClasses(currentArea);
    } catch (e) {
      showToast('Error deleting class', 'error');
    }
  });

  // Tab Switching Logic
  const tabs = container.querySelectorAll('.workspace-tab');
  const contents = container.querySelectorAll('.tab-content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // reset tabs
      tabs.forEach(t => {
        t.style.fontWeight = '500';
        t.style.color = 'var(--clr-text-muted)';
        t.style.borderBottom = '2px solid transparent';
        t.classList.remove('active');
      });
      // hide contents
      contents.forEach(c => c.style.display = 'none');
      
      // activate tab
      tab.style.fontWeight = '600';
      tab.style.color = 'var(--clr-primary)';
      tab.style.borderBottom = '2px solid var(--clr-primary)';
      tab.classList.add('active');
      
      const targetId = 'class-' + tab.dataset.tab + '-container';
      document.getElementById(targetId).style.display = 'block';
    });
  });
}
