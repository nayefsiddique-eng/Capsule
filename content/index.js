// Main content script for Capsule

console.log('Capsule content script loaded.');

function getActiveAdapter() {
  if (!window.capsuleAdapters) return null;
  for (const [name, adapter] of Object.entries(window.capsuleAdapters)) {
    if (adapter.matches()) {
      return adapter;
    }
  }
  return null;
}

const adapter = getActiveAdapter();
if (adapter) {
  console.log('Capsule active adapter:', adapter);
  
  // Inject widget
  const widget = document.createElement('capsule-widget');
  document.body.appendChild(widget);

  function updateWidgetState() {
    chrome.storage.local.get(['activeCapsule', 'showWidget'], (result) => {
      const showWidgetSetting = result.showWidget !== false;
      if (result.activeCapsule && showWidgetSetting) {
        widget.show(result.activeCapsule);
      } else {
        widget.hide();
      }
    });
  }

  // Check initial storage state
  updateWidgetState();

  // Listen for storage changes to show/hide widget
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      if (changes.activeCapsule || changes.showWidget) {
        updateWidgetState();
      }
    }
  });

  // Handle widget drop
  widget.addEventListener('capsule-drop', async (e) => {
    const data = e.detail.data;
    if (data && data.turns) {
      // Format text
      const textToInject = data.turns.map(t => `[${t.role.toUpperCase()}]\n${t.content}`).join('\n\n');
      const success = await adapter.insertIntoInput(textToInject);
      if (success) {
        console.log('Capsule injected successfully!');
      } else {
        console.error('Capsule failed to inject.');
      }
    }
  });
  
  // Listen for messages from popup or background script
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'EXTRACT_CHAT') {
      const turns = adapter.extractConversation();
      sendResponse({ turns, success: true });
    } else if (request.action === 'INJECT_CHAT') {
      (async () => {
        const success = await adapter.insertIntoInput(request.text);
        sendResponse({ success });
      })();
      return true; // Keep message channel open for async response
    }
    return true;
  });
}
