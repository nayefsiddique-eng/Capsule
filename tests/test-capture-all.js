const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile');
const resultsDir = path.resolve(__dirname, '../test-fixtures/qa-results');

const sites = [
  'https://chatgpt.com/',
  'https://claude.ai/',
  'https://gemini.google.com/',
  'https://www.perplexity.ai/',
  'https://perplexity.ai/'
];

async function testCaptureAll() {
  console.log('Launching browser for Capture Test...');
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
    const extensionId = sw.url().split('/')[2];
    const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;

    for (const site of sites) {
      const page = await context.newPage();
      try {
        await page.goto(site, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await page.waitForTimeout(2000); // Wait for content script to inject

        const popupPage = await context.newPage();
        await popupPage.goto(popupUrl);
        await popupPage.waitForTimeout(1000);
        
        let dialogAppeared = false;
        popupPage.on('dialog', dialog => {
          if (dialog.message().includes('Could not connect')) {
            dialogAppeared = true;
          }
          dialog.accept();
        });
        
        await popupPage.click('#capture-btn');
        await popupPage.waitForTimeout(1000);
        
        console.log(`Site: ${site} -> Dialog Appeared: ${dialogAppeared}`);
        await popupPage.close();
      } catch (e) {
        console.log(`Site: ${site} -> Error: ${e.message}`);
      }
      await page.close();
    }
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await context.close();
  }
}

testCaptureAll();
