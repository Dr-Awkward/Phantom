// ============================================================
// Click Pattern Spoofing
// ============================================================

'use strict';

const ClickSynth = {

  safeSelectors: [
    'p', 'span', 'div:not([onclick])', 'h1', 'h2', 'h3',
    'li', 'td', 'th', 'article', 'section', 'header',
    'footer', 'aside', 'main', 'figure', 'figcaption',
    'blockquote', 'label:not([for])', 'img'
  ],

  dangerSelectors: [
    'a', 'button', 'input', 'select', 'textarea',
    '[role="button"]', '[role="link"]', '[onclick]',
    'form', '[type="submit"]', '.checkout', '.purchase',
    '.buy', '.delete', '.remove', '.confirm'
  ],

  isSafe(element) {
    let el = element;
    while (el && el !== document.body) {
      for (const sel of this.dangerSelectors) {
        if (el.matches && el.matches(sel)) return false;
      }
      el = el.parentElement;
    }
    return true;
  },

  async performPhantomClick() {
    const allSafe = document.querySelectorAll(this.safeSelectors.join(', '));
    if (allSafe.length === 0) return;

    const target = allSafe[Math.floor(Math.random() * allSafe.length)];
    if (!this.isSafe(target)) return;

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const x = rect.left + rect.width * (0.15 + Math.random() * 0.7);
    const y = rect.top + rect.height * (0.15 + Math.random() * 0.7);

    const downDelay = 50 + Math.random() * 80;
    const upDelay   = 10 + Math.random() * 30;

    target.dispatchEvent(MouseSynth.createMouseEvent('mousedown', x, y));
    await sleep(downDelay);
    target.dispatchEvent(MouseSynth.createMouseEvent('mouseup', x, y));
    await sleep(upDelay);
    target.dispatchEvent(MouseSynth.createMouseEvent('click', x, y));
  },

  async performRageClick() {
    const allSafe = document.querySelectorAll(this.safeSelectors.join(', '));
    if (allSafe.length === 0) return;

    const target = allSafe[Math.floor(Math.random() * allSafe.length)];
    if (!this.isSafe(target)) return;

    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const baseX = rect.left + rect.width * 0.5;
    const baseY = rect.top + rect.height * 0.5;

    const count = 3 + Math.floor(Math.random() * 3);
    for (let i = 0; i < count; i++) {
      const x = baseX + (Math.random() - 0.5) * 10;
      const y = baseY + (Math.random() - 0.5) * 10;
      target.dispatchEvent(MouseSynth.createMouseEvent('click', x, y));
      await sleep(80 + Math.random() * 120);
    }
  }
};
