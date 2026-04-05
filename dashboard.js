'use strict';

// ---- Target tab management ----
// The user picks which website tab to monitor from a dropdown.
// Pre-selected from ?tab= param (set by popup.js) or first http tab found.

let targetTabId = null;

async function populateTabPicker() {
  const select = document.getElementById('targetSelect');
  const hint = document.getElementById('targetHint');
  let myTabId = null;
  try {
    const myTab = await chrome.tabs.getCurrent();
    if (myTab) myTabId = myTab.id;
  } catch (e) {}

  // Query ALL windows so we find tabs even if dashboard opened in a new window
  const tabs = await chrome.tabs.query({});
  const httpTabs = tabs.filter(t =>
    t.id !== myTabId &&
    t.url &&
    (t.url.startsWith('http://') || t.url.startsWith('https://'))
  );

  select.innerHTML = '';

  if (httpTabs.length === 0) {
    select.innerHTML = '<option value="">No website tabs open</option>';
    targetTabId = null;
    hint.textContent = 'Open a website in another tab, then click the refresh button.';
    hint.classList.add('visible');
    return;
  }

  hint.classList.remove('visible');

  for (const tab of httpTabs) {
    const opt = document.createElement('option');
    opt.value = tab.id;
    const title = tab.title || 'Untitled';
    const host = new URL(tab.url).hostname;
    opt.textContent = title.length > 45 ? title.substring(0, 42) + '... (' + host + ')' : title + ' (' + host + ')';
    opt.title = tab.url;
    select.appendChild(opt);
  }

  // Pre-select from URL param if valid
  const params = new URLSearchParams(window.location.search);
  const paramId = parseInt(params.get('tab'));
  if (paramId && httpTabs.some(t => t.id === paramId)) {
    select.value = paramId;
    targetTabId = paramId;
  } else {
    targetTabId = httpTabs[0].id;
    select.value = httpTabs[0].id;
  }
}

document.getElementById('targetSelect').addEventListener('change', (e) => {
  targetTabId = parseInt(e.target.value) || null;
  pollData();
});

document.getElementById('refreshTabs').addEventListener('click', () => {
  populateTabPicker();
});

// ---- Canvas visualization ----

const canvasReal  = document.getElementById('canvasReal');
const canvasNoisy = document.getElementById('canvasNoisy');
const ctxReal  = canvasReal.getContext('2d');
const ctxNoisy = canvasNoisy.getContext('2d');

