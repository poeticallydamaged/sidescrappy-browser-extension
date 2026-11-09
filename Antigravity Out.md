Below is the complete, zero-build Manifest V3 codebase for the Side Panel Web Scraper extension. It uses vanilla HTML, CSS, and JavaScript, supports dynamic CSS selector pairs (Column Label + Selector), handles both Long and Wide CSV schemas, and uses `chrome.downloads` to organize exports into profile-named subfolders.

---

### 1. `manifest.json`

Configures the Manifest V3 service worker, Side Panel behavior, required permissions, and universal host access.

```json
{
  "manifest_version": 3,
  "name": "SidePanel Batch Scraper",
  "version": "1.0.0",
  "description": "Sequential multi-URL CSS selector scraper with Long/Wide CSV export.",
  "permissions": [
    "sidePanel",
    "tabs",
    "scripting",
    "storage",
    "downloads"
  ],
  "host_permissions": [
    "<all_urls>"
  ],
  "background": {
    "service_worker": "background.js"
  },
  "side_panel": {
    "default_path": "sidepanel.html"
  },
  "action": {
    "default_title": "Open Batch Scraper"
  }
}

```

---

### 2. `sidepanel.html`

Provides a persistent, dark-mode control interface with dynamic selector management, profile controls, schema selection, and real-time logging.

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Batch Scraper</title>
  <style>
    :root {
      --bg: #121316;
      --surface: #1e2026;
      --border: #2e323b;
      --text: #e2e4e9;
      --muted: #8b92a5;
      --accent: #6366f1;
      --accent-hover: #4f46e5;
      --danger: #ef4444;
      --success: #10b981;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background-color: var(--bg);
      color: var(--text);
      padding: 14px;
      font-size: 13px;
      line-height: 1.4;
    }

    h2 {
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 10px;
      color: var(--text);
      letter-spacing: 0.3px;
    }

    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 12px;
      margin-bottom: 12px;
    }

    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--muted);
      margin-bottom: 5px;
    }

    input[type="text"],
    select,
    textarea {
      width: 100%;
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      padding: 7px 9px;
      border-radius: 4px;
      font-size: 12px;
      font-family: inherit;
      outline: none;
    }

    input[type="text"]:focus,
    select:focus,
    textarea:focus {
      border-color: var(--accent);
    }

    textarea {
      resize: vertical;
      min-height: 90px;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      white-space: pre;
    }

    .row {
      display: flex;
      gap: 6px;
      align-items: center;
      margin-bottom: 8px;
    }

    button {
      background: var(--accent);
      color: #fff;
      border: none;
      border-radius: 4px;
      padding: 7px 11px;
      font-size: 12px;
      font-weight: 500;
      cursor: pointer;
      transition: background 0.15s;
    }

    button:hover {
      background: var(--accent-hover);
    }

    button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .btn-secondary {
      background: #2b2f3a;
      color: var(--text);
    }

    .btn-secondary:hover {
      background: #373c4a;
    }

    .btn-danger {
      background: transparent;
      border: 1px solid var(--danger);
      color: var(--danger);
      padding: 5px 8px;
    }

    .btn-danger:hover {
      background: var(--danger);
      color: #fff;
    }

    .btn-block {
      width: 100%;
      padding: 10px;
      font-size: 13px;
      font-weight: 600;
    }

    .selector-row {
      display: grid;
      grid-template-columns: 1fr 1.5fr auto;
      gap: 6px;
      margin-bottom: 6px;
    }

    .schema-group {
      display: flex;
      gap: 14px;
      margin-top: 4px;
    }

    .schema-option {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      color: var(--text);
      text-transform: none;
      cursor: pointer;
    }

    #statusLog {
      background: #0b0c0e;
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 8px;
      height: 120px;
      overflow-y: auto;
      font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
      font-size: 11px;
      color: #9ca3af;
    }

    .log-entry {
      margin-bottom: 4px;
      word-break: break-all;
    }

    .log-entry.info { color: #93c5fd; }
    .log-entry.success { color: var(--success); }
    .log-entry.error { color: var(--danger); }
  </style>
</head>
<body>

  <!-- Profile Management -->
  <div class="card">
    <h2>Profile Manager</h2>
    <label for="profileSelect">Load Saved Profile</label>
    <div class="row">
      <select id="profileSelect">
        <option value="">-- Select a Profile --</option>
      </select>
      <button id="deleteProfileBtn" class="btn-danger" title="Delete Selected Profile">Del</button>
    </div>

    <label for="profileName">Profile Name</label>
    <div class="row" style="margin-bottom: 0;">
      <input type="text" id="profileName" placeholder="e.g., Ecommerce_Monitors">
      <button id="saveProfileBtn" class="btn-secondary" style="white-space: nowrap;">Save Profile</button>
    </div>
  </div>

  <!-- Target URLs -->
  <div class="card">
    <label for="urlList">Target URLs (One per line)</label>
    <textarea id="urlList" placeholder="https://example.com/item-1&#10;https://example.com/item-2"></textarea>
  </div>

  <!-- CSS Selectors -->
  <div class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <label style="margin-bottom: 0;">CSS Selectors</label>
      <button id="addSelectorBtn" class="btn-secondary" style="padding: 4px 8px; font-size: 11px;">+ Add Selector</button>
    </div>
    <div id="selectorsContainer"></div>
  </div>

  <!-- Output Configuration -->
  <div class="card">
    <label>Output Schema Format</label>
    <div class="schema-group">
      <label class="schema-option">
        <input type="radio" name="schemaType" value="wide" checked>
        Wide Schema (1 row/URL or item)
      </label>
      <label class="schema-option">
        <input type="radio" name="schemaType" value="long">
        Long Schema (Entity-Attribute-Value)
      </label>
    </div>
  </div>

  <!-- Execution & Progress -->
  <button id="startScrapeBtn" class="btn-block" style="margin-bottom: 12px;">Start Scraping</button>

  <div class="card" style="margin-bottom: 0;">
    <label>Status & Execution Log</label>
    <div id="statusLog"></div>
  </div>

  <script src="sidepanel.js"></script>
</body>
</html>

```

---

### 3. `sidepanel.js`

Manages profile state in `chrome.storage.local`, dynamic selector inputs, communication with `background.js`, Long/Wide CSV conversion, and `chrome.downloads.download` execution.

```javascript
const STORAGE_KEY = "scraper_profiles";

// DOM Elements
const profileSelect = document.getElementById("profileSelect");
const profileNameInput = document.getElementById("profileName");
const saveProfileBtn = document.getElementById("saveProfileBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const urlListInput = document.getElementById("urlList");
const selectorsContainer = document.getElementById("selectorsContainer");
const addSelectorBtn = document.getElementById("addSelectorBtn");
const startScrapeBtn = document.getElementById("startScrapeBtn");
const statusLog = document.getElementById("statusLog");

// Initialize Panel
document.addEventListener("DOMContentLoaded", async () => {
  await loadProfilesDropdown();
  addSelectorRow("Title", "h1");
  addSelectorRow("Price", ".price");
});

// Listen for progress and completion messages from background.js
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === "SCRAPE_PROGRESS") {
    logMessage(message.text, message.level || "info");
  } else if (message.type === "SCRAPE_COMPLETE") {
    handleScrapeComplete(message.data, message.config);
  } else if (message.type === "SCRAPE_ERROR") {
    logMessage(`Fatal Error: ${message.error}`, "error");
    startScrapeBtn.disabled = false;
    startScrapeBtn.textContent = "Start Scraping";
  }
});

