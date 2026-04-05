// ============================================================
// Phantom — Event Listener Interception (MAIN world)
// Injected at document_start BEFORE any page scripts load.
// This file runs in the page's JavaScript world so that
// prototype wrapping actually affects tracker scripts.
// ============================================================

(function() {
  'use strict';

  var _addEventListener    = EventTarget.prototype.addEventListener;
  var _removeEventListener = EventTarget.prototype.removeEventListener;

  var listenerMap = new WeakMap();

  // State — updated by the ISOLATED content-script world via postMessage
  var active    = false;
  var persona   = null;
  var intensity = 1.0;
  var modules   = {};

  var INTERCEPTED = new Set([
    'mousemove', 'click', 'mousedown', 'mouseup',
    'mouseenter', 'mouseleave', 'mouseover', 'mouseout',
    'scroll', 'wheel',
    'pointerdown', 'pointerup', 'pointermove',
    'touchstart', 'touchmove', 'touchend',
    'keydown', 'keyup'
  ]);

  // Events blocked by Permissions Policy on many sites.
  // Pass these directly to the original without routing through our wrapper
  // to avoid Chrome attributing the policy violation to this file.
  var POLICY_BLOCKED = new Set(['unload', 'beforeunload']);

  var PHANTOM_KEYS = [
    { key: 'Shift',   code: 'ShiftLeft',   keyCode: 16 },
    { key: 'Control', code: 'ControlLeft', keyCode: 17 },
    { key: 'Alt',     code: 'AltLeft',     keyCode: 18 },
    { key: 'Meta',    code: 'MetaLeft',    keyCode: 91 }
  ];

  // ---- Wrap addEventListener ----

  EventTarget.prototype.addEventListener = function(type, listener, options) {
    if (POLICY_BLOCKED.has(type)) {
      try { return _addEventListener.call(this, type, listener, options); } catch(e) {}
      return;
    }

    if (!INTERCEPTED.has(type) || !listener) {
      return _addEventListener.call(this, type, listener, options);
    }

    var element = this;

    var wrappedListener = function(event) {
      // Real event always passes through first
      try { listener.call(element, event); } catch(e) {}

      if (!active || !persona) return;

      if (type === 'mousemove' && modules.mouse !== false) {
        injectMouseNoise(event, element, listener);
      } else if ((type === 'keydown' || type === 'keyup') && modules.keystroke !== false) {
        injectKeystrokeNoise(event, listener, element);
      }
    };

    if (!listenerMap.has(listener)) {
      listenerMap.set(listener, new Map());
    }
    listenerMap.get(listener).set(type, wrappedListener);

    return _addEventListener.call(this, type, wrappedListener, options);
  };

  // ---- Wrap removeEventListener ----

  EventTarget.prototype.removeEventListener = function(type, listener, options) {
    if (listenerMap.has(listener)) {
      var typeMap = listenerMap.get(listener);
      if (typeMap.has(type)) {
        var wrapped = typeMap.get(type);
        typeMap.delete(type);
        return _removeEventListener.call(this, type, wrapped, options);
      }
    }
    return _removeEventListener.call(this, type, listener, options);
  };

  // ---- Noise helpers ----

  function injectMouseNoise(realEvent, element, listener) {
    if (Math.random() < 0.25 * persona.mouseSpeed * intensity) {
      var offsetX = 200 + Math.random() * 300;
      var offsetY = -50 + Math.random() * 100;
      var ghostEvent = new MouseEvent('mousemove', {
        bubbles: true, cancelable: true, view: window,
        clientX: realEvent.clientX + offsetX,
        clientY: realEvent.clientY + offsetY,
        screenX: realEvent.clientX + offsetX + (window.screenX || 0),
        screenY: realEvent.clientY + offsetY + (window.screenY || 0) + 80,
        movementX: (Math.random() - 0.5) * 4,
        movementY: (Math.random() - 0.5) * 4,
        ctrlKey:  realEvent.ctrlKey,
        shiftKey: realEvent.shiftKey,
        altKey:   realEvent.altKey,
        metaKey:  realEvent.metaKey
      });
      setTimeout(function() {
        try { listener.call(element, ghostEvent); } catch(e) {}
      }, 5 + Math.random() * 20);
    }
  }

  function injectKeystrokeNoise(realEvent, listener, element) {
    if (Math.random() < 0.15) {
      var pk = PHANTOM_KEYS[Math.floor(Math.random() * PHANTOM_KEYS.length)];
      setTimeout(function() {
        try {
          var down = new KeyboardEvent('keydown', {
            key: pk.key, code: pk.code, keyCode: pk.keyCode,
            bubbles: true, cancelable: true
          });
          var up = new KeyboardEvent('keyup', {
            key: pk.key, code: pk.code, keyCode: pk.keyCode,
            bubbles: true, cancelable: true
          });
          listener.call(element, down);
          setTimeout(function() {
            try { listener.call(element, up); } catch(e) {}
          }, 20 + Math.random() * 40);
        } catch(e) {}
      }, 5 + Math.random() * 30);
    }
  }

  // ---- Cross-world communication ----
  // Receive state updates from the ISOLATED content-script world.

  _addEventListener.call(window, 'message', function(event) {
    if (event.source !== window || !event.data) return;
    if (event.data.type === '__phantom_state__') {
      active    = !!event.data.active;
      persona   = event.data.persona || null;
      intensity = event.data.intensity || 1.0;
      modules   = event.data.modules || {};
    }
  });

})();
