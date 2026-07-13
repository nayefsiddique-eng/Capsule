const { chromium } = require('playwright');
const path = require('path');

const extensionPath = path.resolve(__dirname, '../');

async function testUrls() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const sites = [
    'https://chatgpt.com',
    'https://claude.ai',
    'https://gemini.google.com',
    'https://perplexity.ai'
  ];

  for (const site of sites) {
    try {
      await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
      console.log(`Input: ${site} -> Actual URL: ${page.url()}`);
    } catch (e) {
      console.log(`Input: ${site} -> Error: ${e.message}`);
    }
  }

  await browser.close();
}

testUrls();
