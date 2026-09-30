const fs = require('fs');
let content = fs.readFileSync('d:/TopsCore/js/admin/vocab-vault.js', 'utf8');

// Replace tasks query
content = content.replace(/const \{ data: tasks \} = await sb\.from\('assessments'\)[\s\S]*?\.order\('name'\);/m, 
`        const { data: tasks } = await sb.from('assessments')
          .select('id,title,description')
          .eq('assessment_type', 'VOCAB_TASK')
          .eq('class_id', state.classId)
          .eq('status', 'PUBLISHED')
          .is('deleted_at', null)
          .order('title');`);

// Replace tasks rendering
content = content.replace(/<span class="fw-600 text-sm">\$\{escapeHtml\(t\.title\|\|t\.name\)\}<\/span>[\s\S]*?<span class="text-xs text-muted ml-2">Topic: \$\{escapeHtml\(t\.payload\?\.source_topic\|\|'—'\)\}<\/span>/m, 
`<span class="fw-600 text-sm">\${escapeHtml(t.title)}</span>
                  <span class="text-xs text-muted ml-2">\${escapeHtml(t.description||'—')}</span>`);

// Replace quizzes query
content = content.replace(/const \{ data: quizzes \} = await sb\.from\('assessments'\)[\s\S]*?\.order\('name'\);/m, 
`        const { data: quizzes } = await sb.from('assessments')
          .select('id,title,description')
          .eq('assessment_type', 'VOCAB_QUIZ')
          .eq('class_id', state.classId)
          .eq('status', 'PUBLISHED')
          .is('deleted_at', null)
          .order('title');`);

// Replace quizzes rendering
content = content.replace(/<span class="fw-600 text-sm">\$\{escapeHtml\(q\.title\|\|q\.name\)\}<\/span>[\s\S]*?<span class="text-xs text-muted ml-2">Topics: \$\{escapeHtml\(\(q\.payload\?\.source_topics\|\|\[\]\)\.join\(', '\)\|\|'—'\)\}<\/span>/m, 
`<span class="fw-600 text-sm">\${escapeHtml(q.title)}</span>
                  <span class="text-xs text-muted ml-2">\${escapeHtml(q.description||'—')}</span>`);

fs.writeFileSync('d:/TopsCore/js/admin/vocab-vault.js', content, 'utf8');
console.log('Replaced successfully');
