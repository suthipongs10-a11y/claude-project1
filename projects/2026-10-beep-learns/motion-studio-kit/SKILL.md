---
name: motion-studio
description: Make "BEEP Learns" cartoon episodes (and other code-animated motion videos) — brief first for approval, then build with the locked BEEP/MOCHI kit, voices, subtitles, music, render to MP4 (16:9 or 9:16).
---

# Motion Studio — BEEP Learns

Code-animated cartoon shorts in a fixed house style: flat vector, thick plum outlines, squash & stretch, screen-face acting, Mickey-Mousing sound, short English lines with on-screen captions. Every frame is a pure function of time (`seek(t)`), rendered by headless Chromium → ffmpeg. Music and SFX are synthesized in code; voices come from free offline Piper TTS.

The person writes Thai; reply in Thai. Characters speak simple English.

---

## 0. Two gates (always)

**Gate 1 — BRIEF (no code, no rendering).** When asked "make a clip about X":
1. If the topic involves real culture, places, or facts, verify them with web search first. Never invent customs.
2. Reply in Thai with the brief template below. End by asking only what's missing: format (16:9 / 9:16 / both) and length (default 60–90 s for 16:9, 30–45 s for 9:16).
3. STOP and wait. Don't build until the person approves ("ผ่าน", "สร้างได้เลย", "go", …).

**Gate 2 — BUILD.** After approval plus format and length: follow §5 build steps. Send stills for a quick check only if the person asked for it. Otherwise run the critique loop yourself and deliver the MP4.

### Brief template (Thai, short and scannable)
```
🎬 ชื่อตอน: BEEP in <PLACE> — <hook title in English>
💡 แก่นเรื่อง 1 บรรทัด: …
🌏 วัฒนธรรมที่ใช้ (ข้อเท็จจริงที่เช็คแล้ว): 1) … 2) … 3) …
👥 ตัวละคร: BEEP, MOCHI, + locals (ชื่อ/ลุค/เสียง)
🎞 Beat sheet (วินาที):
  0–3   Title card
  3–…   Arrival gag …
  …     Gag 1 → Gag 2 → Gag 3 (escalate) → BEEP "gets it"
  …     Iris out → "TODAY BEEP LEARNED" card
🗣 บทพูด (EN สั้นๆ + ซับ): WHO: "line"  (≤ 8 lines, mostly 1–4 words)
📚 คำที่ BEEP ได้เรียน (end card): 1) word = meaning  2) …
🎵 ดนตรี/เสียง: mood, local flavour, key SFX
⏱ ความยาวแนะนำ: … | รูปแบบ: 16:9 / 9:16 ?
```

---

## 1. Cast (LOCKED — never redesign, recolor, or rename)

**BEEP** (`kit/beep.js`): small hover robot with a TV-box head, dark screen face, cyan pixel eyes, white egg body with a teal band, noodle arms with round mitts, and a pink-tipped springy antenna. Eager, literal, proud, curious. Acts with the screen face; nearly every beat changes the face.
Faces: `neutral happy wide angry suspicious annoyed sad exclaim question dots loading learning check static swirl x heart idea battery sleep wink stars text`.
Accessories via `acc`: `scarf, backpack, camera, headband, gloves, hat: cap|straw|beanie|party`. The travel default is `{scarf:true}`, plus a local hat when it fits the gag.
Voice: cast `B` (Piper speaker 552, pitch 1.25, robot 0.22). Says 1–4 words, often a wrong guess, then the right word.

**MOCHI** (`kit/cat.js`): orange tabby cat with big green eyes. BEEP's travel buddy. Running gag: MOCHI adapts to each culture instantly and perfectly, while BEEP gets it wrong. Never speaks words, only `meow`, `mrrp`, `purr`, `yawn` SFX. Acts with half-lid smugness, slow blinks and tail.
Poses: `sit run walk crouch stretch flat sleep`. Eyes: `open half closed happy dilated spiral one wide`. Accessories: `bow, hat, scarf`.

**Locals** (`kit/person.js`, bean style, same outline): build per episode with `MS.makePerson(layer, {skin, hair, hairColor, top, bottom, bottomType, acc:{hat, glasses, mustache, beard, apron}})`.
Poses: `stand walk run bow wave cheer point shrug sit jump clap`.
Locals are kind and competent. The joke is always BEEP's confusion, never the culture or the people. Use respectful, everyday customs; no stereotypes, accents or costumes used as punchlines.

---

## 2. Episode formula (BEEP Learns)

