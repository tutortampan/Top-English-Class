const fs = require('fs');
const path = require('path');

// 1. UPDATE VOCAB-VAULT.JS
let vaultPath = path.join(__dirname, 'js', 'admin', 'vocab-vault.js');
let vaultCode = fs.readFileSync(vaultPath, 'utf8');

// Replace level loading
vaultCode = vaultCode.replace(
  /const \{ data \} = await sb\.from\('levels'\)\.select\('id,name,level_number'\)\.eq\('program_id', state\.programId\)\.eq\('is_active', true\)\.is\('deleted_at', null\)\.order\('level_number'\);[\s\S]*?bLevel\.disabled = false;/m,
  `const { data } = await sb.from('levels')
            .select('id,name,level_number,sort_order')
            .eq('program_id', state.programId)
            .eq('is_active', true)
            .is('deleted_at', null)
            .order('sort_order', { ascending: true })
            .order('level_number', { ascending: true });
        
        let levelData = data;
        if (!data || data.length === 0) {
            levelData = [
                { id: 'lvl1', name: '1st Level', level_number: 1 },
                { id: 'lvl2', name: '2nd Level', level_number: 2 },
                { id: 'lvl3', name: '3rd Level', level_number: 3 }
            ];
        } else {
            levelData = levelData.map(l => {
                if (l.level_number === 0) return { ...l, name: 'All Levels' };
                let suffix = 'th Level';
                if (l.level_number === 1) suffix = 'st Level';
                else if (l.level_number === 2) suffix = 'nd Level';
                else if (l.level_number === 3) suffix = 'rd Level';
                return { ...l, name: l.name || \`\${l.level_number}\${suffix}\` };
            });
        }
        
        levelData.sort((a, b) => {
            if (a.level_number === 0) return 1;
            if (b.level_number === 0) return -1;
            return (a.sort_order || a.level_number) - (b.sort_order || b.level_number);
        });

        bLevel.innerHTML = '<option value="">- Select Level -</option>' + levelData.map(l => \`<option value="\${escapeHtml(l.id)}">\${escapeHtml(l.name)}</option>\`).join('');
        bLevel.disabled = false;`
);

// Replace Step 5 schedule options
vaultCode = vaultCode.replace(
  /<span>&#128336; Flexible Window \(Due Date\)<\/span>[\s\S]*?<span>&#128197; Fixed Schedule \(Synchronous Window\)<\/span>/m,
  `<span>&#128336; Batch Duration (Flexible Self-Paced)</span>
            </label>
            <label class="d-flex align-center gap-2" style="cursor:pointer;">
              <input type="radio" name="sched-mode" value="manual" \${state.scheduleMode==='manual'?'checked':''} style="accent-color:var(--clr-primary);" />
              <span>&#128197; Tutor Live Control (Manual Toggle / In-Class)</span>`
);

fs.writeFileSync(vaultPath, vaultCode);


// 2. UPDATE API.JS
let apiPath = path.join(__dirname, 'js', 'api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8');

// Replace checkVaultDuplicates
apiCode = apiCode.replace(
  /export async function checkVaultDuplicates\(newRows\) \{[\s\S]*?return \{ cleanRows, duplicateConflicts \};\n\}/m,
  `export async function checkVaultDuplicates(newRows) {
  const sb = await getSupabase();
  const { data: vaultData, error } = await sb.from('vocabulary_vault')
    .select('id, topic, indonesian, english, target_level')
    .is('deleted_at', null);
  if (error) throw error;
  const vault = vaultData || [];

  const cleanRows = [];
  const duplicateConflicts = [];
  const normStr = s => String(s || '').toLowerCase().trim().replace(/\\s+/g, ' ');

  for (let i = 0; i < newRows.length; i++) {
    const row = newRows[i];
    const rowEng = normStr(row.english);
    const rowInd = normStr(row.indonesian);
    const rowTopic = normStr(row.topic);
    const rowLevel = parseInt(row.level || row.target_level || 1, 10) || 1;

    const exact = vault.find(v => 
        normStr(v.english) === rowEng && 
        normStr(v.indonesian) === rowInd && 
        normStr(v.topic) === rowTopic && 
        (v.target_level || 1) === rowLevel
    );

    if (exact) {
      duplicateConflicts.push({ index: i, row, existingRecord: exact, conflictType: 'EXACT' });
      continue;
    }

    cleanRows.push({ index: i, row });
  }

  return { cleanRows, duplicateConflicts };
}`
);

// Replace sanitizeVaultRow
apiCode = apiCode.replace(
  /function sanitizeVaultRow\(row\) \{[\s\S]*?\}/m,
  `function sanitizeVaultRow(row) {
  return {
    topic:      String(row.topic || '').trim().replace(/\\s+/g, ' '),
    indonesian: String(row.indonesian || '').trim().replace(/\\s+/g, ' '),
    english:    canonicalizeSynonyms(row.english),
    word_type:  String(row.word_type || 'Verb').trim().replace(/\\s+/g, ' '),
    target_level: parseInt(row.level || row.target_level || 1, 10) || 1
  };
}`
);

