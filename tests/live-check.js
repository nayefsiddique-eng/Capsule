const { chromium } = require('playwright');
const path = require('path');
const readline = require('readline');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile');
const resultsDir = path.resolve(__dirname, '../test-fixtures/live-results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function runLiveCheck() {
  console.log('Launching browser...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  await new Promise(resolve => {
    rl.question('\n>>> Please navigate to ChatGPT, Claude, Gemini, and Perplexity.\n>>> Send a message in EACH, then press Enter.', () => {
      resolve();
    });
  });

  console.log('\n--- Dumping all Playwright pages ---');
  
  try {
    const pages = context.pages();
    for (const p of pages) {
      const url = p.url();
      let siteName = null;
      if (url.includes('chatgpt.com')) siteName = 'chatgpt';
      else if (url.includes('claude.ai')) siteName = 'claude';
      else if (url.includes('gemini.google.com')) siteName = 'gemini';
      else if (url.includes('perplexity.ai')) siteName = 'perplexity';
      
      if (siteName) {
        console.log(`\nFound ${siteName} at ${url}`);
        await p.bringToFront();
        await p.waitForTimeout(2000);
        
        const html = await p.evaluate(() => document.body.innerHTML);
        fs.writeFileSync(path.join(resultsDir, `${siteName}-real-dom.html`), html);
        await p.screenshot({ path: path.join(resultsDir, `${siteName}-real-structure.png`), fullPage: true });
        console.log(`Saved DOM and screenshot for ${siteName}`);
      }
    }
  } catch (error) {
    console.error('An error occurred during tests:', error);
  } finally {
    console.log('\nClosing browser...');
    await context.close();
    rl.close();
  }
}

runLiveCheck();