function drawPoints(ctx, points, color) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  if (points.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.globalAlpha = 0.4;
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  for (let i = 0; i < points.length; i++) {
    const age = (points.length - i) / points.length;
    ctx.globalAlpha = 0.2 + age * 0.8;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(points[i].x, points[i].y, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawPlaceholder(ctx, text) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  ctx.fillStyle = '#8b949e';
  ctx.font = '13px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(text, ctx.canvas.width / 2, ctx.canvas.height / 2);
}

function updateReplay(stats) {
  if (!stats || !stats.recentPositions || stats.recentPositions.length === 0) {
    drawPlaceholder(ctxReal, 'Move the mouse on the monitored page');
    drawPlaceholder(ctxNoisy, 'Waiting for data...');
    return;
  }

  const positions = stats.recentPositions;
  const vw = stats.viewportWidth || 1920;
  const vh = stats.viewportHeight || 1080;
  const cw = canvasReal.width;
  const ch = canvasReal.height;

  function scale(pts) {
    return pts.map(p => ({
      x: Math.max(2, Math.min(cw - 2, (p.x / vw) * cw)),
      y: Math.max(2, Math.min(ch - 2, (p.y / vh) * ch))
    }));
  }

  // Left canvas: real mouse positions only
  const realPts = positions.filter(p => !p.ghost);
  drawPoints(ctxReal, scale(realPts), '#58a6ff');

  // Right canvas: real (blue) + ghost (red) mixed
  const scaledAll = scale(positions);
  ctxNoisy.clearRect(0, 0, canvasNoisy.width, canvasNoisy.height);

  // Real trail
  const scaledReal = scale(realPts);
  if (scaledReal.length > 1) {
    ctxNoisy.beginPath();
    ctxNoisy.strokeStyle = '#58a6ff';
    ctxNoisy.lineWidth = 1.5;
    ctxNoisy.globalAlpha = 0.3;
    ctxNoisy.moveTo(scaledReal[0].x, scaledReal[0].y);
    for (let i = 1; i < scaledReal.length; i++) {
      ctxNoisy.lineTo(scaledReal[i].x, scaledReal[i].y);
    }
    ctxNoisy.stroke();
    ctxNoisy.globalAlpha = 1;
  }

  // Ghost trail
  const ghostPts = scale(positions.filter(p => p.ghost));
  if (ghostPts.length > 1) {
    ctxNoisy.beginPath();
    ctxNoisy.strokeStyle = '#f85149';
    ctxNoisy.lineWidth = 1.5;
    ctxNoisy.globalAlpha = 0.4;
    ctxNoisy.moveTo(ghostPts[0].x, ghostPts[0].y);
    for (let i = 1; i < ghostPts.length; i++) {
      ctxNoisy.lineTo(ghostPts[i].x, ghostPts[i].y);
    }
    ctxNoisy.stroke();
    ctxNoisy.globalAlpha = 1;
  }

  // All dots colored by type
  for (let i = 0; i < scaledAll.length; i++) {
    const age = (scaledAll.length - i) / scaledAll.length;
    ctxNoisy.globalAlpha = 0.2 + age * 0.8;
    ctxNoisy.fillStyle = positions[i].ghost ? '#f85149' : '#58a6ff';
    ctxNoisy.beginPath();
    ctxNoisy.arc(scaledAll[i].x, scaledAll[i].y, 2, 0, Math.PI * 2);
    ctxNoisy.fill();
  }
  ctxNoisy.globalAlpha = 1;
}

// ---- Stats polling ----

let statsView = 'page';

function displayPageStats(response) {
  document.getElementById('statGhost').textContent    = (response.ghostMouseEvents || 0).toLocaleString();
  document.getElementById('statClicks').textContent   = (response.phantomClicks || 0).toLocaleString();
  document.getElementById('statScrolls').textContent  = (response.scrollSpoofs || 0).toLocaleString();
  document.getElementById('statKeys').textContent     = (response.keystrokeEvents || 0).toLocaleString();
  document.getElementById('statPersonas').textContent = response.personaRotations || 0;
  document.getElementById('statArchetype').textContent = response.persona || '---';
  document.getElementById('statUptime').textContent   = (response.uptimeMinutes || 0) + ' min';

  const total = (response.ghostMouseEvents || 0) +
                (response.phantomClicks || 0) * 10 +
                (response.scrollSpoofs || 0) * 5 +
                (response.keystrokeEvents || 0) * 2;
  const minutes = Math.max(1, response.uptimeMinutes || 1);
  const score = Math.min(100, Math.round((total / minutes) * 0.5));
  document.getElementById('privacyScore').textContent = score;
}

function displaySessionStats(session) {
  document.getElementById('statGhost').textContent    = (session.ghostMouseEvents || 0).toLocaleString();
  document.getElementById('statClicks').textContent   = (session.phantomClicks || 0).toLocaleString();
  document.getElementById('statScrolls').textContent  = (session.scrollSpoofs || 0).toLocaleString();
  document.getElementById('statKeys').textContent     = (session.keystrokeEvents || 0).toLocaleString();
  document.getElementById('statPersonas').textContent = session.personaRotations || 0;
  document.getElementById('statArchetype').textContent = '(all pages)';
  const sessionMinutes = Math.round((Date.now() - (session.startTime || Date.now())) / 60000);
  document.getElementById('statUptime').textContent   = sessionMinutes + ' min';

  const total = (session.ghostMouseEvents || 0) +
                (session.phantomClicks || 0) * 10 +
                (session.scrollSpoofs || 0) * 5 +
                (session.keystrokeEvents || 0) * 2;
  const minutes = Math.max(1, sessionMinutes);
  const score = Math.min(100, Math.round((total / minutes) * 0.5));
  document.getElementById('privacyScore').textContent = score;
}

async function pollData() {
  if (targetTabId) {
    chrome.tabs.sendMessage(targetTabId, { type: 'getPhantomStats' }, (response) => {
      if (chrome.runtime.lastError || !response) return;
      updateReplay(response);
      if (statsView === 'page') {
        displayPageStats(response);
      }
    });
  }

  if (statsView === 'session') {
    chrome.runtime.sendMessage({ type: 'getSessionStats' }, (session) => {
      if (chrome.runtime.lastError || !session) return;
      displaySessionStats(session);
    });
  }
}

document.getElementById('tabPage').addEventListener('click', () => {
  statsView = 'page';
  document.getElementById('tabPage').classList.add('active');
  document.getElementById('tabSession').classList.remove('active');
  pollData();
});

document.getElementById('tabSession').addEventListener('click', () => {
  statsView = 'session';
  document.getElementById('tabSession').classList.add('active');
  document.getElementById('tabPage').classList.remove('active');
  pollData();
});

// ---- Tracker scanning ----

let trackerSignatures = null;

async function loadSignatures() {
  if (trackerSignatures) return trackerSignatures;
  const url = chrome.runtime.getURL('tracker-signatures.json');
  const response = await fetch(url);
  trackerSignatures = await response.json();
  return trackerSignatures;
}

document.getElementById('scanBtn').addEventListener('click', async () => {
  if (!targetTabId) {
    document.getElementById('trackerList').innerHTML =
      '<div class="tracker-empty">Pick a website tab from the dropdown above first.</div>';
    return;
  }

  const sigs = await loadSignatures();

  let results;
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: targetTabId },
      func: () => {
        const scripts = Array.from(document.querySelectorAll('script[src]'));
        return scripts.map(s => s.src);
      }
    });
  } catch (e) {
    document.getElementById('trackerList').innerHTML =
      '<div class="tracker-empty">Cannot access that tab. Try refreshing it, then click the &#8635; button above.</div>';
    return;
  }

  const scriptUrls = (results && results[0] && results[0].result) || [];
  const listEl = document.getElementById('trackerList');
  listEl.innerHTML = '';

  let found = 0;
  for (const tracker of sigs.trackers) {
    const matched = tracker.patterns.some(pattern =>
      scriptUrls.some(url => url.includes(pattern))
    );
    if (matched) {
      found++;
      const item = document.createElement('div');
      item.className = 'tracker-item';
      item.innerHTML = `
        <span class="tracker-icon">&#9888;</span>
        <span class="tracker-name">${tracker.name}</span>
        <span class="tracker-desc">— ${tracker.collects}</span>
        <span class="tracker-poisoned">Poisoned</span>
      `;
      listEl.appendChild(item);
    }
  }

  if (found === 0) {
    listEl.innerHTML = '<div class="tracker-empty">No known trackers detected on this page.</div>';
  }
});

