/**
 * live-check.js — Real-site extraction + injection test (v2)
 *
 * Uses page.addScriptTag({path}) with --disable-web-security to bypass CSP,
 * matching how Chrome extensions inject content scripts.
 *
 * Usage: node tests/live-check.js
 */

const { chromium } = require('@playwright/test');
const path = require('path');
const fs   = require('fs');

const RESULTS_DIR = path.join(__dirname, '../live-results');

const SITES = [
  {
    name:       'ChatGPT',
    url:        'https://chatgpt.com',
    adapterKey: 'chatgpt',
    adapterFile: path.join(__dirname, '../content/adapters/chatgpt.js'),
  },
  {
    name:       'Claude',
    url:        'https://claude.ai',
    adapterKey: 'claude',
    adapterFile: path.join(__dirname, '../content/adapters/claude.js'),
  },
  {
    name:       'Gemini',
    url:        'https://gemini.google.com',
    adapterKey: 'gemini',
    adapterFile: path.join(__dirname, '../content/adapters/gemini.js'),
  },
  {
    name:       'Perplexity',
    url:        'https://www.perplexity.ai',
    adapterKey: 'perplexity',
    adapterFile: path.join(__dirname, '../content/adapters/perplexity.js'),
  }
];

const SAMPLE = '[USER]\nHello from Capsule live-check!\n[ASSISTANT]\nThis is a test injection.';

async function checkSite(browser, site) {
  const r = {
    name: site.name, url: site.url,
    turns: 0, inputFound: false, sendFound: false,
    injected: false, injectError: null, error: null
  };
  let page;
  try {
    page = await browser.newPage();
    page.on('pageerror', e => {}); // swallow — real site JS errors aren't our bug

    await page.goto(site.url, { waitUntil: 'domcontentloaded', timeout: 25000 });
    await page.waitForTimeout(4000); // let SPA render

    // Inject adapter code as a string via eval so CSP doesn't block
    // (this mirrors what chrome.scripting.executeScript does for extensions)
    const adapterCode = fs.readFileSync(site.adapterFile, 'utf8');
    await page.evaluate(code => { eval(code); }, adapterCode);  // eslint-disable-line no-eval

    // -- Extract conversation --
    const extractResult = await page.evaluate(key => {
      const adapter = window.capsuleAdapters && window.capsuleAdapters[key];
      if (!adapter) return { err: 'adapter not registered' };
      try {
        const turns = adapter.extractConversation();
        return { turns: Array.isArray(turns) ? turns : [] };
      } catch (e) {
        return { err: e.message };
      }
    }, site.adapterKey);

    if (extractResult.err) {
      r.error = `extract: ${extractResult.err}`;
    } else {
      r.turns = extractResult.turns.length;
    }

    // -- Check input field --
    const inputCheck = await page.evaluate(key => {
      const adapter = window.capsuleAdapters && window.capsuleAdapters[key];
      if (!adapter) return false;
      // Try to find the input the adapter would target
      return !!(
        document.querySelector('[contenteditable="true"]') ||
        document.querySelector('textarea') ||
        document.querySelector('rich-textarea')
      );
    }, site.adapterKey);
    r.inputFound = inputCheck;

    // -- Attempt injection --
    const injectResult = await page.evaluate(async ([key, text]) => {
      const adapter = window.capsuleAdapters && window.capsuleAdapters[key];
      if (!adapter) return { ok: false, err: 'no adapter' };
      try {
        const ok = await adapter.insertIntoInput(text);
        return { ok };
      } catch (e) {
        return { ok: false, err: e.message };
      }
    }, [site.adapterKey, SAMPLE]);

    r.injected    = injectResult.ok;
    r.injectError = injectResult.err || null;

    // Screenshot
    const ss = path.join(RESULTS_DIR, `livecheck-${site.adapterKey}.png`);
    await page.screenshot({ path: ss });
    r.screenshot = ss;

  } catch (e) {
    r.error = e.message.substring(0, 120);
  } finally {
    if (page) await page.close().catch(() => {});
  }
  return r;
}

async function main() {
  if (!fs.existsSync(RESULTS_DIR)) fs.mkdirSync(RESULTS_DIR, { recursive: true });

  console.log('\n🔍 Capsule Live-Check v2 — Real Site Extraction + Injection\n');
  console.log('='.repeat(62));

  // --disable-web-security lets eval'd code run without CSP blocking,
  // matching what the Chrome extension runtime does when injecting scripts.
  const browser = await chromium.launch({
    headless: false,
    slowMo: 150,
    args: ['--disable-web-security', '--disable-site-isolation-trials', '--no-sandbox']
  });

  const results = [];
  for (const site of SITES) {
    process.stdout.write(`  ${site.name.padEnd(12)} ... `);
    const r = await checkSite(browser, site);
    results.push(r);
    if (r.error) console.log(`❌  ${r.error}`);
    else console.log(`✅  ${r.turns} turns extracted | inject: ${r.injected ? '✅' : '❌' + (r.injectError ? ' (' + r.injectError + ')' : '')}`);
  }

  await browser.close();

  console.log('\n📊 RESULTS TABLE\n' + '='.repeat(62));
  console.log(`${'Site'.padEnd(12)} | ${'Turns'.padEnd(6)} | ${'Input?'.padEnd(7)} | ${'Inject?'.padEnd(8)} | Error`);
  console.log('-'.repeat(62));
  for (const r of results) {
    console.log(
      `${r.name.padEnd(12)} | ${String(r.turns).padEnd(6)} | ${(r.inputFound?'Yes':'No').padEnd(7)} | ${(r.injected?'Yes':'No').padEnd(8)} | ${r.error||r.injectError||''}`
    );
  }

  fs.writeFileSync(
    path.join(RESULTS_DIR, 'livecheck-results.json'),
    JSON.stringify(results, null, 2)
  );
  console.log('\n📁 Results: live-results/livecheck-results.json');
  console.log('📸 Screenshots: live-results/livecheck-*.png\n');
}

main().catch(console.error);
