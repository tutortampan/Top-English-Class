/**
 * panel-c-builder.js
 * Panel C (Class & Assessment Management) Dashboard
 * Handles Smart Auto-Naming, Assessment Duplication, Prerequisite Engine, and AI Module Templates
 */
import { adminFetchAll, adminSoftDelete } from "../api.js?v=4.1.0";
import { getSupabase } from "../supabase.js?v=4.1.0";
import { showToast } from "../app.js?v=4.1.0";

// AI Module Definitions
export const AI_MODULES = {
  POINT_AND_SPEAK: {
    name: "Point & Speak!",
    label: "Point & Speak!",
    description: "Student takes a live photo and speaks a description using correct demonstrative pronoun, to-be, article, adjectives, and noun.",
    columns: ["NO", "INSTRUCTION", "TARGET_PRONOUNS", "MIN_ADJECTIVES"],
    sample: [
      ...Array.from({length: 5}, (_, i) => ({ NO: i + 1, INSTRUCTION: "Take a picture of 1 object close to you.", TARGET_PRONOUNS: "This", MIN_ADJECTIVES: 2 })),
      ...Array.from({length: 5}, (_, i) => ({ NO: i + 6, INSTRUCTION: "Take a picture of 1 object far from you.", TARGET_PRONOUNS: "That", MIN_ADJECTIVES: 2 })),
      ...Array.from({length: 5}, (_, i) => ({ NO: i + 11, INSTRUCTION: "Take a picture of 2+ objects close to you.", TARGET_PRONOUNS: "These", MIN_ADJECTIVES: 2 })),
      ...Array.from({length: 5}, (_, i) => ({ NO: i + 16, INSTRUCTION: "Take a picture of 2+ objects far from you.", TARGET_PRONOUNS: "Those", MIN_ADJECTIVES: 2 }))
    ]
  },
  STORYTELLING: {
    name: "Storytelling",
    columns: ["TOPIC_PROMPT", "MIN_SENTENCES", "TARGET_TENSE", "MIN_DURATION_SEC", "MAX_DURATION_SEC", "ELEMENTS_TO_ASSESS"],
    sample: { 
      TOPIC_PROMPT: "Tell a story about your pet.", 
      MIN_SENTENCES: 20, 
      TARGET_TENSE: "Past Tense",
      MIN_DURATION_SEC: 60,
      MAX_DURATION_SEC: 3600,
      ELEMENTS_TO_ASSESS: "Grammar, Vocabulary, Fluency"
    }
  },
  CONVERSATIONAL: {
    name: "Conversation-based",
    columns: ["TOPIC", "GUIDING_QUESTIONS", "TURN_COUNT"],
    sample: { TOPIC: "Ordering Food", GUIDING_QUESTIONS: "What would you like to order? | Any drinks?", TURN_COUNT: 5 }
  },
  MULTIPLE_CHOICE: {
    name: "Multiple Choice",
    columns: ["QUESTION", "OPTION_A", "OPTION_B", "OPTION_C", "OPTION_D", "CORRECT_ANSWER"],
    sample: { QUESTION: "The cat ___ sleeping.", OPTION_A: "is", OPTION_B: "are", OPTION_C: "am", OPTION_D: "be", CORRECT_ANSWER: "OPTION_A" }
  },
  READ_ALOUD: {
    name: "Read Aloud / Pronunciation",
    columns: ["PASSAGE_TEXT", "TARGET_PHONEMES"],
    sample: { PASSAGE_TEXT: "She sells seashells by the seashore.", TARGET_PHONEMES: "sh,s" }
  },
  TURN_BASED_ROLEPLAY: {
    name: "Turn-based Roleplay",
    columns: ["SCENARIO_DESCRIPTION", "STUDENT_ROLE", "AI_ROLE"],
    sample: { SCENARIO_DESCRIPTION: "At the airport check-in desk.", STUDENT_ROLE: "Passenger", AI_ROLE: "Agent" }
  },
  SPEAKING_MONOLOGUE: {
    name: "Speaking Performance",
    columns: ["TOPIC", "MIN_DURATION_SEC"],
    sample: { TOPIC: "Describe your hometown and its culture.", MIN_DURATION_SEC: 120 }
  }
};

