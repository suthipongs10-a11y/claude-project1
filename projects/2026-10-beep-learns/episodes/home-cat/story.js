// EPISODE TIMING: BEEP at HOME — The Cat Who Broke My Brain (9:16, 150 s)
(function (root) {
  const sfx = (type, t, o = {}) => Object.assign({ type, t }, o);
  const STORY = {
    DURATION: 150,
    TITLE: { text: 'BEEP at HOME', sub: 'Episode 3 · The Cat Who Broke My Brain', end: 3.2, bg: '#FF9EB5' },
    END: { a: 146, words: [{ word: 'Zoomies', meaning: '= sudden cat sprints', note: 'burn energy!' }, { word: 'Kneading', meaning: '= paws pushing', note: 'cat feels safe' }, { word: 'Slow blink', meaning: '= "I love you"', note: 'blink back!' }], cta: 'What should BEEP learn next?' },
    NAMES: { B: ['BEEP', '#7FF6FF'] },
    VO: [['b_good', 8.5], ['b_no', 32.4], ['b_no', 55.0], ['b_why', 66.0], ['b_zoom', 107.8], ['b_love', 140.4]],
    SHAKE: [[63.6, 8], [105.3, 6], [113.4, 12], [64.2, 5]],
    SFX: [
      sfx('fanfare', .1), sfx('pop', .3), sfx('pop', .45, { p: 1.1 }), sfx('pop', .6, { p: 1.2 }), sfx('pop', .75, { p: 1.3 }),
      ...[3.3, 3.55, 3.8].map(t => sfx('bubble', t, { n: 1 })),
      // intro
      sfx('zoom', 3.2), sfx('land', 4.1), sfx('twinkle', 5.5), sfx('twinkle', 6.4), sfx('mrrp', 9.6), sfx('beepHappy', 10.6), sfx('yawn', 11.2), sfx('powerDown', 12.6), sfx('ding', 12.95),
      // gag 1: 5 am
      sfx('meow', 14.2), sfx('footsteps', 15.0, { d: 1.8 }), sfx('hop', 17.1), sfx('thunk', 17.8), sfx('purr', 18.0, { d: 6 }), sfx('beepQ', 22.8), sfx('zap', 23.4), sfx('beepAlarm', 24.4),
      sfx('boing', 26.0), sfx('boing', 27.3), sfx('boing', 28.6), sfx('beepQ', 30.0), sfx('hop', 30.6), sfx('thunk', 31.2), sfx('beepAlarm', 31.6), sfx('powerDown', 34.0), sfx('powerUp', 35.0),
      // gag 2: table
      sfx('hop', 43.6), sfx('thunk', 44.2), sfx('pop', 45.8), sfx('mrrp', 47.4), sfx('drumroll', 47.8, { d: 1.9 }), sfx('pop', 49.8), sfx('twinkle', 50.5), sfx('pop', 52.5), sfx('mrrp', 53.2), sfx('pop', 54.6), sfx('twinkle', 55.9),
      sfx('pop', 57.0), sfx('pop', 59.0), sfx('boing', 60.2), sfx('pop', 61.5), sfx('pop', 63.0), sfx('whoosh', 63.3), sfx('glass', 63.7), sfx('splash', 63.7), sfx('sadTrombone', 64.6), sfx('purr', 66.8, { d: 1.6 }),
      // gag 3: box
      sfx('hop', 68.6), sfx('whoosh', 69.8), sfx('pop', 72.2), sfx('twinkle', 72.4), sfx('beepHappy', 72.6), sfx('footsteps', 74.0, { d: 5 }), sfx('beepQ', 79.5), sfx('hop', 80.6), sfx('thunk', 81.6), sfx('mrrp', 82.0), sfx('giggle', 82.4),
      sfx('whoosh', 85.0), sfx('boing', 86.2), sfx('thunk', 88.8), sfx('beepSad', 89.6), sfx('thunk', 92.3), sfx('sadTrombone', 93.0), sfx('mrrp', 95.5),
      // gag 4: zoomies
      sfx('powerDown', 99.6), sfx('snore', 100.4, { d: 2.5 }), sfx('hiss', 102.4), sfx('zip', 103.0), sfx('skid', 103.85), sfx('zip', 104.4), sfx('hop', 104.7), sfx('bonk', 105.25), sfx('crash', 105.4), sfx('beepAlarm', 106.0), sfx('zip', 106.2), sfx('zip', 107.6), sfx('dizzy', 108.4, { d: 1.4 }), sfx('zap', 108.6),
      sfx('zip', 109.4), sfx('hop', 110.6), sfx('zip', 111.6), sfx('whoosh', 112.1), sfx('zip', 113.0), sfx('bonk', 113.4), sfx('crowdLaugh', 113.6, { d: .8 }), sfx('beepSad', 114.6), sfx('twinkle', 117.2), sfx('zap', 120.0), sfx('beepAlarm', 123.0),
      // payoff
      sfx('footsteps', 126.4, { d: 4 }), sfx('beepQ', 132.6), sfx('ding', 135.3), sfx('compute', 135.8, { d: 1.5 }), sfx('ding', 138.3), sfx('twinkle', 139.4), sfx('beepHappy', 140.9), sfx('hop', 141.0), sfx('purr', 141.8, { d: 4 }), sfx('twinkle', 142.4),
      sfx('iris', 143.6, { d: 2.4 }), sfx('tada', 146.1),
    ],
    MUSIC: [
      { a: 3.2, b: 14, style: 'chill', key: 60, scale: 'major', lead: 'glock', bpm: 96 },
      { a: 14, b: 41, style: 'tiptoe', key: 62, scale: 'major', lead: 'xylo', bpm: 108 },
      { a: 41, b: 70, style: 'tiptoe', key: 65, scale: 'major', lead: 'xylo', bpm: 118 },
      { a: 70, b: 98, style: 'groove', key: 60, scale: 'pent', lead: 'reed', bpm: 104 },
      { a: 98, b: 130, style: 'chase', key: 57, scale: 'minor', lead: 'xylo', bpm: 150 },
      { a: 130, b: 146, style: 'lullaby', key: 60, scale: 'major', lead: 'glock', bpm: 76 },
      { a: 146, b: 150, style: 'travel', key: 60, scale: 'pent', lead: 'glock', bpm: 116 },
    ],
  };
  if (typeof module !== 'undefined') module.exports = STORY; else root.STORY = STORY;
})(typeof window !== 'undefined' ? window : globalThis);
