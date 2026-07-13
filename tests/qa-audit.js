const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile');
const resultsDir = path.resolve(__dirname, '../test-fixtures/qa-results');

if (!fs.existsSync(resultsDir)) {
  fs.mkdirSync(resultsDir, { recursive: true });
}

async function runQA() {
  console.log('Launching browser for QA Audit...');
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

    // Get the extension ID
    const extensionId = sw.url().split('/')[2];
    const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
    
    console.log(`Extension ID: ${extensionId}`);
    
    // Test 1: Popup UI
    const popupPage = await context.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForTimeout(1000); // Wait for load
    
    await popupPage.screenshot({ path: path.join(resultsDir, 'qa-popup-empty.png') });
    console.log('Saved qa-popup-empty.png');
    
    // Inject some fake capsules into storage to test rendering and drag & drop
    await popupPage.evaluate(() => {
      return new Promise(resolve => {
        const fakeCapsules = [
          {
            id: 'cap1',
            sourceSite: 'ChatGPT',
            capturedAt: Date.now(),
            title: 'Discussing React Hooks',
            turns: [{role: 'user', content: 'What is useEffect?'}, {role: 'assistant', content: 'useEffect is...'}],
            tags: ['Code']
          },
          {
            id: 'cap2',
            sourceSite: 'Claude',
            capturedAt: Date.now(),
            title: 'Debugging Playwright',
            turns: [{role: 'user', content: 'Why is it timing out?'}, {role: 'assistant', content: 'Because...'}],
            tags: ['Debugging']
          }
        ];
        chrome.storage.local.set({ savedCapsules: fakeCapsules }, resolve);
      });
    });
    
    // Reload popup to render fake capsules
    await popupPage.reload();
    await popupPage.waitForTimeout(1000);
    await popupPage.screenshot({ path: path.join(resultsDir, 'qa-popup-populated.png') });
    console.log('Saved qa-popup-populated.png');
    
    // Simulate Drag and Drop
    // We will evaluate a script to simulate the drag events since native drag is hard in Playwright
    await popupPage.evaluate(() => {
      const cap = document.querySelector('.capsule[data-id="cap1"]');
      const dropZone = document.getElementById('zone-merge');
      
      // Dispatch dragstart
      cap.dispatchEvent(new DragEvent('dragstart', { bubbles: true }));
      
      // Dispatch dragover
      dropZone.dispatchEvent(new DragEvent('dragover', { bubbles: true }));
      
      // Dispatch drop
      dropZone.dispatchEvent(new DragEvent('drop', { bubbles: true }));
      
      // Dispatch dragend
      cap.dispatchEvent(new DragEvent('dragend', { bubbles: true }));
    });
    
    await popupPage.waitForTimeout(1000);
    await popupPage.screenshot({ path: path.join(resultsDir, 'qa-popup-after-merge.png') });
    console.log('Saved qa-popup-after-merge.png');

    // Test 2: Claude Injection
    console.log('Testing Claude Injection...');
    const claudePage = await context.newPage();
    await claudePage.goto('https://claude.ai/login', { waitUntil: 'domcontentloaded' });
    await claudePage.waitForTimeout(2000);
    await claudePage.screenshot({ path: path.join(resultsDir, 'qa-claude-login.png') });
    console.log('Saved qa-claude-login.png');

  } catch(e) {
    console.error('Error during QA:', e);
  } finally {
    await context.close();
  }
}

runQA();
