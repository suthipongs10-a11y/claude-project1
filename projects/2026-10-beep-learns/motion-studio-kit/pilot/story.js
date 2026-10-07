// EPISODE TIMING (shared by episode.js and kit/audio.cjs)
(function (root) {
  const STORY = {
    DURATION: 17,
    TITLE: { text: 'BEEP in JAPAN', sub: 'Episode 1 · The Bow', end: 3.2, bg: '#FF7AA2' },
    END: { a: 12.4, words: [{ word: 'Konnichiwa!', meaning: '= Hello!' }, { word: 'Ojigi', meaning: '= the polite bow', note: 'not too deep, BEEP!' }], cta: 'Where should BEEP go next?' },
    NAMES: { B: ['BEEP', '#7FF6FF'], A: ['AIKO', '#FF9EB5'] },
    VO: [['a_hello', 4.4], ['b_hello', 9.6]],
    SHAKE: [[8.2, 12]],
    SFX: [
      { type: 'fanfare', t: .1 }, { type: 'pop', t: .3 }, { type: 'pop', t: .45, p: 1.1 }, { type: 'pop', t: .6, p: 1.2 }, { type: 'pop', t: .75, p: 1.3 },
      { type: 'zoom', t: 3.2 }, { type: 'camera', t: 3.9 }, { type: 'beepQ', t: 5.6 }, { type: 'ding', t: 6.5 }, { type: 'compute', t: 7.2, d: .7 },
      { type: 'slideDown', t: 7.95, d: .25 }, { type: 'bonk', t: 8.2 }, { type: 'boing', t: 8.6 }, { type: 'dizzy', t: 8.4, d: 1 }, { type: 'tweet', t: 8.4, d: 1.8 },
      { type: 'clap', t: 10.8 }, { type: 'clap', t: 11.05 }, { type: 'clap', t: 11.3 }, { type: 'mrrp', t: 10.9 }, { type: 'iris', t: 11.6, d: .8 }, { type: 'tada', t: 12.5 },
      ...[3.3, 3.55, 3.8].map(t => ({ type: 'bubble', t, n: 1 })),
    ],
    MUSIC: [
      { a: 3.2, b: 12.4, style: 'chill', key: 62, scale: 'japan', lead: 'koto', bpm: 96 },
      { a: 12.4, b: 17, style: 'travel', key: 60, scale: 'pent', lead: 'glock', bpm: 116 },
    ],
  };
  if (typeof module !== 'undefined') module.exports = STORY; else root.STORY = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
