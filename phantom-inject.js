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
  var _toString            = Function.prototype.toString;

  // Capture native toString representations BEFORE wrapping
  var _nativeAEL      = _toString.call(_addEventListener);
  var _nativeREL      = _toString.call(_removeEventListener);
  var _nativeToString = _toString.call(_toString);

  // NOTE: isTrusted is deliberately NOT spoofed. In Chrome it is a
  // non-configurable own property on every event instance ([LegacyUnforgeable]):
  // defineProperty throws and there is no prototype accessor to override, so a
  // scripted event cannot be made to look trusted from page JS. A tracker that
  // gates on `if (!e.isTrusted) return;` discards all of this noise; we only
  // reach trackers that do not check the flag. (See CLAUDE.md.)
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
    if (new.target) throw new TypeError('Illegal invocation');
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
    if (new.target) throw new TypeError('Illegal invocation');
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

  // ---- Anti-detection: property patches ----
  // Native addEventListener has name="addEventListener" and length=2.
  // Our wrapper inherits different values. Patch them to match.

  Object.defineProperty(EventTarget.prototype.addEventListener, 'name',
    { value: 'addEventListener', configurable: true });
  Object.defineProperty(EventTarget.prototype.addEventListener, 'length',
    { value: 2, configurable: true });
  Object.defineProperty(EventTarget.prototype.removeEventListener, 'name',
    { value: 'removeEventListener', configurable: true });
  Object.defineProperty(EventTarget.prototype.removeEventListener, 'length',
    { value: 2, configurable: true });

  // ---- Anti-detection: toString spoofing ----
  // Fingerprinting scripts check addEventListener.toString() for "[native code]".
  // We override Function.prototype.toString to return the saved native strings
  // for any function Phantom has replaced. The override also hides itself.

  Function.prototype.toString = function toString() {
    if (this === EventTarget.prototype.addEventListener) return _nativeAEL;
    if (this === EventTarget.prototype.removeEventListener) return _nativeREL;
    if (this === Function.prototype.toString) return _nativeToString;
    return _toString.call(this);
  };

  Object.defineProperty(Function.prototype.toString, 'name',
    { value: 'toString', configurable: true });
  Object.defineProperty(Function.prototype.toString, 'length',
    { value: 0, configurable: true });

  // Persistent ghost-cursor state. A tracker that checks trajectory continuity
  // drops events that jump impossibly far between frames, so the ghost moves
  // like a hand: small velocity-limited steps along an eased path toward a
  // slowly drifting target, never teleporting.
  var ghost = { x: null, y: null, tx: 0, ty: 0 };

  function pickGhostTarget(seedX, seedY) {
    var angle = Math.random() * Math.PI * 2;
    var dist  = 60 + Math.random() * 240;
    var maxX  = window.innerWidth  || 1920;
    var maxY  = window.innerHeight || 1080;
    ghost.tx = Math.max(0, Math.min(maxX, seedX + Math.cos(angle) * dist));
    ghost.ty = Math.max(0, Math.min(maxY, seedY + Math.sin(angle) * dist));
  }

  function makeGhostMove(x, y, mvX, mvY, realEvent) {
    return new MouseEvent('mousemove', {
      bubbles: true, cancelable: true, view: window,
      clientX: x, clientY: y,
      screenX: x + (window.screenX || 0),
      screenY: y + (window.screenY || 0) + 80,
      movementX: mvX, movementY: mvY,
      ctrlKey:  realEvent.ctrlKey,
      shiftKey: realEvent.shiftKey,
      altKey:   realEvent.altKey,
      metaKey:  realEvent.metaKey
    });
  }

  // ---- Noise helpers ----

  function injectMouseNoise(realEvent, element, listener) {
    if (Math.random() >= 0.25 * persona.mouseSpeed * intensity) return;

    // Seed the ghost near the real cursor the first time it runs.
    if (ghost.x === null) {
      ghost.x = realEvent.clientX;
      ghost.y = realEvent.clientY;
      pickGhostTarget(ghost.x, ghost.y);
    }

    var steps   = 3 + Math.floor(Math.random() * 4);  // short burst of small moves
    var maxStep = 22;                                 // px/frame ceiling -> human velocity
    var jit     = persona.mouseJitter || 1;
    var delay   = 0;

    for (var i = 0; i < steps; i++) {
      var dx = ghost.tx - ghost.x;
      var dy = ghost.ty - ghost.y;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        pickGhostTarget(ghost.x, ghost.y);
        dx = ghost.tx - ghost.x;
        dy = ghost.ty - ghost.y;
      }

      var ease  = 0.18 + Math.random() * 0.12;
      var stepX = dx * ease + (Math.random() - 0.5) * 2 * jit;
      var stepY = dy * ease + (Math.random() - 0.5) * 2 * jit;
      stepX = Math.max(-maxStep, Math.min(maxStep, stepX));
      stepY = Math.max(-maxStep, Math.min(maxStep, stepY));

      var nx  = Math.round(ghost.x + stepX);
      var ny  = Math.round(ghost.y + stepY);
      var mvX = nx - ghost.x;
      var mvY = ny - ghost.y;
      ghost.x = nx;
      ghost.y = ny;

      delay += 8 + Math.random() * 12;
      (function(px, py, m1, m2, d) {
        setTimeout(function() {
          try { listener.call(element, makeGhostMove(px, py, m1, m2, realEvent)); } catch (e) {}
        }, d);
      })(nx, ny, mvX, mvY, delay);
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
