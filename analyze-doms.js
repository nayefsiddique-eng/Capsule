const fs = require('fs');
const path = require('path');
const html = fs.readFileSync(path.resolve(__dirname, 'test-fixtures/perplexity.html'), 'utf8');

const matches = [...html.matchAll(/class="[^"]*break-words[^"]*"/g)];
console.log('Number of break-words elements:', matches.length);
