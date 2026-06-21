// ============================================================
// Phantom Engine — Orchestrator (ISOLATED content-script world)
// Coordinates noise modules, manages settings, communicates
// with background.js and the MAIN-world interception layer.
// ============================================================

'use strict';

const PhantomEngine = {

  active: false,
  recentPositions: [],
  _lastFlushedStats: null,
  stats: {
    ghostMouseEvents: 0,
    phantomClicks: 0,
    scrollSpoofs: 0,
    keystrokeEvents: 0,
    personaRotations: 0,
    startTime: Date.now()
  },

  async init() {
    // Check whitelist before doing anything
    const domain = window.location.hostname;
    try {
      const whitelistResult = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'isWhitelisted', domain }, (resp) => {
          if (chrome.runtime.lastError) {
            resolve(false);
            return;
          }
          resolve(resp && resp.whitelisted);
        });
      });
      if (whitelistResult) {
        this.active = false;
        this.broadcastState();
        return;
      }
    } catch (e) {
      // If message fails, proceed (assume not whitelisted)
    }

    try {
      const result = await new Promise((resolve) => {
        chrome.storage.sync.get('phantom_settings', (data) => {
          if (chrome.runtime.lastError) {
            resolve({});
            return;
          }
          resolve(data);
        });
      });
      const settings = result.phantom_settings || {};
      this.active = settings.phantomEnabled !== false;
      this.settings = settings;
    } catch (e) {
      this.active = true;
      this.settings = {};
    }

    // Skip iframes if user disabled iframe noise
    if (window !== window.top && this.settings.iframeNoise === false) {
      this.active = false;
      this.broadcastState();
      return;
    }

    // Stand down on pages running aggressive bot-detection / fingerprinting.
    // There the noise is filtered (isTrusted:false) AND can feed a bot/fraud
    // score, so injecting is pure downside. Top frame only, to bound cost.
    if (this.active && window === window.top) {
      try {
        const suppressPatterns = await this.loadSuppressPatterns();
        if (suppressPatterns.length && this.pageUsesAny(suppressPatterns)) {
          this.active = false;
          this.broadcastState();
          return;
        }
        this.watchForHostile(suppressPatterns);
      } catch (e) {
        // Detection is best-effort; never block activation on its failure.
      }
    }

    if (this.active) {
      PersonaEngine.generate();
      this.stats.personaRotations = 1;
      this.broadcastState();
      this.startActivityCycle();

      // Record mouse positions for dashboard replay. Synthetic events are always
      // isTrusted:false (unforgeable in Chrome) and real input is isTrusted:true,
      // so this cleanly separates ghost from real.
      document.addEventListener('mousemove', (e) => {
        this.recordPosition(e.clientX, e.clientY, !e.isTrusted);
      }, true);

      this.startSessionFlush();
    }

    chrome.storage.onChanged.addListener((changes) => {
      try {
        if (changes.phantom_settings) {
          this.settings = changes.phantom_settings.newValue || this.settings;
          const wasActive = this.active;
          this.active = this.settings.phantomEnabled !== false;
          if (this.active && !wasActive) {
            this.enable();
          } else if (!this.active && wasActive) {
            this.disable();
          }
          this.broadcastState();
        }
      } catch (e) {
        // Context invalidated or transient — either way, settings
        // update failed. The engine keeps running with existing settings.
      }
    });
  },

  // ---- Bot-detection stand-down ----
  // Phantom's synthetic events can't fool isTrusted, and on aggressive anti-bot /
  // fingerprinting systems they can actively raise a bot score. Where a tracker
  // is flagged `suppress` in tracker-signatures.json, we disable injection.

  async loadSuppressPatterns() {
    try {
      const url = chrome.runtime.getURL('tracker-signatures.json');
      const data = await (await fetch(url)).json();
      return (data.trackers || [])
        .filter(t => t.suppress === true)
        .reduce((acc, t) => acc.concat(t.patterns || []), []);
    } catch (e) {
      return [];
    }
  },

  pageResourceUrls() {
    const urls = [];
    try { document.querySelectorAll('script[src]').forEach(s => urls.push(s.src)); } catch (e) {}
    try { performance.getEntriesByType('resource').forEach(r => urls.push(r.name)); } catch (e) {}
    return urls;
  },

  pageUsesAny(patterns) {
    const urls = this.pageResourceUrls();
    return patterns.some(p => urls.some(u => u.indexOf(p) !== -1));
  },

  watchForHostile(patterns) {
    if (!patterns || !patterns.length || typeof PerformanceObserver === 'undefined') return;
    try {
      const obs = new PerformanceObserver((list) => {
        const hit = list.getEntries().some(e =>
          patterns.some(p => (e.name || '').indexOf(p) !== -1));
        if (hit && this.active) {
          obs.disconnect();
          this.disable();  // stand down; broadcasts state to the MAIN world
        }
      });
      obs.observe({ type: 'resource', buffered: false });
      this._hostileObserver = obs;
    } catch (e) {}
  },

  // ---- Send state to the MAIN-world interception layer ----

  broadcastState() {
    try {
      window.postMessage({
        type: '__phantom_state__',
        active: this.active,
        persona: PersonaEngine.currentPersona,
        intensity: this.getIntensityMultiplier(),
        modules: {
          mouse: this.isModuleEnabled('mouse'),
          keystroke: this.isModuleEnabled('keystroke')
        }
      }, '*');
    } catch (e) {
      // postMessage failed — non-critical
    }
  },

  recordPosition(x, y, ghost) {
    if (this.recentPositions.length >= 200) {
      this.recentPositions.shift();
    }
    this.recentPositions.push({ x, y, ghost });
  },

  startSessionFlush() {
    this._flushInterval = setInterval(() => {
      try {
        if (!this.active) return;
        const current = this.stats;
        const last = this._lastFlushedStats || {
          ghostMouseEvents: 0, phantomClicks: 0, scrollSpoofs: 0,
          keystrokeEvents: 0, personaRotations: 0
        };
        const delta = {};
        let hasChanges = false;
        for (const key of ['ghostMouseEvents', 'phantomClicks', 'scrollSpoofs', 'keystrokeEvents', 'personaRotations']) {
          delta[key] = (current[key] || 0) - (last[key] || 0);
          if (delta[key] > 0) hasChanges = true;
        }
        if (hasChanges) {
          chrome.runtime.sendMessage({ type: 'flushStats', stats: delta }, () => {
            if (chrome.runtime.lastError) return;
          });
        }
        this._lastFlushedStats = { ...current };
      } catch (e) {
        // Context invalidated — stop the interval so it doesn't spam.
        // Do NOT set this.active = false — the noise engine doesn't need
        // Chrome APIs to keep poisoning trackers. Only stat flushing dies.
        if (e.message && e.message.includes('Extension context invalidated')) {
          clearInterval(this._flushInterval);
        }
        // Transient errors (service worker dormancy, etc.): do nothing,
        // the interval tries again in 30 seconds.
      }
    }, 30000);
  },

  isActive() {
    return this.active;
  },

  isModuleEnabled(module) {
    if (!this.settings) return true;
    const key = module + 'Noise';
    return this.settings[key] !== false;
  },

  getIntensityMultiplier() {
    const intensity = (this.settings && this.settings.noiseIntensity) || 'medium';
    switch (intensity) {
      case 'low':    return 0.3;
      case 'high':   return 2.0;
      default:       return 1.0;
    }
  },

  // ---- Activity cycle ----

  startActivityCycle() {
    const cycle = async () => {
      if (!this.active) return;

      try {
        const persona = PersonaEngine.get();
        const intensity = this.getIntensityMultiplier();
        const burstEnd = Date.now() + persona.activityBurstLen * intensity;

        while (Date.now() < burstEnd && this.active) {
          const action = Math.random();

          try {
            if (action < 0.3 && this.isModuleEnabled('mouse')) {
              const dest = MouseSynth.pickDestination();
              const path = MouseSynth.generatePath(
                MouseSynth.ghostX, MouseSynth.ghostY,
                dest.x, dest.y,
                15 + Math.floor(Math.random() * 20)
              );
              for (const point of path) {
                if (!this.active) return;
                // movementX/Y must match the real step delta — a constant
                // random value contradicts the position and flags the event.
                const movementX = point.x - MouseSynth.ghostX;
                const movementY = point.y - MouseSynth.ghostY;
                const event = MouseSynth.createMouseEvent('mousemove', point.x, point.y, null, movementX, movementY);
                const target = document.elementFromPoint(point.x, point.y);
                if (target) target.dispatchEvent(event);
                MouseSynth.ghostX = point.x;
                MouseSynth.ghostY = point.y;
                this.stats.ghostMouseEvents++;
                await sleep(point.delay / persona.mouseSpeed);
              }
            }
            else if (action < 0.5 && this.isModuleEnabled('hover')) {
              await HoverSynth.performHoverSequence();
            }
            else if (action < 0.65 && this.isModuleEnabled('click')) {
              if (Math.random() < persona.rageClickChance) {
                await ClickSynth.performRageClick();
              } else {
                await ClickSynth.performPhantomClick();
              }
              this.stats.phantomClicks++;
            }
            else if (action < 0.8 && this.isModuleEnabled('scroll')) {
              const patterns = Object.keys(ScrollSynth.patterns);
              const pattern = persona.preferredPattern ||
                patterns[Math.floor(Math.random() * patterns.length)];
              await ScrollSynth.runPattern(pattern);
              this.stats.scrollSpoofs++;
            }
            else if (this.isModuleEnabled('keystroke')) {
              await KeystrokeSynth.performIdleKeystroke();
              this.stats.keystrokeEvents++;
            }
          } catch (e) {
            // Individual action failed — continue cycle
          }

          await sleep(500 + Math.random() * 2000);
        }

        await sleep(persona.idlePeriodLen);

        if (PersonaEngine.isExpired()) {
          PersonaEngine.generate();
          this.stats.personaRotations++;
          this.broadcastState();
        }
      } catch (e) {
        if (e.message && e.message.includes('Extension context invalidated')) {
          this.active = false;
          return;
        }
        // Transient error (DOM churn, persona timing, etc.) — wait and retry
        await sleep(5000);
      }

      if (this.active) cycle();
    };

    setTimeout(cycle, 2000 + Math.random() * 5000);
  },

  enable() {
    this.active = true;
    PersonaEngine.generate();
    this.stats.personaRotations++;
    this.broadcastState();
    this.startActivityCycle();
  },

  disable() {
    this.active = false;
    this.broadcastState();
  },

  getStats() {
    return {
      ...this.stats,
      persona: PersonaEngine.get()?.archetype || 'none',
      uptimeMinutes: Math.round((Date.now() - this.stats.startTime) / 60000),
      recentPositions: this.recentPositions,
      viewportWidth: window.innerWidth,
      viewportHeight: window.innerHeight
    };
  }
};

// ---- Message handler for popup/dashboard communication ----
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  try {
    if (msg.type === 'getPhantomStats') {
      sendResponse(PhantomEngine.getStats());
      return true;
    }
    if (msg.type === 'setPhantomActive') {
      if (msg.active) {
        PhantomEngine.enable();
      } else {
        PhantomEngine.disable();
      }
      sendResponse({ ok: true });
      return true;
    }
  } catch (e) {
    // Context dead — nothing to respond to
  }
});

// ---- Boot ----
PhantomEngine.init();
