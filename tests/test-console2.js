const { chromium } = require('playwright');
const path = require('path');

const extensionPath = path.resolve(__dirname, '../');
const userDataDir = path.resolve(__dirname, '../test-fixtures/persistent-profile');

async function testConsole() {
  console.log('Launching browser to check console...');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: true, // we can run headless to just check console
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`
    ]
  });

  try {
    const page = await context.newPage();
    
    page.on('console', msg => {
      console.log(`PAGE LOG: ${msg.text()}`);
    });

    console.log('Navigating to gemini...');
    await page.goto('https://gemini.google.com/', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);

  } catch(e) {
    console.error('Error:', e);
  } finally {
    await context.close();
  }
}

testConsole();
