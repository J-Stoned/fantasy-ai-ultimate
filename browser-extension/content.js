// Fantasy AI Ultimate - 1-Click Import Extension

(function() {
  'use strict';

  // Configuration
  const FANTASY_AI_URL = 'https://fantasy-ai-ultimate.com';
  const BUTTON_ID = 'fantasy-ai-import-btn';

  // Platform detection
  function detectPlatform() {
    const hostname = window.location.hostname;
    
    if (hostname.includes('yahoo.com')) return 'yahoo';
    if (hostname.includes('espn.com')) return 'espn';
    if (hostname.includes('sleeper')) return 'sleeper';
    if (hostname.includes('cbssports.com')) return 'cbs';
    if (hostname.includes('draftkings.com')) return 'draftkings';
    if (hostname.includes('fanduel.com')) return 'fanduel';
    
    return null;
  }

  // Extract league URL
  function getCurrentLeagueUrl() {
    return window.location.href;
  }

  // Extract cookies for ESPN (since they don't have OAuth)
  async function getEspnAuth() {
    if (detectPlatform() !== 'espn') return null;

    try {
      const cookies = await chrome.runtime.sendMessage({
        action: 'getCookies',
        domain: '.espn.com'
      });

      const espnS2 = cookies.find(c => c.name === 'espn_s2');
      const swid = cookies.find(c => c.name === 'SWID');

      if (espnS2 && swid) {
        return {
          espn_s2: espnS2.value,
          swid: swid.value.replace(/[{}]/g, '') // Remove curly braces
        };
      }
    } catch (error) {
      console.error('Failed to get ESPN cookies:', error);
    }
    
    return null;
  }

  // Create the import button
  function createImportButton() {
    const button = document.createElement('button');
    button.id = BUTTON_ID;
    button.innerHTML = `
      <span class="fai-icon">🚀</span>
      <span class="fai-text">Import to Fantasy AI</span>
    `;
    button.className = 'fantasy-ai-import-button';
    
    // Add loading state
    button.dataset.state = 'ready';
    
    return button;
  }

  // Handle import click
  async function handleImport(button) {
    const platform = detectPlatform();
    const leagueUrl = getCurrentLeagueUrl();
    
    if (!platform) {
      alert('Platform not recognized');
      return;
    }

    // Update button state
    button.dataset.state = 'loading';
    button.querySelector('.fai-text').textContent = 'Importing...';

    try {
      // For ESPN, get auth cookies
      let authData = null;
      if (platform === 'espn') {
        authData = await getEspnAuth();
        if (!authData) {
          throw new Error('Could not retrieve ESPN authentication. Please make sure you are logged in.');
        }
      }

      // Send to Fantasy AI
      const response = await fetch(`${FANTASY_AI_URL}/api/extension/import`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform,
          url: leagueUrl,
          authData,
          extensionVersion: '1.0.0'
        })
      });

      const result = await response.json();

      if (result.success) {
        button.dataset.state = 'success';
        button.querySelector('.fai-text').textContent = 'Imported!';
        
        // Open Fantasy AI in new tab
        setTimeout(() => {
          window.open(`${FANTASY_AI_URL}/dashboard?imported=true`, '_blank');
        }, 1000);
      } else if (result.requiresAuth) {
        // Redirect to auth flow
        window.open(result.authUrl, '_blank');
      } else {
        throw new Error(result.message || 'Import failed');
      }
    } catch (error) {
      button.dataset.state = 'error';
      button.querySelector('.fai-text').textContent = 'Import Failed';
      console.error('Import error:', error);
      alert(`Import failed: ${error.message}`);
      
      // Reset button after 3 seconds
      setTimeout(() => {
        button.dataset.state = 'ready';
        button.querySelector('.fai-text').textContent = 'Import to Fantasy AI';
      }, 3000);
    }
  }

  // Find the best place to insert the button
  function findButtonLocation() {
    const platform = detectPlatform();
    const selectors = {
      yahoo: [
        '.league-header', 
        '#league-header',
        '.Fz-m',
        'header[role="banner"]'
      ],
      espn: [
        '.league--header',
        '.Nav__Primary__Menu',
        '.league-header',
        '.page-header'
      ],
      sleeper: [
        '.league-header',
        '.nav-header',
        '[class*="LeagueHeader"]'
      ],
      cbs: [
        '.league-header',
        '.pageHeader',
        '#leagueHeader'
      ],
      draftkings: [
        '.contest-header',
        '.league-header',
        '[data-test="contest-header"]'
      ],
      fanduel: [
        '.contest-header',
        '.league-detail-header',
        '[class*="ContestHeader"]'
      ]
    };

    const platformSelectors = selectors[platform] || [];
    
    for (const selector of platformSelectors) {
      const element = document.querySelector(selector);
      if (element) return element;
    }

    // Fallback to body
    return document.body;
  }

  // Insert the import button
  function insertButton() {
    // Don't insert if already exists
    if (document.getElementById(BUTTON_ID)) return;

    const button = createImportButton();
    const location = findButtonLocation();
    
    // Position based on location
    if (location === document.body) {
      button.style.position = 'fixed';
      button.style.top = '20px';
      button.style.right = '20px';
      button.style.zIndex = '9999';
    }
    
    location.appendChild(button);
    
    // Add click handler
    button.addEventListener('click', () => handleImport(button));
  }

  // Check if we're on a league page
  function isLeaguePage() {
    const url = window.location.href;
    const leaguePatterns = [
      /league/i,
      /contest/i,
      /team/i,
      /roster/i
    ];
    
    return leaguePatterns.some(pattern => pattern.test(url));
  }

  // Initialize
  function init() {
    if (!isLeaguePage()) return;
    
    // Insert button after page loads
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', insertButton);
    } else {
      // Small delay to ensure page elements are loaded
      setTimeout(insertButton, 1000);
    }

    // Re-insert on navigation (for SPAs)
    let lastUrl = location.href;
    new MutationObserver(() => {
      const url = location.href;
      if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(insertButton, 1000);
      }
    }).observe(document, { subtree: true, childList: true });
  }

  init();
})();