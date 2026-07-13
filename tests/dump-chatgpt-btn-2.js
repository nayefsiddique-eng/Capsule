const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../test-fixtures/chatgpt.html');
const content = fs.readFileSync(filePath, 'utf8');

// Find all buttons
const matches = content.match(/<button[^>]+>/g);
if (matches) {
  matches.forEach(m => {
    if (m.includes('submit') || m.includes('send') || m.includes('Send') || m.includes('button')) {
      console.log(m);
    }
  });
}
