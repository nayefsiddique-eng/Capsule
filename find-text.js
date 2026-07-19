const fs = require('fs');
const path = require('path');

const files = ['claude.html', 'gemini.html', 'perplexity.html'];

for (const f of files) {
  const filePath = path.resolve(__dirname, f);
  if (fs.existsSync(filePath)) {
    const html = fs.readFileSync(filePath, 'utf8');
    const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    console.log(`\n--- ${f} text preview ---`);
    console.log(text.substring(0, 500));
  } else {
    console.log(`\n--- ${f} NOT FOUND ---`);
  }
}
