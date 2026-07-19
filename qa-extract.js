const fs = require('fs');
const path = require('path');
const jsdom = require("jsdom");
const { JSDOM } = jsdom;

const dir = path.resolve(__dirname, 'test-fixtures');
const adaptersDir = path.resolve(__dirname, 'content/adapters');

const sites = [
  { name: 'chatgpt', file: 'chatgpt.html' },
  { name: 'claude', file: 'claude.html' },
  { name: 'gemini', file: 'gemini.html' },
  { name: 'perplexity', file: 'perplexity.html' }
];

console.log('--- QA AUDIT: EXTRACTION ---\n');

for (const site of sites) {
  const filePath = path.join(dir, site.file);
  const adapterPath = path.join(adaptersDir, `${site.name}.js`);
  
  if (fs.existsSync(filePath) && fs.existsSync(adapterPath)) {
    const html = fs.readFileSync(filePath, 'utf8');
    const adapterCode = fs.readFileSync(adapterPath, 'utf8');
    
    const dom = new JSDOM(html, { runScripts: "dangerously" });
    dom.window.eval(adapterCode);
    
    try {
      const turns = dom.window.capsuleAdapters[site.name].extractConversation();
      console.log(`[${site.name.toUpperCase()}]`);
      if (turns && turns.length > 0) {
        console.log(`PASS: Extracted ${turns.length} turns.`);
        console.log(`Sample Turn 0: ${turns[0].role} - "${turns[0].content.substring(0, 50).replace(/\n/g, ' ')}..."`);
      } else {
        console.log(`FAIL: Extracted 0 turns.`);
      }
    } catch(e) {
      console.log(`[${site.name.toUpperCase()}] FAIL: Exception during extraction - ${e.message}`);
    }
    console.log('');
  }
}
