const fs = require('fs');
try {
  let code = fs.readFileSync('d:/TopsCore/js/admin/vocab-vault.js', 'utf8');
  // strip imports and exports so new Function() doesn't fail on them
  code = code.replace(/import\s+.*?from\s+['"].*?['"];?/g, '');
  code = code.replace(/export\s+/g, '');
  
  new Function(code);
  console.log('Syntax OK');
} catch(e) {
  console.error('Syntax Error:', e.message);
  console.error(e.stack);
}
