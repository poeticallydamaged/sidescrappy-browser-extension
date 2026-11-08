if (typeof window.__batchScraperInjected === 'undefined') {
  window.__batchScraperInjected = true;

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'EXTRACT_ELEMENTS') {
      const selectors = message.selectors || [];
      const extractedData = {};

      selectors.forEach(sel => {
        extractedData[sel.label] = [];
        try {
          const elements = document.querySelectorAll(sel.query);
          elements.forEach(el => {
            let value = '';

            const tagName = el.tagName.toLowerCase();
            if (tagName === 'img') {
              value = el.getAttribute('src') || el.getAttribute('data-src') || el.getAttribute('alt') || '';
            } else if (tagName === 'input' || tagName === 'textarea' || tagName === 'select') {
              value = el.value || '';
            } else {
              value = (el.innerText || el.textContent || '').trim();
              if (!value && tagName === 'a') {
                value = el.getAttribute('href') || '';
              }
            }

            extractedData[sel.label].push(value);
          });
        } catch (e) {
          console.warn(`Invalid CSS Selector for label "${sel.label}": ${sel.query}`, e);
          // Let it remain empty rather than throwing
        }
      });

      sendResponse({ success: true, data: extractedData });
    }

    // Return true to indicate asynchronous response if we ever use promises,
    // but here we reply synchronously. We don't strictly need to return true,
    // but it's good practice just in case.
    return false;
  });
}