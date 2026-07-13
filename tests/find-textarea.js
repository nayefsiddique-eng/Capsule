const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../test-fixtures/chatgpt.html');
const content = fs.readFileSync(filePath, 'utf8');

const index = content.indexOf('prompt-textarea');
if (index !== -1) {
  console.log('Surrounding HTML for prompt-textarea:');
  console.log(content.substring(index - 500, index + 500));
} else {
  console.log('prompt-textarea not found');
}
