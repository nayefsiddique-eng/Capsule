// Gemini Adapter for Capsule
window.capsuleAdapters = window.capsuleAdapters || {};

window.capsuleAdapters.gemini = {
  matches: () => window.location.hostname.includes('gemini.google.com'),
  
  extractConversation: () => {
    const turns = [];
    const elements = document.querySelectorAll('.user-query-container, .response-container, model-response');
    
    elements.forEach((el) => {
      const isUser = el.tagName.toLowerCase() === 'user-query' || el.classList.contains('user-query-container');
      turns.push({
        role: isUser ? 'user' : 'assistant',
        content: el.textContent.trim(),
        index: turns.length
      });
    });
    
    return turns;
  },

  insertIntoInput: async (text) => {
    // 1. IDENTIFY INPUT TYPE
    // Gemini uses a contenteditable div inside a rich-textarea element.
    const input = document.querySelector('rich-textarea div[contenteditable="true"]') || document.querySelector('.ql-editor');
    if (!input) {
      console.error('Capsule: Gemini input not found');
      return false;
    }

    // 3. CORRECT APPROACH FOR contentEditable
    input.focus();
    
    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);

    // document.execCommand('insertText') to trigger internal events
    document.execCommand('insertText', false, text);
    
    // Dispatch input event for good measure
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // Verify insertion
    if (!input.textContent.includes(text.substring(0, 20).replace(/\n/g, ' '))) {
       console.warn('Capsule: Insertion verification failed for Gemini');
    }

    // 4. VERIFY SEND BUTTON ACTIVATION & 6. FALLBACK
    return new Promise(resolve => {
      setTimeout(() => {
        // Find Gemini's send button
        const sendBtn = document.querySelector('button[aria-label*="Send"]');
        const isDisabled = sendBtn && (sendBtn.disabled || sendBtn.hasAttribute('disabled') || sendBtn.getAttribute('aria-disabled') === 'true');
        
        if (isDisabled) {
          console.error('Capsule: Send button did not enable, falling back to clipboard');
          navigator.clipboard.writeText(text).then(() => {
            alert('Auto-insert failed — capsule copied, paste manually with Ctrl+V.');
            resolve(false);
          });
        } else {
          resolve(true);
        }
      }, 500);
    });
  }
};
