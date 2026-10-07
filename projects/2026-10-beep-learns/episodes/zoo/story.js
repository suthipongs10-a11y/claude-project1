// EPISODE TIMING: BEEP & MOCHI at the ZOO — Partners in Crime (9:16, 150 s)
(function (root) {
  const sfx = (type, t, o = {}) => Object.assign({ type, t }, o);
  const STORY = {
    DURATION: 150,
    TITLE: { text: 'BEEP & MOCHI', sub: 'Episode 4 · at the ZOO', end: 3.2, bg: '#7FD88F' },
    END: { a: 146, words: [{ word: 'Sentry', meaning: '= the lookout guard', note: 'eyes up!' }, { word: 'Family', meaning: '= big cats & house cats', note: 'same cat family' }, { word: 'Worth the wait', meaning: '= good things take time', note: 'ask the sloth' }], cta: 'Where should the partners go next?' },
    NAMES: { B: ['BEEP', '#7FF6FF'], D: ['DANA', '#FFC145'] },
    VO: [['b_roll', 9.6], ['b_sharp', 23.4], ['d_feed', 53.6], ['b_back', 62.6], ['b_easy', 98.2], ['b_family', 101.6], ['b_respect', 105.8], ['b_time', 114.0], ['b_wait', 130.4], ['b_partners', 134.6]],
    SHAKE: [[58.2, 6], [61.2, 5], [84.4, 12], [86.4, 9], [130.0, 6], [136.0, 4]],
    SFX: [
      sfx('fanfare', .1), sfx('pop', .3), sfx('pop', .45, { p: 1.1 }), sfx('pop', .6, { p: 1.2 }), sfx('pop', .75, { p: 1.3 }),
      ...[3.3, 3.55, 3.8].map(t => sfx('bubble', t, { n: 1 })),
      // gate
      sfx('whoosh', 3.4), sfx('gong', 6.0), sfx('footsteps', 6.5, { d: 3 }), sfx('twinkle', 11.8), sfx('twinkle', 12.4), sfx('pop', 14.6), sfx('whoosh', 15.0),
      // meerkats
      sfx('tweet', 17.5, { d: 1 }), sfx('drumroll', 24.8, { d: 8.5 }), sfx('tweet', 33.6, { d: 1.2 }), sfx('beepQ', 35.6), sfx('twinkle', 37.4), sfx('beepAlarm', 38.2), sfx('mrrp', 38.9), sfx('clap', 42.4), sfx('clap', 42.7), sfx('ding', 43.8), sfx('twinkle', 44.0), sfx('beepSad', 45.4),
      // giraffe
      sfx('whoosh', 46.4), sfx('whoosh', 50.4), sfx('wind', 51.0, { d: 2 }), sfx('slurp', 57.2, { d: .9 }), sfx('splash', 57.9), sfx('beepAlarm', 58.4), sfx('zip', 60.8), sfx('slurp', 61.4), sfx('beepQ', 61.8), sfx('thunk', 67.8), sfx('crowdLaugh', 69.5, { d: 1.2 }), sfx('meow', 70.4, { p: .8 }),
      // lion
      sfx('whoosh', 74.0), sfx('drumroll', 82.0, { d: 2 }), sfx('gong', 84.0), sfx('zap', 84.2), sfx('wind', 84.2, { d: 2 }), sfx('bonk', 86.5), sfx('dizzy', 86.8, { d: 1 }), sfx('footsteps', 88.5, { d: 3 }), sfx('drumroll', 91.5, { d: 2.6 }), sfx('meow', 94.4, { p: 1.4 }), sfx('beepQ', 95.0),
      sfx('twinkle', 96.6), sfx('purr', 97.0, { d: 4 }), sfx('twinkle', 99.5), sfx('ding', 106.2), sfx('whoosh', 107.0),
      // sloth
      sfx('whoosh', 111.5), sfx('twinkle', 114.8), sfx('snore', 119.0, { d: 5.5 }), sfx('tweet', 122.0, { d: 1.2 }), sfx('tweet', 126.4, { d: 1 }), sfx('yawn', 125.6), sfx('twinkle', 129.0), sfx('clap', 130.0), sfx('tada', 130.1), sfx('crowdCheer', 130.3, { d: 2.2 }), sfx('tweet', 131.0),
      sfx('ding', 134.9), sfx('gong', 136.0), sfx('twinkle', 136.2), sfx('zoom', 136.0), sfx('whoosh', 138.0),
      sfx('iris', 142.0, { d: 2.4 }), sfx('tada', 146.1),
    ],
    MUSIC: [
      { a: 3.2, b: 16, style: 'groove', key: 57, scale: 'blues', lead: 'brass', bpm: 92 },
      { a: 16, b: 46, style: 'tiptoe', key: 57, scale: 'minor', lead: 'xylo', bpm: 100 },
      { a: 46, b: 80, style: 'groove', key: 62, scale: 'major', lead: 'reed', bpm: 112 },
      { a: 80, b: 112, style: 'groove', key: 55, scale: 'blues', lead: 'brass', bpm: 88, drone: true },
      { a: 112, b: 128, style: 'lullaby', key: 60, scale: 'pent', lead: 'glock', bpm: 64 },
      { a: 128, b: 136, style: 'travel', key: 62, scale: 'major', lead: 'xylo', bpm: 116 },
      { a: 136, b: 146, style: 'groove', key: 57, scale: 'blues', lead: 'brass', bpm: 100 },
      { a: 146, b: 150, style: 'travel', key: 60, scale: 'pent', lead: 'glock', bpm: 116 },
    ],
  };
  if (typeof module !== 'undefined') module.exports = STORY; else root.STORY = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
