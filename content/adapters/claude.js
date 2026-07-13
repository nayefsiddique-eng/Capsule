// Claude Adapter for Capsule
window.capsuleAdapters = window.capsuleAdapters || {};

window.capsuleAdapters.claude = {
  matches: () => window.location.hostname.includes('claude.ai'),
  
  extractConversation: () => {
    const turns = [];
    // Claude DOM changes often. Let's try to find messages by looking for common classes or attributes.
    // As of recent versions, they often have data-testid="user-message" or similar, or we can use heuristics.
    // For now, let's use a generic heuristic: looking for the chat container.
    const elements = document.querySelectorAll('.font-user-message, .font-claude-response');
    
    elements.forEach((msg) => {
      const isUser = msg.classList.contains('font-user-message');
      turns.push({
        role: isUser ? 'user' : 'assistant',
        content: msg.textContent.trim(),
        index: turns.length
      });
    });
    
    return turns;
  },

  insertIntoInput: async (text) => {
    // 1. IDENTIFY INPUT TYPE
    // Claude uses ProseMirror for its input (contentEditable div).
    const input = document.querySelector('.ProseMirror');
    if (!input) {
      console.error('Capsule: Claude input not found');
      return false;
    }

    // 3. CORRECT APPROACH FOR ProseMirror
    input.focus();
    
    // Select all existing content
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(input);
    selection.removeAllRanges();
    selection.addRange(range);

    // document.execCommand('insertText') is the most reliable cross-editor method
    document.execCommand('insertText', false, text);
    
    // Dispatch input event to trigger React/ProseMirror state
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    
    // Verify insertion
    if (!input.textContent.includes(text.substring(0, 20).replace(/\n/g, ' '))) {
       console.warn('Capsule: Insertion verification failed for Claude');
    }

    // 4. VERIFY SEND BUTTON ACTIVATION & 6. FALLBACK
    return new Promise(resolve => {
      setTimeout(() => {
        // Find Claude's send button (often an aria-label "Send Message" or similar button next to input)
        // We will look for any disabled button near the input
        const sendBtn = input.closest('fieldset') ? input.closest('fieldset').querySelector('button[aria-label*="Send"]') : document.querySelector('button[aria-label*="Send"]');
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