1. **Title card** (0–3.2 s): `STORY.TITLE = {text:'BEEP in JAPAN', sub:'Episode N · <hook>', end:3.2, bg}`
2. **Arrival** (≈5 s): establishing set with the place's icons, BEEP hovers in, MOCHI follows.
3. **Three gags, escalating** (each 8–20 s): a local does a custom → BEEP `?` → MOCHI does it perfectly → BEEP `learning` → BEEP overdoes it (bonk, spin, splash, spicy) → recovers.
4. **Payoff**: BEEP finally does it right (or charmingly wrong). Warm moment with the local, heart face.
5. **Iris out** on BEEP → **end card** `STORY.END = {a, words:[{word, meaning, note}], cta:'Where should BEEP go next?'}` with 2–3 words or phrases. This is the "learn" part.

Rules: ≤ 8 spoken lines per minute, ≤ 6 words per line. A visual gag every 3–6 s. Hold 0.5 s before every punchline. Shorts (9:16) use 1–2 gags only and keep characters big and centered.

---

## 3. House rules (the harness)

**Render contract**
- Everything is a pure function of `t`: no CSS transitions, no timers, no `Math.random` (use `MS.seeded`).
- Timing lives in `story.js` (shared by picture and audio). Motion uses `MS.K` keyframes; hard cuts are duplicate keys.
- Stage world is 1920×1080 with ground `G = 860` (or what the set needs). The camera returns `{x, y, z}`. For 9:16, keep the same world and use tighter camera framing (z 1.1–1.4, centered on the action).
- Fonts are local (Fredoka for UI and captions, Pacifico for script). No CDN.

**Look**
- Thick plum outlines (`MS.PL` `#2B2340`, 5–6 px). Flat pastel fills. One warm accent per set.
- Squash & stretch on every landing (`MS.sq`). Anticipation before every dash. Overshoot on stops (`back`/`el`). Secondary motion on antenna (`MS.beepAntenna`) and tail.
- Every shot has one focal point. Characters ≥ 18% of frame height in 16:9 and ≥ 22% in 9:16.
- Layering: `sky → set → back (shadows) → mid (characters) → front (foreground props) → fxl (fx) → ui`. Duplicate a set piece into `front` when a character must be hidden behind it.

**Sound**
- Every action has a sound: landing = `land`/`thunk`, fall = `slideDown` + `bonk`, idea = `ding`, confusion = `beepQ`, scene change = `whoosh`/`zoom`.
- Music sections use the local flavour (`scale` + `lead`); see §4. Music ducks automatically under voices.

**Critique loop (mandatory before delivery)**
1. Render stills every ~2 s plus every gag peak (`node kit/render.mjs stills W H t1 t2 …`). Read `stills/sheet.jpg`.
2. Score 1–10 on: story clarity without sound, character appeal, composition, gag timing, polish, caption readability, cultural respect.
3. Fix the lowest score, re-render only the affected stills, and repeat until every score is ≥ 8. Log fixes in `CRITIQUE.md`.

**Known pitfalls (check every time)**
- Shadows must follow the surface a character stands on. Set `shadow:false` when elevated.
- Props must not hide characters by accident; check the draw order.
- Captions and speech bubbles must not overlap HUD or title areas. Keep captions ≤ 60 characters.
- Rotations such as bows and falls must pivot at the feet or base, not the body center. See the pivot math in `pilot/episode.js`.
- A character's mouth moves only while that character's line plays (use `MS.mouth(who, t)`).
- In 9:16, check the edges: nothing important within 80 px of the sides.

---

## 4. Kit API (folder `kit/`)

| File | Provides |
|---|---|
| `engine.js` | `MS.K, step, sq, wobble, pop, seeded, shake, clamp, lerp, E` (easings `lin io in out expoIn expoOut back el`), SVG `S, at, show, T, drawOn, OL(w), PL`, canvas `MS.W, MS.H, MS.VERTICAL` |
| `beep.js` | `MS.makeBeep(layer, shadowLayer).draw(state, t, ground)` → returns `{hwL, hwR, headTop, screen}` (world points for props) |
| `cat.js` | `MS.makeCat(layer, shadowLayer).draw(state, t)` |
| `person.js` | `MS.makePerson(layer, opts, shadowLayer).draw(state, t)` |
| `overlays.js` | title card, end card, subtitles, iris, `L.fx` (`puff, sparkle, bang('!'/'?'), zzzOn, dizzy, confettiAt`) |
| `film-template.html` | Boot: layers `L.sky/set/back/mid/front/fxl/ui`, `MS.mouth(who,t)`, `MS.seg(id,i)` (phrase onset times), subtitles, title, end card, iris, fade |
| `voice.py` | `lines.txt` + `cast.json` → `vo/*.wav` + `lipsync.js` |
| `audio.cjs` | `story.js` (`MUSIC`, `SFX`, `VO`) → `score.wav` |
| `render.mjs` | `stills W H t…` · `video W H start end` · `final W H out.mp4` |
| `setup.sh` | fonts, Playwright, Piper + voice model (from GitHub) |