// --- UI Helper Functions ---

function logMessage(text, level = "info") {
  const entry = document.createElement("div");
  entry.className = `log-entry ${level}`;
  const time = new Date().toLocaleTimeString([], { hour12: false });
  entry.textContent = `[${time}] ${text}`;
  statusLog.appendChild(entry);
  statusLog.scrollTop = statusLog.scrollHeight;
}

function addSelectorRow(labelVal = "", selectorVal = "") {
  const row = document.createElement("div");
  row.className = "selector-row";

  const labelInput = document.createElement("input");
  labelInput.type = "text";
  labelInput.placeholder = "Label (e.g. Title)";
  labelInput.className = "sel-label";
  labelInput.value = labelVal;

  const queryInput = document.createElement("input");
  queryInput.type = "text";
  queryInput.placeholder = "CSS Selector (e.g. .title)";
  queryInput.className = "sel-query";
  queryInput.value = selectorVal;

  const removeBtn = document.createElement("button");
  removeBtn.className = "btn-danger";
  removeBtn.textContent = "✕";
  removeBtn.title = "Remove Selector";
  removeBtn.addEventListener("click", () => {
    if (selectorsContainer.children.length > 1) {
      row.remove();
    } else {
      logMessage("At least one CSS selector is required.", "error");
    }
  });

  row.appendChild(labelInput);
  row.appendChild(queryInput);
  row.appendChild(removeBtn);
  selectorsContainer.appendChild(row);
}

