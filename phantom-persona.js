// ============================================================
// Persona Engine + Shared Utilities
// Loaded first — provides sleep(), shuffle(), and PersonaEngine
// ============================================================

'use strict';

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const PersonaEngine = {

  currentPersona: null,

  generate() {
    const archetypes = [
      'speedReader',
      'carefulBrowser',
      'linkHopper',
      'windowShopper',
      'scanner',
      'multitasker'
    ];

    const archetype = archetypes[Math.floor(Math.random() * archetypes.length)];

    const persona = {
      archetype,
      generated: Date.now(),
      expiresIn: (30 + Math.random() * 90) * 60 * 1000,

      mouseSpeed:       0.3 + Math.random() * 1.4,
      mouseJitter:      0.5 + Math.random() * 2.0,
      overshootChance:  0.1 + Math.random() * 0.3,

      scrollSpeed:      0.4 + Math.random() * 1.2,
      scrollPauseRate:  0.05 + Math.random() * 0.4,
      preferredPattern: null,

      clickRate:        0.01 + Math.random() * 0.08,
      clickHoldTime:    50 + Math.random() * 100,
      rageClickChance:  Math.random() * 0.03,

      hoverDwellBase:   300 + Math.random() * 2000,
      hoverCount:       2 + Math.floor(Math.random() * 6),

      activityBurstLen: 5000 + Math.random() * 20000,
      idlePeriodLen:    3000 + Math.random() * 15000,

      keyNoiseRate:     0.05 + Math.random() * 0.2
    };

    switch (archetype) {
      case 'speedReader':
        persona.scrollSpeed *= 1.5;
        persona.scrollPauseRate *= 0.3;
        persona.hoverDwellBase *= 0.4;
        persona.preferredPattern = 'quickSkim';
        break;
      case 'carefulBrowser':
        persona.scrollSpeed *= 0.5;
        persona.scrollPauseRate *= 2.0;
        persona.hoverDwellBase *= 1.8;
        persona.hoverCount += 3;
        persona.preferredPattern = 'carefulRead';
        break;
      case 'linkHopper':
        persona.clickRate *= 2.5;
        persona.mouseSpeed *= 1.3;
        persona.scrollSpeed *= 0.6;
        persona.preferredPattern = 'searchAndFind';
        break;
      case 'windowShopper':
        persona.hoverDwellBase *= 1.5;
        persona.hoverCount += 4;
        persona.clickRate *= 0.3;
        persona.preferredPattern = 'carefulRead';
        break;
      case 'scanner':
        persona.scrollSpeed *= 1.8;
        persona.scrollPauseRate *= 0.2;
        persona.mouseSpeed *= 1.5;
        persona.preferredPattern = 'searchAndFind';
        break;
      case 'multitasker':
        persona.activityBurstLen *= 0.5;
        persona.idlePeriodLen *= 1.5;
        persona.preferredPattern = 'quickSkim';
        break;
    }

    this.currentPersona = persona;
    return persona;
  },

  isExpired() {
    if (!this.currentPersona) return true;
    return Date.now() - this.currentPersona.generated > this.currentPersona.expiresIn;
  },

  get() {
    if (this.isExpired()) this.generate();
    return this.currentPersona;
  }
};
