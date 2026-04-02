// ============================================================
// Phantom — EventListener Interception Layer + Orchestrator
// Injected at document_start via content script
// ============================================================

(function() {
  'use strict';

  // ---- Preserve originals before anyone else touches them ----

  const _addEventListener    = EventTarget.prototype.addEventListener;
  const _removeEventListener = EventTarget.prototype.removeEventListener;
  const _dispatchEvent       = EventTarget.prototype.dispatchEvent;

  const listenerMap = new WeakMap();

  const INTERCEPTED_EVENTS = new Set([
    'mousemove', 'click', 'mousedown', 'mouseup',
    'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
    'scroll', 'wheel',
    'pointerdown', 'pointerup', 'pointermove',
    'touchstart', 'touchmove', 'touchend',
    'keydown', 'keyup'
  ]);

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (!INTERCEPTED_EVENTS.has(type) || !listener) {
      return _addEventListener.call(this, type, listener, options);
    }

    const element = this;

    const wrappedListener = function(event) {
      listener.call(element, event);

      if (PhantomEngine.isActive()) {
        PhantomEngine.injectNoise(type, event, element, listener);
      }
    };

    if (!listenerMap.has(listener)) {
      listenerMap.set(listener, new Map());
    }
    listenerMap.get(listener).set(type, wrappedListener);

    return _addEventListener.call(this, type, wrappedListener, options);
  };

  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (listenerMap.has(listener)) {
      const typeMap = listenerMap.get(listener);
      if (typeMap.has(type)) {
        const wrapped = typeMap.get(type);
        typeMap.delete(type);
        return _removeEventListener.call(this, type, wrapped, options);
      }
    }
    return _removeEventListener.call(this, type, listener, options);
  };

  window.__phantomOriginals = {
    addEventListener: _addEventListener,
    removeEventListener: _removeEventListener,
    dispatchEvent: _dispatchEvent
  };

})();

// ============================================================
// Phantom Engine — Orchestrator
// ============================================================

const PhantomEngine = {

  active: false,
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
    const whitelistResult = await new Promise(resolve => {
      chrome.runtime.sendMessage({ type: 'isWhitelisted', domain }, (resp) => {
        resolve(resp && resp.whitelisted);
      });
    });
    if (whitelistResult) {
      this.active = false;
      return;
    }

    const result = await new Promise(resolve => {
      chrome.storage.sync.get('phantom_settings', resolve);
    });
    const settings = result.phantom_settings || {};
    this.active = settings.phantomEnabled !== false;
    this.settings = settings;

    if (this.active) {
      PersonaEngine.generate();
      this.stats.personaRotations = 1;
      this.startActivityCycle();
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
      }
    });
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

  // ---- Called by EventListener intercept layer ----

  injectNoise(eventType, realEvent, element, listener) {
    const persona = PersonaEngine.get();

    switch (eventType) {
      case 'mousemove':
        if (this.isModuleEnabled('mouse')) {
          this.handleMouseNoise(realEvent, element, listener, persona);
        }
        break;
      case 'keydown':
      case 'keyup':
        if (this.isModuleEnabled('keystroke')) {
          KeystrokeSynth.injectTimingNoise(realEvent, listener, element);
          this.stats.keystrokeEvents++;
        }
        break;
    }
  },

  handleMouseNoise(realEvent, element, listener, persona) {
    if (Math.random() < 0.25 * persona.mouseSpeed * this.getIntensityMultiplier()) {
      const offsetX = 200 + Math.random() * 300;
      const offsetY = -50 + Math.random() * 100;
      const ghostEvent = MouseSynth.createMouseEvent(
        'mousemove',
        realEvent.clientX + offsetX,
        realEvent.clientY + offsetY,
        realEvent
      );
      setTimeout(() => {
        listener.call(element, ghostEvent);
        this.stats.ghostMouseEvents++;
      }, 5 + Math.random() * 20);
    }
  },

  // ---- Activity cycle ----

  startActivityCycle() {
    const cycle = async () => {
      if (!this.active) return;

      const persona = PersonaEngine.get();
      const intensity = this.getIntensityMultiplier();
      const burstEnd = Date.now() + persona.activityBurstLen * intensity;

      while (Date.now() < burstEnd && this.active) {
        const action = Math.random();

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

        await sleep(500 + Math.random() * 2000);
      }

      await sleep(persona.idlePeriodLen);

      if (PersonaEngine.isExpired()) {
        PersonaEngine.generate();
        this.stats.personaRotations++;
      }

      if (this.active) cycle();
    };

    setTimeout(cycle, 2000 + Math.random() * 5000);
  },

  enable() {
    this.active = true;
    PersonaEngine.generate();
    this.stats.personaRotations++;
    this.startActivityCycle();
  },

  disable() {
    this.active = false;
  },

  getStats() {
    return {
      ...this.stats,
      persona: PersonaEngine.get()?.archetype || 'none',
      uptimeMinutes: Math.round((Date.now() - this.stats.startTime) / 60000)
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
