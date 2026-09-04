# 💊 Capsule

**Capture a chat from one AI, drop it into another.**  
*A Manifest V3 Chrome Extension for seamless cross-AI context transfer.*

[![Chrome Extension](https://img.shields.io/badge/chrome-Manifest%20V3-blue.svg)](https://developer.chrome.com/docs/extensions/mv3/)
[![Node.js](https://img.shields.io/badge/backend-Node.js%20%2F%20Express-green.svg)](https://nodejs.org/)
[![Playwright](https://img.shields.io/badge/testing-Playwright-45ba4b.svg)](https://playwright.dev/)
[![License: ISC](https://img.shields.io/badge/License-ISC-yellow.svg)](LICENSE)

---

## 📌 Overview

**Capsule** is a browser extension that allows you to seamlessly extract full conversation contexts from one AI platform (e.g. ChatGPT) and inject them into another (e.g. Claude, Gemini, or Perplexity) with a single click.

---

## ✨ Features

- **Cross-Platform Transfer**: Extract chats from ChatGPT, Claude, Gemini, or Perplexity and insert them into any other supported platform.
- **Glassmorphism Floating Widget**: Injected directly into AI chat interfaces for instant extraction and injection.
- **Local-First Storage**: Saves capsules securely in `chrome.storage.local`.
- **Node.js Auth & Storage Backend**: Includes optional JWT + SQLite authentication backend for user account management.
- **Playwright Test Suite**: 9 automated end-to-end integration tests verifying DOM injection adapters across supported platforms.

---

## 🌐 Supported Platforms

> Verified live against production sites using `tests/live-check.js`.

| Platform | Domain | Extraction | Injection | Input Field Support |
|:---|:---|:---:|:---:|:---:|
| **ChatGPT** | `chatgpt.com` | ✅ | ✅ | Full React state sync |
| **Claude** | `claude.ai` | ✅ | ✅ | ContentEditable / Textarea |
| **Gemini** | `gemini.google.com` | ✅ | ✅ | Custom Web Component |
| **Perplexity** | `perplexity.ai` | ✅ | ✅ | Textarea + React Event Dispatch |

---

## 🚀 Quickstart & Installation

### 1. Load Extension in Chrome

1. Clone repository:
   ```bash
   git clone https://github.com/nayefsiddique-eng/Capsule.git
   cd Capsule
   ```
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right.
4. Click **Load unpacked** and select the `Capsule` root directory.

### 2. (Optional) Run Auth Backend

```bash
cd backend
npm install
cp .env.example .env
npm start
```
*Backend runs locally at `http://localhost:5000` using SQLite and Ethereal SMTP for dev OTPs.*

---

## 🧪 Testing

Run the automated Playwright test suite across all 4 platform adapters:

```bash
npm install
npx playwright install chromium
npx playwright test
```

### Test Suite Results (9/9 Passing)

| Platform | Injection | Fallback Path | Persistence | Status |
|:---|:---:|:---:|:---:|:---:|
| **ChatGPT** | ✅ | ✅ | — | **PASS** |
| **Claude** | ✅ | ✅ | — | **PASS** |
| **Gemini** | ✅ | ✅ | — | **PASS** |
| **Perplexity** | ✅ | ✅ | — | **PASS** |
| **Floating Widget** | — | — | ✅ | **PASS** |

---

## 📁 Repository Structure

```
Capsule/
├── manifest.json                 # Chrome Extension Manifest V3
├── background.js                 # Service worker for background messaging
├── popup/                        # Extension Popup Interface
│   ├── popup.html                # Auth, tray, settings, and modal UI
│   ├── popup.css                 # Glassmorphism design system
│   └── popup.js                  # Capsule management & API sync
├── content/                      # Injected Content Scripts
│   ├── index.js                  # Adapter router & message handler
│   ├── widget.js                 # In-page floating widget UI
│   └── adapters/                 # Platform-specific DOM Adapters
│       ├── chatgpt.js            # chatgpt.com adapter
│       ├── claude.js             # claude.ai adapter
│       ├── gemini.js             # gemini.google.com adapter
│       └── perplexity.js         # perplexity.ai adapter
├── backend/                      # Auth API (Express + SQLite)
│   ├── server.js                 # JWT auth, OTP email, rate limiting
│   ├── db.js                     # SQLite database schema
│   └── .env.example
├── tests/                        # Playwright E2E Integration Tests
│   ├── injection.test.js
│   └── live-check.js
└── README.md
```

---

## 🔌 Adding a New Platform Adapter

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

Register it in `manifest.json`:
```json
{
  "matches": ["https://mysite.com/*"],
  "js": ["content/adapters/mysite.js", "content/index.js"]
}
```

---

## 🔒 Privacy & Security

- **100% Local Processing**: All conversation data remains strictly in `chrome.storage.local` on your device.
- **Scoped Host Permissions**: Permissions are restricted to supported AI domains only.
- **No Third-Party Telemetry**: Zero external tracking or analytics calls.

---

## 📜 License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.