addSelectorBtn.addEventListener("click", () => addSelectorRow());

function getSelectorsFromUI() {
  const rows = selectorsContainer.querySelectorAll(".selector-row");
  const selectors = [];
  rows.forEach((row, index) => {
    const label = row.querySelector(".sel-label").value.trim() || `Field_${index + 1}`;
    const query = row.querySelector(".sel-query").value.trim();
    if (query) {
      selectors.push({ label, query });
    }
  });
  return selectors;
}

function getSchemaSelection() {
  const checked = document.querySelector('input[name="schemaType"]:checked');
  return checked ? checked.value : "wide";
}

function setSchemaSelection(value) {
  const radio = document.querySelector(`input[name="schemaType"][value="${value}"]`);
  if (radio) radio.checked = true;
}

// --- Profile Management (chrome.storage.local) ---

async function getStoredProfiles() {
  const result = await chrome.storage.local.get(STORAGE_KEY);
  return result[STORAGE_KEY] || {};
}

async function loadProfilesDropdown() {
  const profiles = await getStoredProfiles();
  const currentVal = profileSelect.value;
  profileSelect.innerHTML = '<option value="">-- Select a Profile --</option>';

  Object.keys(profiles).sort().forEach((name) => {
    const option = document.createElement("option");
    option.value = name;
    option.textContent = name;
    profileSelect.appendChild(option);
  });

  if (profiles[currentVal]) {
    profileSelect.value = currentVal;
  }
}

saveProfileBtn.addEventListener("click", async () => {
  const rawName = profileNameInput.value.trim();
  if (!rawName) {
    logMessage("Please enter a valid Profile Name before saving.", "error");
    return;
  }

  const urls = urlListInput.value
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);

  const selectors = getSelectorsFromUI();
  const schema = getSchemaSelection();

  const profiles = await getStoredProfiles();
  profiles[rawName] = {
    profileName: rawName,
    urls,
    selectors,
    schema
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
  await loadProfilesDropdown();
  profileSelect.value = rawName;
  logMessage(`Profile "${rawName}" saved.`, "success");
});

profileSelect.addEventListener("change", async () => {
  const selectedName = profileSelect.value;
  if (!selectedName) return;

  const profiles = await getStoredProfiles();
  const profile = profiles[selectedName];
  if (!profile) return;

  profileNameInput.value = profile.profileName || selectedName;
  urlListInput.value = (profile.urls || []).join("\n");
  setSchemaSelection(profile.schema || "wide");

  selectorsContainer.innerHTML = "";
  if (profile.selectors && profile.selectors.length > 0) {
    profile.selectors.forEach((s) => addSelectorRow(s.label, s.query));
  } else {
    addSelectorRow();
  }

  logMessage(`Loaded profile "${selectedName}".`, "info");
});

deleteProfileBtn.addEventListener("click", async () => {
  const selectedName = profileSelect.value;
  if (!selectedName) return;

  const profiles = await getStoredProfiles();
  delete profiles[selectedName];
  await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
  profileNameInput.value = "";
  await loadProfilesDropdown();
  logMessage(`Deleted profile "${selectedName}".`, "info");
});

