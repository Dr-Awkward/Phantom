// ============================================================
// Phantom — Ghost Search Query Engine (Service Worker)
// ============================================================

'use strict';

const SEARCH_ENGINES = {
  google:     'https://www.google.com/search?q=',
  bing:       'https://www.bing.com/search?q=',
  yahoo:      'https://search.yahoo.com/search?p=',
  duckduckgo: 'https://duckduckgo.com/?q='
};

const RSS_FEEDS = [
  'https://news.google.com/rss',
  'https://rss.nytimes.com/services/xml/rss/nyt/HomePage.xml',
  'https://feeds.bbci.co.uk/news/rss.xml'
];

const REMOTE_BASE = 'https://raw.githubusercontent.com/Dr-Awkward/phantom/main/';

let seedQueries = [];
let activeQueries = [];
let settings = {};
let remoteWhitelist = [];

const DEFAULT_SETTINGS = {
  searchEnabled: true,
  phantomEnabled: true,
  searchInterval: 10,
  engines: ['google', 'bing', 'duckduckgo', 'yahoo'],
  mouseNoise: true,
  scrollNoise: true,
  clickNoise: true,
  hoverNoise: true,
  keystrokeNoise: true,
  noiseIntensity: 'medium',
  personaRotation: 'auto',
  dashboardRecording: true,
  whitelist: []
};

async function loadSettings() {
  const result = await chrome.storage.sync.get('phantom_settings');
  settings = { ...DEFAULT_SETTINGS, ...(result.phantom_settings || {}) };
  return settings;
}

async function saveSettings(newSettings) {
  settings = { ...settings, ...newSettings };
  await chrome.storage.sync.set({ phantom_settings: settings });
}

async function loadSeeds() {
  try {
    const url = chrome.runtime.getURL('seeds.json');
    const response = await fetch(url);
    seedQueries = await response.json();
    activeQueries = seedQueries.slice().sort(() => Math.random() - 0.5).slice(0, 20);
  } catch (e) {
    activeQueries = ['weather today', 'news headlines', 'recipe ideas', 'movie reviews'];
  }
}

async function evolveQueries() {
  for (const feedUrl of RSS_FEEDS) {
    try {
      const response = await fetch(feedUrl);
      const text = await response.text();

      // Extract titles via regex (DOMParser not available in service workers)
      const titleRegex = /<title[^>]*>(?:<!\[CDATA\[)?(.*?)(?:\]\]>)?<\/title>/gi;
      let match;
      while ((match = titleRegex.exec(text)) !== null) {
        const title = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
        const words = title.split(/\s+/).filter(w => w.length > 3);
        if (words.length >= 2) {
          const start = Math.floor(Math.random() * Math.max(1, words.length - 3));
          const query = words.slice(start, start + 2 + Math.floor(Math.random() * 2)).join(' ');
          if (query.length > 5 && query.length < 60) {
            activeQueries.push(query.toLowerCase());
          }
        }
      }
    } catch (e) {
      // RSS fetch failed, continue with existing queries
    }
  }

  if (activeQueries.length > 100) {
    activeQueries = activeQueries.sort(() => Math.random() - 0.5).slice(0, 60);
  }
}

async function sendGhostSearch() {
  if (!settings.searchEnabled) return;
  if (activeQueries.length === 0) return;

  const query = activeQueries[Math.floor(Math.random() * activeQueries.length)];
  const engineKeys = settings.engines || Object.keys(SEARCH_ENGINES);
  const engineKey = engineKeys[Math.floor(Math.random() * engineKeys.length)];
  const baseUrl = SEARCH_ENGINES[engineKey];

  if (!baseUrl) return;

  const url = baseUrl + encodeURIComponent(query);

  try {
    await fetch(url, { credentials: 'omit' });
  } catch (e) {
    // Ghost search failed silently
  }
}

// ---- Remote whitelist fetching ----

