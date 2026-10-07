// EPISODE TIMING: BEEP in GERMANY — The Bottle Bank (9:16, 120 s)
(function (root) {
  const sfx = (type, t, o = {}) => Object.assign({ type, t }, o);
  const STORY = {
    DURATION: 120,
    TITLE: { text: 'BEEP in GERMANY', sub: 'Episode 2 · The Bottle Bank', end: 3.2, bg: '#FFC145' },
    END: { a: 114.5, words: [{ word: 'Pfand', meaning: '= bottle deposit', note: 'bring it back!' }, { word: 'Prost!', meaning: '= Cheers!', note: 'look in the eyes' }, { word: 'Rot / Grün', meaning: '= red / green', note: 'wait for green' }], cta: 'Where should BEEP go next?' },
    NAMES: { B: ['BEEP', '#7FF6FF'], K: ['KLARA', '#9BFF6A'], J: ['JONAS', '#FFC145'], C: ['LENA', '#FF9EB5'] },
    VO: [['b_trash', 19.2], ['k_pfand', 24.3], ['b_pfand', 26.0], ['j_prost', 65.0], ['b_eyes', 71.0], ['b_prost', 79.6], ['c_rot', 99.9], ['b_wait', 102.0]],
    SHAKE: [[31.3, 10], [80.5, 8], [98.9, 6]],
    SFX: [
      sfx('fanfare', .1), sfx('pop', .3), sfx('pop', .45, { p: 1.1 }), sfx('pop', .6, { p: 1.2 }), sfx('pop', .75, { p: 1.3 }),
      ...[3.3, 3.55, 3.8].map(t => sfx('bubble', t, { n: 1 })),
      // arrival
      sfx('zoom', 3.2), sfx('land', 4.1), sfx('mrrp', 4.7), sfx('beepQ', 6.6), sfx('ding', 8.0), sfx('slurp', 10.0, { d: 1.6 }), sfx('ahh', 12.0), sfx('beepHappy', 12.4),
      // gag 1: Pfand
      sfx('whoosh', 14.0), sfx('hop', 15.4), sfx('ding', 17.6), sfx('whoosh', 19.4, { d: .5 }), sfx('thunk', 20.1), sfx('footsteps', 20.5, { d: 2.4 }), sfx('beepQ', 25.9), sfx('pop', 27.4),
      sfx('whoosh', 28.0), sfx('compute', 30.2, { d: .7 }), sfx('beepAlarm', 31.0), sfx('bonk', 31.3), sfx('dizzy', 31.5, { d: 1.2 }), sfx('tweet', 31.6, { d: 1.6 }),
      sfx('mrrp', 34.2), sfx('hop', 36.6), sfx('thunk', 37.5), sfx('compute', 37.7, { d: .6 }), sfx('ding', 38.4), sfx('purr', 38.8, { d: 1.4 }),
      sfx('compute', 41.2, { d: .5 }), sfx('ding', 41.9), sfx('pop', 44.4), sfx('twinkle', 44.6), sfx('beepHappy', 44.8), sfx('twinkle', 45.4),
      // walk
      sfx('whoosh', 46.4), sfx('crowdCheer', 58.0, { d: 2 }),
      // gag 2: Prost
      sfx('hop', 61.0), sfx('land', 62.0), sfx('mrrp', 62.1), sfx('glass', 66.6), sfx('beepQ', 67.8), sfx('ding', 71.1), sfx('scan', 73.0, { d: 2 }), sfx('crowdLaugh', 77.2, { d: 1 }),
      sfx('splash', 80.4), sfx('glass', 80.4), sfx('bubble', 80.6, { n: 2 }), sfx('dizzy', 80.8, { d: 1 }), sfx('hop', 84.2), sfx('twinkle', 86.0), sfx('glass', 86.3, { p: 1.5 }), sfx('clap', 87.2), sfx('clap', 87.45),
      sfx('glass', 89.0, { p: 1.2 }), sfx('twinkle', 89.2), sfx('beepHappy', 89.4), sfx('crowdCheer', 89.6, { d: 2 }),
      // gag 3: Ampelmann
      sfx('whoosh', 92.2), sfx('zoom', 94.5, { d: .8 }), sfx('zip', 97.8), sfx('zoom', 98.4, { d: .8 }), sfx('beepAlarm', 98.7), sfx('skid', 98.95), sfx('beepQ', 100.6), sfx('ding', 102.5),
      sfx('tweet', 106.2, { d: .8 }), sfx('ding', 106.6), sfx('footsteps', 107.2, { d: 3.5 }), sfx('beepHappy', 109.4), sfx('twinkle', 110.0),
      sfx('iris', 111.8, { d: 2.4 }), sfx('tada', 114.6),
    ],
    MUSIC: [
      { a: 3.2, b: 14, style: 'chill', key: 60, scale: 'major', lead: 'glock', bpm: 100 },
      { a: 14, b: 46, style: 'tiptoe', key: 62, scale: 'major', lead: 'xylo', bpm: 112 },
      { a: 46, b: 92, style: 'groove', key: 58, scale: 'major', lead: 'brass', bpm: 118 },
      { a: 92, b: 106, style: 'chill', key: 60, scale: 'major', lead: 'reed', bpm: 96 },
      { a: 106, b: 114.5, style: 'fanfare', key: 62, scale: 'major', lead: 'brass', bpm: 120 },
      { a: 114.5, b: 120, style: 'travel', key: 60, scale: 'pent', lead: 'glock', bpm: 116 },
    ],
  };
  if (typeof module !== 'undefined') module.exports = STORY; else root.STORY = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
