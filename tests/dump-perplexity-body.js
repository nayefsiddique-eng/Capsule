const fs = require('fs');
const path = require('path');

const filePath = path.resolve(__dirname, '../test-fixtures/perplexity.html');
const content = fs.readFileSync(filePath, 'utf8');

// Print first 1000 characters of body
const bodyIndex = content.indexOf('<body');
if (bodyIndex !== -1) {
  console.log(content.substring(bodyIndex, bodyIndex + 2000));
} else {
  console.log(content.substring(0, 2000));
}
