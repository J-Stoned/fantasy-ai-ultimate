// Background service worker for Fantasy AI Ultimate extension

// Handle cookie requests from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getCookies') {
    chrome.cookies.getAll({ domain: request.domain }, (cookies) => {
      sendResponse(cookies);
    });
    return true; // Keep channel open for async response
  }
  
  if (request.action === 'openFantasyAI') {
    chrome.tabs.create({ url: request.url });
  }
});

// Handle extension installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Fantasy AI Ultimate extension installed!');
  
  // Set up context menus
  chrome.contextMenus.create({
    id: 'import-league',
    title: 'Import this league to Fantasy AI',
    contexts: ['page'],
    documentUrlPatterns: [
      '*://football.fantasysports.yahoo.com/*',
      '*://baseball.fantasysports.yahoo.com/*',
      '*://fantasy.espn.com/*',
      '*://sleeper.app/*',
      '*://sleeper.com/*',
      '*://*.cbssports.com/fantasy/*',
      '*://draftkings.com/*',
      '*://fanduel.com/*'
    ]
  });
});

// Handle context menu clicks
chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'import-league') {
    // Inject the import script
    chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        // Trigger import from context menu
        const button = document.getElementById('fantasy-ai-import-btn');
        if (button) {
          button.click();
        } else {
          // Create and click a temporary button
          const tempButton = document.createElement('button');
          tempButton.id = 'fantasy-ai-import-btn';
          document.body.appendChild(tempButton);
          
          // Load content script if not already loaded
          const script = document.createElement('script');
          script.src = chrome.runtime.getURL('content.js');
          document.body.appendChild(script);
        }
      }
    });
  }
});

// Monitor tab updates to inject button on navigation
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    const fantasyPatterns = [
      /fantasy.*yahoo\.com/,
      /fantasy\.espn\.com/,
      /sleeper\.(app|com)/,
      /cbssports\.com.*fantasy/,
      /draftkings\.com/,
      /fanduel\.com/
    ];
    
    if (fantasyPatterns.some(pattern => pattern.test(tab.url))) {
      // Re-inject content script to ensure button appears
      chrome.scripting.executeScript({
        target: { tabId: tabId },
        files: ['content.js']
      });
    }
  }
});