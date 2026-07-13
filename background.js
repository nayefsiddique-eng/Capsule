chrome.runtime.onInstalled.addListener(() => {
  console.log('Capsule extension installed.');
  
  chrome.contextMenus.create({
    id: "capture-chat",
    title: "Capture Conversation",
    contexts: ["page"]
  });

  chrome.contextMenus.create({
    id: "inject-last-capsule",
    title: "Inject Last Capsule",
    contexts: ["editable"]
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "capture-chat") {
    chrome.tabs.sendMessage(tab.id, { action: "EXTRACT_CHAT" }, (response) => {
      if (chrome.runtime.lastError || !response || !response.success) {
        console.error("Capture failed or not supported on this page");
        return;
      }
      
      const hostname = new URL(tab.url).hostname;
      const siteName = hostname.includes('chatgpt') ? 'ChatGPT' : 
                       hostname.includes('claude') ? 'Claude' :
                       hostname.includes('gemini') ? 'Gemini' :
                       hostname.includes('perplexity') ? 'Perplexity' : 'Unknown';
      
      chrome.storage.local.get(['savedCapsules', 'enableAutoTagging'], (res) => {
        const capsules = res.savedCapsules || [];
        const autoTagging = res.enableAutoTagging !== false;
        
        const generateTags = (turns) => {
          if (!autoTagging) return ['General'];
          const text = turns.map(t => t.content).join(' ').toLowerCase();
          const tags = [];
          if (text.includes('function') || text.includes('const') || text.includes('console.log')) tags.push('Code');
          if (text.includes('error') || text.includes('bug') || text.includes('fix')) tags.push('Debugging');
          if (tags.length === 0) tags.push('General');
          return tags.slice(0, 2);
        };

        const capsule = {
          id: crypto.randomUUID(),
          sourceSite: siteName,
          capturedAt: Date.now(),
          title: response.turns[0]?.content.substring(0, 30) + '...' || 'New Chat',
          turns: response.turns,
          tags: generateTags(response.turns)
        };

        capsules.push(capsule);
        chrome.storage.local.set({ savedCapsules: capsules, activeCapsule: capsule });
      });
    });
  } else if (info.menuItemId === "inject-last-capsule") {
    chrome.storage.local.get(['activeCapsule'], (res) => {
      if (res.activeCapsule && res.activeCapsule.turns) {
        const textToInject = res.activeCapsule.turns.map(t => `[${t.role.toUpperCase()}]\n${t.content}`).join('\n\n');
        chrome.tabs.sendMessage(tab.id, { action: "INJECT_CHAT", text: textToInject });
      }
    });
  }
});
