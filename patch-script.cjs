const fs = require('fs');

const classMgmtPath = 'd:/TopsCore/js/admin/classes-management.js';
let cm = fs.readFileSync(classMgmtPath, 'utf8');

const cmStart = cm.indexOf('  let classesData = [];');
const cmEnd = cm.indexOf('  const addClassBtn = area.querySelector(\'#btn-add-class-sidebar\');');

if (cmStart === -1 || cmEnd === -1) {
  console.log('Error finding replace targets in classes-management.js', cmStart, cmEnd);
  process.exit(1);
}

const cmReplacement = `  let classesData = [];
  let levelsData = [];
  let assessmentsData = [];
  let instData = [];
  let progData = [];
  let activeInstitutionId = null;
  let activeProgramId = null;
  let activeLevelId = null;
  let activeClassId = null;
  let expandedNodes = new Set();

  async function loadData() {
    try {
      const [cls, lvls, assess, insts, progs] = await Promise.all([
        adminFetchAll('classes', '*'),
        adminFetchAll('levels', '*'),
        adminFetchAll('assessments', 'id, title, assessment_type, answer_type, class_id, level_id, status, is_unlocked'),
        adminFetchAll('institutions', '*'),
        adminFetchAll('programs', '*')
      ]);
      classesData = cls || [];
      levelsData = lvls || [];
      assessmentsData = assess || [];
      instData = insts || [];
      progData = progs || [];

      if (!activeInstitutionId && instData.length > 0) {
        const cec = instData.find(i => i.name.includes('CEC'));
        if (cec) activeInstitutionId = cec.id;
      }

      renderSidebar();
      renderDetailCanvas();
    } catch (err) {
      console.error('Failed to load curriculum data:', err);
      showToast('Failed to load classes data.', 'error');
    }
  }

  function renderSidebar() {
    const listEl = area.querySelector('#sidebar-classes-list');
    if (!listEl) return;

    const cec = instData.find(i => i.name.includes('CEC'));
    const mrtop = instData.find(i => i.name.includes('Top'));
    const level0 = levelsData.find(l => l.level_number === 0);
    const sortedClasses = [...classesData].sort((a, b) => a.name.localeCompare(b.name));

    let html = '';
    const buildClassItem = (c, instId, progId, lvlId) => {
      const isActive = c.id === activeClassId && instId === activeInstitutionId && progId === activeProgramId && lvlId === activeLevelId;
      return \`
        <div class="sidebar-class-item" data-cid="\${c.id}" data-iid="\${instId}" data-pid="\${progId || ''}" data-lid="\${lvlId || ''}" style="
          padding: 8px 12px 8px 30px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 13px;
          font-weight: 500;
          color: \${isActive ? '#ffffff' : '#94a3b8'};
          background: \${isActive ? '#3b82f6' : 'transparent'};
          display: flex; align-items: center; gap: 8px;
          margin-bottom: 2px;
        ">
          <span>📚</span>
          <span>\${c.name}</span>
        </div>
      \`;
    };

    if (cec) {
      const isExpanded = expandedNodes.has('inst-' + cec.id);
      html += \`
        <div class="sidebar-node" data-node="inst-\${cec.id}" style="font-size: 14px; font-weight: 700; color: #f8fafc; cursor: pointer; padding: 8px 12px; background: #0f172a; border-radius: 6px; margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span>\${cec.name}</span>
          <span>\${isExpanded ? '▼' : '▶'}</span>
        </div>
      \`;
      if (isExpanded) {
        const cecLevels = levelsData.filter(l => l.level_number > 0).sort((a,b) => a.level_number - b.level_number);
        cecLevels.forEach(lvl => {
          const lNode = \`lvl-\${cec.id}-\${lvl.id}\`;
          const isLvlExpanded = expandedNodes.has(lNode);
          html += \`
            <div class="sidebar-node" data-node="\${lNode}" style="font-size: 13px; font-weight: 600; color: #cbd5e1; cursor: pointer; padding: 6px 12px 6px 20px; display: flex; justify-content: space-between;">
              <span>\${lvl.name}</span>
              <span>\${isLvlExpanded ? '▼' : '▶'}</span>
            </div>
          \`;
          if (isLvlExpanded) {
            sortedClasses.forEach(c => {
               html += buildClassItem(c, cec.id, null, lvl.id);
            });
          }
        });
      }
    }

    if (mrtop) {
      const isExpanded = expandedNodes.has('inst-' + mrtop.id);
      html += \`
        <div style="height: 10px;"></div>
        <div class="sidebar-node" data-node="inst-\${mrtop.id}" style="font-size: 14px; font-weight: 700; color: #f8fafc; cursor: pointer; padding: 8px 12px; background: #0f172a; border-radius: 6px; margin-bottom: 4px; display: flex; justify-content: space-between;">
          <span>\${mrtop.name}</span>
          <span>\${isExpanded ? '▼' : '▶'}</span>
        </div>
      \`;
      if (isExpanded) {
        const sheraton = progData.find(p => p.name.includes('Sheraton'));
        const tamata = progData.find(p => p.name.includes('Tamata'));
        
        const renderProg = (prog, classNames) => {
          if (!prog) return '';
          let phtml = '';
          const pNode = \`prog-\${prog.id}\`;
          const isPExpanded = expandedNodes.has(pNode);
          phtml += \`
            <div class="sidebar-node" data-node="\${pNode}" style="font-size: 13px; font-weight: 600; color: #cbd5e1; cursor: pointer; padding: 6px 12px 6px 20px; display: flex; justify-content: space-between;">
              <span>\${prog.name}</span>
              <span>\${isPExpanded ? '▼' : '▶'}</span>
            </div>
          \`;
          if (isPExpanded) {
             const progClasses = sortedClasses.filter(c => classNames.some(n => c.name.toLowerCase().includes(n.toLowerCase())));
             progClasses.forEach(c => {
               phtml += buildClassItem(c, mrtop.id, prog.id, level0 ? level0.id : null);
             });
          }
          return phtml;
        };
        
        html += renderProg(sheraton, ['Conversation', 'Presentation', 'Vocabulary']);
        html += renderProg(tamata, ['Conversation', 'Speaking', 'Vocabulary']);
      }
    }

    listEl.innerHTML = html || \`<div style="text-align: center; color: #64748b; font-size: 13px; padding: 20px;">No curriculum structure found.</div>\`;

    listEl.querySelectorAll('.sidebar-node').forEach(el => {
      el.addEventListener('click', () => {
        const node = el.getAttribute('data-node');
        if (expandedNodes.has(node)) expandedNodes.delete(node);
        else expandedNodes.add(node);
        renderSidebar();
      });
    });

    listEl.querySelectorAll('.sidebar-class-item').forEach(el => {
      el.addEventListener('click', () => {
        activeClassId = el.getAttribute('data-cid') || null;
        activeInstitutionId = el.getAttribute('data-iid') || null;
        activeProgramId = el.getAttribute('data-pid') || null;
        activeLevelId = el.getAttribute('data-lid') || null;
        renderSidebar();
        renderDetailCanvas();
      });
    });
  }

  function renderDetailCanvas() {
    const canvasEl = area.querySelector('#classes-detail-canvas');
    if (!canvasEl) return;

    if (!activeClassId || !activeInstitutionId || !activeLevelId) {
      canvasEl.innerHTML = \`<div style="display: flex; align-items: center; justify-content: center; height: 100%; color: #64748b; font-size: 14px;">Select a class from the left sidebar to view details.</div>\`;
      return;
    }

    const activeClass = classesData.find(c => c.id === activeClassId);
    const activeInst = instData.find(i => i.id === activeInstitutionId);
    const activeProg = progData.find(p => p.id === activeProgramId);
    const activeLevel = levelsData.find(l => l.id === activeLevelId);

    const filteredAssessments = assessmentsData.filter(a => a.class_id === activeClassId && a.level_id === activeLevelId);

    canvasEl.innerHTML = \`
      <div style="display: flex; flex-direction: column; gap: 20px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid #334155; padding-bottom: 16px;">
          <div>
            <h3 style="font-size: 20px; font-weight: 700; color: #f8fafc; margin: 0 0 4px 0;">\${activeClass.name}</h3>
            <span style="font-size: 13px; color: #94a3b8;">Path: <strong style="color: #38bdf8;">\${activeInst ? activeInst.name : ''} \${activeProg ? '> ' + activeProg.name : ''} > \${activeLevel ? activeLevel.name : ''}</strong></span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 20px;">
          <div style="background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 16px; display: flex; flex-direction: column; gap: 10px;">
            <div style="font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 2px; text-transform: uppercase; letter-spacing: 0.5px;">
              ⚡ Assessment Builders
            </div>

            <div style="display: flex; gap: 10px;">
              <button id="btn-build-vocab-test" style="background: #3b82f6; color: white; border: none; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span>✍️🎙️</span> + Vocab Test (Written / Oral)
              </button>
              <button id="btn-build-idiom-test" style="background: #1e293b; border: 1px solid #334155; color: #e2e8f0; padding: 10px 14px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 8px;">
                <span>🔽</span> + Idiom & Proverb Test (10-Option)
              </button>
            </div>
          </div>
        </div>

        <div style="background: #0f172a; border: 1px solid #334155; border-radius: 10px; padding: 16px; margin-top: 10px;">
          <div style="font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.5px;">
            📋 Active Assessments for this Scope
          </div>
          \${filteredAssessments.length === 0 ? \`
            <div style="text-align: center; color: #64748b; font-size: 13px; padding: 24px;">No assessments yet for this class and level.</div>
          \` : \`
            <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 13px; color: #e2e8f0;">
              <thead>
                <tr style="border-bottom: 1px solid #334155; color: #94a3b8;">
                  <th style="padding: 8px;">Title</th>
                  <th style="padding: 8px;">Type</th>
                  <th style="padding: 8px;">Format</th>
                  <th style="padding: 8px;">Status</th>
                </tr>
              </thead>
              <tbody>
                \${filteredAssessments.map(asm => \`
                  <tr style="border-bottom: 1px solid #1e293b;">
                    <td style="padding: 10px 8px; font-weight: 600;">\${asm.title}</td>
                    <td style="padding: 10px 8px;">\${asm.assessment_type}</td>
                    <td style="padding: 10px 8px;"><span style="background: #334155; padding: 2px 8px; border-radius: 4px; font-size: 11px; text-transform: capitalize;">\${asm.answer_type || 'standard'}</span></td>
                    <td style="padding: 10px 8px;"><span style="color: #22c55e; font-weight: 600;">\${asm.status}</span></td>
                  </tr>
                \`).join('')}
              </tbody>
            </table>
          \`}
        </div>
      </div>
    \`;

    const vocabBtn = canvasEl.querySelector('#btn-build-vocab-test');
    if (vocabBtn) {
      vocabBtn.addEventListener('click', () => {
        openAssessmentBuilderModal(null, {
          institutionId: activeInstitutionId,
          institutionName: activeInst ? activeInst.name : '',
          programId: activeProgramId,
          programName: activeProg ? activeProg.name : '',
          classId: activeClassId,
          className: activeClass ? activeClass.name : '',
          levelId: activeLevelId,
          levelName: activeLevel ? activeLevel.name : '',
          skipStep1: true
        });
      });
    }

    const idiomBtn = canvasEl.querySelector('#btn-build-idiom-test');
    if (idiomBtn) {
      idiomBtn.addEventListener('click', () => {
        showToast('Idiom & Proverb 10-Option Dropdown builder modal initialized.', 'info');
      });
    }
  }

`;

cm = cm.substring(0, cmStart) + cmReplacement + cm.substring(cmEnd);
fs.writeFileSync(classMgmtPath, cm);
console.log('Successfully patched classes-management.js');
