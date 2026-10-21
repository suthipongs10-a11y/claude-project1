"""QC orchestrator (SPEC §8.7). Runs every available check per clip, maps results onto shots."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from . import ffmpeg_tools as ff
from .cer import cer
from .request import Check, ClipRef, QcRequest, ShotRef, skipped

ALL_CHECKS = ["duration", "cuts", "black", "freeze", "dialogue", "identity", "people", "text"]


@dataclass
class ShotResult:
    shot_id: str
    clip: str
    version: int
    checks: list[Check] = field(default_factory=list)
    keyframes: list[str] = field(default_factory=list)

    @property
    def passed(self) -> bool:
        return all(c.passed for c in self.checks if not c.skipped)

    def reasons(self) -> list[str]:
        return [c.detail or c.name for c in self.checks if not c.passed and not c.skipped]

    def to_json(self) -> dict[str, Any]:
        return {
            "shot_id": self.shot_id,
            "clip": self.clip,
            "version": self.version,
            "pass": self.passed,
            "checks": [c.to_json() for c in self.checks],
            "reasons": self.reasons(),
            "keyframes": self.keyframes,
        }


def _want(req: QcRequest, name: str) -> bool:
    return req.checks is None or name in req.checks


def run_clip(req: QcRequest, clip: ClipRef) -> tuple[list[ShotResult], list[str]]:
    ffmpeg, ffprobe = req.tools["ffmpeg"], req.tools["ffprobe"]
    th = req.thresholds
    path = req.root / clip.clip
    errors: list[str] = []
    results = [ShotResult(shot_id=s.shot_id, clip=clip.clip, version=clip.version) for s in clip.shots]
    if not path.exists():
        for r in results:
            r.checks.append(Check("clip_exists", False, detail=f"ไม่พบไฟล์คลิป {clip.clip}"))
        return results, errors

    # ---- clip-level: duration + cuts (same verdict for every shot in the batch)
    duration = None
    if _want(req, "duration"):
        try:
            duration = ff.probe_duration(ffprobe, path)
            diff = abs(duration - clip.expected_sec) / clip.expected_sec if clip.expected_sec else 0.0
            ok = diff <= th.duration_tolerance
            chk = Check("duration", ok, value=round(duration, 2), threshold=f"{clip.expected_sec}s ±{int(th.duration_tolerance * 100)}%",
                        detail=None if ok else f"ความยาวคลิป {duration:.2f}s ต่างจากที่วาง {clip.expected_sec}s เกิน {int(th.duration_tolerance * 100)}%")
        except ff.FfmpegError as e:
            chk = Check("duration", False, detail=str(e))
        for r in results:
            r.checks.append(chk)

    if _want(req, "cuts"):
        try:
            cuts = ff.detect_scene_cuts(ffmpeg, path, th.scdet_threshold)
            expected = max(len(clip.shots) - 1, 0)
            ok = abs(len(cuts) - expected) <= th.cut_tolerance
            chk = Check("cuts", ok, value=len(cuts), threshold=f"{expected} ±{th.cut_tolerance}",
                        detail=None if ok else f"พบจุดตัด {len(cuts)} จุด ({', '.join(f'{c:.1f}s' for c in cuts) or 'ไม่มี'}) แต่ shot list มี {expected} จุด")
        except ff.FfmpegError as e:
            chk = Check("cuts", False, detail=str(e))
        for r in results:
            r.checks.append(chk)

    # ---- interval checks mapped onto shots
    if _want(req, "black"):
        try:
            blacks = ff.detect_black(ffmpeg, path, th.black_min_sec)
            for s, r in zip(clip.shots, results):
                hits = [b for b in blacks if b.overlaps(s.offset_sec, s.offset_sec + s.duration_sec)]
                r.checks.append(Check("black", not hits, value=len(hits), threshold=f"0 (≥{th.black_min_sec}s)",
                                      detail=None if not hits else "ภาพดำ " + ", ".join(f"{b.start:.1f}–{b.end:.1f}s" for b in hits)))
        except ff.FfmpegError as e:
            for r in results:
                r.checks.append(Check("black", False, detail=str(e)))

    if _want(req, "freeze"):
        try:
            freezes = ff.detect_freeze(ffmpeg, path, th.freeze_min_sec)
            for s, r in zip(clip.shots, results):
                hits = [b for b in freezes if b.overlaps(s.offset_sec, s.offset_sec + s.duration_sec)]
                r.checks.append(Check("freeze", not hits, value=len(hits), threshold=f"0 (≥{th.freeze_min_sec}s)",
                                      detail=None if not hits else "ภาพค้าง " + ", ".join(f"{b.start:.1f}–{b.end:.1f}s" for b in hits)))
        except ff.FfmpegError as e:
            for r in results:
                r.checks.append(Check("freeze", False, detail=str(e)))

    # ---- keyframes (needed by identity/people/text and by the human/Claude review)
    frames_by_shot: dict[str, list[Path]] = {}
    need_frames = any(_want(req, n) for n in ("identity", "people", "text")) or th.keyframes_per_shot > 0
    if need_frames:
        for s, r in zip(clip.shots, results):
            try:
                frames = ff.extract_keyframes(ffmpeg, path, s.offset_sec, s.duration_sec, th.keyframes_per_shot, req.root / req.frames_dir, f"{s.shot_id}_v{clip.version}")
                frames_by_shot[s.shot_id] = frames
                r.keyframes = [str(f.relative_to(req.root)).replace("\\", "/") for f in frames]
            except ff.FfmpegError as e:
                errors.append(f"{s.shot_id}: keyframes: {e}")

    # ---- dialogue (native only)
    if _want(req, "dialogue"):
        shots_with_dialogue = [s for s in clip.shots if s.dialogue]
        if req.dialogue_mode != "native":
            for r in results:
                r.checks.append(skipped("dialogue", f"dialogue_mode={req.dialogue_mode} ไม่ตรวจเสียงพูดในโมเดล"))
        elif not shots_with_dialogue:
            for r in results:
                r.checks.append(skipped("dialogue", "ช็อตไม่มีบทพูด"))
        else:
            from . import transcribe as tr

            if not tr.whisper_available():
                for r in results:
                    r.checks.append(skipped("dialogue", "ไม่ได้ติดตั้ง faster-whisper (pip install -e '.[whisper]')"))
            elif not ff.has_audio(ffprobe, path):
                for s, r in zip(clip.shots, results):
                    r.checks.append(Check("dialogue", not s.dialogue, detail=None if not s.dialogue else "คลิปไม่มีแทร็กเสียง"))
            else:
                try:
                    words = tr.transcribe(path, req.whisper["model"], req.whisper["device"], req.whisper["compute_type"], req.lang)
                    for s, r in zip(clip.shots, results):
                        if not s.dialogue:
                            r.checks.append(skipped("dialogue", "ช็อตไม่มีบทพูด"))
                            continue
                        expected = "".join(d.text for d in s.dialogue)
                        heard = tr.words_in_window(words, s.offset_sec, s.offset_sec + s.duration_sec)
                        value = cer(expected, heard)
                        ok = value <= th.cer_max
                        r.checks.append(Check("dialogue", ok, value=round(value, 3), threshold=f"CER ≤ {th.cer_max}",
                                              detail=None if ok else f"ได้ยิน \"{heard}\" แต่บทคือ \"{expected}\" (CER {value:.2f})"))
                except Exception as e:  # model load/transcribe failure must not kill the run
                    for r in results:
                        r.checks.append(skipped("dialogue", f"whisper ล้มเหลว: {e}"))

    # ---- identity
    if _want(req, "identity"):
        from . import similarity as sim

        live = req.medium == "live_action"
        available = sim.face_available() if live else sim.clip_available()
        for s, r in zip(clip.shots, results):
            chars = [c for c in s.characters if c.get("refs")]
            if not chars:
                r.checks.append(skipped("identity", "ไม่มีตัวละครที่มี ref ในช็อต"))
                continue
            if not available:
                r.checks.append(skipped("identity", "ไม่ได้ติดตั้ง insightface (live) / open_clip (การ์ตูน)"))
                continue
            frames = frames_by_shot.get(s.shot_id, [])
            if not frames:
                r.checks.append(skipped("identity", "ไม่มี keyframe"))
                continue
            worst: tuple[str, float] | None = None
            try:
                for c in chars:
                    refs = [req.root / p for p in c["refs"] if (req.root / p).exists()]
                    if not refs:
                        continue
                    score = sim.face_similarity(frames, refs) if live else sim.clip_similarity(frames, refs)
                    if score is None:
                        continue
                    if worst is None or score < worst[1]:
                        worst = (c["id"], score)
            except Exception as e:
                r.checks.append(skipped("identity", f"similarity ล้มเหลว: {e}"))
                continue
            if worst is None:
                r.checks.append(skipped("identity", "ไม่พบหน้า/ภาพอ้างอิงที่ใช้ได้"))
                continue
            ok = worst[1] >= th.identity_similarity_min
            r.checks.append(Check("identity", ok, value=round(worst[1], 3), threshold=f"≥ {th.identity_similarity_min}",
                                  detail=None if ok else f"ตัวละคร {worst[0]} หน้าตาไม่เหมือน ref (similarity {worst[1]:.2f})"))

    # ---- people count
    if _want(req, "people"):
        from . import people as pp

        for s, r in zip(clip.shots, results):
            limit = s.max_people if s.max_people is not None else len(s.characters)
            frames = frames_by_shot.get(s.shot_id, [])
            if not pp.cv2_available():
                r.checks.append(skipped("people", "ไม่ได้ติดตั้ง opencv (pip install -e '.[people]')"))
            elif not frames:
                r.checks.append(skipped("people", "ไม่มี keyframe"))
            else:
                try:
                    n = max(pp.count_people(f) for f in frames)
                    ok = n <= limit
                    r.checks.append(Check("people", ok, value=n, threshold=f"≤ {limit}", detail=None if ok else f"พบคน {n} คน เกินที่กำหนด {limit}"))
                except Exception as e:
                    r.checks.append(skipped("people", f"detector ล้มเหลว: {e}"))

    # ---- burned-in text / watermark (optional)
    if _want(req, "text") and th.ocr:
        from . import ocr

        for s, r in zip(clip.shots, results):
            frames = frames_by_shot.get(s.shot_id, [])
            if not ocr.ocr_available():
                r.checks.append(skipped("text", "ไม่ได้ติดตั้ง pytesseract"))
            elif not frames:
                r.checks.append(skipped("text", "ไม่มี keyframe"))
            else:
                try:
                    found = [t for t in (ocr.visible_text(f) for f in frames) if len(t) >= 4]
                    r.checks.append(Check("text", not found, value=len(found), threshold="0", detail=None if not found else f"พบตัวหนังสือ/ลายน้ำ: {found[0][:40]}"))
                except Exception as e:
                    r.checks.append(skipped("text", f"OCR ล้มเหลว: {e}"))

    return results, errors


def run_request(req: QcRequest) -> dict[str, Any]:
    results: list[ShotResult] = []
    errors: list[str] = []
    for clip in req.clips:
        rs, errs = run_clip(req, clip)
        results.extend(rs)
        errors.extend(errs)
    skipped_names = sorted({c.name for r in results for c in r.checks if c.skipped})
    return {
        "results": [r.to_json() for r in results],
        "summary": {"shots": len(results), "pass": sum(1 for r in results if r.passed), "fail": sum(1 for r in results if not r.passed)},
        "skipped_checks": skipped_names,
        "errors": errors,
    }
