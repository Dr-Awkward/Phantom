'use strict';

// ---- Canvas replay visualization ----

const canvasReal  = document.getElementById('canvasReal');
const canvasNoisy = document.getElementById('canvasNoisy');
const ctxReal  = canvasReal.getContext('2d');
const ctxNoisy = canvasNoisy.getContext('2d');

const realPoints  = [];
const noisePoints = [];

function drawPoints(ctx, points, color) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);

  // Draw trails
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

  // Draw dots
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

// Simulate demo data for the canvas visualization
function generateDemoReplay() {
  realPoints.length = 0;
  noisePoints.length = 0;

  const w = canvasReal.width;
  const h = canvasReal.height;

  // Generate a clean path (real user)
  let rx = 60, ry = 60;
  for (let i = 0; i < 80; i++) {
    rx += (Math.random() - 0.4) * 12;
    ry += (Math.random() - 0.3) * 8;
    rx = Math.max(10, Math.min(w - 10, rx));
    ry = Math.max(10, Math.min(h - 10, ry));
    realPoints.push({ x: rx, y: ry });
  }

  // Copy real points to noisy canvas, then add ghost trails
  for (const p of realPoints) {
    noisePoints.push({ ...p });
  }

  // Ghost trail 1
  let gx = 200, gy = 40;
  for (let i = 0; i < 60; i++) {
    gx += (Math.random() - 0.5) * 18;
    gy += (Math.random() - 0.3) * 10;
    gx = Math.max(10, Math.min(w - 10, gx));
    gy = Math.max(10, Math.min(h - 10, gy));
    noisePoints.push({ x: gx, y: gy });
  }

  // Ghost trail 2
  gx = 350; gy = 180;
  for (let i = 0; i < 50; i++) {
    gx += (Math.random() - 0.6) * 14;
    gy += (Math.random() - 0.5) * 12;
    gx = Math.max(10, Math.min(w - 10, gx));
    gy = Math.max(10, Math.min(h - 10, gy));
    noisePoints.push({ x: gx, y: gy });
  }

  // Scatter some phantom clicks
  for (let i = 0; i < 20; i++) {
    noisePoints.push({
      x: 30 + Math.random() * (w - 60),
      y: 30 + Math.random() * (h - 60)
    });
  }

  drawPoints(ctxReal, realPoints, '#58a6ff');
  drawPoints(ctxNoisy, noisePoints, '#58a6ff');
}

// ---- Stats polling ----

async function updateStats() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  chrome.tabs.sendMessage(tab.id, { type: 'getPhantomStats' }, (response) => {
    if (chrome.runtime.lastError || !response) return;

    document.getElementById('statGhost').textContent    = (response.ghostMouseEvents || 0).toLocaleString();
    document.getElementById('statClicks').textContent   = (response.phantomClicks || 0).toLocaleString();
    document.getElementById('statScrolls').textContent  = (response.scrollSpoofs || 0).toLocaleString();
    document.getElementById('statKeys').textContent     = (response.keystrokeEvents || 0).toLocaleString();
    document.getElementById('statPersonas').textContent = response.personaRotations || 0;
    document.getElementById('statArchetype').textContent = response.persona || '---';
    document.getElementById('statUptime').textContent   = (response.uptimeMinutes || 0) + ' min';

    // Compute privacy score based on total noise events
    const total = (response.ghostMouseEvents || 0) +
                  (response.phantomClicks || 0) * 10 +
                  (response.scrollSpoofs || 0) * 5 +
                  (response.keystrokeEvents || 0) * 2;
    const minutes = Math.max(1, response.uptimeMinutes || 1);
    const rate = total / minutes;
    const score = Math.min(100, Math.round(rate * 0.5));
    document.getElementById('privacyScore').textContent = score;
  });
}

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
  const sigs = await loadSignatures();
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return;

  // Inject a script to gather all script src URLs on the page
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const scripts = Array.from(document.querySelectorAll('script[src]'));
      return scripts.map(s => s.src);
    }
  });

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

// ---- Export (placeholder — real GIF encoding requires a library) ----

document.getElementById('exportBtn').addEventListener('click', () => {
  // Export both canvases as PNG images for now
  const link = document.createElement('a');
  link.download = 'trackmenot-replay.png';
  link.href = canvasNoisy.toDataURL('image/png');
  link.click();
});

// ---- Init ----

generateDemoReplay();
updateStats();
setInterval(updateStats, 5000);