// --- Scraping Trigger ---

startScrapeBtn.addEventListener("click", () => {
  const profileName = profileNameInput.value.trim() || "Default_Profile";
  const urls = urlListInput.value
    .split("\n")
    .map((u) => u.trim())
    .filter(Boolean);
  const selectors = getSelectorsFromUI();
  const schema = getSchemaSelection();

  if (urls.length === 0) {
    logMessage("Please provide at least one URL.", "error");
    return;
  }

  if (selectors.length === 0) {
    logMessage("Please provide at least one valid CSS selector.", "error");
    return;
  }

  statusLog.innerHTML = "";
  logMessage(`Starting job "${profileName}" (${urls.length} URLs, ${schema.toUpperCase()} schema)...`, "info");
  startScrapeBtn.disabled = true;
  startScrapeBtn.textContent = "Scraping in Progress...";

  chrome.runtime.sendMessage({
    type: "START_SCRAPE",
    config: {
      profileName,
      urls,
      selectors,
      schema
    }
  });
});

// --- CSV Formatting & Download (chrome.downloads) ---

function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  const str = String(val).replace(/\r?\n|\r/g, " ").trim();
  return `"${str.replace(/"/g, '""')}"`;
}

function convertToCSV(results, config) {
  const { selectors, schema } = config;
  const rows = [];

  if (schema === "long") {
    // Long Schema: URL, Timestamp, Status, Selector_Label, CSS_Selector, Match_Index, Extracted_Value
    rows.push(
      ["URL", "Timestamp", "Status", "Selector_Label", "CSS_Selector", "Match_Index", "Extracted_Value"]
        .map(escapeCSV)
        .join(",")
    );

    results.forEach((item) => {
      if (item.error) {
        rows.push(
          [item.url, item.timestamp, `ERROR: ${item.error}`, "", "", "", ""]
            .map(escapeCSV)
            .join(",")
        );
        return;
      }

      selectors.forEach((sel) => {
        const matches = item.data[sel.label] || [];
        if (matches.length === 0) {
          rows.push(
            [item.url, item.timestamp, "OK", sel.label, sel.query, 0, ""]
              .map(escapeCSV)
              .join(",")
          );
        } else {
          matches.forEach((val, idx) => {
            rows.push(
              [item.url, item.timestamp, "OK", sel.label, sel.query, idx + 1, val]
                .map(escapeCSV)
                .join(",")
            );
          });
        }
      });
    });
  } else {
    // Wide Schema: URL, Timestamp, Status, Match_Index, [Selector_1, Selector_2, ...]
    const headers = ["URL", "Timestamp", "Status", "Match_Index", ...selectors.map((s) => s.label)];
    rows.push(headers.map(escapeCSV).join(","));

    results.forEach((item) => {
      if (item.error) {
        const errRow = [
          item.url,
          item.timestamp,
          `ERROR: ${item.error}`,
          0,
          ...selectors.map(() => "")
        ];
        rows.push(errRow.map(escapeCSV).join(","));
        return;
      }

      // Determine max matches across any selector on this page to align rows
      let maxMatches = 1;
      selectors.forEach((sel) => {
        const count = (item.data[sel.label] || []).length;
        if (count > maxMatches) maxMatches = count;
      });

      for (let i = 0; i < maxMatches; i++) {
        const rowData = [
          item.url,
          item.timestamp,
          "OK",
          i + 1,
          ...selectors.map((sel) => {
            const arr = item.data[sel.label] || [];
            return arr[i] !== undefined ? arr[i] : "";
          })
        ];
        rows.push(rowData.map(escapeCSV).join(","));
      }
    });
  }

  return rows.join("\r\n");
}

function sanitizePathSegment(name) {
  return name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/_{2,}/g, "_");
}

