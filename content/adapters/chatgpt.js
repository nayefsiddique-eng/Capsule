// ChatGPT Adapter for Capsule
window.capsuleAdapters = window.capsuleAdapters || {};

window.capsuleAdapters.chatgpt = {
  matches: () => window.location.hostname.includes('chatgpt.com'),
  
  extractConversation: () => {
    const turns = [];
    const elements = document.querySelectorAll('[data-message-author-role]');
    
    elements.forEach((el) => {
      const role = el.getAttribute('data-message-author-role');
      if (role === 'user' || role === 'assistant') {
        turns.push({
          role: role,
          content: el.textContent.trim(),
          index: turns.length
        });
      }
    });
    
    return turns;
  },

  insertIntoInput: async (text) => {
    // 1. IDENTIFY INPUT TYPE
    // ChatGPT uses a plain contenteditable <div> for its prompt input.
    const input = document.getElementById('prompt-textarea');
    if (!input) {
      console.error('Capsule: ChatGPT input not found');
      return false;
    }

    // Correct approach for contentEditable:
    input.focus();
    
    // Select existing content to replace it
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);

    // Simulate real input
    document.execCommand('insertText', false, text);
    
    // Dispatch input event to be safe
    input.dispatchEvent(new Event('input', { bubbles: true }));

    // 4. VERIFY SEND BUTTON ACTIVATION & 6. FALLBACK
    return new Promise(resolve => {
      setTimeout(() => {
        const sendBtn = document.querySelector('button[data-testid="send-button"]');
        const isDisabled = !sendBtn || sendBtn.disabled || sendBtn.hasAttribute('disabled') || sendBtn.getAttribute('aria-disabled') === 'true';
        
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
