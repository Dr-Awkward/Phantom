// ============================================================
// Scroll Behavior Synthesizer
// ============================================================

'use strict';

const ScrollSynth = {

  patterns: {
    quickSkim: {
      scrollDelta: () => 150 + Math.random() * 300,
      pauseChance: 0.15,
      pauseDuration: () => 500 + Math.random() * 1500,
      direction: 1
    },
    carefulRead: {
      scrollDelta: () => 40 + Math.random() * 80,
      pauseChance: 0.4,
      pauseDuration: () => 2000 + Math.random() * 5000,
      direction: 1
    },
    searchAndFind: {
      scrollDelta: () => 200 + Math.random() * 400,
      pauseChance: 0.05,
      pauseDuration: () => 300 + Math.random() * 500,
      direction: 1,
      reverseAt: 0.6
    },
    bottomFirst: {
      scrollDelta: () => 500 + Math.random() * 800,
      pauseChance: 0.02,
      pauseDuration: () => 200,
      direction: 1,
      reverseAt: 0.95
    }
  },

  dispatchScroll(deltaY) {
    const wheelEvent = new WheelEvent('wheel', {
      bubbles: true,
      cancelable: true,
      deltaX: 0,
      deltaY: deltaY,
      deltaMode: 0
    });
    document.dispatchEvent(wheelEvent);

    const scrollEvent = new Event('scroll', { bubbles: true });
    window.dispatchEvent(scrollEvent);
  },

  async runPattern(patternName) {
    const pattern = this.patterns[patternName];
    if (!pattern) return;

    const pageHeight = document.documentElement.scrollHeight;
    const viewHeight = window.innerHeight;
    let position = 0;
    let direction = pattern.direction;

    const steps = 15 + Math.floor(Math.random() * 25);

    for (let i = 0; i < steps; i++) {
      const delta = pattern.scrollDelta() * direction;
      position += delta;

      if (pattern.reverseAt && position > pageHeight * pattern.reverseAt) {
        direction = -1;
      }
      if (position < 0) position = 0;
      if (position > pageHeight - viewHeight) position = pageHeight - viewHeight;

      this.dispatchScroll(delta);

      if (Math.random() < pattern.pauseChance) {
        await sleep(pattern.pauseDuration());
      } else {
        await sleep(30 + Math.random() * 100);
      }
    }
  }
};
