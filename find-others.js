const fs = require('fs');
const path = require('path');

const files = ['claude-real-dom.html', 'gemini-real-dom.html', 'perplexity-real-dom.html'];

for (const f of files) {
  const file = path.resolve(__dirname, 'test-fixtures/live-results/', f);
  if (fs.existsSync(file)) {
    const html = fs.readFileSync(file, 'utf8');
    const index = html.toLowerCase().indexOf('hello');
    if (index !== -1) {
      console.log(`Found in ${f}:`, html.substring(Math.max(0, index - 300), index + 300));
    } else {
      console.log(`Not found in ${f}`);
    }
  } else {
    console.log(`${f} not found`);
  }
}