**BEEP state:** `{x, y, sx, sy, rot, face, fp, label, look, lookY, armL:[x,y], armR:[x,y], antX, thrust, talk, sparks, aura, shadow, acc}`. Hovering `y = G - 180 + sin(t*3.2)*7`. Grounded `y = G - 98`, `thrust 0`. Rest hands are `[-92,88]` and `[92,88]`.
**MOCHI state:** `{x, y, flip, pose, eyes, look, lookY, mouth:'w'|'open'|'smirk'|'tongue', mouthOpen, paw, pawT, tilt, headDy, rot, sx, sy, k, tailAmp, tailSpd, wiggle, shadow, acc}`.
**Person state:** `{x, y, flip, pose, bowAmt, armL, armR, talk, eyes:'open'|'closed'|'happy'|'wide'|'angry'|'sad', look, headRot, blush}`.

**`story.js` (UMD) exports `STORY`:** `DURATION, TITLE, END, NAMES {who:[label,color]}, VO [[id, t, {muffle}]], SHAKE [[t,amp]], SFX [{type,t,d,p,g,n}], MUSIC [{a,b,style,key,scale,lead,bpm,drone}]`.
- Music `style`: `chill travel tiptoe chase lullaby fanfare groove`.
- `scale`: `major minor pent japan hijaz blues thai`.
- `lead`: `glock koto xylo reed brass`. Use `drone:true` for bagpipe or sitar-like beds.
- SFX types: `pop boing whoosh zip zoom ding twinkle thunk bonk land hop slideUp slideDown tiptoe scurry skid crash glass clang splash bubble sizzle eat slurp ahh spicy steam beepHappy beepQ beepSad beepAlarm scan compute giggle zap powerDown powerUp dizzy meow mrrp yawn hiss purr snore tweet crowdCheer crowdLaugh gong bell clap drumroll tada sadTrombone fanfare iris camera footsteps water wind`.

**`lines.txt`:** `id|who|spoken text|caption`.
- Use ` / ` inside the spoken text for a 0.32 s comic pause.
- Spell foreign words phonetically in the spoken part ("Kon-nee-chee-wah!") and write them properly in the caption ("Konnichiwa!").

**`cast.json` speakers** (LibriTTS-high; pitch via rubberband):
- B = 552 @ 1.25, robot 0.22 (locked)
- Deep male 805 · male 368 / 92 / 253 · female 529 / 115 / 552 / 23
- Child: a female speaker @ pitch 1.3
- Elder: male 506 @ 0.92

---

## 5. Build steps (Gate 2)

```bash
# kit = folder "kit/" from motion-studio-kit.zip (or git clone of the person's kit repo)
mkdir ep && cd ep && cp -r <kit> kit && cp kit/film-template.html film.html
bash kit/setup.sh                       # once per machine/session
# write: lines.txt, cast.json (copy B from §4), story.js, episode.js
python3 kit/voice.py                     # → vo/*.wav + lipsync.js (prints durations + phrase onsets)
#   → place VO start times in story.js from the printed durations; leave ≥0.3 s gaps
node kit/audio.cjs                       # → score.wav
node kit/render.mjs stills 1920 1080 <times…>   # critique loop (read stills/sheet.jpg)
node kit/render.mjs video 1920 1080 0 <DURATION>
node kit/render.mjs final 1920 1080 BEEP_Learns_<place>.mp4
# 9:16: same files, use 1080 1920 (camera framing via MS.VERTICAL)
```

**`episode.js` skeleton:** `window.EP = { build(L){ set + characters + fx cues }, camera(t){ return {x,y,z} }, iris(t){ return null | {r,x,y} }, update(t,L){ compute states with MS.K/step/sq and call .draw() } }`. Use `pilot/episode.js` as the reference implementation (Japan bow episode).

**Timing workflow:** write lines first → run `voice.py` → build the beat timeline around the real durations → place gags and SFX → audio → stills → fix → video.

**Delivery:** send the MP4 (keep it under ~50 MB; CRF 22 is fine). Reply with 1–2 sentences on what happened in the episode, the honest limits (voice is TTS), and the next episode idea.

If `kit/` is not available in this session, ask the person to attach `motion-studio-kit.zip`, or clone their kit repo. Don't rebuild the characters from memory, because consistency is the point of the channel.
