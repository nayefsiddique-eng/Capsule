const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const fs = require('fs');

test.describe('Full Auth Round-Trip', () => {
  let browserContext;
  let extensionId;

  test.beforeAll(async () => {
    const extensionPath = path.resolve(__dirname, '..');
    browserContext = await chromium.launchPersistentContext('', {
      headless: false,
      args: [
        `--disable-extensions-except=${extensionPath}`,
        `--load-extension=${extensionPath}`
      ]
    });

    // Find the extension ID
    let [background] = browserContext.serviceWorkers();
    if (!background) {
      background = await browserContext.waitForEvent('serviceworker');
    }
    const extensionUri = background.url();
    extensionId = extensionUri.split('/')[2];
  });

  test.afterAll(async () => {
    await browserContext.close();
  });

  test('Perform full sign-up -> OTP -> tray -> sign-out -> sign-in', async () => {
    const page = await browserContext.newPage();
    const popupUrl = `chrome-extension://${extensionId}/popup/popup.html`;
    await page.goto(popupUrl);
    
    // Wait for auth view
    await page.waitForSelector('#auth-view', { state: 'visible' });
    
    // Switch to Sign Up
    await page.click('.auth-tab[data-tab="signup"]');
    
    // Fill Sign Up form
    await page.fill('#auth-name', 'Test User');
    const testEmail = `test-${Date.now()}@example.com`;
    await page.fill('#auth-email', testEmail);
    await page.fill('#auth-password', 'password123');
    await page.fill('#auth-confirm', 'password123');
    
    // Intercept the /auth/register request to get the preview URL and OTP from the DB
    let previewUrl = null;
    page.on('response', async (response) => {
      if (response.url().includes('/auth/register')) {
        const body = await response.json();
        if (body.previewUrl) previewUrl = body.previewUrl;
      }
    });

    // Submit Sign Up
    await page.click('#auth-submit');
    
    // Wait for OTP view
    await page.waitForSelector('#otp-view', { state: 'visible' });
    console.log(`✅ Transitioned to OTP view for ${testEmail}`);
    
    // Get OTP from SQLite DB since we are testing locally
    const Database = require('better-sqlite3');
    const db = new Database(path.join(__dirname, '../backend/capsule.db'));
    const otpRecord = db.prepare('SELECT * FROM otps WHERE email = ? ORDER BY id DESC LIMIT 1').get(testEmail);
    
    // We can't reverse bcrypt hash easily, but wait, the OTP is printed to the backend console. 
    // We can't grab it from DB because it's hashed!
    // But wait, since we sent it via Ethereal, we can look at the Ethereal email or we can just modify the DB temporarily to store the raw OTP for testing, OR we can grab it from the backend task log.
    // Let's just grab the preview URL which is printed by the interceptor!
    
    // Wait a sec for the response to finish
    await page.waitForTimeout(1000);
    console.log(`📧 Ethereal Email Preview URL: ${previewUrl}`);
    
    // Actually, to enter the OTP in Playwright without modifying the backend, I need the raw OTP.
    // Let me just read the backend task log file!
    const logPath = path.join(__dirname, '../../.gemini/antigravity/brain/8697f8b2-c283-4264-b4f6-2ca9c68111cb/.system_generated/tasks/task-1683.log');
    let otp = '';
    if (fs.existsSync(logPath)) {
      const logs = fs.readFileSync(logPath, 'utf8');
      const match = logs.match(new RegExp(`OTP for ${testEmail}: (\\d{6})`));
      if (match) otp = match[1];
    }
    
    if (!otp) {
      throw new Error("Could not find OTP in backend logs");
    }
    console.log(`🔑 Extracted OTP from backend logs: ${otp}`);
    
    // Enter OTP
    const otpInputs = await page.$$('.otp-digit');
    for (let i = 0; i < 6; i++) {
      await otpInputs[i].fill(otp[i]);
    }
    
    // Wait for main view
    await page.waitForSelector('#main-view', { state: 'visible' });
    console.log(`✅ Transitioned to Main Tray view!`);
    
    // Sign Out
    await page.click('#user-avatar');
    await page.waitForSelector('#auth-view', { state: 'visible' });
    console.log(`✅ Signed out successfully.`);
    
    // Sign In
    await page.click('.auth-tab[data-tab="signin"]');
    await page.fill('#auth-email', testEmail);
    await page.fill('#auth-password', 'password123');
    await page.click('#auth-submit');
    
    // Wait for main view
    await page.waitForSelector('#main-view', { state: 'visible' });
    console.log(`✅ Signed in successfully. Round trip complete!`);
    
    // Save the preview URL for the prompt requirement
    fs.writeFileSync(path.join(__dirname, 'ethereal_preview.txt'), previewUrl || 'No preview URL (offline mode)');
  });
});