export async function downloadAITemplate(moduleType) {
  const mod = AI_MODULES[moduleType];
  if (!mod) return;
  const data = Array.isArray(mod.sample) ? mod.sample : [mod.sample];
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `Template_${moduleType}.xlsx`);
  showToast(`Template ${mod.name} downloaded!`, "success");
}

export function generateSmartName(className, type, topicName, moduleName) {
  const c = (className || "Class").trim();
  const tp = (type || "Type").trim();
  const t = (topicName || "Topic").trim();
  const m = (moduleName || "Module").trim();
  return `${c} - ${tp} - ${t} - ${m}`;
}

export async function duplicateAssessment(assessmentId) {
  try {
    const sb = await getSupabase();
    const { data: asm, error: fetchErr } = await sb.from("assessments").select("*").eq("id", assessmentId).single();
    if (fetchErr) throw fetchErr;

    const clonedData = {
      ...asm,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      name: `${asm.name || asm.title || 'Assessment'} (Clone)`
    };
    
    const { data: clone, error: insertErr } = await sb.from("assessments").insert(clonedData).select().single();
    if (insertErr) throw insertErr;
    
    showToast("Assessment cloned successfully!", "success");
    return clone;
  } catch (err) {
    showToast("Failed to clone assessment: " + err.message, "error");
    return null;
  }
}

export async function duplicateTopic(topicId, targetClassId = null) {
  try {
    const sb = await getSupabase();
    const { data: originalTopic, error: tErr } = await sb.from("topics").select("*").eq("id", topicId).single();
    if (tErr) throw tErr;

    const clonedTopic = {
      ...originalTopic,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      name: `${originalTopic.name || 'Topic'} (Clone)`
    };
    if (targetClassId) {
      clonedTopic.Class_id = targetClassId;
      clonedTopic.class_id = targetClassId;
    }

    const { data: newTopic, error: insertTopicErr } = await sb.from("topics").insert(clonedTopic).select().single();
    if (insertTopicErr) throw insertTopicErr;

    showToast(`Topic cloned: "${newTopic.name}"!`, "success");
    return newTopic;
  } catch (err) {
    showToast("Failed to clone topic: " + err.message, "error");
    return null;
  }
}

export function buildPrerequisiteJSON(prereqList, aggregateThreshold = 60) {
  // prereqList: array of { assessment_id, min_score }
  return {
    parents: prereqList.map(p => ({ assessment_id: p.assessment_id || p.parentId, min_score: parseInt(p.min_score || p.minScore, 10) || 60 })),
    aggregate_avg_threshold: prereqList.length > 0 ? (parseInt(aggregateThreshold, 10) || 60) : 0
  };
}

