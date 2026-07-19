const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, 'test-fixtures/live-results/claude-real-dom.html');
const html = fs.readFileSync(file, 'utf8');

const index = html.indexOf('what is 3+3');
if (index !== -1) {
  console.log('User Parent context:', html.substring(Math.max(0, index - 800), index + 800));
} else {
  console.log('User text not found');
}
