'use strict';

// ============================================================
// Minimal test runner — no dependencies
// ============================================================

const suites = [];
let totalPass = 0;
let totalFail = 0;

function describe(name, fn) {
  const suite = { name, tests: [] };
  suites.push(suite);
  window.__currentSuite = suite;
  fn();
  window.__currentSuite = null;
}

function it(name, fn) {
  window.__currentSuite.tests.push({ name, fn });
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || 'Assertion failed');
}

function assertType(val, type, msg) {
  assert(typeof val === type, msg || `Expected type ${type}, got ${typeof val}`);
}

function assertInRange(val, min, max, msg) {
  assert(val >= min && val <= max, msg || `Expected ${val} to be in range [${min}, ${max}]`);
}

// ============================================================
// Test suites
// ============================================================

// ---- PersonaEngine ----

describe('PersonaEngine', () => {
  it('generates a persona with all required fields', () => {
    const p = PersonaEngine.generate();
    assertType(p.archetype, 'string');
    assertType(p.generated, 'number');
    assertType(p.expiresIn, 'number');
    assertType(p.mouseSpeed, 'number');
    assertType(p.mouseJitter, 'number');
    assertType(p.scrollSpeed, 'number');
    assertType(p.clickRate, 'number');
    assertType(p.hoverDwellBase, 'number');
    assertType(p.activityBurstLen, 'number');
    assertType(p.idlePeriodLen, 'number');
    assertType(p.keyNoiseRate, 'number');
  });

  it('archetype is one of the six defined types', () => {
    const valid = ['speedReader', 'carefulBrowser', 'linkHopper', 'windowShopper', 'scanner', 'multitasker'];
    for (let i = 0; i < 20; i++) {
      const p = PersonaEngine.generate();
      assert(valid.includes(p.archetype), `Unexpected archetype: ${p.archetype}`);
    }
  });

  it('get() returns current persona if not expired', () => {
    const p = PersonaEngine.generate();
    const p2 = PersonaEngine.get();
    assert(p === p2, 'get() should return the same persona object');
  });

  it('isExpired() returns true when no persona exists', () => {
    PersonaEngine.currentPersona = null;
    assert(PersonaEngine.isExpired() === true);
  });

  it('expiresIn is between 30 and 120 minutes', () => {
    for (let i = 0; i < 20; i++) {
      const p = PersonaEngine.generate();
      assertInRange(p.expiresIn, 30 * 60 * 1000, 120 * 60 * 1000);
    }
  });

  it('mouseSpeed is in valid range', () => {
    for (let i = 0; i < 30; i++) {
      const p = PersonaEngine.generate();
      // Base range 0.3-1.7 * archetype multiplier up to ~2.5
      assert(p.mouseSpeed > 0, `mouseSpeed should be positive: ${p.mouseSpeed}`);
      assert(p.mouseSpeed < 5, `mouseSpeed unreasonably high: ${p.mouseSpeed}`);
    }
  });
});

// ---- Utility functions ----

describe('Utility Functions', () => {
  it('sleep() returns a promise that resolves', async () => {
    const start = Date.now();
    await sleep(50);
    const elapsed = Date.now() - start;
    assert(elapsed >= 40, `sleep(50) resolved too quickly: ${elapsed}ms`);
  });

  it('shuffle() returns an array of the same length', () => {
    const arr = [1, 2, 3, 4, 5];
    const result = shuffle(arr);
    assert(result.length === arr.length, 'Length mismatch');
  });

  it('shuffle() does not modify the original array', () => {
    const arr = [1, 2, 3, 4, 5];
    const copy = arr.slice();
    shuffle(arr);
    assert(JSON.stringify(arr) === JSON.stringify(copy), 'Original array was modified');
  });

  it('shuffle() contains all original elements', () => {
    const arr = [10, 20, 30, 40, 50];
    const result = shuffle(arr);
    for (const v of arr) {
      assert(result.includes(v), `Missing element: ${v}`);
    }
  });
});

// ---- MouseSynth ----

