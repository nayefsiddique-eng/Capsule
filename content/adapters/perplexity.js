// Perplexity Adapter for Capsule
window.capsuleAdapters = window.capsuleAdapters || {};

window.capsuleAdapters.perplexity = {
  matches: () => window.location.hostname.includes('perplexity.ai'),
  
  extractConversation: () => {
    const turns = [];
    const elements = document.querySelectorAll('.break-words, [data-renderer="lm"]');
    
    elements.forEach((el) => {
      // Exclude generic containers if possible
      if (el.tagName === 'svg' || el.children.length > 5) return;
      
      const isUser = el.classList.contains('break-words') && !el.hasAttribute('data-renderer');
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
    // Perplexity uses a React-controlled <textarea>.
    const input = document.querySelector('textarea');
    if (!input) {
      console.error('Capsule: Perplexity input not found');
      return false;
    }

    // 2. CORRECT APPROACH FOR React <textarea>
    input.focus();
    
    const nativeSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype, "value"
    ).set;
    
    nativeSetter.call(input, text);
    
    // Dispatch both input and change events
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));

    // 4. VERIFY SEND BUTTON ACTIVATION & 6. FALLBACK
    return new Promise(resolve => {
      setTimeout(() => {
        // Find Perplexity's send button (typically a button near the textarea with an icon or aria-label)
        // We look for a generic button inside the input container that might be disabled
        const sendBtn = input.parentElement ? input.parentElement.querySelector('button') : null;
        const isDisabled = sendBtn && (sendBtn.disabled || sendBtn.hasAttribute('disabled'));
        
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
