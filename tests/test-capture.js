const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile');
const resultsDir = path.resolve(__dirname, '../test-fixtures/qa-results');

async function testCapture() {
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

    const page = await context.newPage();
    // Use an easy one to test, e.g. chatgpt.com
    await page.goto('https://chatgpt.com/', { waitUntil: 'domcontentloaded' });
    
    // Inject the content script manually since it might be stale?
    // Wait, Playwright launches a fresh browser, so the tab is FRESH.
    // If it fails on a fresh tab, the manifest matches are WRONG or something.
    
    const popupPage = await context.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForTimeout(1000);
    
    // Click capture
    await popupPage.click('#capture-btn');
    
    // Check for alert dialog
    popupPage.on('dialog', dialog => {
      console.log('DIALOG OPENED:', dialog.message());
      dialog.accept();
    });
    
    await popupPage.waitForTimeout(2000);
    
  } catch(e) {
    console.error('Error:', e);
  } finally {
    await context.close();
  }
}

testCapture();
