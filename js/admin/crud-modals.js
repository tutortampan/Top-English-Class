import {
  adminFetchAll, adminInsert, adminUpdate, adminSoftDelete,
  mergeDuplicateStudents, detectDuplicateStudents, mergeStudentPair,
  detectDuplicateQuestions, resequenceExamQuestions, resolveDuplicateQuestionGroup, batchResolveExamDuplicateQuestions
} from '../api.js?v=4.1.0';
import { showToast, showLoading, hideLoading } from '../app.js?v=4.1.0';

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

// -- Module-level state & DOM references (assigned lazily on first use) --
let crudModal   = null;
let crudForm    = null;
let _currentSection = null;
let _editId     = null;
let openDuplicateStudentsModal = null;
let openDuplicateQuestionsModal = null;

const formFields = {
  user_professionals: [
    { id: 'full_name', label: 'Full Name', type: 'text', required: true },
    { id: 'title', label: 'Professional Title', type: 'text', required: false },
    { id: 'bio', label: 'Biography', type: 'textarea', required: false },
    { id: 'contact_email', label: 'Email Address', type: 'text', required: false },
    { id: 'contact_phone', label: 'Phone Number', type: 'text', required: false }
  ],
  work_records: [
    { id: 'company_name', label: 'Company / Organization', type: 'text', required: true },
    { id: 'role_title', label: 'Role / Job Title', type: 'text', required: true },
    { id: 'start_date', label: 'Start Date', type: 'date', required: true },
    { id: 'end_date', label: 'End Date', type: 'date', required: false },
    { id: 'description', label: 'Description', type: 'textarea', required: false }
  ],
  professional_skills: [
    { id: 'skill_name', label: 'Skill Name', type: 'text', required: true },
    { id: 'proficiency_level', label: 'Proficiency Level', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced', 'Expert'], required: true }
  ],
  institutions: [
    { id: 'name', label: 'Institution Name', type: 'text', required: true },
    { id: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  subjects: [
    { id: 'name', label: 'Class Name', type: 'text', required: true },
    { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
    { id: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  class_instances: [
    { id: 'batch_id', label: 'Batch', type: 'select', source: 'batches', required: true },
    { id: 'class_id', label: 'Class Board', type: 'select', source: 'classes', required: true },
    { id: 'start_date', label: 'Start Date', type: 'date', required: false },
    { id: 'estimated_finish', label: 'Estimated Finish Date', type: 'date', required: false },
    { id: 'recurring_schedule', label: 'Recurring Schedule (JSON)', type: 'textarea', placeholder: 'e.g. [{"day": "Monday", "start_time": "15:00", "end_time": "16:30", "zoom_link": "https://zoom.us/j/123"}]', required: false },
    { id: 'status', label: 'Status', type: 'select', options: [{val:'active',text:'Active'},{val:'finished',text:'Finished'},{val:'inactive',text:'Inactive'}], required: true }
  ],
  levels: [
    { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true, uiOnly: true },
    { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: false, dependsOn: 'institution_id' },
    { id: 'class_id', label: 'Subject', type: 'select', source: 'classes', required: true, dependsOn: 'institution_id' },
    { id: 'level_number', label: 'Level Number', type: 'number', required: true, placeholder: 'e.g. 1' },
    { id: 'name', label: 'Level Name', type: 'text', required: true, placeholder: 'e.g. Level 1 - Beginner' },
    { id: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  programs: [
    { id: 'name', label: 'Program Name', type: 'text', required: true },
    { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
    { id: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  batches: [
    { id: 'institution_id', label: 'Program (filter only)', type: 'select', source: 'institutions', required: false, uiOnly: true },
    { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: true, dependsOn: 'institution_id' },
    { id: 'name', label: 'Batch Name', type: 'text', required: true, placeholder: 'e.g. Batch 2026-A' },
    { id: 'is_active', label: 'Active', type: 'checkbox' },
  ],
  students: [
    { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
    { id: 'program_id', label: 'Class', type: 'select', source: 'programs', required: true, dependsOn: 'institution_id' },
    { id: 'batch_id', label: 'Batch', type: 'select', source: 'batches', required: false, dependsOn: 'program_id' },
    
    { id: 'name', label: 'Full Name', type: 'text', required: true },
    { id: 'gender', label: 'Gender', type: 'select', options: [
      { value: '', label: 'â€” Unassigned (Student will choose) â€”' },
      { value: 'male', label: 'Male (Mr.)' },
      { value: 'female', label: 'Female (Miss)' }
    ]},
    { id: 'birth_date', label: 'Birth Date', type: 'date' },
    { id: 'pin_hash', label: 'PIN (4 digits)', type: 'password', placeholder: '****' },
    { id: 'is_active', label: 'Active', type: 'checkbox' },
  ],
      assessments: [
      { id: 'institution_id', label: 'Institution', type: 'select', source: 'institutions', required: true },
      { id: 'program_id', label: 'Program', type: 'select', source: 'programs', required: false, dependsOn: 'institution_id' },
      { id: 'batch_id', label: 'Batch', type: 'select', source: 'batches', required: false, dependsOn: 'program_id' },
      { id: 'module_id', label: 'AI Module', type: 'select', source: 'modules', required: true },
      { id: 'auto_name_override', label: 'Manual Name Override', type: 'checkbox' },
      { id: 'name', label: 'Assessment Name', type: 'text', required: true },
      { id: 'available_from', label: 'Available From', type: 'datetime-local' },
      { id: 'available_until', label: 'Available Until', type: 'datetime-local' },
      { id: 'time_limit_seconds', label: 'Time Limit (Seconds)', type: 'number' },
      { id: 'prerequisite_rules', label: 'Prerequisite Rules (JSON)', type: 'textarea' },
      { id: 'payload', label: 'Configuration Payload (JSON)', type: 'textarea' }
    ],
    exams: [
    { id: 'institution_id', label: 'Program', type: 'select', source: 'institutions', required: true },
    { id: 'program_id', label: 'Class (Optional / Assigned)', type: 'select', source: 'programs', required: false, dependsOn: 'institution_id' },
    { id: 'class_id', label: 'Subject', type: 'select', source: 'classes', required: false, dependsOn: 'institution_id' },
    { id: 'exam_type', label: 'Exam Type', type: 'select', options: ['Daily', 'Weekly', 'Monthly', 'Final'], required: true, defaultValue: 'Daily' },
    
    { id: 'exam_order', label: 'Order (1, 2, 3...)', type: 'select', options: ['1','2','3','4','5','6','7','8','9','10'], required: true, defaultValue: '1' },
    { id: 'exam_title', label: 'Assessment Title (Auto-Generated)', type: 'text', required: true, placeholder: 'Auto-generated as: [Class] - [Topic] - [Module] - [Type]' },
    { id: 'prerequisite_exam_id', label: 'Prerequisite Exam (Optional)', type: 'select', source: 'exams', required: false },
    { id: 'minimum_required_score', label: 'Passing Score % (Default: 60%)', type: 'number', required: true, defaultValue: 60 },
    { id: 'prerequisite_min_score', label: 'Prerequisite Min % (Default: 60%)', type: 'number', required: false, defaultValue: 60 },
    { id: 'time_limit_minutes', label: 'Global Time Limit (minutes)', type: 'number', required: true, defaultValue: 60 },
    { id: 'exam_status', label: 'Exam Status', type: 'select', options: ['published','draft','unpublished','archived'], required: true },
    { id: 'question_order', label: 'Question Order', type: 'select', options: [{ value: 'sequential', label: 'Sequential' }, { value: 'random', label: 'Random' }], required: true },
    { id: 'retake_allowed', label: 'Retake Allowed', type: 'checkbox' },
    { id: 'max_attempts', label: 'Max Attempts (blank = unlimited)', type: 'number' },
  ],
  questions: [
    { id: 'question_text', label: 'Question Text', type: 'textarea', required: true },
    { id: 'question_order', label: 'Order', type: 'number', required: true },
    { id: 'exam_id', label: 'Examination', type: 'select', source: 'exams', required: true },
    { id: 'answer_type', label: 'Answer Type', type: 'select', options: [
      {value:'multiple_choice',label:'Multiple Choice'},
      {value:'dropdown',label:'Dropdown'},
      {value:'speech_to_text',label:'Speaking Test'},
      {value:'written',label:'Written Test'}
    ], required: true },
    { id: 'correct_answer', label: 'Correct Answer', type: 'text', required: true, placeholder: 'e.g. run / jog / sprint  (use / ; or | to separate multiple accepted answers)' },
    { id: 'options_json', label: 'Options (separated by / ; or JSON array)', type: 'textarea', placeholder: 'e.g. Option A / Option B / Option C  (use / or ; to separate choices)' },
    { id: 'metadata', label: 'Metadata / Word Type', type: 'text', placeholder: 'e.g. 1 - VERB' },
  ],
};

function _ensureDomRefs() {
  if (!crudModal) crudModal = document.getElementById('crud-modal');
  if (!crudForm)  crudForm  = document.getElementById('crud-form');
}

async function openCrudModal(section, record) {
      _ensureDomRefs();
      _currentSection = section;
      _editId = record?.id || null;
      window.isProfileDirty = false;
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
          if (f.id === 'prerequisite_exam_id') {
            sel.innerHTML = `<option value="">None (Optional)</option>`;
            sel.disabled = false;

            sel.innerHTML = `<option value="">â€” No Level / Optional â€”</option>`;
            sel.disabled = false;
          } else if (!f.dependsOn) {
            sel.innerHTML = `<option value="">â€” Select â€”</option>`;
            let opts = await adminFetchAll(f.source);
            opts = opts.filter(o => !o.deleted_at);
            
            // Phase 5: Filter out inactive items in dropdowns
            opts = opts.filter(o => {
              if (o.is_active !== undefined) return o.is_active === true;
              if (o.status !== undefined) return o.status !== 'cancelled' && o.status !== 'archived';
              if (o.exam_status !== undefined) return o.exam_status === 'published';
              return true;
            });

            opts.forEach(o => {
              const opt = document.createElement('option');
              opt.value = o.id;
              opt.textContent = o.name || o.title || o.exam_title || o.id;
              if (record && record[f.id] === o.id) opt.selected = true;
              sel.appendChild(opt);
            });
          } else {
            sel.innerHTML = `<option value="">â€” Select Previous First â€”</option>`;
            sel.disabled = true;
          }
          group.appendChild(sel);
        } else if (f.type === 'select' && f.options) {
          const sel = document.createElement('select');
          sel.className = 'form-control';
          sel.id = `field-${f.id}`;
          sel.name = f.id;
          if (f.required) sel.required = true;
          sel.innerHTML = `<option value="">â€” Select â€”</option>` + f.options.map(o => {
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
          else if (f.defaultValue !== undefined) inp.value = f.defaultValue;
          group.appendChild(inp);
        }

        formGrid.appendChild(group);
      }

      crudForm.appendChild(formGrid);

      const progSelect = crudForm.querySelector('#field-institution_id');
      const classSelect = crudForm.querySelector('#field-program_id');
      const batchSelect = crudForm.querySelector('#field-batch_id');
      const subjectSelect = crudForm.querySelector('#field-class_id');

      const updatePrereqRequirement = () => {
        if (!prereqSelect) return;
        // Keep prerequisite optional unless business rules require it later
        prereqSelect.required = false; 
      };

      if (prereqSelect) {
        prereqSelect.disabled = false;
        const isNoneSelected = !record || !record.prerequisite_exam_id;
        prereqSelect.innerHTML = `<option value="" ${isNoneSelected ? 'selected' : ''}>None (Optional)</option>`;
        const allExams = await adminFetchAll('exams');
        const eligible = allExams.filter(e => !e.deleted_at && e.id !== _editId);
        eligible.sort((a, b) => (a.exam_title || '').localeCompare(b.exam_title || '')).forEach(e => {
          const opt = document.createElement('option');
          opt.value = e.id;
          opt.textContent = e.exam_title || e.display_name || e.id;
          if (record && record.prerequisite_exam_id === e.id) opt.selected = true;
          prereqSelect.appendChild(opt);
        });
        updatePrereqRequirement();
      }

            let _titleManuallyEdited = Boolean(_editId && (record?.exam_title || record?.name));
      const triggerAutoTitle = () => {
        if (_titleManuallyEdited || !titleInput) return;
        if (_currentSection === 'exams') {
          const cText = (classSelect && classSelect.selectedIndex > 0 ? classSelect.options[classSelect.selectedIndex].textContent.trim() : '') ||
                        (progSelect && progSelect.selectedIndex > 0 ? progSelect.options[progSelect.selectedIndex].textContent.trim() : '');
          const tText = subjectSelect && subjectSelect.selectedIndex > 0 ? subjectSelect.options[subjectSelect.selectedIndex].textContent.trim() : '';
          const selectedLvlOpt = levelSelect && levelSelect.selectedIndex > 0 ? levelSelect.options[levelSelect.selectedIndex] : null;
          const mText = selectedLvlOpt ? (selectedLvlOpt.getAttribute('data-level-letter') || selectedLvlOpt.textContent.trim()) : '';
          const typeText = examTypeInput ? examTypeInput.value.trim() : '';

          const parts = [cText, tText, mText, typeText].filter(Boolean);
          if (parts.length > 0) {
            titleInput.value = parts.join(' - ');
          }
        } else if (_currentSection === 'assessments') {
          const mSelect = document.getElementById('field-module_id');
          const mText = mSelect && mSelect.selectedIndex > 0 ? mSelect.options[mSelect.selectedIndex].textContent.trim() : '';
          const progText = progSelect && progSelect.selectedIndex > 0 ? progSelect.options[progSelect.selectedIndex].textContent.trim() : '';
          const bSelect = document.getElementById('field-batch_id');
          const batchText = bSelect && bSelect.selectedIndex > 0 ? bSelect.options[bSelect.selectedIndex].textContent.trim() : '';

          const parts = [progText, batchText, mText].filter(Boolean);
          if (parts.length > 0) {
            titleInput.value = parts.join(' - ');
          }
        }
      };

      if (titleInput && (_currentSection === 'exams' || _currentSection === 'assessments')) {
        titleInput.addEventListener('input', () => {
          _titleManuallyEdited = true;
        });
      }

      const populateLevelsForSection = async () => {
        if (!levelSelect) return;
        levelSelect.innerHTML = `<option value="">â€” No Level / Optional â€”</option>`;
        levelSelect.disabled = false;

        try {
          const allLevels = await adminFetchAll('levels');
          let activeLevels = allLevels.filter(l => !l.deleted_at);

          const selSubjId = subjectSelect ? subjectSelect.value : null;
          if (selSubjId) {
            const subjectSpecific = activeLevels.filter(l => l.class_id === selSubjId);
            if (subjectSpecific.length > 0) {
              activeLevels = subjectSpecific;
            }
          }

          const seen = new Set();
          activeLevels.sort((a, b) => (Number(a.level_number) || 0) - (Number(b.level_number) || 0)).forEach(l => {
            if (!seen.has(l.id)) {
              seen.add(l.id);
              const opt = document.createElement('option');
              opt.value = l.id;
              const letter = toLevelLetter(l.level_number);
              const displayName = l.name ? (l.name.toLowerCase().includes('level') ? l.name : `Level ${letter} (${l.name})`) : `Level ${letter}`;
              opt.textContent = displayName;
              opt.setAttribute('data-level-letter', letter);
              opt.setAttribute('data-level-num', l.level_number);

              levelSelect.appendChild(opt);
            }
          });
        } catch (lvlErr) {
          console.warn('Level population notice:', lvlErr);
        }

        updatePrereqRequirement();
        triggerAutoTitle();
      };

      if (progSelect && classSelect) {
        const populateBatchesForClass = async (selectedClassId) => {
          if (!batchSelect) return;
          batchSelect.innerHTML = `<option value="">â€” Select Batch â€”</option>`;
          if (!selectedClassId) {
            batchSelect.disabled = true;
            batchSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
            return;
          }
          batchSelect.disabled = false;
          const allBatches = await adminFetchAll('batches');
          const filteredBatches = allBatches.filter(b => b.program_id === selectedClassId && !b.deleted_at && (b.is_active === undefined || b.is_active === true));
          filteredBatches.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(b => {
            const opt = document.createElement('option');
            opt.value = b.id;
            opt.textContent = b.name;
            if (record && record.batch_id === b.id) opt.selected = true;
            batchSelect.appendChild(opt);
          });
        };

        const populateClassesForProgram = async (selectedProgId) => {
          classSelect.innerHTML = `<option value="">${_currentSection === 'levels' ? 'â€” Select Program (Optional / All Programs) â€”' : 'â€” Select Program â€”'}</option>`;
          if (batchSelect) {
            batchSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
            batchSelect.disabled = true;
          }
          if (!selectedProgId) {
            classSelect.disabled = true;
            return;
          }
          classSelect.disabled = false;
          const allClasses = await adminFetchAll('programs');
          const filteredClasses = allClasses.filter(c => c.institution_id === selectedProgId && !c.deleted_at && (c.is_active === undefined || c.is_active === true));
          filteredClasses.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(c => {
            const opt = document.createElement('option');
            opt.value = c.id;
            opt.textContent = c.name;
            if (record && record.program_id === c.id) opt.selected = true;
            classSelect.appendChild(opt);
          });
          if (classSelect.value) {
            await populateBatchesForClass(classSelect.value);
          }
          await populateLevelsForSection();
          triggerAutoTitle();
        };

        const initialProgId = record?.institution_id || (record?.programs?.institution_id) || (record?.classes?.institution_id) || progSelect.value;
        if (initialProgId) {
          progSelect.value = initialProgId;
          await populateClassesForProgram(initialProgId);
          if (record?.program_id) {
            classSelect.value = record.program_id;
            await populateBatchesForClass(record.program_id);
            if (record?.batch_id && batchSelect) {
              batchSelect.value = record.batch_id;
            }
          }
        } else {
          classSelect.disabled = true;
          classSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
        }

        progSelect.addEventListener('change', async (e) => {
          await populateClassesForProgram(e.target.value);
        });
        classSelect.addEventListener('change', async (e) => {
          if (typeof populateBatchesForClass === 'function') {
            await populateBatchesForClass(e.target.value);
          }
          await populateLevelsForSection();
          triggerAutoTitle();
        });
      }

      // Program -> Subject -> Level cascading dependencies
      if (progSelect && subjectSelect) {
        const populateSubjectsForProgram = async (selectedProgId) => {
          subjectSelect.innerHTML = `<option value="">â€” Select Subject â€”</option>`;
          if (!selectedProgId) {
            subjectSelect.disabled = true;
            return;
          }
          subjectSelect.disabled = false;
          const allSubjects = await adminFetchAll('classes');
          const filteredSubjects = allSubjects.filter(s => s.institution_id === selectedProgId && !s.deleted_at);
          filteredSubjects.sort((a, b) => (a.name || '').localeCompare(b.name || '')).forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = s.name;
            if (record && record.class_id === s.id) opt.selected = true;
            subjectSelect.appendChild(opt);
          });
          await populateLevelsForSection();
          triggerAutoTitle();
        };

        const initialProgIdForSubject = record?.institution_id || (record?.classes?.institution_id) || progSelect?.value;
        if (initialProgIdForSubject) {
          await populateSubjectsForProgram(initialProgIdForSubject);
        } else {
          subjectSelect.disabled = true;
          subjectSelect.innerHTML = `<option value="">â€” Select Program First â€”</option>`;
        }

        progSelect.addEventListener('change', async (e) => {
          await populateSubjectsForProgram(e.target.value);
        });
        subjectSelect.addEventListener('change', async () => {
          await populateLevelsForSection();
          triggerAutoTitle();
        });
      }

      if (levelSelect) {
        levelSelect.addEventListener('change', () => {
          updatePrereqRequirement();
          triggerAutoTitle();
        });
      }
      if (orderSelect) {
        orderSelect.addEventListener('change', () => {
          updatePrereqRequirement();
          triggerAutoTitle();
        });
      }
      if (examTypeInput) {
        examTypeInput.addEventListener('change', triggerAutoTitle);
        examTypeInput.addEventListener('input', triggerAutoTitle);
      }


      crudModal.classList.remove('hidden');
    }

// Wire up module-level event listeners (DOM must be ready)
document.addEventListener('DOMContentLoaded', () => {
  _ensureDomRefs();

  crudForm.addEventListener('input', () => { window.isProfileDirty = true; });
  crudForm.addEventListener('change', () => { window.isProfileDirty = true; });

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
        else if (f.id === 'recurring_schedule') {
          if (!el.value || !el.value.trim()) {
            payload[f.id] = null;
          } else {
            try {
              payload[f.id] = JSON.parse(el.value.trim());
            } catch (err) {
              alert('Invalid JSON format in Recurring Schedule.');
              return;
            }
          }
        }
        else if (f.id === 'options_json') {
          if (!el.value || !el.value.trim()) {
            payload[f.id] = null;
          } else {
            const raw = el.value.trim();
            if (raw.startsWith('[') && raw.endsWith(']')) {
              try {
                payload[f.id] = JSON.parse(raw);
              } catch {
                if (/[;/|]/.test(raw)) {
                  payload[f.id] = raw.replace(/^[\[\]"']+|[\[\]"']+$/g, '').split(/[;/|]/).map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
                } else {
                  payload[f.id] = raw.replace(/^[\[\]"']+|[\[\]"']+$/g, '').split(',').map(s => s.trim().replace(/^["']|["']$/g, '')).filter(Boolean);
                }
              }
            } else if (/[;/|]/.test(raw)) {
              payload[f.id] = raw.split(/[;/|]/).map(s => s.trim()).filter(Boolean);
            } else if (raw.includes(',')) {
              payload[f.id] = raw.split(',').map(s => s.trim()).filter(Boolean);
            } else {
              payload[f.id] = [raw];
            }
          }
        }
        else if (f.type === 'password' && _editId && !el.value) continue; // Don't overwrite PIN if empty on edit
        else if (f.type === 'password' && el.value) {
          payload[f.id] = await hashPin(el.value);
        }
        else payload[f.id] = el.value || null;
      }

      // Prerequisite Exam Validation: Must fill if level and order are not Level A and Order 1
      if (_currentSection === 'exams') {
        // Prerequisite logic handled in Assessment Builder
      }

      // Never send display_name (Postgres GENERATED ALWAYS STORED column causes 428C9)
      delete payload.display_name;

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
            if (targetTable === 'levels' && payloadToSave.program_id && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
              delete payloadToSave.program_id;
              await adminUpdate(targetTable, _editId, payloadToSave);
            } else if (targetTable === 'exams') {
              let retried = false;
              if ('program_id' in payloadToSave && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.program_id;
                retried = true;
              }
              if ('prerequisite_exam_id' in payloadToSave && (err.message?.includes('prerequisite') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.prerequisite_exam_id;
                retried = true;
              }
              if ('exam_order' in payloadToSave && (err.message?.includes('order') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.exam_order;
                retried = true;
              }
              if (retried) {
                await adminUpdate(targetTable, _editId, payloadToSave);
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
          showToast('Record updated.', 'success');
        } else {
          // If manually adding a student, check if identical student already exists in same class
          if (_currentSection === 'students') {
            const existingList = await adminFetchAll('students');
            const existingMatch = existingList.find(s => !s.deleted_at && s.program_id === payload.program_id && (formatStudentName(s.name, s.gender) || '').toLowerCase().trim() === (payload.name || '').toLowerCase().trim());
            if (existingMatch) {
              await adminUpdate('students', existingMatch.id, { ...payload, updated_at: new Date().toISOString() });
              showToast('A student with this name already exists in the class. Data successfully merged/updated!', 'success');
              crudModal.classList.add('hidden');
              loadSection('students');
              return;
            }
          }
          try {
            await adminInsert(targetTable, payloadToSave);
          } catch (err) {
            if (targetTable === 'levels' && payloadToSave.program_id && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
              delete payloadToSave.program_id;
              await adminInsert(targetTable, payloadToSave);
            } else if (targetTable === 'exams') {
              let retried = false;
              if ('program_id' in payloadToSave && (err.message?.includes('program_id') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.program_id;
                retried = true;
              }
              if ('prerequisite_exam_id' in payloadToSave && (err.message?.includes('prerequisite') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.prerequisite_exam_id;
                retried = true;
              }
              if ('exam_order' in payloadToSave && (err.message?.includes('order') || err.message?.includes('PGRST204') || err.message?.includes('400'))) {
                delete payloadToSave.exam_order;
                retried = true;
              }
              if (retried) {
                await adminInsert(targetTable, payloadToSave);
              } else {
                throw err;
              }
            } else {
              throw err;
            }
          }
          showToast('Record added.', 'success');
        }
        window.isProfileDirty = false;
        crudModal.classList.add('hidden');
        loadSection(_currentSection);
      } catch(e) {
        showToast('Save failed: ' + e.message, 'error');
      }
    });


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
        loadSection(_currentSection);
      } catch (err) {
        showToast('Delete failed: ' + err.message, 'error');
      }
    });

    // Modal close handlers
    ['close-crud-modal','crud-cancel-btn'].forEach(id => document.getElementById(id).addEventListener('click', () => {
      if (window.isProfileDirty) {
        if (!confirm('You have unsaved changes. Are you sure you want to close?')) return;
      }
      window.isProfileDirty = false;
      crudModal.classList.add('hidden');
    }));
    ['delete-cancel-btn'].forEach(id => document.getElementById(id).addEventListener('click', () => document.getElementById('delete-modal').classList.add('hidden')));

    // --- DUPLICATE STUDENTS MODAL LOGIC ---
    const dupStudModal = document.getElementById('duplicate-students-modal');
    const dupStudContent = document.getElementById('dup-students-content');
    let currentDupStudScope = 'same_class';
    let dupStudentGroups = [];

    openDuplicateStudentsModal = async function() {
      dupStudModal.classList.remove('hidden');
      await loadDuplicateStudents(currentDupStudScope);
    };

    document.getElementById('close-dup-students-modal')?.addEventListener('click', () => {
      dupStudModal.classList.add('hidden');
      loadSection('students'); // Refresh list when closed
    });

    document.querySelectorAll('.dup-stud-tab-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        document.querySelectorAll('.dup-stud-tab-btn').forEach(b => {
          b.classList.remove('btn-primary');
          b.classList.add('btn-secondary');
        });
        const target = e.currentTarget;
        target.classList.remove('btn-secondary');
        target.classList.add('btn-primary');
        currentDupStudScope = target.dataset.scope;
        await loadDuplicateStudents(currentDupStudScope);
      });
    });

    async function loadDuplicateStudents(scope) {
      dupStudContent.innerHTML = '<div class="empty-state p-6 text-center"><div class="spinner"></div><p>Scanning for duplicates...</p></div>';
      try {
        const duplicateGroups = await detectDuplicateStudents(scope);
        dupStudentGroups = duplicateGroups;
        
        // Update counters
        const totalDups = duplicateGroups.reduce((acc, g) => acc + (g.candidates.length - 1), 0);
        if (scope === 'same_class') document.getElementById('dup-stud-same-count').textContent = totalDups;
        else document.getElementById('dup-stud-cross-count').textContent = totalDups;

        if (dupStudentGroups.length === 0) {
          dupStudContent.innerHTML = '<div class="empty-state p-6 text-center"><p>âœ… No duplicate students found.</p></div>';
          return;
        }

        let html = '';
        dupStudentGroups.forEach((group, gIdx) => {
          html += `
            <div class="card p-4 mb-4" style="border-left:4px solid var(--clr-primary);">
              <div class="fw-700 mb-2">Duplicate Group ${gIdx + 1} â€” Name: "${escapeHtml(group.name)}"</div>
              <table class="table-sm w-100 mb-3 text-sm">
                <thead>
                  <tr>
                    <th>Student Info</th>
                    <th>Demographics</th>
                    <th>Academic History</th>
                    <th>Created At</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
          `;
          group.candidates.forEach((student, sIdx) => {
            html += `
                  <tr style="${sIdx === 0 ? 'background:rgba(74, 222, 128, 0.1);' : ''}">
                    <td>${student.id.substring(0,8)}...</td>
                    <td>${escapeHtml(student.programs?.name || '-')}</td>
                    <td>${escapeHtml(student.institutions?.name || '-')}</td>
                    <td>${new Date(student.created_at).toLocaleString()}</td>
                    <td>${sIdx === 0 ? '<span class="badge badge-success">Primary Target</span>' : `<button class="btn btn-warning btn-sm btn-merge-student" data-primary="${group.recommendedPrimaryId}" data-secondary="${student.id}">Merge to Primary</button>`}</td>
                  </tr>
            `;
          });
          html += `
                </tbody>
              </table>
            </div>
          `;
        });
        dupStudContent.innerHTML = html;

        // Attach merge listeners
        document.querySelectorAll('.btn-merge-student').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const primaryId = e.currentTarget.dataset.primary;
            const secondaryId = e.currentTarget.dataset.secondary;
            if(!confirm('Merge this student into the primary? All exam attempts and progress will be transferred, and this duplicate profile will be soft-deleted. This cannot be undone.')) return;
            
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<div class="spinner" style="width:12px;height:12px;"></div>';
            try {
              const res = await mergeStudentPair(primaryId, secondaryId);
              showToast(`Successfully merged student! Transferred ${res.transferredAttempts || 0} attempts and ${res.transferredProgress || 0} progress records.`, 'success');
              await loadDuplicateStudents(currentDupStudScope); // Refresh
            } catch(err) {
              showToast(`Merge failed: ${err.message}`, 'error');
              e.currentTarget.disabled = false;
              e.currentTarget.textContent = 'Merge to Primary';
            }
          });
        });

      } catch(err) {
        dupStudContent.innerHTML = `<div class="empty-state p-6 text-center text-danger"><p>Error loading duplicates: ${err.message}</p></div>`;
      }
    }

    document.getElementById('btn-merge-all-visible-students')?.addEventListener('click', async () => {
      if (dupStudentGroups.length === 0) return;
      if (!confirm(`Are you sure you want to quick-merge ALL ${dupStudentGroups.length} visible groups into their respective primary profiles?`)) return;
      
      showLoading('Batch merging duplicate students...');
      try {
        let successCount = 0;
        for (const group of dupStudentGroups) {
          const primaryId = group[0].id;
          for (let i = 1; i < group.length; i++) {
            await mergeStudentPair(primaryId, group[i].id);
            successCount++;
          }
        }
        hideLoading();
        showToast(`Successfully processed batch merge (${successCount} records merged).`, 'success');
        await loadDuplicateStudents(currentDupStudScope);
      } catch (err) {
        hideLoading();
        showToast(`Batch merge interrupted: ${err.message}`, 'error');
        await loadDuplicateStudents(currentDupStudScope);
      }
    });

    // --- DUPLICATE QUESTIONS MODAL LOGIC ---
    const dupQModal = document.getElementById('duplicate-questions-modal');
    const dupQContent = document.getElementById('dup-questions-content');
    const dupQExamSelect = document.getElementById('dup-q-exam-select');

    openDuplicateQuestionsModal = async function() {
      dupQModal.classList.remove('hidden');
      
      // Populate exam select
      try {
        const exams = await adminFetchAll('exams', 'id, exam_title, exam_status');
        const sortedExams = exams.sort((a, b) => a.exam_title.localeCompare(b.exam_title));
        dupQExamSelect.innerHTML = '<option value="">â€” All Exams (Global Search) â€”</option>' + 
          sortedExams.map(e => `<option value="${e.id}">${escapeHtml(e.exam_title)} (${e.exam_status})</option>`).join('');
      } catch(e) { console.error("Could not load exams for duplicate select:", e); }
        
      await loadDuplicateQuestions();
    }

    document.getElementById('close-dup-questions-modal')?.addEventListener('click', () => {
      dupQModal.classList.add('hidden');
    });

    dupQExamSelect?.addEventListener('change', () => loadDuplicateQuestions());

    async function loadDuplicateQuestions() {
      dupQContent.innerHTML = '<div class="empty-state p-6 text-center"><div class="spinner"></div><p>Scanning for duplicate questions...</p></div>';
      try {
        const examId = dupQExamSelect.value || null;
        const data = await detectDuplicateQuestions(examId);
        
        document.getElementById('dup-q-same-count').textContent = data.totalSameExamDupCount;

        if (data.sameExamDuplicates.length === 0) {
          dupQContent.innerHTML = '<div class="empty-state p-6 text-center"><p>âœ… No duplicate questions found.</p></div>';
          return;
        }

        let html = '';
        data.sameExamDuplicates.forEach((group, gIdx) => {
          // Group by exam
          const examTitle = group.examTitle || 'Unknown Exam';
          const primaryQ = group.candidates[0];
          
          let optsDisplay = '';
          if (primaryQ.options_json) {
            try {
              const opts = typeof primaryQ.options_json === 'string' ? JSON.parse(primaryQ.options_json) : primaryQ.options_json;
              optsDisplay = Array.isArray(opts) ? opts.join(' | ') : String(primaryQ.options_json);
            } catch(e) {
              optsDisplay = String(primaryQ.options_json);
            }
          }

          html += `
            <div class="card p-4 mb-4" style="border-left:4px solid var(--clr-warning);">
              <div class="d-flex justify-between align-center mb-2 flex-wrap gap-2">
                <div class="fw-700">Duplicate Question in: ${escapeHtml(examTitle)}</div>
                <button class="btn btn-warning btn-sm btn-resolve-q-group" data-primary="${primaryQ.id}">Auto-Resolve Group</button>
              </div>
              <div class="text-sm mb-3 px-3 py-2 rounded" style="background:var(--clr-surface-2); border:1px solid var(--clr-border);">
                <div class="mb-2"><strong>Text:</strong> ${escapeHtml(primaryQ.question_text)}</div>
                ${optsDisplay ? `<div class="mb-2 text-muted"><strong>Options:</strong> ${escapeHtml(optsDisplay)}</div>` : ''}
                <div class="text-muted"><strong>Correct Answer:</strong> ${escapeHtml(primaryQ.correct_answer || '-')}</div>
              </div>
              <table class="table-sm w-100 text-xs">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Order</th>
                    <th>Answer Type</th>
                    <th>Answers Count</th>
                    <th>Created At</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
          `;
          group.candidates.forEach((q, qIdx) => {
            html += `
                  <tr style="${qIdx === 0 ? 'background:rgba(74, 222, 128, 0.1);' : 'background:rgba(239, 68, 68, 0.05);'}">
                    <td>${q.id.substring(0,8)}...</td>
                    <td>${q.question_order}</td>
                    <td>${escapeHtml(q.answer_type)}</td>
                    <td class="fw-700 text-primary">${q.answersCount || 0}</td>
                    <td>${new Date(q.created_at).toLocaleString()}</td>
                    <td>${qIdx === 0 ? '<span class="badge badge-success">Primary (Kept)</span>' : '<span class="badge badge-error">Duplicate (Will Remove)</span>'}</td>
                  </tr>
            `;
          });
          html += `
                </tbody>
              </table>
            </div>
          `;
        });
        dupQContent.innerHTML = html;

        // Attach resolve listeners
        document.querySelectorAll('.btn-resolve-q-group').forEach(btn => {
          btn.addEventListener('click', async (e) => {
            const primaryId = e.currentTarget.dataset.primary;
            // Find the group based on primaryId
            const group = data.sameExamDuplicates.find(g => g.recommendedPrimaryId === primaryId);
            if(!group) return;
            
            if(!confirm('Resolve this duplicate question group? All student answers tied to the duplicates will be repointed to the primary question, and the duplicates will be hard-deleted. Finally, the exam questions will be re-sequenced.')) return;
            
            e.currentTarget.disabled = true;
            e.currentTarget.innerHTML = '<div class="spinner" style="width:12px;height:12px;"></div>';
            try {
              let count = 0;
              for (let i = 1; i < group.candidates.length; i++) {
                await resolveDuplicateQuestionGroup(group.recommendedPrimaryId, group.candidates[i].id, false);
                count++;
              }
              await resequenceExamQuestions(group.examId);
              showToast(`Resolved! Repointed answers. ${count} duplicates removed.`, 'success');
              await loadDuplicateQuestions(); // Refresh
            } catch(err) {
              showToast(`Resolve failed: ${err.message}`, 'error');
              e.currentTarget.disabled = false;
              e.currentTarget.textContent = 'Auto-Resolve Group';
            }
          });
        });

      } catch(err) {
        dupQContent.innerHTML = `<div class="empty-state p-6 text-center text-danger"><p>Error loading duplicates: ${err.message}</p></div>`;
      }
    }

    document.getElementById('btn-resolve-all-visible-questions')?.addEventListener('click', async () => {
      const examId = dupQExamSelect.value || null;
      if (!examId) {
        showToast('Please select a specific Exam from the filter to perform Batch Auto-Resolve.', 'warning');
        return;
      }
      
      if (!confirm(`Are you sure you want to batch resolve ALL duplicate questions for this exam? This is irreversible.`)) return;
      
      showLoading('Batch resolving duplicate questions...');
      try {
        const res = await batchResolveExamDuplicateQuestions(examId);
        hideLoading();
        showToast(`Successfully processed exam: repointed ${res.totalRepointedAnswers} answers across ${res.groupsResolved} duplicate groups.`, 'success');
        await loadDuplicateQuestions();
      } catch (err) {
        hideLoading();
        showToast(`Batch resolve failed: ${err.message}`, 'error');
        await loadDuplicateQuestions();
      }
    });

    // Note: Sidebar toggle is already wired above (openSidebar/closeSidebar functions).
    // Duplicate handler removed â€” single handler at initConsole() is authoritative.
}); // end DOMContentLoaded




export { openCrudModal, openDuplicateStudentsModal, openDuplicateQuestionsModal, hashPin };

