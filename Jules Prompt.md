
# Task: Build Manifest V3 Side-Panel Web Scraper Extension

## Objective
Generate a complete, fully functional, zero-build Manifest V3 browser extension for Chromium browsers (Chrome/Brave). The extension must run strictly inside the Chromium Side Panel API (`chrome.sidePanel`) and operate as an automated batch web scraper. It must sequentially open target URLs, extract DOM elements based on dynamic CSS selectors, format results into either Wide or Long schema, and download the resulting CSV into organized subfolders using `chrome.downloads`.

---

## Workspace & Target Architecture
Deliver a self-contained root folder containing exactly five source files without external bundling or node build dependencies:


```

batch-scraper/
├── manifest.json       # Manifest V3 configuration with sidePanel & downloads
├── sidepanel.html      # Persistent Dark-Mode Control Center UI
├── sidepanel.js        # UI controller, storage manager, CSV formatter & downloader
├── background.js       # Service worker: tab lifecycle manager & scraper orchestrator
└── content.js          # Injected DOM extraction script

```

### Prohibitions & Hard Constraints
- **UI Interface:** Do not use a popup window (`default_popup`). The extension MUST use `chrome.sidePanel` and set `openPanelOnActionClick: true`.
- **File System API:** Do NOT use the HTML5 File System Access API (`showSaveFilePicker`), IndexedDB file stores, or anchor click simulations (`<a download>`). All CSV saves must strictly use `chrome.downloads.download`.
- **Zero Build Tools:** Do not use Vite, Webpack, Babel, or npm dependencies. Use standard ES6+ vanilla JavaScript, HTML5, and CSS.

---

## File-by-File Technical Specifications

### 1. `manifest.json`
- **Manifest Version:** `3`
- **Permissions Required:**
  - `"sidePanel"`
  - `"tabs"`
  - `"scripting"`
  - `"storage"`
  - `"downloads"`
- **Host Permissions:** `["<all_urls>"]`
- **Background Configuration:** `"service_worker": "background.js"`
- **Side Panel Configuration:** `"default_path": "sidepanel.html"`
- **Action:** Define an empty `action` object to allow clicking the extension icon to toggle the side panel.

---

### 2. `sidepanel.html`
Design a responsive, dark-mode sidebar layout containing the following dedicated sections:
1. **Profile Management:**
   - Dropdown (`<select id="profileSelect">`) to view and load saved profiles.
   - Delete button for the selected profile.
   - Text input (`#profileName`) and "Save Profile" button.
2. **URL Input Area:**
   - `<textarea id="urlList">` accepting multi-line URLs (one per line).
3. **Dynamic CSS Selectors Container:**
   - Container `#selectorsContainer` holding dynamic 2-input rows: **Column Label** (e.g., `Title`) and **CSS Selector** (e.g., `h1.product-title`).
   - A button `+ Add Selector` to dynamically append selector pairs.
   - Per-row remove button (`✕`).
4. **Schema Toggle:**
   - Radio buttons or dropdown selecting between:
     - `wide`: Wide Schema (one record/row per item, selectors spread horizontally).
     - `long`: Long Schema (Entity-Attribute-Value layout: `URL`, `Timestamp`, `Status`, `Selector_Label`, `CSS_Selector`, `Match_Index`, `Extracted_Value`).
5. **Execution Controls & Status:**
   - Primary action button `#startScrapeBtn` ("Start Scraping").
   - Scrollable terminal-style status log (`#statusLog`) showing real-time timestamps and execution messages.

---

### 3. `sidepanel.js`
Implement four primary modules in vanilla JavaScript:

1. **Profile Persistence (`chrome.storage.local`):**
   - Save profiles as an object map under a root key (e.g., `scraper_profiles`).
   - Saving bundles: `profileName`, `urls` (array), `selectors` (array of `{label, query}`), and `schema`.
   - Selecting a profile from the dropdown repopulates all inputs, regenerates selector rows, and sets the active schema radio button.
2. **Scrape Dispatching:**
   - Validate inputs: ensure at least one URL and one CSS selector are configured.
   - Disable the "Start Scraping" button and show progress state.
   - Send runtime message `{ type: "START_SCRAPE", config: { profileName, urls, selectors, schema } }` to `background.js`.
