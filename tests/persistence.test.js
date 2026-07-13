const { test, expect } = require('@playwright/test');
const path = require('path');

test.describe('Persistence Test', () => {
  test('widget restores state from chrome.storage on load', async ({ page }) => {
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
    
    // Load empty page
    await page.goto('about:blank');

    // Mock chrome storage
    const mockCapsule = {
      id: '123',
      title: 'Persistence Test',
      turns: [{ role: 'user', content: 'Test persist' }]
    };

    await page.evaluate((capsule) => {
      window.chrome = {
        storage: {
          local: {
            get: (keys, cb) => {
              setTimeout(() => cb({ activeCapsule: capsule }), 10);
            }
          },
          onChanged: {
            addListener: () => {}
          }
        },
        runtime: {
          onMessage: {
            addListener: () => {}
          }
        }
      };
      
      // Mock window.capsuleAdapters so index.js doesn't crash on active tab
      window.capsuleAdapters = {
        mock: {
          matches: () => true,
          extractConversation: () => {},
          insertIntoInput: () => {}
        }
      };
    }, mockCapsule);

    // Inject widget component
    await page.addScriptTag({ path: path.resolve(__dirname, '../content/widget.js') });
    
    // Inject index.js (this should read from storage and show the widget)
    await page.addScriptTag({ path: path.resolve(__dirname, '../content/index.js') });

    // Assert the data was passed correctly
    const widgetData = await page.waitForFunction(() => {
      const widget = document.querySelector('capsule-widget');
      return widget ? widget.capsuleData : null;
    });

    const data = await widgetData.jsonValue();
    expect(data.title).toBe('Persistence Test');

  });
});
