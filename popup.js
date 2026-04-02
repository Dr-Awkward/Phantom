'use strict';

const searchToggle  = document.getElementById('searchToggle');
const phantomToggle = document.getElementById('phantomToggle');
const statusDot     = document.getElementById('statusDot');
const ghostEvents   = document.getElementById('ghostEvents');
const phantomClicks = document.getElementById('phantomClicks');
const scrollSpoofs  = document.getElementById('scrollSpoofs');
const queryPool     = document.getElementById('queryPool');
const personaBadge  = document.getElementById('personaBadge');
const dashboardLink = document.getElementById('dashboardLink');
const optionsLink   = document.getElementById('optionsLink');

function formatNumber(n) {
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}

function updateStatusDot() {
  const active = searchToggle.checked || phantomToggle.checked;
  statusDot.className = 'status-dot ' + (active ? 'active' : 'inactive');
}

async function loadState() {
  // Get background status
  chrome.runtime.sendMessage({ type: 'getStatus' }, (response) => {
    if (response) {
      searchToggle.checked = response.searchEnabled;
      phantomToggle.checked = response.phantomEnabled;
      queryPool.textContent = formatNumber(response.queryPoolSize || 0);
      updateStatusDot();
    }
  });

  // Get phantom stats from the active tab's content script
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, { type: 'getPhantomStats' }, (response) => {
      if (chrome.runtime.lastError || !response) {
        ghostEvents.textContent = '-';
        phantomClicks.textContent = '-';
        scrollSpoofs.textContent = '-';
        personaBadge.textContent = 'Persona: inactive';
        return;
      }
      ghostEvents.textContent = formatNumber(response.ghostMouseEvents || 0);
      phantomClicks.textContent = formatNumber(response.phantomClicks || 0);
      scrollSpoofs.textContent = formatNumber(response.scrollSpoofs || 0);
      personaBadge.textContent = 'Persona: ' + (response.persona || '---');
    });
  }
}

searchToggle.addEventListener('change', () => {
  chrome.runtime.sendMessage({
    type: 'updateSettings',
    settings: { searchEnabled: searchToggle.checked }
  });
  updateStatusDot();
});

phantomToggle.addEventListener('change', async () => {
  chrome.runtime.sendMessage({
    type: 'updateSettings',
    settings: { phantomEnabled: phantomToggle.checked }
  });

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.id) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'setPhantomActive',
      active: phantomToggle.checked
    });
  }
  updateStatusDot();
});

dashboardLink.addEventListener('click', () => {
  chrome.tabs.create({ url: chrome.runtime.getURL('dashboard.html') });
});

optionsLink.addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

// Check for updates
chrome.runtime.sendMessage({ type: 'checkUpdate' }, (update) => {
  if (chrome.runtime.lastError || !update) return;
  const banner = document.getElementById('updateBanner');
  const link = document.getElementById('updateLink');
  banner.style.display = 'block';
  link.textContent = 'Update available: v' + update.version;
  link.addEventListener('click', () => {
    chrome.tabs.create({ url: update.download });
  });
});

loadState();
