const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../test-fixtures/chatgpt.html');
const content = fs.readFileSync(filePath, 'utf8');

// Find button tags
const matches = content.match(/<button[^>]+>/g);
if (matches) {
  console.log('Buttons found in chatgpt.html:');
  matches.forEach(m => {
    if (m.includes('send') || m.includes('Submit') || m.includes('disabled') || m.includes('testid')) {
      console.log(m);
    }
  });
} else {
  console.log('No buttons found.');
}
