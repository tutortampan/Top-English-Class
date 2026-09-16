/**
 * panel-c-builder.js
 * Panel C (Class & Assessment Management) Dashboard
 * Handles Smart Auto-Naming, Assessment Duplication, Prerequisite Engine, and AI Module Templates
 */
import { adminFetchAll, adminSoftDelete, supabase, showToast } from "../api.js?v=4.1.0";

// AI Module Definitions
export const AI_MODULES = {
  VISUAL_PRONOUNS: {
    name: "Tell Me What You See (Visual Pronouns)",
    columns: ["IMAGE_URL", "PROMPT_TEXT", "MIN_SENTENCES", "TARGET_PRONOUNS"],
    sample: { IMAGE_URL: "https://example.com/img.jpg", PROMPT_TEXT: "Describe this room.", MIN_SENTENCES: 20, TARGET_PRONOUNS: "this,that,these,those" }
  },
  NARRATIVE_TENSE: {
    name: "Let me tell you something (Narrative Tense)",
    columns: ["PROMPT_TEXT", "MIN_DURATION_SEC", "TARGET_TENSE"],
    sample: { PROMPT_TEXT: "Tell a story about a memorable holiday.", MIN_DURATION_SEC: 60, TARGET_TENSE: "Past Tense" }
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
  },
  VOCAB_MASTERY: {
    name: "Vocabulary Mastery",
    columns: ["LEXICAL_ITEM", "DEFINITION", "MODE"],
    sample: { LEXICAL_ITEM: "Accomplish", DEFINITION: "Achieve or complete successfully.", MODE: "Spelling" }
  }
};

export async function downloadAITemplate(moduleType) {
  const mod = AI_MODULES[moduleType];
  if (!mod) return;
  const ws = XLSX.utils.json_to_sheet([mod.sample]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Template");
  XLSX.writeFile(wb, `Template_${moduleType}.xlsx`);
  showToast(`Template ${mod.name} downloaded!`, "success");
}

export function generateSmartName(institution, program, moduleName, type) {
  return `${institution || "INST"} - ${program || "PROG"} - ${moduleName} - ${type}`;
}

export async function duplicateAssessment(assessmentId) {
  try {
    const { data: original, error: fetchErr } = await supabase.from("assessments").select("*").eq("id", assessmentId).single();
    if (fetchErr) throw fetchErr;

    const clonedData = {
      ...original,
      id: undefined,
      created_at: undefined,
      updated_at: undefined,
      name: `${original.name} (Clone)`
    };

    const { data: clone, error: insertErr } = await supabase.from("assessments").insert(clonedData).select().single();
    if (insertErr) throw insertErr;

    showToast("Assessment Duplicated successfully!", "success");
    return clone;
  } catch (err) {
    showToast("Failed to duplicate assessment: " + err.message, "error");
    return null;
  }
}

export function buildPrerequisiteJSON(prereqList) {
  // prereqList: array of { parentId, minScore }
  return {
    parents: prereqList.map(p => ({ assessment_id: p.parentId, min_score: p.minScore })),
    aggregate_avg_threshold: prereqList.length > 0 ? 60 : 0 // Default 60 if parents exist
  };
}



export async function renderAIAssessments(area) {
  area.innerHTML = 
    <div class="section-header d-flex justify-between align-center flex-wrap gap-3 mb-4">
      <div>
        <h2 class="section-title text-gradient">AI Assessments (Panel C)</h2>
        <p class="section-subtitle">Manage dynamic AI-driven modules and prerequisites.</p>
      </div>
      <div class="d-flex gap-2">
        <button class="btn btn-secondary btn-sm" onclick="window.loadSection('import_ai_assessments')">📥 Import Payload</button>
        <button class="btn btn-primary btn-sm" onclick="window.openCrudModal('assessments', null)">+ New Assessment</button>
      </div>
    </div>
    <div class="glass-card table-wrap mt-6">
      <table class="table w-100" id="assessments-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Module</th>
            <th>Program / Batch</th>
            <th>Items Configured</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr><td colspan="5" class="text-center py-4"><div class="spinner"></div> Loading...</td></tr>
        </tbody>
      </table>
    </div>
  ;

  try {
    const data = await adminFetchAll('assessments', '*, modules(name)');
    const tbody = document.getElementById('assessments-table').querySelector('tbody');
    
    if (!data || data.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" class="text-center py-4 text-muted">No AI Assessments created yet.</td></tr>';
      return;
    }

    // Sort by name
    data.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

    tbody.innerHTML = data.map(r => {
      const itemsCount = (r.payload && Array.isArray(r.payload.items)) ? r.payload.items.length : 0;
      return 
        <tr>
          <td class="fw-600"> + (r.name || 'Untitled') + </td>
          <td class="text-muted text-sm"> + (r.modules?.name || 'Unknown') + </td>
          <td class="text-muted text-sm"> + (r.program_id ? 'Program' : (r.batch_id ? 'Batch' : 'Global')) + </td>
          <td class="text-center"><span class="badge badge-info"> + itemsCount +  Items</span></td>
          <td>
            <div class="d-flex gap-2">
              <button class="btn btn-secondary btn-sm" onclick="window.openCrudModal('assessments', window._assessmentsRecords[' + r.id + '])">Edit</button>
              <button class="btn btn-outline-primary btn-sm" id="clone- + r.id + ">Clone</button>
              <button class="btn btn-danger btn-sm" onclick="window._deleteRecord('assessments', ' + r.id + ', ' + r.name + ')">Del</button>
            </div>
          </td>
        </tr>
      ;
    }).join('');

    // Attach clone listeners
    window._assessmentsRecords = {};
    data.forEach(r => {
      window._assessmentsRecords[r.id] = r;
      document.getElementById('clone-' + r.id)?.addEventListener('click', async () => {
        if(confirm('Clone ' + r.name + '?')) {
          await duplicateAssessment(r.id);
          window.loadSection('assessments');
        }
      });
    });

  } catch(e) {
    console.error(e);
  }
}

export async function renderImportAIAssessments(area) {
  area.innerHTML = 
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
  ;

  const assessments = await adminFetchAll('assessments', '*, modules(name)');
  const select = document.getElementById('ai-import-target');
  select.innerHTML = '<option value="">- Select Assessment -</option>' + assessments.map(a => 
    <option value=" + a.id + "> + a.name +  ( + a.modules?.name + )</option>
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
      const { error } = await supabase.from('assessments').update({ payload: { items: parsedRows } }).eq('id', targetId);
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