// Replace Level filtering in createVocabMasteryAssessment
// We need to inject target_level fetching
apiCode = apiCode.replace(
  /export async function createVocabMasteryAssessment\(config\) \{([\s\S]*?)const \{ data, error \} = await sb\.from\('vocabulary_vault'\)\n\s*\.select\('\*'\)\n\s*\.eq\('topic', sourceTopic\)\n\s*\.is\('deleted_at', null\)\n\s*\.order\('topic'\)\.order\('indonesian'\);/m,
  `export async function createVocabMasteryAssessment(config) {
  const sb = await getSupabase();
  const {
    institutionId, programId, classId, levelId,
    tier, title,
    questionOrder = 'random',
    scheduleMode = 'batch',
    windowStart = null, windowEnd = null,
    durationMinutes = 60,
    quotaMode = 'full', customQuota = null,
    sourceTopic = null, sourceTaskIds = [], sourceQuizIds = []
  } = config;

  let vaultWords = [];
  let sourceTopics = [];

  // Determine Target Level
  let targetLevel = 1;
  let isAllLevels = false;
  const { data: lvlData } = await sb.from('levels').select('level_number').eq('id', levelId).single();
  if (lvlData) {
      targetLevel = lvlData.level_number || 1;
      if (lvlData.level_number === 0) isAllLevels = true;
  }

  if (tier === 'TASK') {
    if (!sourceTopic) throw new Error('sourceTopic is required for TASK tier.');
    let q = sb.from('vocabulary_vault').select('*').eq('topic', sourceTopic).is('deleted_at', null);
    if (!isAllLevels) q = q.eq('target_level', targetLevel);
    const { data, error } = await q.order('topic').order('indonesian');`
);

apiCode = apiCode.replace(
  /const \{ data, error \} = await sb\.from\('vocabulary_vault'\)\n\s*\.select\('\*'\)\n\s*\.in\('topic', sourceTopics\)\n\s*\.is\('deleted_at', null\)\n\s*\.order\('topic'\)\.order\('indonesian'\);/gm,
  `let q = sb.from('vocabulary_vault').select('*').in('topic', sourceTopics).is('deleted_at', null);
    if (!isAllLevels) q = q.eq('target_level', targetLevel);
    const { data, error } = await q.order('topic').order('indonesian');`
);

// Remove seen.has() truncation to maintain full pool for QUIZ/EXAM
apiCode = apiCode.replace(
  /const seen = new Map\(\);\n\s*for \(const w of \(data \|\| \[\]\)\) \{\n\s*const key = w\.english\.toLowerCase\(\)\.trim\(\);\n\s*if \(!seen\.has\(key\)\) seen\.set\(key, w\);\n\s*\}\n\s*vaultWords = \[\.\.\.seen\.values\(\)\];/gm,
  `vaultWords = data || [];`
);

// Replace checkAndTriggerLevelUp
apiCode = apiCode.replace(
  /const \{ data: exams, error: exErr \} = await sb\.from\('assessments'\)\n\s*\.select\('id'\)\n\s*\.eq\('level_id', currentLevelId\)/m,
  `const { data: exams, error: exErr } = await sb.from('assessments')
    .select('id, levels!inner(level_number)')
    .eq('level_id', currentLevelId)
    .neq('levels.level_number', 0)` // exclude all-levels exams
);

// Also add is_unlocked for scheduleMode 'batch' / 'manual' in assessment insertion
apiCode = apiCode.replace(
  /schedule_mode:        scheduleMode,/m,
  `schedule_mode:        scheduleMode,
    is_unlocked:          scheduleMode === 'batch' ? true : false,`
);

fs.writeFileSync(apiPath, apiCode);


// 3. UPDATE ASSESSMENT.HTML
let asmPath = path.join(__dirname, 'assessment.html');
let asmCode = fs.readFileSync(asmPath, 'utf8');

// Add lock screen logic for manual schedule
asmCode = asmCode.replace(
  /if \(assessmentData\?\.schedule_mode === 'fixed'\) \{/m,
  `if (assessmentData?.schedule_mode === 'manual' && assessmentData?.is_unlocked === false) {
          mainBox.innerHTML = \`
            <div class="glass-panel text-center p-5 mx-auto" style="max-width:500px;margin-top:10vh;">
              <h2 class="fw-800 text-xl mb-3" style="color:var(--clr-text-1);">🔒 Ujian Terkunci</h2>
              <p class="text-sm" style="color:var(--clr-text-2);">Menunggu instruksi tutor di kelas.</p>
              <button class="btn btn-primary mt-4" onclick="window.location.href='dashboard.html'">Kembali ke Dashboard</button>
            </div>
          \`;
          hideLoading();
          return;
        }
        
        if (assessmentData?.schedule_mode === 'fixed') {`
);

fs.writeFileSync(asmPath, asmCode);


// 4. BUMP VERSION TO 4.7.0
const walkSync = function(dir, filelist) {
  let files = fs.readdirSync(dir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(dir + '/' + file).isDirectory() && file !== 'node_modules' && file !== '.git') {
      filelist = walkSync(dir + '/' + file, filelist);
    }
    else {
      if (file.endsWith('.html') || file.endsWith('.js')) {
        filelist.push(path.join(dir, file));
      }
    }
  });
  return filelist;
};

const allFiles = walkSync(__dirname);
allFiles.forEach(file => {
  let c = fs.readFileSync(file, 'utf8');
  if (c.includes('v=4.6.2')) {
    fs.writeFileSync(file, c.replace(/v=4\.6\.2/g, 'v=4.7.0'));
  }
  if (c.includes('v=4.3.0')) {
    fs.writeFileSync(file, c.replace(/v=4\.3\.0/g, 'v=4.7.0'));
  }
});
