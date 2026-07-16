# SKILL — Bones & Firelight Video Pipeline (LATEST, battle-tested)

> **What this is:** the exact, refined workflow used to produce this channel's videos (validated on video #1 "Killer Wolves" and video #2 "Alcohol"). Follow it top-to-bottom and you reproduce the process at 100% fidelity. This supersedes the generic skill in `CLAUDE.md` where they differ — `CLAUDE.md` is the brand-agnostic template; **this file is how we actually work now.**
>
> **Golden rule:** *image↔audio sync is the single most important thing.* Everything below exists to guarantee it. Generate the VO FIRST, derive all timing from its real word-level timestamps, and never let an image's position drift off the voice.

---

## 0. Fixed facts about this setup (don't re-ask these)

- **Channel:** Bones & Firelight — prehistory / Ice-Age survival edutainment, faceless, animated 2D hand-drawn, English. Dark/strange/true storytelling voice. Palette: fire orange `#F0A23C`, ember `#FF7A2F`, cold night `#14161C`, cold blue `#3B4A66`, bone-white `#F3EEE2`.
- **Env:** Windows, PowerShell + Bash tools. **Always** run Python with `PYTHONIOENCODING=utf-8` (Thai/em-dash crashes cp1252 otherwise).
- **Images & animation = PROMPT-ONLY, always.** We emit paste-ready prompts; the user generates FREE in **Google Flow** and hands files back. This is a cost decision — never generate images directly even if paid tools exist. (Reason: reduce cost.)
- **Voiceover = ElevenLabs** (paid, worth it). Key lives in a `.env` at `C:\Work\VideoTest\projects\2026-07-spider-scorpion\elevenlabs\.env` (keys: `ELEVENLABS_API_KEY`, `VOICE_ID_EN`). **Read from file, never echo the key, never commit it.**
  - Model `eleven_multilingual_v2`, endpoint `/with-timestamps`, voice_settings `{stability:0.5, similarity_boost:0.75, style:0.35, use_speaker_boost:true}`.
