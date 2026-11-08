// UI Elements
const profileSelect = document.getElementById('profileSelect');
const deleteProfileBtn = document.getElementById('deleteProfileBtn');
const profileNameInput = document.getElementById('profileName');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const urlListTextarea = document.getElementById('urlList');
const selectorsContainer = document.getElementById('selectorsContainer');
const addSelectorBtn = document.getElementById('addSelectorBtn');
const schemaRadios = document.getElementsByName('schema');
const startScrapeBtn = document.getElementById('startScrapeBtn');
const statusLog = document.getElementById('statusLog');

// Storage Key
const STORAGE_KEY = 'scraper_profiles';

// State
let profiles = {};

// Initialize
async function init() {
  await loadProfiles();

  if (Object.keys(profiles).length === 0) {
    addSelectorRow('', '');
  }

  // Event Listeners
  addSelectorBtn.addEventListener('click', () => addSelectorRow('', ''));
  saveProfileBtn.addEventListener('click', saveCurrentProfile);
  profileSelect.addEventListener('change', handleProfileSelection);
  deleteProfileBtn.addEventListener('click', deleteCurrentProfile);
  startScrapeBtn.addEventListener('click', startScraping);

  // Message Listener
  chrome.runtime.onMessage.addListener(handleMessage);
}

// Logging
function log(msg, type = 'info') {
  const time = new Date().toLocaleTimeString();
  const color = type === 'error' ? '#ff5252' : (type === 'success' ? '#69f0ae' : '#e0e0e0');
  const logEntry = document.createElement('div');
  logEntry.style.color = color;
  logEntry.textContent = `[${time}] ${msg}`;
  statusLog.appendChild(logEntry);
  statusLog.scrollTop = statusLog.scrollHeight;
}

// Selector UI
function addSelectorRow(labelVal = '', queryVal = '') {
  const row = document.createElement('div');
  row.className = 'selector-row';

  const labelInput = document.createElement('input');
  labelInput.type = 'text';
  labelInput.placeholder = 'Column Label (e.g. Title)';
  labelInput.value = labelVal;
  labelInput.className = 'sel-label';

  const queryInput = document.createElement('input');
  queryInput.type = 'text';
  queryInput.placeholder = 'CSS Selector (e.g. h1)';
  queryInput.value = queryVal;
  queryInput.className = 'sel-query';

  const upBtn = document.createElement('button');
  upBtn.textContent = '↑';
  upBtn.className = 'reorder-btn';
  upBtn.onclick = () => {
    if (row.previousElementSibling) {
      row.parentNode.insertBefore(row, row.previousElementSibling);
    }
  };

  const downBtn = document.createElement('button');
  downBtn.textContent = '↓';
  downBtn.className = 'reorder-btn';
  downBtn.onclick = () => {
    if (row.nextElementSibling) {
      row.parentNode.insertBefore(row.nextElementSibling, row);
    }
  };

  const removeBtn = document.createElement('button');
  removeBtn.textContent = '✕';
  removeBtn.className = 'danger';
  removeBtn.onclick = () => row.remove();

  row.appendChild(labelInput);
  row.appendChild(queryInput);
  row.appendChild(upBtn);
  row.appendChild(downBtn);
  row.appendChild(removeBtn);
  selectorsContainer.appendChild(row);
}

function getSelectors() {
  const rows = selectorsContainer.querySelectorAll('.selector-row');
  const selectors = [];
  rows.forEach(row => {
    const label = row.querySelector('.sel-label').value.trim();
    const query = row.querySelector('.sel-query').value.trim();
    if (label && query) {
      selectors.push({ label, query });
    }
  });
  return selectors;
}

function getActiveSchema() {
  for (const radio of schemaRadios) {
    if (radio.checked) return radio.value;
  }
  return 'wide';
}

function setActiveSchema(val) {
  for (const radio of schemaRadios) {
    radio.checked = (radio.value === val);
  }
}

// Profiles
async function loadProfiles() {
  const data = await chrome.storage.local.get(STORAGE_KEY);
  profiles = data[STORAGE_KEY] || {};

  // Update select options
  const currentVal = profileSelect.value;
  profileSelect.innerHTML = '<option value="">-- Select Profile --</option>';

  for (const name of Object.keys(profiles)) {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    profileSelect.appendChild(opt);
  }

  if (profiles[currentVal]) {
    profileSelect.value = currentVal;
  }
}

async function saveCurrentProfile() {
  const name = profileNameInput.value.trim();
  if (!name) return alert('Please enter a profile name.');

  const urls = urlListTextarea.value.split('\n').map(u => u.trim()).filter(u => u);
  const selectors = getSelectors();
  const schema = getActiveSchema();

  profiles[name] = {
    name,
    urls,
    selectors,
    schema
  };

  await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
  await loadProfiles();
  profileSelect.value = name;
  log(`Profile '${name}' saved.`, 'success');
}