describe('MouseSynth', () => {
  it('generatePath() returns an array of waypoints', () => {
    const path = MouseSynth.generatePath(0, 0, 100, 100, 10);
    assert(Array.isArray(path), 'Path should be an array');
    assert(path.length >= 11, `Expected at least 11 points, got ${path.length}`);
  });

  it('each waypoint has x, y, and delay', () => {
    const path = MouseSynth.generatePath(50, 50, 200, 200, 5);
    for (const point of path) {
      assertType(point.x, 'number');
      assertType(point.y, 'number');
      assertType(point.delay, 'number');
      assert(point.delay > 0, 'Delay should be positive');
    }
  });

  it('path starts near the start point', () => {
    const path = MouseSynth.generatePath(100, 100, 400, 400, 20);
    const first = path[0];
    assert(Math.abs(first.x - 100) < 10, `Start x too far: ${first.x}`);
    assert(Math.abs(first.y - 100) < 10, `Start y too far: ${first.y}`);
  });

  it('createMouseEvent() returns a MouseEvent', () => {
    const evt = MouseSynth.createMouseEvent('mousemove', 100, 200);
    assert(evt instanceof MouseEvent, 'Should be a MouseEvent');
    assert(evt.clientX === 100, `clientX should be 100, got ${evt.clientX}`);
    assert(evt.clientY === 200, `clientY should be 200, got ${evt.clientY}`);
    assert(evt.type === 'mousemove', `Type should be mousemove, got ${evt.type}`);
  });

  it('createMouseEvent() copies modifier keys from real event', () => {
    const real = new MouseEvent('click', { shiftKey: true, ctrlKey: true });
    const ghost = MouseSynth.createMouseEvent('click', 50, 50, real);
    assert(ghost.shiftKey === true, 'shiftKey should be copied');
    assert(ghost.ctrlKey === true, 'ctrlKey should be copied');
  });

  it('pickDestination() returns {x, y}', () => {
    const dest = MouseSynth.pickDestination();
    assertType(dest.x, 'number');
    assertType(dest.y, 'number');
  });
});

// ---- ScrollSynth ----

describe('ScrollSynth', () => {
  it('has all four scroll patterns defined', () => {
    assert(ScrollSynth.patterns.quickSkim, 'Missing quickSkim');
    assert(ScrollSynth.patterns.carefulRead, 'Missing carefulRead');
    assert(ScrollSynth.patterns.searchAndFind, 'Missing searchAndFind');
    assert(ScrollSynth.patterns.bottomFirst, 'Missing bottomFirst');
  });

  it('each pattern has scrollDelta as a function', () => {
    for (const [name, pattern] of Object.entries(ScrollSynth.patterns)) {
      assertType(pattern.scrollDelta, 'function', `${name}.scrollDelta should be a function`);
      const val = pattern.scrollDelta();
      assertType(val, 'number', `${name}.scrollDelta() should return a number`);
      assert(val > 0, `${name}.scrollDelta() should be positive`);
    }
  });

  it('dispatchScroll() fires without errors', () => {
    let caught = false;
    try {
      ScrollSynth.dispatchScroll(100);
    } catch (e) {
      caught = true;
    }
    assert(!caught, 'dispatchScroll threw an error');
  });
});

// ---- ClickSynth ----

describe('ClickSynth', () => {
  it('safeSelectors is a non-empty array', () => {
    assert(Array.isArray(ClickSynth.safeSelectors));
    assert(ClickSynth.safeSelectors.length > 0);
  });

  it('dangerSelectors includes all critical elements', () => {
    const required = ['a', 'button', 'input', 'form', '[type="submit"]'];
    for (const sel of required) {
      assert(ClickSynth.dangerSelectors.includes(sel), `Missing danger selector: ${sel}`);
    }
  });

  it('isSafe() rejects a button element', () => {
    const btn = document.createElement('button');
    document.body.appendChild(btn);
    assert(ClickSynth.isSafe(btn) === false, 'Button should not be safe');
    btn.remove();
  });

  it('isSafe() rejects an anchor element', () => {
    const a = document.createElement('a');
    a.href = '#';
    document.body.appendChild(a);
    assert(ClickSynth.isSafe(a) === false, 'Anchor should not be safe');
    a.remove();
  });

  it('isSafe() accepts a paragraph element', () => {
    const p = document.createElement('p');
    p.textContent = 'test';
    document.body.appendChild(p);
    assert(ClickSynth.isSafe(p) === true, 'Paragraph should be safe');
    p.remove();
  });

  it('isSafe() rejects a child of a dangerous element', () => {
    const a = document.createElement('a');
    const span = document.createElement('span');
    a.appendChild(span);
    document.body.appendChild(a);
    assert(ClickSynth.isSafe(span) === false, 'Child of anchor should not be safe');
    a.remove();
  });
});

