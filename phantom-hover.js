// ============================================================
// Hover Dwell Time Randomizer
// ============================================================

'use strict';

const HoverSynth = {

  async performHoverSequence() {
    const targets = document.querySelectorAll(
      'a, button, img, [class*="card"], [class*="item"], ' +
      '[class*="product"], [class*="result"], h2, h3'
    );

    if (targets.length === 0) return;

    const count = 2 + Math.floor(Math.random() * 4);
    const selected = shuffle(Array.from(targets)).slice(0, count);

    for (const el of selected) {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) continue;
      if (rect.top < 0 || rect.top > window.innerHeight) continue;

      const x = rect.left + rect.width * (0.3 + Math.random() * 0.4);
      const y = rect.top + rect.height * (0.3 + Math.random() * 0.4);

      el.dispatchEvent(MouseSynth.createMouseEvent('mouseenter', x, y));
      el.dispatchEvent(MouseSynth.createMouseEvent('mouseover', x, y));

      const microMoves = 2 + Math.floor(Math.random() * 4);
      for (let i = 0; i < microMoves; i++) {
        await sleep(200 + Math.random() * 600);
        const mx = x + (Math.random() - 0.5) * 15;
        const my = y + (Math.random() - 0.5) * 10;
        el.dispatchEvent(MouseSynth.createMouseEvent('mousemove', mx, my));
      }

      const dwellTime = 400 + Math.random() * 2800;
      await sleep(dwellTime);

      el.dispatchEvent(MouseSynth.createMouseEvent('mouseleave', x, y));
      el.dispatchEvent(MouseSynth.createMouseEvent('mouseout', x, y));

      await sleep(300 + Math.random() * 1200);
    }
  }
};
