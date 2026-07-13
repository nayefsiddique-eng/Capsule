const { chromium } = require('playwright');
const path = require('path');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile');

const sites = [
  'https://chatgpt.com/',
  'https://claude.ai/',
  'https://gemini.google.com/',
  'https://www.perplexity.ai/',
  'https://perplexity.ai/'
];

async function checkInjection() {
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: false,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    for (const site of sites) {
      const page = await context.newPage();
      try {
        await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000);
        
        const isAppended = await page.evaluate(() => {
          return typeof window.capsuleAdapters !== 'undefined';
        });
        
        console.log(`Site: ${site} -> Content script injected: ${isAppended}`);
      } catch (e) {
        console.log(`Site: ${site} -> Error: ${e.message}`);
      }
      await page.close();
    }
  } finally {
    await context.close();
  }
}

checkInjection();
