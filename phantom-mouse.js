// ============================================================
// Mouse Trajectory Synthesizer
// ============================================================

'use strict';

const MouseSynth = {

  ghostX: 0,
  ghostY: 0,
  currentPath: [],
  pathIndex: 0,

  generatePath(startX, startY, endX, endY, steps) {
    const path = [];

    const cp1x = startX + (endX - startX) * 0.3 + (Math.random() - 0.5) * 80;
    const cp1y = startY + (endY - startY) * 0.1 + (Math.random() - 0.5) * 80;
    const cp2x = startX + (endX - startX) * 0.7 + (Math.random() - 0.5) * 60;
    const cp2y = startY + (endY - startY) * 0.9 + (Math.random() - 0.5) * 60;

    for (let i = 0; i <= steps; i++) {
      const t = i / steps;

      const ease = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const u = 1 - ease;
      const x = u*u*u*startX + 3*u*u*ease*cp1x + 3*u*ease*ease*cp2x + ease*ease*ease*endX;
      const y = u*u*u*startY + 3*u*u*ease*cp1y + 3*u*ease*ease*cp2y + ease*ease*ease*endY;

      const jitterX = (Math.random() - 0.5) * 2.5;
      const jitterY = (Math.random() - 0.5) * 2.5;

      path.push({
        x: Math.round(x + jitterX),
        y: Math.round(y + jitterY),
        delay: 8 + Math.random() * 12 + (t < 0.1 || t > 0.9 ? 15 : 0)
      });
    }

    if (Math.random() < 0.3) {
      const overX = endX + (endX - startX) * 0.05 * (Math.random() + 0.5);
      const overY = endY + (endY - startY) * 0.05 * (Math.random() + 0.5);
      path.push(
        { x: Math.round(overX), y: Math.round(overY), delay: 20 },
        { x: Math.round(endX + (Math.random()-0.5)*3), y: Math.round(endY + (Math.random()-0.5)*3), delay: 30 }
      );
    }

    return path;
  },

  pickDestination() {
    const strategies = [
      () => {
        const targets = document.querySelectorAll('a, button, input, [role="button"], img');
        if (targets.length === 0) return null;
        const el = targets[Math.floor(Math.random() * targets.length)];
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + rect.width * (0.2 + Math.random() * 0.6),
          y: rect.top + rect.height * (0.2 + Math.random() * 0.6)
        };
      },
      () => ({
        x: 100 + Math.random() * (window.innerWidth - 200),
        y: 100 + Math.random() * (window.innerHeight - 200)
      }),
      () => {
        const paragraphs = document.querySelectorAll('p, h1, h2, h3, li, td');
        if (paragraphs.length === 0) return null;
        const el = paragraphs[Math.floor(Math.random() * paragraphs.length)];
        const rect = el.getBoundingClientRect();
        return {
          x: rect.left + Math.random() * Math.min(rect.width, 400),
          y: rect.top + rect.height * 0.5
        };
      }
    ];

    const strategy = strategies[Math.floor(Math.random() * strategies.length)];
    return strategy() || { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  },

  createMouseEvent(type, x, y, realEvent) {
    return new MouseEvent(type, {
      bubbles: true,
      cancelable: true,
      view: window,
      clientX: x,
      clientY: y,
      screenX: x + (window.screenX || 0),
      screenY: y + (window.screenY || 0) + 80,
      movementX: (Math.random() - 0.5) * 4,
      movementY: (Math.random() - 0.5) * 4,
      button: type === 'click' ? 0 : (realEvent ? realEvent.button : 0),
      buttons: type === 'mousemove' ? 1 : 0,
      ctrlKey:  realEvent ? realEvent.ctrlKey  : false,
      shiftKey: realEvent ? realEvent.shiftKey : false,
      altKey:   realEvent ? realEvent.altKey   : false,
      metaKey:  realEvent ? realEvent.metaKey  : false
    });
  }
};
