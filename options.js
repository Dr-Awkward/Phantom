'use strict';

const FIELDS = {
  searchEnabled:     { type: 'checkbox' },
  searchInterval:    { type: 'number' },
  phantomEnabled:    { type: 'checkbox' },
  mouseNoise:        { type: 'checkbox' },
  scrollNoise:       { type: 'checkbox' },
  clickNoise:        { type: 'checkbox' },
  hoverNoise:        { type: 'checkbox' },
  keystrokeNoise:    { type: 'checkbox' },
  noiseIntensity:    { type: 'select' },
  personaRotation:   { type: 'select' },
  iframeNoise:       { type: 'checkbox' },
  dashboardRecording:{ type: 'checkbox' }
};

const ENGINE_IDS = {
  engGoogle:     'google',
  engBing:       'bing',
  engYahoo:      'yahoo',
  engDuckduckgo: 'duckduckgo'
};

function getEl(id) {
  return document.getElementById(id);
}

function readForm() {
  const settings = {};
  for (const [id, info] of Object.entries(FIELDS)) {
    const el = getEl(id);
    if (!el) continue;
    if (info.type === 'checkbox') settings[id] = el.checked;
    else if (info.type === 'number') settings[id] = parseInt(el.value, 10) || 10;
    else settings[id] = el.value;
  }

  settings.engines = [];
  for (const [elId, engineKey] of Object.entries(ENGINE_IDS)) {
    if (getEl(elId).checked) settings.engines.push(engineKey);
  }

  const whitelistText = getEl('whitelist').value.trim();
  settings.whitelist = whitelistText
    ? whitelistText.split('\n').map(s => s.trim()).filter(Boolean)
    : [];

  return settings;
}

function populateForm(settings) {
  for (const [id, info] of Object.entries(FIELDS)) {
    const el = getEl(id);
    if (!el) continue;
    if (info.type === 'checkbox') el.checked = settings[id] !== false;
    else if (info.type === 'number') el.value = settings[id] || 10;
    else el.value = settings[id] || el.options[0].value;
  }

  const engines = settings.engines || ['google', 'bing', 'yahoo', 'duckduckgo'];
  for (const [elId, engineKey] of Object.entries(ENGINE_IDS)) {
    getEl(elId).checked = engines.includes(engineKey);
  }

  getEl('whitelist').value = (settings.whitelist || []).join('\n');
}

function showSaved() {
  const el = getEl('saveStatus');
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 2000);
}

function save() {
  const settings = readForm();
  chrome.runtime.sendMessage({ type: 'updateSettings', settings }, () => {
    showSaved();
  });
}

// Load settings on open
chrome.runtime.sendMessage({ type: 'getSettings' }, (settings) => {
  if (settings) populateForm(settings);
});

// Load remote whitelist display
chrome.runtime.sendMessage({ type: 'getWhitelist' }, (data) => {
  const el = getEl('remoteWhitelistList');
  if (!data || !data.remote || data.remote.length === 0) {
    el.textContent = 'No community whitelist loaded yet.';
    return;
  }
  el.innerHTML = data.remote.map(d => '<span>' + d + '</span>').join('');
});

// Auto-save on any change
document.querySelectorAll('input, select, textarea').forEach(el => {
  const event = el.type === 'checkbox' ? 'change' : 'input';
  el.addEventListener(event, save);
});
