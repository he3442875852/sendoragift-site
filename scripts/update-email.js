const fs = require('fs');

const files = [
  'index.html',
  'corporate-gift.html',
  'employee-welcome.html',
  'promotional-giveaways.html',
  'event-gift.html',
  'executive-gift.html',
  'conference-gift.html',
  'sports-event.html',
  'holiday-gift.html'
];

for (const file of files) {
  let html = fs.readFileSync(file, 'utf8');
  html = html.replace(/info@sendoragift\.com/g, 'rita@mcpatch.com');
  fs.writeFileSync(file, html, 'utf8');
}

fs.rmSync('scripts/update-email.js', { force: true });
fs.rmSync('.github/workflows/update-email.yml', { force: true });