3. **Message Listener & Status Reporting:**
   - Listen for `SCRAPE_PROGRESS` messages from `background.js` and append color-coded log entries to `#statusLog`.
   - Listen for `SCRAPE_ERROR` to unlock UI and log errors.
   - Listen for `SCRAPE_COMPLETE` carrying the aggregated dataset.
4. **CSV Transformation & Download:**
   - Implement `convertToCSV(results, config)`:
     - Handle RFC 4180 CSV escaping (wrap fields in double quotes, escape existing internal quotes `""`, and replace linebreaks).
     - Generate headers and rows according to the selected schema (`wide` vs `long`).
   - Create a Blob URL from the UTF-8 encoded CSV string (`\uFEFF` BOM prefix included).
   - Sanitize `profileName` (strip non-alphanumeric characters) to avoid directory traversal.
   - Trigger `chrome.downloads.download`:
     ```javascript
     chrome.downloads.download({
       url: blobUrl,
       filename: `ScraperProfiles/${sanitizedProfileName}/dataset_${schema}_${timestamp}.csv`,
       saveAs: false,
       conflictAction: "uniquify"
     });
     ```
   - Revoke the Blob URL after completion.

---

### 4. `background.js` (Service Worker)
Orchestrate sequential tab management and coordinate scraping without crashing service worker lifecycles:

1. **Panel Behavior Setup:**
   - Call `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })` on initialization.
2. **Sequential Batch Scraper Loop:**
   - On receiving `START_SCRAPE`, loop through `urls` sequentially:
     - Validate URL syntax (enforce `http:` / `https:` protocols).
     - Create a tab: `const tab = await chrome.tabs.create({ url: targetUrl, active: true });`.
     - Implement a robust `waitForTabLoad(tabId, timeoutMs)` using `chrome.tabs.onUpdated` (with a 25–30 second timeout fallback).
     - Add a short settle delay (e.g., 500–800ms) to accommodate basic client-side rendering.
     - Programmatically inject the content script:
       ```javascript
       await chrome.scripting.executeScript({
         target: { tabId },
         files: ["content.js"]
       });
       ```
     - Send `{ type: "EXTRACT_ELEMENTS", selectors }` to the tab via `chrome.tabs.sendMessage` and await the scraped payload.
     - Always close the tab in a `finally` block via `chrome.tabs.remove(tabId)`.
     - Dispatch progress updates (`SCRAPE_PROGRESS`) to the side panel after each URL finishes.
3. **Aggregate & Return:**
   - Aggregate all extracted data and dispatch `SCRAPE_COMPLETE` with the complete dataset back to the side panel.

---

### 5. `content.js` (DOM Scraper)
1. **Idempotence Guard:**
   - Ensure the script guards against multiple injections using a window flag (e.g., `window.__batchScraperInjected`).
2. **Extraction Logic:**
   - Listen for `{ type: "EXTRACT_ELEMENTS", selectors }`.
   - For each selector `{ label, query }`:
     - Safely execute `document.querySelectorAll(query)`.
     - Extract values intelligently:
       - For `<img>` tags: extract `src`, `data-src`, or `alt`.
       - For `<input>`, `<textarea>`, `<select>`: extract `value`.
       - For generic tags: extract `.innerText` or `.textContent` (trimmed).
       - Fallback to `href` for `<a>` tags if no text exists.
     - Handle syntax errors in invalid CSS selectors gracefully without throwing unhandled exceptions.
   - Reply to the background worker with `{ success: true, data: extractedData }`.

---

## Acceptance Criteria
- [ ] Extension loads unpacked in Developer Mode on Chrome/Brave without manifest errors or permission warnings.
- [ ] Clicking the browser action icon automatically opens the Side Panel interface.
- [ ] Profile Manager creates, saves, lists, updates, and deletes profiles from `chrome.storage.local`.
- [ ] Dynamic selector builder allows adding and removing arbitrary numbers of CSS selector pairs.
- [ ] Scraping executes strictly sequentially: opens a single tab, waits for load, extracts data, closes the tab, and advances to the next URL.
- [ ] Both Wide and Long CSV schemas format correctly with RFC 4180 escaping for commas and quotes.
- [ ] CSV file downloads directly to `Downloads/ScraperProfiles/<ProfileName>/...` via `chrome.downloads.download`.
- [ ] Invalid URLs or missing DOM selectors log warnings and do not break the batch loop.