async function fetchRemoteWhitelist() {
  try {
    const response = await fetch(REMOTE_BASE + 'whitelist.json', { credentials: 'omit' });
    if (!response.ok) return;
    const data = await response.json();
    if (data && Array.isArray(data.domains)) {
      remoteWhitelist = data.domains;
      await chrome.storage.local.set({ phantom_remote_whitelist: remoteWhitelist });
    }
  } catch (e) {
    // Remote fetch failed — keep using cached whitelist
  }
}

async function loadCachedWhitelist() {
  try {
    const result = await chrome.storage.local.get('phantom_remote_whitelist');
    remoteWhitelist = result.phantom_remote_whitelist || [];
  } catch (e) {
    remoteWhitelist = [];
  }
}

// ---- Update check ----

async function checkForUpdate() {
  try {
    const response = await fetch(REMOTE_BASE + 'version.json', { credentials: 'omit' });
    if (!response.ok) return;
    const data = await response.json();
    const currentVersion = chrome.runtime.getManifest().version;
    if (data.version && data.version !== currentVersion) {
      await chrome.storage.local.set({
        phantom_update_available: {
          version: data.version,
          download: data.download
        }
      });
    } else {
      await chrome.storage.local.remove('phantom_update_available');
    }
  } catch (e) {
    // Update check failed silently
  }
}

function setupAlarms() {
  chrome.alarms.clearAll();

  if (settings.searchEnabled) {
    const interval = settings.searchInterval || 10;
    chrome.alarms.create('phantom-ghost-search', {
      delayInMinutes: 1,
      periodInMinutes: interval + Math.random() * 5
    });
  }

  chrome.alarms.create('phantom-evolve-queries', {
    delayInMinutes: 30,
    periodInMinutes: 60
  });

  // Daily remote whitelist + update check
  chrome.alarms.create('phantom-daily-sync', {
    delayInMinutes: 5,
    periodInMinutes: 1440
  });
}

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'phantom-ghost-search') {
    sendGhostSearch();
  }
  if (alarm.name === 'phantom-evolve-queries') {
    evolveQueries();
  }
  if (alarm.name === 'phantom-daily-sync') {
    fetchRemoteWhitelist();
    checkForUpdate();
  }
});

chrome.storage.onChanged.addListener((changes) => {
  if (changes.phantom_settings) {
    settings = { ...DEFAULT_SETTINGS, ...(changes.phantom_settings.newValue || {}) };
    setupAlarms();
  }
});

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'getStatus') {
    sendResponse({
      searchEnabled: settings.searchEnabled,
      phantomEnabled: settings.phantomEnabled,
      queryPoolSize: activeQueries.length,
      settings: settings
    });
    return true;
  }
  if (msg.type === 'updateSettings') {
    saveSettings(msg.settings).then(() => {
      setupAlarms();
      sendResponse({ ok: true });
    });
    return true;
  }
  if (msg.type === 'getSettings') {
    sendResponse(settings);
    return true;
  }
  if (msg.type === 'getWhitelist') {
    const localWhitelist = settings.whitelist || [];
    const merged = [...new Set([...localWhitelist, ...remoteWhitelist])];
    sendResponse({ local: localWhitelist, remote: remoteWhitelist, merged: merged });
    return true;
  }
  if (msg.type === 'checkUpdate') {
    chrome.storage.local.get('phantom_update_available', (result) => {
      sendResponse(result.phantom_update_available || null);
    });
    return true;
  }
  if (msg.type === 'isWhitelisted') {
    const domain = msg.domain || '';
    const localWhitelist = settings.whitelist || [];
    const allWhitelisted = [...localWhitelist, ...remoteWhitelist];
    const whitelisted = allWhitelisted.some(d => domain === d || domain.endsWith('.' + d));
    sendResponse({ whitelisted });
    return true;
  }
});

async function init() {
  await loadSettings();
  await loadCachedWhitelist();
  await loadSeeds();
  await evolveQueries();
  setupAlarms();
  fetchRemoteWhitelist();
  checkForUpdate();
}

init();