- **Assembly = HyperFrames** (`npx hyperframes`, v0.7.x). GSAP is **vendored** at `vendor/gsap.min.js` (copy it into each new video's `vendor/` — do NOT rely on a CDN at render).
- **Duration truth = `ffprobe`** (installed). Never estimate duration from word count.
- **Each video gets its own folder:** `video-NN-slug/` with `clips/`, `clips/img/`, `images/`, `renders/`, `vendor/`.
- **Git:** text files only. `.gitignore` already excludes `*.mp4`, `clips/*.mp3`, `clips/img/`, `.thumbnails/`, `.waveform-cache/`, `renders/`, `*.env`. Keep heavy media on disk, out of git.

---

## 1. Per-video folder scaffold

```
video-NN-slug/
  SCRIPT.md                 # narration + shot-planning notes
  PROMPTS-PACKAGE.md        # the 125-ish image prompts for Google Flow
  POST-PACKAGE.md           # YouTube upload copy (title/desc/tags/etc.)
  index.html                # HyperFrames composition (built from manifest)
  vendor/gsap.min.js        # copied from repo root vendor/
  clips/
    narration.txt           # clean spoken text (VO input)
    voiceover.mp3           # ElevenLabs VO  (SOURCE OF TRUTH for length)
    word-timings.json       # per-word timestamps (SOURCE OF TRUTH for sync)
    shots-raw.json          # phrase segmentation (intermediate)
    shot-manifest.json      # per-shot timing + motion + subject + caption (MASTER)
    img/
      style-anchor.png      # locked style + character reference
      img1.png … imgN.png   # one per manifest row; number = shot number
  images/
    thumbnail-1..3.png → thumbnail.png
  renders/final.mp4
```

---

## 2. THE PIPELINE (run in this exact order)

### Step 1 — Confirm the topic + length
Title and target minutes are usually already chosen. Default length ~8 min. Lock the title string before writing.

### Step 2 — Research (real facts, always)
Use `WebSearch` + `WebFetch` for the actual history/science. Pull 2–4 solid, citable facts and find the **reframe hook / twist** (video #2's was "you inherited the craving 10M years before humans existed"). We are faceless-documentary style — accuracy matters.

### Step 3 — Write `SCRIPT.md` in the channel voice
- Structure: **Cold-open reframe hook → 3–4 acts → outro with binge-loop CTA** ("that story is waiting right here on screen. Click it. This has been Bones & Firelight.").
- Present tense, short punchy lines, dark/strange/true, concrete nouns (they become the shot images).
- `## headers` and `[bracket notes]` are NOT spoken — planning only. Mark caption-candidate words in notes.
- **Show it, get approval before VO.**

### Step 4 — Extract clean narration → `clips/narration.txt`
Strip headers, `>` notes, `[...]` notes, `**meta**`, `---`, table rows, and any `«»`/`**` markers. Result = pure spoken English. Sanity-check word count (~150 wpm → minutes).

### Step 5 — Generate the VO (ElevenLabs, with timestamps) ⚠ FIRST, before any images
Python: read key from the `.env`, POST to `/v1/text-to-speech/{VOICE_ID_EN}/with-timestamps` with the settings above. Save:
- `clips/voiceover.mp3`
- reconstruct **word-level** timings from the char-level alignment → `clips/word-timings.json` (`[{w,start,end}]`)
- probe true duration with `ffprobe`.

**▶ VOICEOVER APPROVAL GATE (mandatory).** Play it for the user. Do NOT proceed to images until they approve — every image is timed to this exact audio. Iterate here (voice/speed/wording) if needed.

### Step 6 — Segment the VO into shots → `clips/shots-raw.json`
Phrase-driven, from `word-timings.json`:
- Group words into sentence units (cut after tokens ending `. ! ?`).
- **Split** any unit longer than **6.5s** at its best internal boundary (em-dash preferred, else comma) nearest the midpoint, keeping both sides ≥1.2s.
- **Merge** forward any unit shorter than **2.0s** unless the merge would exceed 6.5s.
- Make coverage **gapless**: each shot's `start` = previous shot's spoken end; last shot runs to VO end. This yields ~120–130 shots for an 8-min video.

### Step 7 — Build `shot-manifest.json` (the MASTER timing+motion file)
This is the heart of the current method — **timing comes from here, NOT from a fixed interval.** One row per shot:
```json
{ "n":1, "start":0.0, "duration":4.72,
  "shot_type":"zoom_in_slow", "scale_start":1.0, "scale_end":1.18,
  "pan_x":30, "pan_y":-18, "ease":"power1.inOut",
  "subject":"image idea matching the noun spoken now",
  "caption":"OPTIONAL SHORT WORD or null",
  "vo_text":"the words spoken over this shot" }
```

**6 shot types + motion params (from `MOTION-STYLE-SPEC.md`) — target shares over the whole video:**

| shot_type | share | scale start→end | ease | when |
|---|---|---|---|---|
| `static` | **~50%** | 1.05→1.05 (tiny drift) | `none` | default, no reason to zoom |
| `text_card` | ~6–8% | 1.05→1.08 | `power1.inOut` | abstract/summary beats (still a real scene image) |
| `zoom_in_slow` | ~14–16% | 1.00→1.18 | `power1.inOut` | descriptive/narrative |
| `zoom_out_slow` | ~10% | 1.13→1.00 | `power1.inOut` | reveal / open a scene |
| `zoom_in_fast` | ~6–7% | 1.00→1.60 | `power3.out` | SHOCK/emphasis, keep SHORT (~1.5–4s) |
| `zoom_out_fast` | ~5% | 1.38→1.00 | `power2.out` | sudden reveal |

Assign `shot_type` per phrase by **tone** (shock→in_fast, narrative→slow, reveal→out, filler→static), then nudge the mix toward the shares above. Alternate `pan` direction by odd/even `n`. **duration is the spoken length** (already in shots-raw), never a flat number.

**Captions (the emphasis words):**
- Short **1–3 word** ALL-CAPS standout words on select shots (numbers/dates, strong nouns, turns, punchy lines). **Curated, not every line.**
- **COUNT (updated per latest feedback): aim for ~20% of shots.** Video #2 used 13/125 (~10%) and the user said *good but too few — roughly DOUBLE it.* So target **~24–28 captions** on a ~125-shot video. Keep the same style/format; just more of them, spread across more scenes.
- The image for a caption shot must be generated **with clean negative space** (no baked text) — the word is added in HyperFrames.

Print the full manifest as a human table grouped by act and **get approval** (user can edit any shot_type / caption / subject by number). This is the shot-list gate.

### Step 8 — Style anchor (lock style + character) → then the prompt pack
1. **First deliver ONLY the style-anchor prompt.** User generates it in Flow, saves `clips/img/style-anchor.png`. `Read` it and confirm the look together. (For channel continuity, tell the user to attach a frame from the previous video as an ingredient when generating the anchor.)
2. **Lock the recurring character** from the anchor — write an exact description (video #2: round white oval head, big close-set eyes tiny pupils, tiny mouth, messy spiky black hair with a white bone + woven cord headband, thin black stick limbs, brown fur wrap, single curved tooth necklace). This CHARLOCK string goes verbatim into every shot that shows the character so **face + hair stay identical start to finish** — the user cares about this specifically.
3. **Write `PROMPTS-PACKAGE.md`** — one block per shot. **Exact format the user requires:**
   ```
   [imgN.png] <STYLE BLOCK> <CHARLOCK if character present / MODERNLOCK if modern human> Scene: <subject>. <hand-anatomy note if hands prominent> <"do NOT render text, leave clean space" if caption shot> Add style-anchor.png as an ingredient and match its style, palette, and linework[, and the character's exact face and hair] exactly. 16:9.
   ```
   - **Each block STARTS with `[imgN.png]` directly** — NOTHING before the bracket (no "Shot N / time / VO:" header lines — the user explicitly rejected those). Blank line between blocks.
   - STYLE BLOCK: `Hand-drawn 2D cartoon animation, bold black ink outlines, flat cel-shaded colors, limited palette, no photoreal texture, warm amber light against cool blue-green shade.`
   - Hand rule where hands show: `Hands: five digits = four fingers + one thumb, count 1-2-3-4-5, no fused, melted, or extra fingers.`
4. Also emit **3 thumbnail prompts** in the channel formula (one big-emotion focal character, 2–3 word ALL-CAPS hook, generate clean then composite text). 16:9.

### Step 9 — HAND-BACK + verification gate (never skip)
The user generates all images in Google Flow (16:9, anchor as ingredient every time) and drops them into `clips/img/`. They often hand back as `imgN_png.png` — **rename to `imgN.png`** and move into `clips/img/`.
Then verify with Python:
- files `img1..imgN` all present, **no gaps/dupes** (N = manifest row count);
- read PNG dims, confirm all **16:9**;
- `Read` a few (a character shot early + late to confirm the face/hair lock held, a caption shot to confirm clean text space).
Report: **"N/N images received, numbering complete, aspect OK, character consistent."** If anything's missing/misnumbered, name the exact files and wait. A missing/misordered image silently shifts every later image off the VO.

### Step 10 — Build `index.html` from the manifest (HyperFrames Mode B + captions)
Generate with Python from `shot-manifest.json`. Rules:
- Root: `<div id="root" data-composition-id="root" data-start="0" data-duration="{VO}" data-width="1920" data-height="1080">`.
- **Images:** one wrapper per shot `<div id="kb{i}" class="kb clip" data-start="{start}" data-duration="{slot+XF}" data-track-index="{i%2}"><img src="clips/img/img{n}.png"></div>`. `XF=0.35` crossfade. **Animate the `.kb img` wrapper, never the media element's own box.** Last shot's duration runs to VO end.
- GSAP per shot: `tl.fromTo("#kb{i} img",{scale:scale_start,x:0,y:0},{scale:scale_end,x:pan_x,y:pan_y,duration:span,ease})` + fade the wrapper in over XF and out at `start+slot`.
- **Captions:** each on its own free `data-track-index` (6/7 alternating, i.e. NOT 0/1 images, NOT 20 audio). `<div class="cap clip">…<span>WORD</span></div>`. Start ≈ `shot.start+0.25`, duration ~2.2s. 3 alternating entrances (zoom-out punch / slide-in / pop-up via `back.out`), quick fade out. Style: big bold, `-webkit-text-stroke` black, bone-white or ember fill, positioned top ~14% (off faces). *(Note: user likes this effect; the only change requested is MORE of them — see Step 7 count.)*
- Register `window.__timelines["root"] = tl;` and load `<script src="vendor/gsap.min.js">`.
- Audio: `<audio id="vo" class="clip" data-start="0" data-duration="{VO}" data-track-index="20" data-volume="1.0" src="clips/voiceover.mp3">`.

**Lint:** `npx hyperframes lint` → **0 errors** required. Every timed element needs `class="clip"`; each media source its own track-index; root needs `data-composition-id`. "file too large / track too dense" warnings are safe to ignore.

### Step 11 — Interactive preview → approve
`npx hyperframes preview --port <port>` (run in background). Give the user the `http://localhost:<port>` URL — it's the **interactive studio, not an MP4**. Ask them to check: audio↔image sync (top priority), motion variety, caption timing/placement, character consistency. Iterate by editing `index.html` (studio hot-reloads). **Do not render until they approve.**

### Step 12 — Render → deliver
`npx hyperframes render --quality high --fps 24 --output renders/final.mp4` (run in background; ~45 min for 8.5 min @ 24fps, ~12k frames). Verify with `ffprobe` (1920×1080, h264, 24fps, aac, duration ≈ VO, has audio). Stop the preview server.
Deliver a **LOCATION MAP with absolute Windows paths** (final.mp4, images folder, voiceover, script, index.html, manifest, prompt pack, project folder). State that nothing is baked in — any piece can be swapped and re-rendered.

### Step 13 — POST-PACKAGE (when asked)
Write `POST-PACKAGE.md` **all in one deliverable** (user wants it complete, not split): title + 2 backups, description (first 2 lines carry the hook), **tags comma-separated**, **keywords comma-separated**, 3 hashtags, pinned comment (a question), chapters (recommend OFF for narrative retention), **end-screen binge loop** (set this video's element + **go back and point the PREVIOUS video's end screen at this one**), upload checklist (Education / English US / Made-for-kids No / add to the channel playlist), timing & first-hour tips.

---

## 3. Hard-won rules (do not relearn these)

1. **VO before images. Always.** Timing derives from real timestamps, never word-count estimates.
2. **`imgN.png` number = shot number = manifest row.** No gaps, no renames. This is the entire sync contract.
3. **Prompt blocks start with `[imgN.png]` and nothing before it.** No header/reference lines.
4. **Images prompt-only via Google Flow (free).** Never auto-generate. TTS stays ElevenLabs (paid).
5. **Lock the character** (face + hair especially) into every character shot via the CHARLOCK string + anchor-as-ingredient. The user explicitly wants identical face/hair throughout.
6. **Motion is variable & phrase-driven** per `MOTION-STYLE-SPEC.md` — NOT a fixed 5s Ken Burns grid (that was video #1's old method; abandoned).
7. **Captions: keep the style, use MORE of them** — ~20% of shots (~2× video #2), curated to standout words. User likes the effect; wanted more coverage.
8. **Never commit secrets or heavy media.** Read the `.env` key, never print it.
9. **`PYTHONIOENCODING=utf-8`** on every Python run.
10. **Approval gates are real:** script → VO → shot-manifest table → style anchor → post-images verification → interactive preview. Don't skip ahead.

---

## 4. Reference: reusable scripts (rebuild in scratchpad each run)
- `extract_narration.py` — SCRIPT.md → clips/narration.txt
- `gen_vo.py` — ElevenLabs with-timestamps → voiceover.mp3 + word-timings.json + ffprobe
- `segment_shots.py` — word-timings.json → shots-raw.json (6.5s split / 2.0s merge / gapless)
- `build_manifest.py` — shots-raw.json + per-n type/subject/caption maps → shot-manifest.json (+ prints share tally + act table)
- `gen_prompts.py` — shot-manifest.json → PROMPTS-PACKAGE.md (STYLE + CHARLOCK/MODERNLOCK + hand note + caption clean-space + thumbnails)
- `build_index.py` — shot-manifest.json → index.html (per-shot Ken Burns + caption tweens + audio)

Related repo files: `MOTION-STYLE-SPEC.md` (motion detail + hand-back contract), `NEXT-VIDEO-NOTES.md` (carry-over asks), `CHANNEL-SETUP.md` (About/keywords/avatar/banner), `CLAUDE.md` (generic template).
```
