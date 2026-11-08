// Enable Side Panel opening on action click
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(console.error);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'START_SCRAPE') {
    // Run async scraper process in background
    runScraper(message.config).catch(err => {
      console.error(err);
      chrome.runtime.sendMessage({
        type: 'SCRAPE_ERROR',
        error: err.message || String(err)
      });
    });
  }
});

async function runScraper(config) {
  const dataset = [];

  for (let i = 0; i < config.urls.length; i++) {
    const rawUrl = config.urls[i];
    let targetUrl = rawUrl;

    // Simple protocol check, default to https if missing
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl;
    }

    try {
      chrome.runtime.sendMessage({
        type: 'SCRAPE_PROGRESS',
        message: `[${i + 1}/${config.urls.length}] Loading ${targetUrl}...`,
        status: 'info'
      });

      const tab = await chrome.tabs.create({ url: targetUrl, active: false });

      try {
        await waitForTabLoad(tab.id, 30000); // 30s timeout

        // Let JS render finish
        await new Promise(r => setTimeout(r, 800));

        // Inject content script
        await chrome.scripting.executeScript({
          target: { tabId: tab.id },
          files: ['content.js']
        });

        // Send message to extract
        const response = await chrome.tabs.sendMessage(tab.id, {
          type: 'EXTRACT_ELEMENTS',
          selectors: config.selectors
        });

        if (response && response.success) {
          dataset.push({
            url: targetUrl,
            status: 'success',
            data: response.data
          });
          chrome.runtime.sendMessage({
            type: 'SCRAPE_PROGRESS',
            message: `[${i + 1}/${config.urls.length}] Successfully extracted data.`,
            status: 'success'
          });
        } else {
          throw new Error('Content script failed or returned invalid response.');
        }

      } finally {
        await chrome.tabs.remove(tab.id).catch(() => {});
      }

    } catch (err) {
      console.warn(`Failed scraping ${targetUrl}`, err);
      dataset.push({
        url: targetUrl,
        status: 'error',
        error: err.message || String(err)
      });
      chrome.runtime.sendMessage({
        type: 'SCRAPE_PROGRESS',
        message: `[${i + 1}/${config.urls.length}] Error: ${err.message}`,
        status: 'error'
      });
    }
  }

  // Send completion message back to side panel
  chrome.runtime.sendMessage({
    type: 'SCRAPE_COMPLETE',
    dataset,
    config
  });
}

function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let timeoutId;

    const listener = (updatedTabId, changeInfo, tab) => {
      if (updatedTabId === tabId && changeInfo.status === 'complete') {
        cleanup();
        resolve();
      }
    };

    const cleanup = () => {
      clearTimeout(timeoutId);
      chrome.tabs.onUpdated.removeListener(listener);
    };

    chrome.tabs.onUpdated.addListener(listener);

    // Initial check just in case it loads immediately
    chrome.tabs.get(tabId, (tab) => {
      if (tab && tab.status === 'complete') {
        cleanup();
        resolve();
      }
    });

    timeoutId = setTimeout(() => {
      cleanup();
      reject(new Error(`Timeout waiting for tab ${tabId} to load after ${timeoutMs}ms`));
    }, timeoutMs);
  });
}