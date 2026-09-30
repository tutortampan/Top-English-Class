const fs = require('fs');

const content = fs.readFileSync('d:/TopsCore/js/admin/vocab-vault.js', 'utf8');
const lines = content.split('\n');

const replacement = `export async function renderVocabularyVault(area) {
  showLoading();
  try {
    const [words, topics] = await Promise.all([
      fetchVaultWords({ limit: 10000, targetLevel: null }),
      fetchVaultTopics(null)
    ]);
    hideLoading();
    _renderTopicManager(area, words, topics);
  } catch (e) {
    hideLoading();
    area.innerHTML = \`<div class="empty-state"><div class="empty-state__icon">&#9888;&#65039;</div><h3>Failed to load Vocabulary Vault</h3><p class="text-muted">\${escapeHtml(e.message)}</p></div>\`;
  }
}

// ─── Domain D: Topic Management Panel ─────────────────────────────

function _renderTopicManager(area, words, topics) {
  const topicMap = new Map();
  topics.forEach(t => topicMap.set(t, { count: 0, targetLevel: null, types: {} }));
  words.forEach(w => {
    if (!w.topic) return;
    if (!topicMap.has(w.topic)) topicMap.set(w.topic, { count: 0, targetLevel: null, types: {} });
    const tData = topicMap.get(w.topic);
    tData.count++;
    tData.targetLevel = w.target_level;
    const type = w.word_type || "Unknown";
    tData.types[type] = (tData.types[type] || 0) + 1;
  });
  const topicEntries = Array.from(topicMap.entries()).sort((a,b) => a[0].localeCompare(b[0]));

  area.innerHTML = \`
    <div style="display: flex; flex-direction: column; height: calc(100vh - 100px); padding: 24px; box-sizing: border-box; overflow: hidden; font-family: 'Inter', sans-serif;">
      <div style="margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-start;">
        <div>
          <h2 style="font-size: 24px; font-weight: 700; color: #f8fafc; margin: 0 0 8px 0; display: flex; align-items: center; gap: 10px;">
            <span style="color: #6366f1;">🗃️</span> Domain D: Vocabulary Vault & Topic Manager
          </h2>
          <p style="font-size: 13px; color: #94a3b8; margin: 0;">Centralized data warehouse for all vocabulary, idioms, and expressions.</p>
        </div>
        <div style="display: flex; gap: 12px;">
          <button id="btn-import-vault" style="background: #1e293b; color: #e2e8f0; border: 1px solid #334155; padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
            📥 Import Excel
          </button>
          <button id="btn-find-duplicates" style="background: rgba(245, 158, 11, 0.1); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.2); padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; cursor: pointer;">
            ⚠️ Resolve Duplicates
          </button>
        </div>
      </div>
      <div style="flex-grow: 1; background: #0f172a; border: 1px solid #1e293b; border-radius: 12px; display: flex; flex-direction: column; overflow: hidden;">
        <div style="padding: 16px; border-bottom: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; background: #020617;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <input type="search" id="vault-topic-search" placeholder="Search Topics..." style="background: #1e293b; border: 1px solid #334155; color: #f8fafc; padding: 8px 12px; border-radius: 6px; font-size: 13px; width: 250px; outline: none;">
          </div>
          <div style="font-size: 12px; color: #64748b; font-weight: 500;">
            Total Topics: <span style="color: #f8fafc; font-weight: 700;">\${topicEntries.length}</span> &nbsp;|&nbsp; 
            Total Words: <span style="color: #f8fafc; font-weight: 700;">\${words.length}</span>
          </div>
        </div>
        <div style="flex-grow: 1; overflow-y: auto;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px;">
            <thead style="background: #0f172a; position: sticky; top: 0; z-index: 10; border-bottom: 1px solid #1e293b;">
              <tr>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px;">Topic Title</th>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; text-align: center;">Word Count</th>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px;">Composition</th>
                <th style="padding: 16px; font-weight: 600; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.5px; font-size: 11px; width: 300px;">Structural Binding (Level)</th>
              </tr>
            </thead>
            <tbody id="vault-topic-tbody"></tbody>
          </table>
        </div>
      </div>
    </div>
  \`;

  const tbody = document.getElementById("vault-topic-tbody");
  function renderRows(filteredEntries) {
    if (!filteredEntries.length) {
      tbody.innerHTML = "<tr><td colspan=\\"4\\" style=\\"text-align: center; padding: 40px; color: #64748b;\\">No topics match your search.</td></tr>";
      return;
    }
    tbody.innerHTML = filteredEntries.map(([topic, data]) => {
      const compBadges = Object.entries(data.types).map(([type, count]) => {
        let color = "#3b82f6";
        if (type.toLowerCase() === "vocab" || type.toLowerCase() === "vocabulary") color = "#10b981";
        if (type.toLowerCase() === "idiom") color = "#f59e0b";
        if (type.toLowerCase() === "expression") color = "#8b5cf6";
        return \`<span style="background: \${color}20; color: \${color}; border: 1px solid \${color}40; padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; margin-right: 4px;">\${escapeHtml(type)}: \${count}</span>\`;
      }).join("");
      return \`
        <tr style="border-bottom: 1px solid rgba(30, 41, 59, 0.5);">
          <td style="padding: 16px; font-weight: 600; color: #e2e8f0;">\${escapeHtml(topic)}</td>
          <td style="padding: 16px; text-align: center;"><span style="background: #1e293b; color: #cbd5e1; padding: 4px 10px; border-radius: 20px; font-weight: 700; font-size: 12px;">\${data.count}</span></td>
          <td style="padding: 16px;">\${compBadges}</td>
          <td style="padding: 16px;">
            <select class="topic-level-select form-control" data-topic="\${escapeHtml(topic)}" style="background: #020617; border: 1px solid #334155; color: #f8fafc; padding: 6px 12px; border-radius: 6px; font-size: 12px; width: 100%; outline: none; cursor: pointer;">
              <option value="0" \${data.targetLevel === 0 ? "selected" : ""}>[Universal] Level 0 (Mr. Top)</option>
              <option value="1" \${data.targetLevel === 1 ? "selected" : ""}>[CEC Pare] Level 1</option>
              <option value="2" \${data.targetLevel === 2 ? "selected" : ""}>[CEC Pare] Level 2</option>
              <option value="3" \${data.targetLevel === 3 ? "selected" : ""}>[CEC Pare] Level 3</option>
            </select>
          </td>
        </tr>
      \`;
    }).join("");

    tbody.querySelectorAll(".topic-level-select").forEach(select => {
      select.addEventListener("change", async (e) => {
        const topicName = e.target.getAttribute("data-topic");
        const newLevel = parseInt(e.target.value, 10);
        showLoading();
        try {
          await moveVaultTopicsToLevel([topicName], newLevel);
          showToast(\`Topic "\${topicName}" bound to Level \${newLevel}\`, "success");
          const t = topicMap.get(topicName);
          if(t) t.targetLevel = newLevel;
        } catch (err) {
          showToast(\`Binding failed: \${err.message}\`, "error");
          const t = topicMap.get(topicName);
          e.target.value = t ? t.targetLevel : 1;
        } finally {
          hideLoading();
        }
      });
    });
  }

  renderRows(topicEntries);

  document.getElementById("vault-topic-search")?.addEventListener("input", (e) => {
    const term = e.target.value.toLowerCase().trim();
    const filtered = topicEntries.filter(([topic]) => topic.toLowerCase().includes(term));
    renderRows(filtered);
  });

  document.getElementById("btn-import-vault")?.addEventListener("click", () => {
    openImportModal(words, topics, (newWords) => renderVocabularyVault(area));
  });

  document.getElementById("btn-find-duplicates")?.addEventListener("click", () => {
    const map = new Map();
    for (const w of words) {
      const key = (w.indonesian||"").toLowerCase().trim() + "||" + (w.topic||"").toLowerCase().trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(w);
    }
    const duplicateGroups = Array.from(map.values()).filter(g => g.length > 1);
    if (duplicateGroups.length === 0) {
      showToast("No duplicates found in your Vault!", "success");
      return;
    }
    openFindDuplicatesModal(duplicateGroups, area);
  });
}`;

const newLines = lines.slice(0, 64).concat(replacement.split('\n')).concat(lines.slice(398));
fs.writeFileSync('d:/TopsCore/js/admin/vocab-vault.js', newLines.join('\n'));
console.log('Successfully replaced lines 65-398.');