// ---- KeystrokeSynth ----

describe('KeystrokeSynth', () => {
  it('phantomKeys contains only modifier keys', () => {
    const validKeys = ['Shift', 'Control', 'Alt', 'Meta'];
    for (const pk of KeystrokeSynth.phantomKeys) {
      assert(validKeys.includes(pk.key), `Unexpected phantom key: ${pk.key}`);
      assertType(pk.code, 'string');
      assertType(pk.keyCode, 'number');
    }
  });

  it('injectTimingNoise() does not throw', () => {
    const fakeEvent = new KeyboardEvent('keydown', { key: 'a', code: 'KeyA' });
    const listener = function() {};
    const el = document.createElement('div');
    let caught = false;
    try {
      KeystrokeSynth.injectTimingNoise(fakeEvent, listener, el);
    } catch (e) {
      caught = true;
    }
    assert(!caught, 'injectTimingNoise threw an error');
  });

  it('performIdleKeystroke() returns a promise', () => {
    const result = KeystrokeSynth.performIdleKeystroke();
    assert(result instanceof Promise, 'Should return a promise');
  });
});

// ---- HoverSynth ----

describe('HoverSynth', () => {
  it('performHoverSequence() returns a promise', () => {
    const result = HoverSynth.performHoverSequence();
    assert(result instanceof Promise, 'Should return a promise');
  });
});

// ---- Manifest validation ----

describe('Manifest Structure', () => {
  it('seeds.json is valid JSON with an array of strings', async () => {
    const response = await fetch('../seeds.json');
    const data = await response.json();
    assert(Array.isArray(data), 'seeds.json should be an array');
    assert(data.length > 0, 'seeds.json should not be empty');
    for (const item of data) {
      assertType(item, 'string', 'Each seed should be a string');
    }
  });

  it('tracker-signatures.json has valid structure', async () => {
    const response = await fetch('../tracker-signatures.json');
    const data = await response.json();
    assert(data.trackers, 'Should have trackers array');
    assert(Array.isArray(data.trackers), 'trackers should be an array');
    for (const t of data.trackers) {
      assertType(t.name, 'string');
      assert(Array.isArray(t.patterns), `${t.name} should have patterns array`);
      assertType(t.collects, 'string');
    }
  });
});

// ============================================================
// Run all tests
// ============================================================

(async function runTests() {
  const resultsEl = document.getElementById('results');
  const summaryEl = document.getElementById('summary');

  for (const suite of suites) {
    const suiteEl = document.createElement('div');
    suiteEl.className = 'suite';

    const headerEl = document.createElement('div');
    headerEl.className = 'suite-header';
    headerEl.textContent = suite.name;
    suiteEl.appendChild(headerEl);

    for (const test of suite.tests) {
      const rowEl = document.createElement('div');
      rowEl.className = 'test-row';

      try {
        const result = test.fn();
        if (result instanceof Promise) await result;
        totalPass++;
        rowEl.innerHTML = `<span class="icon-pass">&#10003;</span><span class="test-name">${test.name}</span>`;
      } catch (err) {
        totalFail++;
        rowEl.innerHTML = `<span class="icon-fail">&#10007;</span><span class="test-name">${test.name}</span>`;
        const errEl = document.createElement('div');
        errEl.className = 'test-error';
        errEl.textContent = err.message;
        suiteEl.appendChild(rowEl);
        suiteEl.appendChild(errEl);
        continue;
      }

      suiteEl.appendChild(rowEl);
    }

    resultsEl.appendChild(suiteEl);
  }

  const total = totalPass + totalFail;
  if (totalFail === 0) {
    summaryEl.className = 'summary pass';
    summaryEl.textContent = `All ${total} tests passed`;
  } else {
    summaryEl.className = 'summary fail';
    summaryEl.textContent = `${totalFail} of ${total} tests failed`;
  }
})();
