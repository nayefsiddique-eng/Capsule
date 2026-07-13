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

async function extractViaExtension() {
  console.log('Attaching to browser...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    let sw = context.serviceWorkers()[0];
    if (!sw) {
      sw = await context.waitForEvent('serviceworker', { timeout: 5000 });
    }

    console.log('Triggering dump of all tabs via extension service worker...');
    const results = await sw.evaluate(async () => {
      const tabs = await chrome.tabs.query({});
      const dumped = [];
      
      for (const t of tabs) {
        if (!t.url) continue;
        let siteName = null;
        if (t.url.includes('chatgpt.com')) siteName = 'chatgpt';
        else if (t.url.includes('claude.ai')) siteName = 'claude';
        else if (t.url.includes('gemini.google.com')) siteName = 'gemini';
        else if (t.url.includes('perplexity.ai')) siteName = 'perplexity';
        
        if (siteName) {
          try {
            const results = await chrome.scripting.executeScript({
              target: { tabId: t.id },
              func: () => document.body.innerHTML
            });
            if (results && results[0] && results[0].result) {
              dumped.push({ site: siteName, url: t.url, html: results[0].result });
            }
          } catch(e) {
            // ignore
          }
        }
      }
      return dumped;
    });

    console.log(`Found ${results.length} valid tabs via extension.`);
    for (const r of results) {
      console.log(`Saving ${r.site} from ${r.url}`);
      fs.writeFileSync(path.join(resultsDir, `${r.site}-real-dom-extension.html`), r.html);
    }
  } catch(e) {
    console.error(e);
  } finally {
    console.log('Done, closing...');
    await context.close();
  }
}

extractViaExtension();
