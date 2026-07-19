const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../test-fixtures/perplexity.html');
const content = fs.readFileSync(filePath, 'utf8');

const matches = content.match(/<textarea[^>]*>/g);
console.log('Textareas in perplexity.html:', matches);
