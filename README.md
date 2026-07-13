# Capsule

A Chrome extension to capture an entire conversation from one AI chat tab and inject it into a different AI's chat window.

## Installation

1. Clone or download this repository.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked** and select the `Capsule` folder.

## How to use

1. Open an AI chat tab (e.g., ChatGPT, Claude, Gemini, Perplexity) with a conversation.
2. Click the Capsule extension icon in the toolbar.
3. Click "Capture This Chat".
4. A floating "Capsule" bubble will appear in the bottom right corner of the page.
5. Switch to another AI chat tab. The widget will persist.
6. Drag the floating capsule into the chat input box (or anywhere) and drop it to inject the chat history.

## Development (Writing new adapters)

Adapters handle extraction and injection for specific sites. Create a new file in `content/adapters/` (e.g., `mysite.js`):

```javascript
window.capsuleAdapters = window.capsuleAdapters || {};

window.capsuleAdapters.mysite = {
  matches: () => window.location.hostname.includes('mysite.com'),
  
  extractConversation: () => {
    // ... return an array of { role: 'user' | 'assistant', content: string }
  },

  insertIntoInput: (text) => {
    // ... inject text into the input field
    return true;
  }
};
```

Then add your adapter script to the `content_scripts.js` array in `manifest.json` before `content/index.js`.
