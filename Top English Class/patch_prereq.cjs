const fs = require('fs');
const path = require('path');

let apiPath = path.join(__dirname, 'js', 'api.js');
let apiCode = fs.readFileSync(apiPath, 'utf8');

// Inject prerequisite auto-linking into createVocabMasteryAssessment
apiCode = apiCode.replace(
  /schedule_mode:\s*scheduleMode,/m,
  `schedule_mode:        scheduleMode,
    prerequisites:        (tier === 'QUIZ' && sourceTaskIds.length > 0) ? { parents: sourceTaskIds.map(id => ({ assessment_id: id, min_score: 60 })) } : 
                          (tier === 'EXAM' && sourceQuizIds.length > 0) ? { parents: sourceQuizIds.map(id => ({ assessment_id: id, min_score: 60 })) } : null,`
);

fs.writeFileSync(apiPath, apiCode);