function handleProfileSelection() {
  const name = profileSelect.value;
  if (!name || !profiles[name]) {
    urlListTextarea.value = '';
    selectorsContainer.innerHTML = '';
    addSelectorRow('', '');
    profileNameInput.value = '';
    return;
  }

  const p = profiles[name];
  profileNameInput.value = p.name;
  urlListTextarea.value = p.urls.join('\n');

  selectorsContainer.innerHTML = '';
  if (p.selectors && p.selectors.length > 0) {
    p.selectors.forEach(s => addSelectorRow(s.label, s.query));
  } else {
    addSelectorRow('', '');
  }

  setActiveSchema(p.schema || 'wide');
  log(`Loaded profile '${name}'.`);
}

async function deleteCurrentProfile() {
  const name = profileSelect.value;
  if (!name || !profiles[name]) return;

  if (confirm(`Delete profile '${name}'?`)) {
    delete profiles[name];
    await chrome.storage.local.set({ [STORAGE_KEY]: profiles });
    await loadProfiles();
    handleProfileSelection();
    log(`Profile '${name}' deleted.`);
  }
}

// Scraping
function startScraping() {
  const urls = urlListTextarea.value.split('\n').map(u => u.trim()).filter(u => u);
  const selectors = getSelectors();

  if (urls.length === 0) return alert('Please enter at least one URL.');
  if (selectors.length === 0) return alert('Please enter at least one CSS selector.');

  const config = {
    profileName: profileNameInput.value.trim() || 'DefaultProfile',
    urls,
    selectors,
    schema: getActiveSchema()
  };

  startScrapeBtn.disabled = true;
  statusLog.innerHTML = '';
  log('Starting scrape job...');

  chrome.runtime.sendMessage({
    type: 'START_SCRAPE',
    config
  });
}

function handleMessage(msg, sender, sendResponse) {
  if (msg.type === 'SCRAPE_PROGRESS') {
    log(msg.message, msg.status === 'error' ? 'error' : 'info');
  } else if (msg.type === 'SCRAPE_ERROR') {
    log(`Fatal Error: ${msg.error}`, 'error');
    startScrapeBtn.disabled = false;
  } else if (msg.type === 'SCRAPE_COMPLETE') {
    log('Scraping complete. Preparing dataset...', 'success');
    handleScrapeComplete(msg.dataset, msg.config);
    startScrapeBtn.disabled = false;
  }
}

// CSV and Download
function escapeCSV(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

function convertToCSV(dataset, config) {
  const lines = [];

  if (config.schema === 'wide') {
    // Wide Schema: URL, [Selector Labels...]
    const headers = ['URL'];
    config.selectors.forEach(s => headers.push(s.label));
    lines.push(headers.map(escapeCSV).join(','));

    for (const record of dataset) {
      if (record.status === 'error') {
        // Log errors in the first column or just URL and empty other columns
        const row = [escapeCSV(record.url), escapeCSV(`Error: ${record.error}`)];
        lines.push(row.join(','));
        continue;
      }

      const row = [escapeCSV(record.url)];

      // We take the first match for each selector to make it wide format.
      // If multiple matches exist, wide format is tricky, so we join them or just take first.
      // We will join multiple matches with a newline or separator.
      config.selectors.forEach(sel => {
        const matches = record.data[sel.label] || [];
        row.push(matches.join(' | '));
      });

      lines.push(row.map(escapeCSV).join(','));
    }
  } else {
    // Long Schema: URL, Timestamp, Status, Selector_Label, CSS_Selector, Match_Index, Extracted_Value
    const headers = ['URL', 'Timestamp', 'Status', 'Selector_Label', 'CSS_Selector', 'Match_Index', 'Extracted_Value'];
    lines.push(headers.map(escapeCSV).join(','));

    for (const record of dataset) {
      if (record.status === 'error') {
        lines.push([record.url, Date.now(), 'error', '', '', '', record.error].map(escapeCSV).join(','));
        continue;
      }

      let hasData = false;

      config.selectors.forEach(sel => {
        const matches = record.data[sel.label] || [];
        matches.forEach((val, idx) => {
          hasData = true;
          lines.push([
            record.url,
            Date.now(),
            'success',
            sel.label,
            sel.query,
            idx,
            val
          ].map(escapeCSV).join(','));
        });
      });

      if (!hasData) {
        lines.push([record.url, Date.now(), 'success', '', '', '', ''].map(escapeCSV).join(','));
      }
    }
  }

  return '\uFEFF' + lines.join('\r\n');
}

function handleScrapeComplete(dataset, config) {
  try {
    const csvContent = convertToCSV(dataset, config);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const blobUrl = URL.createObjectURL(blob);

    const safeProfileName = config.profileName.replace(/[^a-z0-9]/gi, '_').toLowerCase() || 'default';
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `ScraperProfiles/${safeProfileName}/dataset_${config.schema}_${timestamp}.csv`;

    chrome.downloads.download({
      url: blobUrl,
      filename: filename,
      saveAs: false,
      conflictAction: 'uniquify'
    }, (downloadId) => {
      URL.revokeObjectURL(blobUrl);
      if (chrome.runtime.lastError) {
        log(`Download failed: ${chrome.runtime.lastError.message}`, 'error');
      } else {
        log(`Downloaded successfully as ${filename}`, 'success');
      }
    });
  } catch (e) {
    log(`Failed to process CSV: ${e.message}`, 'error');
  }
}

// Run
init();
