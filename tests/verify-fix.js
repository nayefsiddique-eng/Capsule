const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile-verify');

async function verifyFix() {
  console.log('Verifying fix on perplexity.ai...');
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
    console.log('Navigating to https://perplexity.ai/ ...');
    await page.goto('https://perplexity.ai/', { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(3000);

    const popupPage = await context.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForTimeout(2000);

    let dialogAppeared = false;
    popupPage.on('dialog', dialog => {
      console.log('DIALOG:', dialog.message());
      dialogAppeared = true;
      dialog.accept();
    });

    // Wait for capsules to render
    await popupPage.waitForSelector('#capsule-list');

    // Click Capture
    // To make sure it targets the right tab, we must bring the perplexity page to front!
    // But popup.js uses `active: true, currentWindow: true`.
    // Wait, Playwright tab management: popupPage is the active tab!
    // So the popup will capture from ITSELF and fail!
    
    // Instead of using the popup UI manually, let's inject a fake click that queries the perplexity tab ID
    // and sends the message directly, OR let's evaluate in popup context but pass the perplexity tab ID!
    
    // Get perplexity tab ID
    const tabs = await popupPage.evaluate(async () => {
      return new Promise(resolve => {
        chrome.tabs.query({}, tabs => resolve(tabs));
      });
    });
    
    const perpTab = tabs.find(t => t.url && t.url.includes('perplexity.ai'));
    if (!perpTab) {
      console.log('Perplexity tab not found by chrome.tabs.query!');
      return;
    }

    console.log('Found perplexity tab:', perpTab.url);

    // Now trigger the extraction directly on that tab from popup
    const result = await popupPage.evaluate(async (tabId) => {
      return new Promise(resolve => {
        chrome.tabs.sendMessage(tabId, { action: 'EXTRACT_CHAT' }, (response) => {
          if (chrome.runtime.lastError) {
            resolve({ error: chrome.runtime.lastError.message });
          } else {
            resolve({ success: true, response });
          }
        });
      });
    }, perpTab.id);

    console.log('Capture result:', result);

    if (result.error) {
      console.log('VERIFICATION FAILED: Error dialog would appear. ' + result.error);
    } else {
      console.log('VERIFICATION PASSED: Successfully connected and extracted conversation!');
      if (result.response && result.response.turns) {
         console.log(`Extracted ${result.response.turns.length} turns.`);
      }
    }

  } catch(e) {
    console.error('Error:', e);
  } finally {
    await context.close();
  }
}

verifyFix();
