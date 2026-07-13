<p align="center">
  <img src="assets/banner.png" alt="Capsule" width="600" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/chrome-MV3-4285F4?style=flat-square&logo=googlechrome&logoColor=white" />
  <img src="https://img.shields.io/badge/tests-9%2F9-22c55e?style=flat-square" />
  <img src="https://img.shields.io/badge/license-ISC-a1a1aa?style=flat-square" />
  <img src="https://img.shields.io/badge/version-1.0.0-06b6d4?style=flat-square" />
</p>

<p align="center">
  <b>One-click capture & transfer of AI conversations across platforms.</b><br/>
  <sub>ChatGPT · Claude · Gemini · Perplexity</sub>
</p>

---

## Why Capsule?

Switching between AI platforms means losing context. Copy-pasting 50 messages, reformatting, and re-explaining your problem — every single time.

Capsule eliminates that. **One click** captures an entire conversation. **One drag** injects it into any other AI's chat input. Full context, zero friction.

---

## Features

- **One-Click Capture** — Extract a full conversation thread from any supported AI tab
- **Drag & Drop Injection** — Drop captured capsules directly into another AI's input field
- **Merge & Diff** — Drag capsules onto each other to combine or compare conversations
- **Context Menus** — Right-click → _Capture_ or _Inject_ without opening the popup
- **Persistent Storage** — Capsules survive tab closes, restarts, and navigations
- **Auto-Tagging** — Capsules are tagged by source platform automatically
- **Settings Panel** — Toggle floating widget, auto-tagging, and session persistence
- **Premium UI** — Dark glassmorphism interface with smooth transitions and custom typography

---

## Quick Start

```bash
git clone https://github.com/nayefsiddique-eng/Capsule.git
```

1. Open `chrome://extensions/` and enable **Developer Mode**
2. Click **Load unpacked** → select the `Capsule/` folder
3. Pin the Capsule icon in your toolbar
4. Open any supported AI chat → click the Capsule icon → **Capture**

---

## How It Works

```
┌─────────────────────────────────────────────────────────────┐
│  CAPTURE                                                    │
│                                                             │
│  Popup  ──►  background.js  ──►  content/index.js           │
│                                       │                     │
│                                  activeAdapter              │
│                                .extractConversation()       │
│                                       │                     │
│                                       ▼                     │
│                              chrome.storage.local           │
│                                 (saved capsule)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  INJECT                                                     │
│                                                             │
│  Widget drag/drop  ──►  activeAdapter.insertIntoInput()     │
│                              │                              │
│                    ┌─────────┼─────────┐                    │
│                    ▼         ▼         ▼                    │
│              contenteditable  textarea  clipboard           │
│              (innerHTML)    (native     (fallback +         │
│                              setter)    user alert)         │
└─────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
Capsule/
│
├── manifest.json                 # Chrome MV3 manifest
├── background.js                 # Service worker — context menus, messaging
├── package.json                  # Dev dependencies (Playwright)
│
├── popup/                        # Extension popup UI
│   ├── popup.html                #   Auth, tray, settings, modals
│   ├── popup.css                 #   Glassmorphism design system
│   └── popup.js                  #   Auth flow, capsule CRUD, drag & drop
│
├── content/                      # Content scripts (injected into AI sites)
│   ├── index.js                  #   Adapter detection, message handling
│   ├── widget.js                 #   Floating capsule widget
│   └── adapters/
│       ├── chatgpt.js            #   chatgpt.com
│       ├── claude.js             #   claude.ai
│       ├── gemini.js             #   gemini.google.com
│       └── perplexity.js         #   perplexity.ai
│
├── assets/
│   ├── icon{16,48,128}.png       #   Extension icons
│   └── fonts/                    #   Space Grotesk, JetBrains Mono
│
└── tests/
    ├── injection.test.js         #   Injection E2E (all 4 adapters)
    └── persistence.test.js       #   Widget state persistence
```

---

## Testing

```bash
npm install
npx playwright install chromium
npx playwright test
```

| Adapter | Injection | Fallback | Status |
|:--------|:---------:|:--------:|:------:|
| ChatGPT | ✅ | ✅ | Pass |
| Claude | ✅ | ✅ | Pass |
| Gemini | ✅ | ✅ | Pass |
| Perplexity | ✅ | ✅ | Pass |
| Persistence | ✅ | — | Pass |

---

## Adding a New Adapter

Create `content/adapters/mysite.js`:

```javascript
window.capsuleAdapters = window.capsuleAdapters || {};

window.capsuleAdapters.mysite = {
  matches: () => location.hostname.includes('mysite.com'),

  extractConversation: () => {
    return [...document.querySelectorAll('.message')].map(el => ({
      role: el.classList.contains('user') ? 'user' : 'assistant',
      content: el.textContent.trim()
    }));
  },

  insertIntoInput: async (text) => {
    const input = document.querySelector('textarea');
    if (!input) return false;
    const setter = Object.getOwnPropertyDescriptor(
      HTMLTextAreaElement.prototype, 'value'
    ).set;
    setter.call(input, text);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    return true;
  }
};
```

Then add the script and URL pattern to `manifest.json` under `content_scripts`.

---

## Privacy

Capsule runs **100% locally**. No data leaves your browser. All conversations are stored in `chrome.storage.local` on your machine. Host permissions are scoped to the 4 supported AI domains only.

---

## Roadmap

- [ ] Export as Markdown / JSON
- [ ] Cloud sync across devices
- [ ] More platforms — Copilot, DeepSeek, Grok
- [ ] Keyboard shortcuts (`Ctrl+Shift+C` / `Ctrl+Shift+V`)
- [ ] Full-text search across capsules
- [ ] Team sharing via link

---

<p align="center">
  <sub>ISC © <a href="https://github.com/nayefsiddique-eng">nayefsiddique-eng</a></sub>
</p>
