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

    if (this.active) {
      PersonaEngine.generate();
      this.stats.personaRotations = 1;
      this.broadcastState();
      this.startActivityCycle();

      // Record mouse positions for dashboard replay
      document.addEventListener('mousemove', (e) => {
        this.recordPosition(e.clientX, e.clientY, !e.isTrusted);
      }, true);

      this.startSessionFlush();
    }

    chrome.storage.onChanged.addListener((changes) => {
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
    });
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
    setInterval(() => {
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
                const event = MouseSynth.createMouseEvent('mousemove', point.x, point.y);
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
        // Cycle error — wait and retry
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
});

// ---- Boot ----
PhantomEngine.init();
