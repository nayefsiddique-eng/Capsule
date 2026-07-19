/**
 * otp-manual.test.js — Item 2 of verification pass (v3)
 *
 * Proves:
 *   (a) Wrong OTP → popup stays on otp-view with inputs re-enabled
 *   (b) Correct OTP → popup transitions to main-view (tray)
 *
 * Uses Node http module for backend calls (fetch not available in PW test Node context).
 * Registers via backend FIRST, then opens popup fresh and goes through Sign-Up flow.
 */

const { test, expect, chromium } = require('@playwright/test');
const path = require('path');
const http  = require('http');
const fs    = require('fs');

const BACKEND     = 'http://localhost:3001';
const EXT_PATH    = path.resolve(__dirname, '..');
const RESULTS_DIR = path.join(__dirname, '../live-results');
// Scan all task logs in the brain dir for the OTP — works regardless of which task ID the server got
const TASKS_DIR = 'C:\\Users\\Admin pc\\.gemini\\antigravity\\brain\\8697f8b2-c283-4264-b4f6-2ca9c68111cb\\.system_generated\\tasks';

function httpPost(url, body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(body);
    const parsed = new URL(url);
    const req = http.request({
      hostname: parsed.hostname, port: parsed.port || 80,
      path: parsed.pathname, method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let raw = '';
      res.on('data', c => raw += c);
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(raw) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function getLatestOTPFromLog(email) {
  // Scan ALL task log files — server task ID changes every restart
  if (!fs.existsSync(TASKS_DIR)) return null;
  const escaped = email.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}[^\r\n]*(\\d{6})`, 'g');
  let last = null;
  for (const f of fs.readdirSync(TASKS_DIR)) {
    if (!f.endsWith('.log')) continue;
    const log = fs.readFileSync(path.join(TASKS_DIR, f), 'utf8');
    let match;
    while ((match = re.exec(log)) !== null) last = match[1];
    re.lastIndex = 0; // reset for next file
  }
  return last;
}

// Single flat test — no beforeAll (avoids timeout issues with persistent context)
test('OTP flow: wrong code → error, correct code → tray', async () => {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // ── 1. Register via backend ─────────────────────────────────
  const testEmail = `pw-otp-${Date.now()}@example.com`;
  const reg = await httpPost(`${BACKEND}/auth/register`, {
    name: 'PW Tester', email: testEmail, password: 'Test1234'
  });
  console.log(`\nRegister → ${reg.status}:`, reg.body);
  expect(reg.status).toBe(201);
  console.log(`📧 Ethereal preview: ${reg.body.previewUrl || '(offline — OTP in server log)'}`);
  await new Promise(r => setTimeout(r, 600)); // let log flush

  // ── 2. Extract OTP ──────────────────────────────────────────
  const otp = getLatestOTPFromLog(testEmail);
  console.log(`🔑 OTP from server log: ${otp}`);
  expect(otp).toBeTruthy();

  // ── 3. Launch extension ─────────────────────────────────────
  const ctx = await chromium.launchPersistentContext('', {
    headless: false, slowMo: 100,
    args: [
      `--disable-extensions-except=${EXT_PATH}`,
      `--load-extension=${EXT_PATH}`,
      '--no-sandbox', '--disable-dev-shm-usage'
    ],
    timeout: 30000
  });

  try {
    // Wait for service worker
    let bg = ctx.serviceWorkers()[0];
    if (!bg) {
      bg = await ctx.waitForEvent('serviceworker', { timeout: 15000 });
    }
    const extId = bg.url().split('/')[2];
    console.log(`Extension ID: ${extId}`);

    const page = await ctx.newPage();
    await page.goto(`chrome-extension://${extId}/popup/popup.html`, { waitUntil: 'domcontentloaded' });

    // Clear session so we always start at auth
    await page.evaluate(() => new Promise(r => chrome.storage.local.clear(r)));
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.waitForSelector('#auth-view', { state: 'visible', timeout: 8000 });
    console.log('✅ Auth view loaded');

    // ── 4. Sign-Up → OTP view ──────────────────────────────────
    await page.click('.auth-tab[data-tab="signup"]');
    await page.fill('#auth-name', 'PW Tester');
    await page.fill('#auth-email', testEmail);
    await page.fill('#auth-password', 'Test1234');
    await page.fill('#auth-confirm', 'Test1234');
    await page.click('button[type="submit"]');
    await page.waitForSelector('#otp-view', { state: 'visible', timeout: 12000 });
    console.log('✅ OTP view appeared');
    await page.screenshot({ path: path.join(RESULTS_DIR, 'A-otp-view-loaded.png') });

    // ── 5. Enter WRONG code ────────────────────────────────────
    let alertMsg = null;
    page.on('dialog', async dlg => {
      alertMsg = dlg.message();
      console.log(`🔔 Alert: "${alertMsg}"`);
      await dlg.dismiss();
    });

    const boxes = await page.$$('.otp-digit');
    expect(boxes.length).toBe(6);
    for (let i = 0; i < 6; i++) await boxes[i].fill('0');
    console.log('⌨️  Entered wrong OTP: 000000');
    await page.waitForTimeout(3500); // wait for backend round-trip + alert

    await page.screenshot({ path: path.join(RESULTS_DIR, 'B-otp-wrong-code.png') });
    console.log('📸 B-otp-wrong-code.png saved');

    // OTP view must still be visible
    expect(await page.isVisible('#otp-view')).toBe(true);
    // Inputs must be re-enabled
    const disabled = await page.$eval('.otp-digit', el => el.disabled);
    expect(disabled).toBe(false);
    console.log('✅ After wrong code: still on OTP view, inputs re-enabled');

    // ── 6. Enter CORRECT code ──────────────────────────────────
    const fresh = await page.$$('.otp-digit');
    for (const b of fresh) { await b.click(); await b.press('Control+a'); await b.press('Delete'); }
    await page.waitForTimeout(200);
    for (let i = 0; i < 6; i++) await fresh[i].fill(otp[i]);
    console.log(`⌨️  Entered correct OTP: ${otp}`);

    await page.waitForSelector('#main-view', { state: 'visible', timeout: 12000 });
    console.log('✅ Main tray visible — auth complete!');
    await page.screenshot({ path: path.join(RESULTS_DIR, 'C-otp-tray-success.png') });
    console.log('📸 C-otp-tray-success.png saved');

    const avatar = await page.$eval('#user-avatar', el => el.textContent.trim());
    console.log(`👤 Avatar: "${avatar}" (expected "P")`);
    expect(avatar).toBe('P');

    console.log('\n✅ Item 2 DONE: wrong→error state confirmed, correct→tray confirmed\n');

  } finally {
    await ctx.close();
  }
}, 120000); // 2 min total timeout
