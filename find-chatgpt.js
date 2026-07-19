const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, 'test-fixtures/live-results/chatgpt-real-dom.html');
const html = fs.readFileSync(file, 'utf8');

const matches = [...html.matchAll(/data-message-author-role="([^"]+)"/g)];
console.log('Roles found:', matches.map(m => m[1]).join(', '));
