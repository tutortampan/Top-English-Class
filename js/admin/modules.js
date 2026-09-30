export async function renderModules(area) {
  // Utility to escape HTML to prevent breaking the template string
  const escapeHtml = (unsafe) => {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
  };

  const modules = [
    { id: 'm1', name: 'Point & Speak!', type: 'Visual Pronouns', desc: 'Real-time object and pronoun identification using image context.', status: 'Active', icon: '🎯', directive: 'Direct English Only.\\nArchitecture: Stateless & Low-Egress.\\nMedia (photos) must be processed transiently in the browser, sent directly to the AI API for evaluation via Edge Functions, and discarded.' },
    { id: 'm2', name: 'Storytelling', type: 'Narrative Tense', desc: 'Evaluates past, present, and future tense continuity in a narrative flow.', status: 'Active', icon: '📖', directive: 'Direct English Only.\\nArchitecture: Stateless & Low-Egress.\\nEvaluate narrative tense (past/present/future continuity).' },
    { id: 'm3', name: 'Conversation-based', type: 'Freeform Dialogue', desc: 'Open-ended contextual dialogue with the AI to test conversational agility.', status: 'Active', icon: '💬', directive: 'Direct English Only.\\nArchitecture: Stateless & Low-Egress.\\nOpen-ended contextual dialogue.' },
    { id: 'm4', name: 'Multiple Choice', type: 'Standardized', desc: 'Classic multi-option evaluation for grammar and syntax precision.', status: 'Active', icon: '☑️', directive: 'Direct English Only.\\nArchitecture: Stateless & Low-Egress.\\nClassic multi-option evaluation.' },
    { id: 'm5', name: 'Read Aloud / Pronunciation', type: 'Speech Analysis', desc: 'Deep phonetic analysis comparing spoken input against standard texts.', status: 'Active', icon: '🎙️', directive: 'Direct English Only.\\nArchitecture: Stateless & Low-Egress.\\nMedia (audio) must be processed transiently in the browser, sent directly to the AI API for evaluation, and discarded.' },
    { id: 'm6', name: 'Turn-based Roleplay', type: 'Realtime WebSockets', desc: 'Simulated real-world scenarios requiring immediate contextual responses.', status: 'Active', icon: '🎭', directive: 'Direct English Only.\\nArchitecture: Stateless & Low-Egress.\\nReal-world scenario simulation via WebSockets.' },
    { id: 'm7', name: 'Speaking Performance', type: '5 Pillars', desc: 'Comprehensive grading on Fluency, Pronunciation, Vocabulary, Grammar, and Comprehension.', status: 'Active', icon: '📊', directive: 'Direct English Only.\\nArchitecture: Stateless & Low-Egress.\\nEvaluate based on 5 Pillars: Fluency, Pronunciation, Vocabulary, Grammar, Comprehension.' },
    { id: 'm8', name: 'Vocabulary Mastery', type: 'Written/Oral', desc: 'Rigorous testing of target lexicon including spelling, meaning, and usage.', status: 'Active', icon: '🧠', directive: 'Direct English Only.\\nFor vocabulary-style written evaluation, normalize at minimum: leading/trailing whitespace, repeated spaces, case, unnecessary punctuation.\\nRequired result labels: Correct, Minor Spelling Error, Incorrect.\\nDefault tolerance: 0 errors -> 1pt, 1-2 errors -> 0.5pt, 3+ errors -> 0pt.' }
  ];

  area.innerHTML = `
    <div style="display: flex; flex-direction: column; height: calc(100vh - 100px); padding: 24px; box-sizing: border-box; overflow-y: auto;">
      <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          <h2 style="font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0 0 8px 0; display: flex; align-items: center; gap: 10px;">
            <span>📦</span> Modules (Core Blocks)
          </h2>
          <p style="font-size: 14px; color: #94a3b8; margin: 0;">Central warehouse for the 8 core AI evaluation engines.</p>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;">
        ${modules.map(mod => `
          <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 20px; display: flex; flex-direction: column; transition: transform 0.2s, box-shadow 0.2s;" 
               onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 10px 15px -3px rgba(0, 0, 0, 0.3)'" 
               onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
              <div style="font-size: 32px; line-height: 1;">${mod.icon}</div>
              <span style="background: rgba(34, 197, 94, 0.1); color: #22c55e; border: 1px solid rgba(34, 197, 94, 0.2); padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                ${mod.status}
              </span>
            </div>
            
            <h3 style="font-size: 16px; font-weight: 700; color: #f8fafc; margin: 0 0 4px 0;">${mod.name}</h3>
            <div style="font-size: 12px; font-weight: 600; color: #3b82f6; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
              ${mod.type}
            </div>
            
            <p style="font-size: 13px; color: #94a3b8; line-height: 1.5; margin: 0 0 20px 0; flex-grow: 1;">
              ${mod.desc}
            </p>
            
            <button class="btn-configure-engine" data-id="${mod.id}" data-name="${escapeHtml(mod.name)}" data-directive="${escapeHtml(mod.directive)}"
                    style="background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 8px 12px; border-radius: 8px; font-size: 12px; font-weight: 600; cursor: pointer; transition: all 0.2s; width: 100%;"
                    onmouseover="this.style.background='#3b82f6'; this.style.borderColor='#3b82f6'; this.style.color='white'"
                    onmouseout="this.style.background='#0f172a'; this.style.borderColor='#334155'; this.style.color='#e2e8f0'">
              Configure Engine
            </button>
          </div>
        `).join('')}
      </div>
    </div>
  `;

  area.querySelectorAll('.btn-configure-engine').forEach(btn => {
    btn.addEventListener('click', () => {
      const modName = btn.getAttribute('data-name');
      const modDirective = btn.getAttribute('data-directive');
      
      const bodyHTML = `
        <div style="display:flex; flex-direction:column; gap:16px;">
          <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; color:#94a3b8; font-size:12px; margin:0;">ENGINE STATUS</label>
            <select class="form-control" style="background:#0f172a; border: 1px solid #334155; color:#f8fafc; padding: 10px; border-radius: 8px;">
              <option selected>Active</option>
              <option>Maintenance Mode</option>
              <option>Disabled</option>
            </select>
          </div>
          
          <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; color:#94a3b8; font-size:12px; margin:0;">SYSTEM PROMPT / INSTRUCTIONS (ENGLISH ONLY)</label>
            <textarea class="form-control" rows="7" style="background:#0f172a; border: 1px solid #334155; color:#f8fafc; padding: 10px; border-radius: 8px; resize:vertical; font-family: monospace; font-size: 13px;" placeholder="Enter base instructions for the AI...">${modDirective}</textarea>
          </div>
          
          <div class="form-group" style="display:flex; justify-content:space-between; align-items:center; background:#0f172a; padding: 12px; border-radius: 8px; border: 1px solid #334155;">
            <label style="margin:0; font-weight:600; color:#94a3b8; font-size:13px;">ALLOW TEACHER MANUAL OVERRIDE</label>
            <input type="checkbox" checked style="accent-color:#3b82f6; width:16px; height:16px; cursor:pointer;">
          </div>
          
          <div class="form-group" style="display:flex; flex-direction:column; gap:6px;">
            <label style="font-weight:600; color:#94a3b8; font-size:12px; margin:0;">TOLERANCE ENGINE (EDIT-DISTANCE)</label>
            <select class="form-control" style="background:#0f172a; border: 1px solid #334155; color:#f8fafc; padding: 10px; border-radius: 8px;">
              <option>Default (0 err = 1pt, 1-2 err = 0.5pt, 3+ = 0)</option>
              <option>Strict (0 err = 1pt, else 0)</option>
              <option>Custom Engine Settings...</option>
            </select>
          </div>
        </div>
      `;
      
      const footerHTML = `
        <div style="display:flex; gap:10px; justify-content:flex-end;">
          <button class="btn btn-ghost" onclick="closeRecordDrawer()">Cancel</button>
          <button class="btn btn-primary" id="drawer-save-btn">Save Configuration</button>
        </div>
      `;
      
      if (window.openRecordDrawer) {
        window.openRecordDrawer(`⚙️ Configure: ${modName}`, bodyHTML, footerHTML);
        
        setTimeout(() => {
          const saveBtn = document.getElementById('drawer-save-btn');
          if (saveBtn) {
            saveBtn.addEventListener('click', () => {
              if (window.showToast) window.showToast(`Configuration saved for ${modName}.`, 'success');
              if (window.closeRecordDrawer) window.closeRecordDrawer();
            });
          }
        }, 50);
      }
    });
  });
}