export async function renderAIAssessments(area) {
  const [classes, topics, modules] = await Promise.all([
    adminFetchAll('classes').catch(() => []),
    adminFetchAll('topics').catch(() => []),
    adminFetchAll('modules').catch(() => [])
  ]);
  // Build lookup maps for O(1) access in row rendering
  const classMap = Object.fromEntries(classes.map(c => [c.id, c]));
  const topicMap = Object.fromEntries(topics.map(t => [t.id, t]));
  const moduleMap = Object.fromEntries(modules.map(m => [m.id, m]));

  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title text-gradient">Class Curriculum &amp; AI Assessments (Panel C)</h2>
        <p class="section-subtitle">Strict Hierarchy: <strong>CLASS (Level 1) &rarr; TOPIC (Level 2) &rarr; ASSESSMENT (Level 3)</strong></p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-secondary btn-sm" onclick="window.loadSection('import_ai_assessments')">📥 Import Payload</button>
        <button class="btn btn-primary btn-sm" id="btn-toggle-new-assessment">+ Create Assessment</button>
      </div>
    </div>

    <!-- 8 AI Modules Template Download Strip -->
    <div class="glass-card mb-4" style="padding: 1.25rem;">
      <div style="font-size: 0.85rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--clr-text-2); margin-bottom: 0.75rem;">
        📥 Dynamic Excel Templates for 8 AI Assessment Modules
      </div>
      <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;" id="ai-template-chips">
        ${Object.keys(AI_MODULES).map(key => `
          <button class="btn btn-secondary btn-xs btn-dl-template" data-type="${key}" style="display: inline-flex; align-items: center; gap: 0.35rem;">
            📊 ${AI_MODULES[key].name}
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Smart Auto-Naming & Assessment Creator Form -->
    <div class="glass-card mb-4" id="smart-assessment-creator" style="padding: 1.5rem; display: none;">
      <h3 style="margin: 0 0 1rem 0; font-size: 1.1rem; color: var(--clr-primary);">⚡ Smart Auto-Naming Assessment Creator</h3>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-bottom: 1rem;">
        <div class="form-group">
          <label class="form-label">Level 1: Class *</label>
          <select class="form-control" id="sn-class">
            <option value="">-- Select Class --</option>
            ${classes.map(c => `<option value="${c.id}">${c.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Assessment Type *</label>
          <select class="form-control" id="sn-type">
            <option value="Task">Task</option>
            <option value="Quiz">Quiz</option>
            <option value="Assessment">Assessment</option>
            <option value="Final">Final</option>
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Level 2: Topic *</label>
          <select class="form-control" id="sn-topic">
            <option value="">-- Select Topic --</option>
            ${topics.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
          </select>
        </div>

        <div class="form-group">
          <label class="form-label">Level 3: AI Module *</label>
          <select class="form-control" id="sn-module">
            ${Object.keys(AI_MODULES).map(key => `<option value="${key}">${AI_MODULES[key].name}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="form-group mb-3">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
          <label class="form-label" style="margin: 0;">Generated Assessment Name</label>
          <label style="display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.8rem; cursor: pointer;">
            <input type="checkbox" id="sn-override-toggle" />
            <span class="text-warning">✏️ Manual Override</span>
          </label>
        </div>
        <input type="text" class="form-control" id="sn-result-name" readonly style="background: rgba(0,0,0,0.2); font-weight: 700; color: #38bdf8;" />
        <div class="text-xs text-muted mt-1">Formula: <code>[Class Name] - [Type] - [Topic Name] - [Module Name]</code></div>
      </div>

      <div style="display: flex; justify-content: flex-end; gap: 0.75rem;">
        <button class="btn btn-ghost btn-sm" id="sn-cancel-btn">Cancel</button>
        <button class="btn btn-primary btn-sm" id="sn-submit-btn">Create Assessment</button>
      </div>
    </div>

    <!-- Active Assessments Table -->
    <div class="glass-card table-wrap">
      <table class="table w-100" id="assessments-table">
        <thead>
          <tr>
            <th>Assessment Name</th>
            <th>Hierarchy (Class &rarr; Topic)</th>
            <th>Type</th>
            <th>Payload Items</th>
            <th style="text-align: right;">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="5" class="text-center py-4"><div class="spinner"></div> Loading...</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Attach template download listeners
  document.querySelectorAll('.btn-dl-template').forEach(b => {
    b.addEventListener('click', (e) => {
      downloadAITemplate(e.currentTarget.dataset.type);
    });
  });

  // Toggle Creator Form
  const creator = document.getElementById('smart-assessment-creator');
  document.getElementById('btn-toggle-new-assessment')?.addEventListener('click', () => {
    creator.style.display = creator.style.display === 'none' ? 'block' : 'none';
  });
  document.getElementById('sn-cancel-btn')?.addEventListener('click', () => {
    creator.style.display = 'none';
  });

  // Auto-Naming Logic
  const snClass = document.getElementById('sn-class');
  const snTopic = document.getElementById('sn-topic');
  const snModule = document.getElementById('sn-module');
  const snType = document.getElementById('sn-type');
  const snResult = document.getElementById('sn-result-name');
  const snToggle = document.getElementById('sn-override-toggle');

  const updateGeneratedName = () => {
    if (!snToggle.checked) {
      const moduleText = AI_MODULES[snModule.value]?.name || snModule.value;
      snResult.value = generateSmartName(
        snClass.options[snClass.selectedIndex]?.text || snClass.value, 
        snType.value,
        snTopic.options[snTopic.selectedIndex]?.text || snTopic.value, 
        moduleText
      );
    }
  };

  [snClass, snTopic, snModule, snType].forEach(el => el?.addEventListener('change', updateGeneratedName));
  snToggle?.addEventListener('change', (e) => {
    snResult.readOnly = !e.target.checked;
    snResult.style.background = e.target.checked ? 'var(--clr-surface-1)' : 'rgba(0,0,0,0.2)';
    if (!e.target.checked) updateGeneratedName();
  });
  updateGeneratedName();

  // Create Assessment Handler
  document.getElementById('sn-submit-btn')?.addEventListener('click', async () => {
    const finalName = snResult.value.trim();
    if (!finalName) {
      showToast('Assessment name cannot be empty.', 'warning');
      return;
    }
    try {
      const sb = await getSupabase();
      const selectedMod = AI_MODULES[snModule.value];
      let autoItems = [];
      if (selectedMod && Array.isArray(selectedMod.sample)) {
        autoItems = selectedMod.sample;
      } else if (selectedMod && selectedMod.sample) {
        autoItems = [selectedMod.sample];
      }

      // We must fetch the actual UUID for this module from the database
      const { data: moduleData, error: modErr } = await sb.from('modules').select('id').eq('module_type', snModule.value).single();
      if (modErr || !moduleData) {
        throw new Error("Could not find the Module definition in the database. Ensure modules are seeded.");
      }

      // Base payload - uses only columns confirmed to exist in the live DB
      const baseInsert = {
        name: snToggle.checked ? finalName : null,
        auto_name_override: snToggle.checked,
        module_id: moduleData.id,
        payload: { 
          items: autoItems, 
          module: snModule.value,        // module_type key
          type: snType.value,            // assessment_type fallback
          _class_id: snClass.value || null,  // class_id fallback
          _topic_id: snTopic.value || null   // topic_id fallback
        }
      };
      
      // Full insert with optional columns that may or may not exist after migration
      const fullInsert = { 
        ...baseInsert, 
        assessment_type: snType.value,
        class_id: snClass.value || null, 
        topic_id: snTopic.value || null 
      };
      
      let { error: aErr } = await sb.from('assessments').insert(fullInsert);
      // Catch both PostgreSQL 42703 and Supabase schema cache errors
      // ("Could not find the 'X' column of 'assessments' in the schema cache")
      const isMissingColumnErr = aErr && (
        aErr.code === '42703' ||
        aErr.message?.includes('does not exist') ||
        aErr.message?.includes('schema cache') ||
        aErr.message?.includes('Could not find')
      );
      if (isMissingColumnErr) {
        // Columns don't exist yet in the live DB — fall back to base insert (no optional cols)
        console.warn('[Assessment] Column missing, falling back to base insert. Run migration!', aErr.message);
        const retry = await sb.from('assessments').insert(baseInsert);
        aErr = retry.error;
      }
      if (aErr) {
        console.error("Supabase Assessments Insert Error:", aErr);
        throw new Error("Assessments error: " + aErr.message);
      }
      showToast('Assessment created successfully!', 'success');
      creator.style.display = 'none';
      renderAIAssessments(area);
    } catch (err) {
      console.error(err);
      showToast('Error creating assessment: ' + err.message, 'error');
    }
  });

  // Fetch and display assessments
  try {
    let data = [];
    data = await adminFetchAll('assessments', '*', {}, true);
    // Sort newest first
    data.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    const tbody = document.getElementById('assessments-table').querySelector('tbody');
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No assessments created yet. Use the button above to create one.</td></tr>';
      return;
    }

    tbody.innerHTML = data.map(r => {
      const itemsCount = (r.payload && Array.isArray(r.payload.items)) ? r.payload.items.length : 0;
      // Look up related data by ID from the pre-fetched maps
      // Fall back to IDs stored in payload if DB columns don't exist yet
      const classId = r.class_id || r.payload?._class_id;
      const topicId = r.topic_id || r.payload?._topic_id;
      const relClass = classMap[classId];
      const relTopic = topicMap[topicId];
      const relModule = moduleMap[r.module_id];
      // Get module type from payload as fallback
      const moduleTypeFromPayload = r.payload?.module || '';
      
      // assessment_type column may not exist yet — fall back to payload.type
      const assessmentType = r.assessment_type || r.payload?.type || 'Assessment';
      
      let displayName = r.name || 'Untitled';
      if (!r.auto_name_override) {
        displayName = generateSmartName(
          relClass?.name || 'Global',
          assessmentType,
          relTopic?.name || 'No Topic',
          relModule?.name || moduleTypeFromPayload || 'Custom Module'
        );
      }
      
      let editContentBtn = '';
      if (relModule?.module_type === 'LEGACY_Assessment') {
        editContentBtn = `<button class="btn btn-outline-primary btn-sm" onclick="import('./assessment-builder.js').then(m => m.openAssessmentBuilder('${r.id}'))">Questions</button>`;
      }

      const className = relClass?.name || '—';
      const topicName = relTopic?.name || '—';
      const moduleName = relModule?.name || moduleTypeFromPayload || 'Custom';

      return `
        <tr>
          <td class="fw-700" style="color: var(--clr-text-1);">${displayName}</td>
          <td class="text-muted text-sm" style="font-size: 0.8rem;">
            <span style="color: var(--clr-primary);">${className}</span>
            ${topicName !== '—' ? `<span style="color: var(--clr-text-3);"> → ${topicName}</span>` : ''}
          </td>
          <td><span class="badge badge-neutral">${assessmentType}</span></td>
          <td>
            <span class="badge badge-info">${itemsCount} Items</span>
            <span class="badge badge-neutral" style="font-size: 0.7rem; margin-left: 4px;">${moduleName}</span>
          </td>
          <td style="text-align: right;">
            <div class="d-flex gap-2 justify-end">
              ${editContentBtn}
              <button class="btn btn-secondary btn-sm" onclick="window.openAIAssessmentEditor('${r.id}')">Edit</button>
              <button class="btn btn-outline-primary btn-sm btn-clone-asm" data-id="${r.id}" data-name="${displayName}">⚡ Clone</button>
              <button class="btn btn-danger btn-sm" onclick="window._deleteRecord ? window._deleteRecord('assessments', '${r.id}', '${displayName}') : alert('Delete')">Del</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');

    // Clone listeners
    document.querySelectorAll('.btn-clone-asm').forEach(b => {
      b.addEventListener('click', async (e) => {
        const id = e.currentTarget.dataset.id;
        const name = e.currentTarget.dataset.name;
        if (confirm(`Clone assessment "${name}"?`)) {
          await duplicateAssessment(id);
          renderAIAssessments(area);
        }
      });
    });

  } catch (err) {
    console.error('Error rendering AI assessments:', err);
  }
}

window.openAIAssessmentEditor = async (assessmentId) => {
  const sb = await getSupabase();
  const { data: asm, error } = await sb.from('assessments').select('*, classes(id, name), topics(id, name)').eq('id', assessmentId).single();
  if (error || !asm) {
    showToast("Error loading assessment", "error");
    return;
  }
  
  const [classes, topics] = await Promise.all([
    adminFetchAll('classes').catch(() => []),
    adminFetchAll('topics').catch(() => [])
  ]);

  const modal = document.createElement('div');
  modal.className = 'modal-backdrop';
  modal.innerHTML = `
    <div class="modal-content" style="max-width: 500px;">
      <div class="modal-header d-flex justify-between align-center p-3">
        <h2 class="modal-title" style="font-size: 1.2rem;">Edit Assessment</h2>
        <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">&times;</button>
      </div>
      <div class="modal-body p-4">
        <div class="form-group mb-3">
          <label class="form-label">Class</label>
          <select class="form-control" id="edit-asm-class">
            <option value="">-- None --</option>
            ${classes.map(c => `<option value="${c.id}" ${asm.class_id === c.id ? 'selected' : ''}>${c.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Topic</label>
          <select class="form-control" id="edit-asm-topic">
            <option value="">-- None --</option>
            ${topics.map(t => `<option value="${t.id}" ${asm.topic_id === t.id ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Assessment Type</label>
          <select class="form-control" id="edit-asm-type">
            <option value="Task" ${asm.assessment_type === 'Task' ? 'selected' : ''}>Task</option>
            <option value="Quiz" ${asm.assessment_type === 'Quiz' ? 'selected' : ''}>Quiz</option>
            <option value="Assessment" ${asm.assessment_type === 'Assessment' ? 'selected' : ''}>Assessment</option>
            <option value="Final" ${asm.assessment_type === 'Final' ? 'selected' : ''}>Final</option>
          </select>
        </div>
        <div class="form-group mb-3">
          <label style="display: flex; gap: 0.5rem; align-items: center; cursor: pointer;">
            <input type="checkbox" id="edit-asm-override" ${asm.auto_name_override ? 'checked' : ''} />
            <strong>Manual Name Override</strong>
          </label>
        </div>
        <div class="form-group mb-3">
          <label class="form-label">Manual Name</label>
          <input type="text" class="form-control" id="edit-asm-name" value="${escapeHtml(asm.name || '')}" ${asm.auto_name_override ? '' : 'disabled style="background: rgba(0,0,0,0.1);"'} />
        </div>
      </div>
      <div class="modal-footer d-flex justify-end p-3 gap-2">
        <button class="btn btn-ghost" onclick="this.closest('.modal-backdrop').remove()">Cancel</button>
        <button class="btn btn-primary" id="btn-save-asm-edit">Save Changes</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  const overrideToggle = modal.querySelector('#edit-asm-override');
  const nameInput = modal.querySelector('#edit-asm-name');
  overrideToggle.addEventListener('change', (e) => {
    nameInput.disabled = !e.target.checked;
    nameInput.style.background = e.target.checked ? 'var(--clr-surface-1)' : 'rgba(0,0,0,0.1)';
  });

  modal.querySelector('#btn-save-asm-edit').addEventListener('click', async () => {
    const payload = {
      class_id: modal.querySelector('#edit-asm-class').value || null,
      topic_id: modal.querySelector('#edit-asm-topic').value || null,
      assessment_type: modal.querySelector('#edit-asm-type').value,
      auto_name_override: overrideToggle.checked,
      name: overrideToggle.checked ? nameInput.value.trim() : null
    };

    const { error: updErr } = await sb.from('assessments').update(payload).eq('id', assessmentId);
    if (updErr) {
      showToast('Error updating assessment: ' + updErr.message, 'error');
    } else {
      showToast('Assessment updated!', 'success');
      modal.remove();
      if (window.loadSection) window.loadSection('assessments');
    }
  });
};

export async function renderImportAIAssessments(area) {
  if (!area) {
    console.warn('Import AI Assessments container not found in DOM.');
    return;
  }
  area.innerHTML = `
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title text-gradient">Import AI Assessment Payload</h2>
        <p class="section-subtitle">Upload populated AI Module templates to inject into an Assessment payload.</p>
      </div>
      <div>
        <button class="btn btn-secondary btn-sm" onclick="window.loadSection('assessments')">Back to Assessments</button>
      </div>
    </div>
    
    <div class="glass-card p-6" style="max-width: 600px;">
      <div class="form-group mb-4">
        <label class="form-label">Target Assessment</label>
        <select id="ai-import-target" class="form-control">
          <option value="">- Loading... -</option>
        </select>
      </div>
      
      <div class="form-group mb-4">
        <label class="form-label">Upload Template File (.xlsx)</label>
        <input type="file" id="ai-import-file" class="form-control" accept=".xlsx,.xls" />
      </div>
      
      <button class="btn btn-primary" id="ai-import-btn" disabled>Upload & Apply to Payload</button>
    </div>
  `;

  const assessments = await adminFetchAll('assessments', '*');
  const select = document.getElementById('ai-import-target');
  select.innerHTML = '<option value="">- Select Assessment -</option>' + assessments.map(a => 
    `<option value="${a.id}">${a.name} (${a.modules?.name || 'Unknown'})</option>`
  ).join('');

  let parsedRows = null;
  const fileInput = document.getElementById('ai-import-file');
  const importBtn = document.getElementById('ai-import-btn');

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target.result);
      const workbook = XLSX.read(data, { type: 'array' });
      const worksheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      if(jsonRows.length > 0) {
        // Just normalize keys directly
        parsedRows = jsonRows.map(row => {
          const item = {};
          for (const [key, value] of Object.entries(row)) {
            item[key.trim().toUpperCase().replace(/\s+/g, '_')] = value;
          }
          return item;
        });
        importBtn.disabled = false;
        showToast('Parsed ' + parsedRows.length + ' rows.', 'info');
      }
    };
    reader.readAsArrayBuffer(file);
  });

  importBtn.addEventListener('click', async () => {
    const targetId = select.value;
    if(!targetId) return showToast('Select a target assessment!', 'warning');
    if(!parsedRows) return showToast('No rows parsed!', 'warning');

    importBtn.disabled = true;
    importBtn.textContent = 'Saving...';
    try {
      const sb = await getSupabase();
      const { error } = await sb.from('assessments').update({ payload: { items: parsedRows } }).eq('id', targetId);
      if(error) throw error;
      showToast('Successfully applied payload to assessment!', 'success');
      window.loadSection('assessments');
    } catch(err) {
      showToast('Error: ' + err.message, 'error');
      importBtn.disabled = false;
      importBtn.textContent = 'Upload & Apply to Payload';
    }
  });
}