function handleScrapeComplete(results, config) {
  startScrapeBtn.disabled = false;
  startScrapeBtn.textContent = "Start Scraping";

  logMessage("Formatting dataset into CSV...", "info");
  const csvContent = convertToCSV(results, config);

  // Create Blob URL in Side Panel DOM context
  const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
  const blobUrl = URL.createObjectURL(blob);

  const safeProfile = sanitizePathSegment(config.profileName || "Default_Profile");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filename = `ScraperProfiles/${safeProfile}/dataset_${config.schema}_${timestamp}.csv`;

  chrome.downloads.download(
    {
      url: blobUrl,
      filename: filename,
      saveAs: false,
      conflictAction: "uniquify"
    },
    (downloadId) => {
      // Revoke the object URL after a short delay
      setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);

      if (chrome.runtime.lastError) {
        logMessage(`Download failed: ${chrome.runtime.lastError.message}`, "error");
      } else {
        logMessage(`CSV saved to Downloads/${filename} (ID: ${downloadId})`, "success");
      }
    }
  );
}

```

---

### 4. `background.js`

Service Worker that configures the Side Panel to open on toolbar icon click, sequentially opens and monitors tabs with timeout resilience, injects `content.js`, collects extracted data, closes each tab, and sends the aggregated dataset back to the Side Panel.

```javascript
const TAB_LOAD_TIMEOUT_MS = 25000;
const POST_LOAD_SETTLE_MS = 800;

// Enable opening Side Panel directly by clicking the extension action icon
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((err) => console.error("SidePanel behavior error:", err));

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "START_SCRAPE") {
    runBatchScrape(message.config).catch((err) => {
      chrome.runtime.sendMessage({
        type: "SCRAPE_ERROR",
        error: err.message || String(err)
      });
    });
    sendResponse({ status: "started" });
    return true;
  }
});

function sendProgress(text, level = "info") {
  chrome.runtime.sendMessage({
    type: "SCRAPE_PROGRESS",
    text,
    level
  }).catch(() => {});
}

/**
 * Waits for a specific tab to reach status === 'complete' or times out.
 */
function waitForTabLoad(tabId, timeoutMs) {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        chrome.tabs.onUpdated.removeListener(listener);
        reject(new Error(`Page load timed out after ${timeoutMs / 1000}s`));
      }
    }, timeoutMs);

    function listener(updatedTabId, changeInfo) {
      if (updatedTabId === tabId && changeInfo.status === "complete") {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
    }

    chrome.tabs.onUpdated.addListener(listener);

    // Check if the tab is already complete
    chrome.tabs.get(tabId, (tab) => {
      if (chrome.runtime.lastError) {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          reject(new Error(chrome.runtime.lastError.message));
        }
        return;
      }
      if (tab && tab.status === "complete") {
        if (!settled) {
          settled = true;
          clearTimeout(timer);
          chrome.tabs.onUpdated.removeListener(listener);
          resolve();
        }
      }
    });
  });
}

function delay(ms) {
  return new Promise((res) => setTimeout(res, ms));
}

