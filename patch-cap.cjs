const fs = require('fs');
let code = fs.readFileSync('d:/TopsCore/js/admin/vocab-vault.js', 'utf8');

// The badge replacement
code = code.replace(
  '<span class="badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);font-size:0.75rem;">',
  '<span class="badge" style="background:rgba(99,102,241,0.15);color:#a5b4fc;border:1px solid rgba(99,102,241,0.3);font-size:0.75rem;text-transform:capitalize;">'
);

// We should also replace the edit topic input class to capitalize if not already. Let's not worry about it if not mentioned exactly, just badge topics and tables.
fs.writeFileSync('d:/TopsCore/js/admin/vocab-vault.js', code);
console.log('Capitalized');
