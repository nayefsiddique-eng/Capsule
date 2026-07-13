const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile-ui');

async function testUI() {
  console.log('Testing UI...');
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

    const popupPage = await context.newPage();
    await popupPage.goto(popupUrl);
    await popupPage.waitForTimeout(2000);

    const destDir = path.resolve(__dirname, '../../.gemini/antigravity/brain/8697f8b2-c283-4264-b4f6-2ca9c68111cb/live-results');
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    // 1. Initial State (Sign In)
    await popupPage.screenshot({ path: path.join(destDir, 'auth-signin.png') });
    console.log('Screenshot saved: auth-signin.png');

    // 2. Tab to Sign Up
    await popupPage.click('.auth-tab[data-tab="signup"]');
    await popupPage.waitForTimeout(1000);
    await popupPage.screenshot({ path: path.join(destDir, 'auth-signup.png') });
    console.log('Screenshot saved: auth-signup.png');

    // 3. Skip Auth to Main View
    await popupPage.click('#skip-auth');
    await popupPage.waitForTimeout(1000);
    await popupPage.screenshot({ path: path.join(destDir, 'main-view.png') });
    console.log('Screenshot saved: main-view.png');

  } catch(e) {
    console.error('Error:', e);
  } finally {
    await context.close();
  }
}

testUI();