async function runBatchScrape(config) {
  const { urls, selectors } = config;
  const aggregatedResults = [];

  for (let i = 0; i < urls.length; i++) {
    const rawUrl = urls[i];
    const timestamp = new Date().toISOString();
    sendProgress(`Scraping tab ${i + 1} of ${urls.length}: ${rawUrl}`, "info");

    // Validate URL syntax and protocol
    let parsedUrl;
    try {
      parsedUrl = new URL(rawUrl);
      if (!["http:", "https:"].includes(parsedUrl.protocol)) {
        throw new Error("Only http:// and https:// URLs are supported.");
      }
    } catch (err) {
      sendProgress(`Skipping invalid URL (${rawUrl}): ${err.message}`, "error");
      aggregatedResults.push({
        url: rawUrl,
        timestamp,
        data: {},
        error: `Invalid URL: ${err.message}`
      });
      continue;
    }

    let tabId = null;
    try {
      // 1. Open new active tab
      const tab = await chrome.tabs.create({ url: parsedUrl.href, active: true });
      tabId = tab.id;

      // 2. Wait for the tab to finish loading
      await waitForTabLoad(tabId, TAB_LOAD_TIMEOUT_MS);

      // Brief settle delay for dynamic DOM hydration
      await delay(POST_LOAD_SETTLE_MS);

      // 3. Inject content.js
      await chrome.scripting.executeScript({
        target: { tabId },
        files: ["content.js"]
      });

      // 4. Send selectors to content.js and receive scraped payload
      const response = await chrome.tabs.sendMessage(tabId, {
        type: "EXTRACT_ELEMENTS",
        selectors
      });

      if (!response || !response.success) {
        throw new Error(response?.error || "Content script returned empty response");
      }

      aggregatedResults.push({
        url: parsedUrl.href,
        timestamp,
        data: response.data,
        error: null
      });

      sendProgress(`Completed (${i + 1}/${urls.length}): Extracted ${ selectors.length } selector group(s).`, "success");
    } catch (err) {
      sendProgress(`Error on ${rawUrl}: ${err.message}`, "error");
      aggregatedResults.push({
        url: parsedUrl.href,
        timestamp,
        data: {},
        error: err.message
      });
    } finally {
      // 5. Always close the scraped tab if it still exists
      if (tabId !== null) {
        try {
          await chrome.tabs.remove(tabId);
        } catch (_) {
          // Tab was already closed manually by user
        }
      }
    }
  }

  sendProgress(`All ${urls.length} URL(s) processed. Generating CSV...`, "info");
  chrome.runtime.sendMessage({
    type: "SCRAPE_COMPLETE",
    data: aggregatedResults,
    config
  });
}

```

---

### 5. `content.js`

Injected programmatically into each loaded tab. It guards against duplicate listener registration, evaluates each CSS selector safely, extracts text/attributes (including special fallbacks for links, images, and inputs), and returns the payload to `background.js`.

```javascript
(() => {
  // Prevent duplicate message listeners if injected multiple times
  if (window.__batchScraperContentInjected) return;
  window.__batchScraperContentInjected = true;

  function extractElementValue(el) {
    if (!el) return "";
    const tag = el.tagName ? el.tagName.toUpperCase() : "";

    if (tag === "IMG") {
      return el.src || el.getAttribute("data-src") || el.alt || "";
    }
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
      return el.value || "";
    }
    if (tag === "META") {
      return el.getAttribute("content") || "";
    }

    const text = (el.innerText || el.textContent || "").trim();
    if (text) return text;

    if (tag === "A" && el.href) {
      return el.href;
    }
    return "";
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type !== "EXTRACT_ELEMENTS") return false;

    try {
      const { selectors } = message;
      const extractedData = {};

      selectors.forEach(({ label, query }) => {
        try {
          const nodeList = document.querySelectorAll(query);
          const values = Array.from(nodeList)
            .map((el) => extractElementValue(el))
            .filter((val) => val !== "");
          extractedData[label] = values;
        } catch (selectorErr) {
          // Handle invalid CSS selector syntax gracefully
          extractedData[label] = [`[Invalid Selector: ${query}]`];
        }
      });

      sendResponse({
        success: true,
        data: extractedData
      });
    } catch (err) {
      sendResponse({
        success: false,
        error: err.message || String(err)
      });
    }

    return true;
  });
})();

```

---

### How to Load the Unpacked Extension in Chrome / Brave

1. **Create the Project Directory:**
Create a new folder on your computer named `sidepanel-batch-scraper` and save the 5 files above (`manifest.json`, `sidepanel.html`, `sidepanel.js`, `background.js`, `content.js`) inside it.
2. **Open Extensions Management:**
Navigate to `chrome://extensions/` (or `brave://extensions/` in Brave).
3. **Enable Developer Mode:**
Toggle the **Developer mode** switch in the top-right corner of the page.
4. **Load Unpacked:**
Click the **Load unpacked** button in the top-left corner and select your `sidepanel-batch-scraper` directory.
5. **Pin & Launch:**
Click the puzzle-piece **Extensions** icon in your browser toolbar, pin **SidePanel Batch Scraper**, and click its icon to open the persistent Side Panel.