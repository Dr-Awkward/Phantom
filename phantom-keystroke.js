// ============================================================
// Keystroke Timing Noise
// ============================================================

'use strict';

const KeystrokeSynth = {

  phantomKeys: [
    { key: 'Shift',   code: 'ShiftLeft',   keyCode: 16 },
    { key: 'Control', code: 'ControlLeft', keyCode: 17 },
    { key: 'Alt',     code: 'AltLeft',     keyCode: 18 },
    { key: 'Meta',    code: 'MetaLeft',    keyCode: 91 }
  ],

  injectTimingNoise(realEvent, listener, element) {
    if (Math.random() < 0.15) {
      const phantom = this.phantomKeys[
        Math.floor(Math.random() * this.phantomKeys.length)
      ];

      const delay = 5 + Math.random() * 30;
      setTimeout(() => {
        const downEvent = new KeyboardEvent('keydown', {
          key: phantom.key,
          code: phantom.code,
          keyCode: phantom.keyCode,
          bubbles: true,
          cancelable: true
        });
        const upEvent = new KeyboardEvent('keyup', {
          key: phantom.key,
          code: phantom.code,
          keyCode: phantom.keyCode,
          bubbles: true,
          cancelable: true
        });

        listener.call(element, downEvent);
        setTimeout(() => listener.call(element, upEvent), 20 + Math.random() * 40);
      }, delay);
    }
  },

  async performIdleKeystroke() {
    const phantom = this.phantomKeys[
      Math.floor(Math.random() * this.phantomKeys.length)
    ];

    const event = new KeyboardEvent('keydown', {
      key: phantom.key,
      code: phantom.code,
      keyCode: phantom.keyCode,
      bubbles: true
    });
    document.dispatchEvent(event);

    await sleep(100 + Math.random() * 300);

    const upEvent = new KeyboardEvent('keyup', {
      key: phantom.key,
      code: phantom.code,
      keyCode: phantom.keyCode,
      bubbles: true
    });
    document.dispatchEvent(upEvent);
  }
};
