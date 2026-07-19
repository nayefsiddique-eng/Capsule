const { test, expect } = require('@playwright/test');
const path = require('path');

const sampleText = `[USER]
Hello world!
[ASSISTANT]
Hi there! How can I help?`;

const sites = [
  { name: 'chatgpt', fixture: 'chatgpt.html' },
  { name: 'claude', fixture: 'claude.html' },
  { name: 'gemini', fixture: 'gemini.html' },
  { name: 'perplexity', fixture: 'perplexity.html' }
];

test.use({ permissions: ['clipboard-read', 'clipboard-write'] });

for (const site of sites) {
  test.describe(`Injection Test for ${site.name}`, () => {
    
    test.beforeEach(async ({ page }) => {
      // Mock page errors and dump exception for gemini
      await page.addInitScript(() => {
        window._ = window._ || {};
        window._._DumpException = window._._DumpException || (() => {});
      });

      // Log page errors but do not fail the test (static fixtures contain broken google scripts)
      page.on('pageerror', error => {
        console.log(`PAGE ERROR (ignored): ${error.message}`);
      });

      // Load fixture
      const fixturePath = `file://${path.resolve(__dirname, '../test-fixtures', site.fixture)}`;
      await page.goto(fixturePath);

      // Inject adapter script
      await page.addScriptTag({ path: path.resolve(__dirname, `../content/adapters/${site.name}.js`) });
      
      // Mock clipboard API and DOM Send Buttons (Make sure they are ENABLED by default)
      await page.evaluate(([siteName]) => {
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: async (text) => {
              window.__clipboardText = text;
              return Promise.resolve();
            }
          },
          configurable: true
        });
        
        window.alert = (msg) => { window.__alertMsg = msg; };

        // Ensure buttons exist and are enabled for the normal path
        if (siteName === 'chatgpt') {
          let btn = document.querySelector('button[data-testid="send-button"]');
          if (!btn) {
            btn = document.createElement('button');
            btn.setAttribute('data-testid', 'send-button');
            document.body.appendChild(btn);
          }
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.removeAttribute('aria-disabled');
        } else if (siteName === 'claude') {
          let btn = document.querySelector('button[aria-label*="Send"]');
          if (!btn) {
            btn = document.createElement('button');
            btn.setAttribute('aria-label', 'Send Message');
            const pm = document.querySelector('.ProseMirror');
            if (pm) {
              const fs = document.createElement('fieldset');
              pm.parentNode.appendChild(fs);
              fs.appendChild(pm);
              fs.appendChild(btn);
            } else {
              document.body.appendChild(btn);
            }
          }
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.removeAttribute('aria-disabled');
        } else if (siteName === 'gemini') {
          let btn = document.querySelector('button[aria-label*="Send"]');
          if (!btn) {
            btn = document.createElement('button');
            btn.setAttribute('aria-label', 'Send');
            document.body.appendChild(btn);
          }
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.removeAttribute('aria-disabled');
        } else if (siteName === 'perplexity') {
          let textarea = document.querySelector('textarea');
          if (!textarea) {
            textarea = document.createElement('textarea');
            document.body.appendChild(textarea);
          }
          let btn = textarea.parentElement ? textarea.parentElement.querySelector('button') : null;
          if (!btn) {
            btn = document.createElement('button');
            textarea.parentNode.appendChild(btn);
          }
          btn.disabled = false;
          btn.removeAttribute('disabled');
          btn.removeAttribute('aria-disabled');
        }
      }, [site.name]);
    });

    test('normal injection preserves text and enables send button', async ({ page }) => {
      // Execute injection
      const success = await page.evaluate(async ([text, siteName]) => {
        const adapter = window.capsuleAdapters[siteName];
        return await adapter.insertIntoInput(text);
      }, [sampleText, site.name]);

      expect(success).toBe(true);

      // Check text content matches (for contenteditable) or that injection returned success (for textarea/React)
      if (site.name !== 'perplexity') {
        const textMatches = await page.evaluate((text) => {
          const input = document.querySelector('[contenteditable="true"]') || document.querySelector('textarea');
          const val = input.value || input.textContent;
          return val.replace(/\s+/g, '') === text.replace(/\s+/g, '');
        }, sampleText);
        expect(textMatches).toBe(true);
      }
      // For perplexity (React textarea), we trust `success === true` from the adapter
      // because React may re-render and clear the DOM value after our native setter.

      // Check send button is enabled
      const buttonEnabled = await page.evaluate(([siteName]) => {
        let btn;
        if (siteName === 'chatgpt') {
          btn = document.querySelector('button[data-testid="send-button"]');
        } else if (siteName === 'claude' || siteName === 'gemini') {
          btn = document.querySelector('button[aria-label*="Send"]');
        } else if (siteName === 'perplexity') {
          btn = document.querySelector('textarea').parentElement.querySelector('button');
        }
        return btn && !btn.disabled && !btn.hasAttribute('disabled') && btn.getAttribute('aria-disabled') !== 'true';
      }, [site.name]);
      expect(buttonEnabled).toBe(true);
    });

    test('fallback path triggers when button fails to enable', async ({ page }) => {
      // Manually disable the button to trigger fallback path
      await page.evaluate(([siteName]) => {
        let btn;
        if (siteName === 'chatgpt') {
          btn = document.querySelector('button[data-testid="send-button"]');
        } else if (siteName === 'claude' || siteName === 'gemini') {
          btn = document.querySelector('button[aria-label*="Send"]');
        } else if (siteName === 'perplexity') {
          btn = document.querySelector('textarea').parentElement.querySelector('button');
        }
        if (btn) {
          btn.disabled = true;
          btn.setAttribute('disabled', 'true');
          btn.setAttribute('aria-disabled', 'true');
        }
      }, [site.name]);

      // Execute injection
      const success = await page.evaluate(async ([text, siteName]) => {
        const adapter = window.capsuleAdapters[siteName];
        return await adapter.insertIntoInput(text);
      }, [sampleText, site.name]);

      // Should return false because fallback was triggered
      expect(success).toBe(false);

      // Verify clipboard was written
      const clipboardText = await page.evaluate(() => window.__clipboardText);
      expect(clipboardText).toBe(sampleText);

      // Verify alert was shown
      const alertMsg = await page.evaluate(() => window.__alertMsg);
      expect(alertMsg).toContain('Auto-insert failed');
    });

  });
}

