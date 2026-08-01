const fs = require('fs');
const path = require('path');
function search(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      search(full);
    } else if (full.endsWith('.ts') || full.endsWith('.tsx')) {
      const content = fs.readFileSync(full, 'utf8');
      if (/from\(\s*['"`](?:participation_logs|participation_submission_events|audit_events|verification_requests)['"`]\s*\)\s*\.\s*(?:insert|update|delete|upsert)/.test(content)) {
        console.log('FOUND IN:', full);
      }
    }
  }
}
search('src');
console.log('Search complete.');