// ---- Export ----

document.getElementById('exportBtn').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = 'phantom-replay.png';
  link.href = canvasNoisy.toDataURL('image/png');
  link.click();
});

// ---- Diagnostic report ----

async function runDiagnostic() {
  const resultsEl = document.getElementById('diagResults');
  resultsEl.innerHTML = '<div class="diagnostic-empty">Running checks...</div>';

  const checks = [];

  // 1. Service worker
  try {
    const bgResponse = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Timed out')), 3000);
      chrome.runtime.sendMessage({ type: 'getStatus' }, (r) => {
        clearTimeout(timeout);
        if (chrome.runtime.lastError) { reject(chrome.runtime.lastError); return; }
        resolve(r);
      });
    });
    checks.push({
      label: 'Service Worker',
      pass: !!bgResponse,
      detail: bgResponse ? 'Responding' : 'No response'
    });
  } catch (e) {
    checks.push({ label: 'Service Worker', pass: false, detail: e.message || 'Not responding' });
  }

  // 2-4 require a selected tab
  if (!targetTabId) {
    checks.push({ label: 'Target Tab', pass: null, detail: 'Pick a website tab from the dropdown above' });
    checks.push({ label: 'Content Script', pass: null, detail: 'No tab selected' });
    checks.push({ label: 'Event Interception', pass: null, detail: 'No tab selected' });
    checks.push({ label: 'Noise Generation', pass: null, detail: 'No tab selected' });
  } else {
    // Verify target tab exists and show its URL
    let targetTab = null;
    try {
      targetTab = await chrome.tabs.get(targetTabId);
    } catch (e) {}

    if (!targetTab) {
      checks.push({ label: 'Target Tab', pass: false, detail: 'Tab was closed. Click &#8635; to refresh the tab list.' });
      checks.push({ label: 'Content Script', pass: null, detail: 'Tab closed' });
      checks.push({ label: 'Event Interception', pass: null, detail: 'Tab closed' });
      checks.push({ label: 'Noise Generation', pass: null, detail: 'Tab closed' });
    } else {
      const tabUrl = targetTab.url || '(URL hidden)';
      const isHttp = tabUrl.startsWith('http://') || tabUrl.startsWith('https://');
      checks.push({
        label: 'Target Tab',
        pass: isHttp,
        detail: isHttp ? tabUrl.substring(0, 80) : 'Not a website (' + tabUrl.substring(0, 40) + '). Pick an http/https tab.'
      });

      if (!isHttp) {
        checks.push({ label: 'Content Script', pass: false, detail: 'Only works on http/https pages' });
        checks.push({ label: 'Event Interception', pass: false, detail: 'Only works on http/https pages' });
        checks.push({ label: 'Noise Generation', pass: false, detail: 'Only works on http/https pages' });
      } else {
        // 2. Content script
        try {
          const stats = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error('No response')), 3000);
            chrome.tabs.sendMessage(targetTabId, { type: 'getPhantomStats' }, (r) => {
              clearTimeout(timeout);
              if (chrome.runtime.lastError) { reject(new Error(chrome.runtime.lastError.message)); return; }
              resolve(r);
            });
          });
          checks.push({
            label: 'Content Script',
            pass: !!stats,
            detail: stats ? 'Active — persona: ' + (stats.persona || 'none') + ', uptime: ' + (stats.uptimeMinutes || 0) + ' min' : 'No response'
          });

          const total = (stats?.ghostMouseEvents || 0) + (stats?.phantomClicks || 0) +
                        (stats?.scrollSpoofs || 0) + (stats?.keystrokeEvents || 0);
          if (total > 0) {
            checks.push({ label: 'Noise Generation', pass: true, detail: total + ' noise events so far' });
          } else if (stats && stats.uptimeMinutes < 1) {
            checks.push({ label: 'Noise Generation', pass: null, detail: 'Engine just started — wait 30 seconds and re-run' });
          } else {
            checks.push({ label: 'Noise Generation', pass: false, detail: 'No events generated' });
          }
        } catch (e) {
          const isNoReceiver = e.message && e.message.includes('Receiving end does not exist');
          checks.push({
            label: 'Content Script',
            pass: false,
            detail: isNoReceiver
              ? 'Not loaded — refresh the website tab (the tab was probably open before the extension was loaded)'
              : e.message
          });
          checks.push({ label: 'Noise Generation', pass: false, detail: 'Content script not loaded' });
        }

        // 3. MAIN world interception
        try {
          const injected = await chrome.scripting.executeScript({
            target: { tabId: targetTabId },
            world: 'MAIN',
            func: () => {
              return !EventTarget.prototype.addEventListener.toString().includes('[native code]');
            }
          });
          const wrapped = injected && injected[0] && injected[0].result;
          checks.push({
            label: 'Event Interception',
            pass: wrapped,
            detail: wrapped ? 'addEventListener wrapped — tracker callbacks intercepted' : 'addEventListener is native — refresh the website tab'
          });
        } catch (e) {
          const isPermission = e.message && e.message.includes('permission');
          checks.push({
            label: 'Event Interception',
            pass: false,
            detail: isPermission
              ? 'Permission denied — go to chrome://extensions, click Phantom details, set site access to "On all sites"'
              : e.message
          });
        }
      }
    }
  }

  // Render
  resultsEl.innerHTML = '';
  let passCount = 0;
  let failCount = 0;

  for (const check of checks) {
    const icon = check.pass === true ? '&#10003;' : check.pass === false ? '&#10007;' : '&#9679;';
    const cls  = check.pass === true ? 'pass' : check.pass === false ? 'fail' : 'warn';
    if (check.pass === true) passCount++;
    if (check.pass === false) failCount++;

    const row = document.createElement('div');
    row.className = 'diag-row';
    row.innerHTML = `<span class="diag-icon ${cls}">${icon}</span><span class="diag-label">${check.label}</span><span class="diag-detail">${check.detail}</span>`;
    resultsEl.appendChild(row);
  }

  const summary = document.createElement('div');
  if (failCount === 0 && passCount === checks.length) {
    summary.className = 'diag-summary all-pass';
    summary.textContent = 'All systems operational — Phantom is active and injecting noise.';
  } else if (failCount > 0) {
    summary.className = 'diag-summary has-fail';
    summary.textContent = failCount + ' issue' + (failCount > 1 ? 's' : '') + ' found. See details above for how to fix.';
  } else {
    summary.className = 'diag-summary has-fail';
    summary.style.borderColor = '#d29922';
    summary.style.background = '#1a1500';
    summary.style.color = '#d29922';
    summary.textContent = 'Select a website tab and try again.';
  }
  resultsEl.appendChild(summary);
}

document.getElementById('diagBtn').addEventListener('click', runDiagnostic);

// ---- Init ----

(async function init() {
  await populateTabPicker();
  drawPlaceholder(ctxReal, 'Move the mouse on the monitored page');
  drawPlaceholder(ctxNoisy, 'Waiting for data...');
  pollData();
  setInterval(pollData, 5000);
})();
