"""M3 acceptance: the worker catches the broken clips we plant (≥ 80%)."""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import pytest

from workers.qc import ffmpeg_tools as ff
from workers.qc.engine import run_request
from workers.qc.request import QcRequest

from .conftest import FFMPEG, FFPROBE, needs_ffmpeg

pytestmark = needs_ffmpeg


def _request(root: Path, clip: Path, with_dialogue: bool = False, dialogue_mode: str = "dub") -> QcRequest:
    shots = [
        {"shot_id": "ep01_s001", "offset_sec": 0, "duration_sec": 3, "characters": [{"id": "mina", "refs": []}], "dialogue": []},
        {"shot_id": "ep01_s002", "offset_sec": 3, "duration_sec": 4, "characters": [], "dialogue": ([{"char": "mina", "text": "สวัสดี", "t_start": 0.5, "t_end": 1.5}] if with_dialogue else [])},
    ]
    return QcRequest.from_dict({
        "root": str(root),
        "tools": {"ffmpeg": FFMPEG, "ffprobe": FFPROBE},
        "thresholds": {"duration_tolerance": 0.1, "cut_tolerance": 0, "black_min_sec": 0.3, "freeze_min_sec": 1.0, "scdet_threshold": 10, "keyframes_per_shot": 3},
        "medium": "live_action",
        "dialogue_mode": dialogue_mode,
        "frames_dir": "qc/frames",
        "clips": [{"batch_id": "b01", "clip": clip.relative_to(root).as_posix(), "version": 1, "expected_sec": 7.0, "shots": shots}],
    })


def _by_name(result: dict, name: str) -> dict:
    return next(c for c in result["checks"] if c["name"] == name)


def test_ffmpeg_primitives(clips):
    root = clips["good"].parent
    assert abs(ff.probe_duration(FFPROBE, clips["good"]) - 7.0) < 0.2
    cuts = ff.detect_scene_cuts(FFMPEG, clips["good"], 10)
    assert len(cuts) == 1 and abs(cuts[0] - 3.0) < 0.3
    assert len(ff.detect_scene_cuts(FFMPEG, clips["cuts"], 10)) == 3
    blacks = ff.detect_black(FFMPEG, clips["black"], 0.3)
    assert len(blacks) == 1 and 4.3 < blacks[0].start < 4.7
    freezes = ff.detect_freeze(FFMPEG, clips["frozen"], 1.0)
    assert len(freezes) >= 1 and freezes[0].start < 0.5
    assert ff.detect_freeze(FFMPEG, clips["good"], 1.0) == []
    assert ff.has_audio(FFPROBE, clips["audio"]) and not ff.has_audio(FFPROBE, clips["good"])
    frames = ff.extract_keyframes(FFMPEG, clips["good"], 3, 4, 3, root / "frames", "s2")
    assert [f.name for f in frames] == ["s2_1.jpg", "s2_2.jpg", "s2_3.jpg"] and all(f.stat().st_size > 0 for f in frames)


def test_good_clip_passes(clips):
    root = clips["good"].parent
    report = run_request(_request(root, clips["good"]))
    assert report["summary"] == {"shots": 2, "pass": 2, "fail": 0}
    for r in report["results"]:
        assert r["pass"], r
        assert len(r["keyframes"]) == 3
        assert _by_name(r, "dialogue")["skipped"]  # dub mode -> not checked
        assert _by_name(r, "people")["skipped"] or _by_name(r, "people")["pass"]


def test_planted_defects_are_caught(clips):
    root = clips["good"].parent
    expectations = {
        "short": ("duration", None),
        "black": ("black", "ep01_s002"),
        "frozen": ("freeze", "ep01_s001"),
        "cuts": ("cuts", None),
    }
    caught = 0
    for name, (check, shot) in expectations.items():
        report = run_request(_request(root, clips[name]))
        results = {r["shot_id"]: r for r in report["results"]}
        targets = [results[shot]] if shot else list(results.values())
        hit = any(not _by_name(r, check)["pass"] for r in targets)
        if hit:
            caught += 1
        assert hit, f"{name}: {check} not flagged: {json.dumps(report, ensure_ascii=False)[:500]}"
        # the untouched shot of the black clip stays clean on that check
        if shot:
            other = next(r for sid, r in results.items() if sid != shot)
            assert _by_name(other, check)["pass"]
    assert caught / len(expectations) >= 0.8


def test_native_dialogue_without_whisper_is_skipped_not_failed(clips):
    root = clips["good"].parent
    report = run_request(_request(root, clips["audio"], with_dialogue=True, dialogue_mode="native"))
    chk = _by_name(report["results"][1], "dialogue")
    assert chk["skipped"] or "value" in chk  # skipped when faster-whisper missing, real CER when installed
    assert report["summary"]["fail"] == 0


def test_missing_clip_fails_cleanly(clips):
    root = clips["good"].parent
    req = _request(root, clips["good"])
    req.clips[0].clip = "nope.mp4"
    report = run_request(req)
    assert report["summary"]["fail"] == 2
    assert "ไม่พบไฟล์คลิป" in report["results"][0]["reasons"][0]


def test_cli_request_mode(clips, tmp_path):
    root = clips["good"].parent
    req = _request(root, clips["short"])
    req_file = tmp_path / "request.json"
    req_file.write_text(json.dumps({
        "root": str(root), "tools": req.tools, "thresholds": {"cut_tolerance": 0}, "dialogue_mode": "dub",
        "clips": [{"batch_id": "b01", "clip": clips["short"].name, "version": 1, "expected_sec": 7.0,
                   "shots": [{"shot_id": "ep01_s001", "offset_sec": 0, "duration_sec": 3}, {"shot_id": "ep01_s002", "offset_sec": 3, "duration_sec": 4}]}],
    }), encoding="utf-8")
    p = subprocess.run([sys.executable, "-m", "workers.qc.run", "--request", str(req_file)], capture_output=True, text=True, cwd=str(Path(__file__).resolve().parents[3]))
    assert p.returncode == 0, p.stderr
    report = json.loads(p.stdout)
    assert report["summary"]["fail"] == 2
    assert all(not _by_name(r, "duration")["pass"] for r in report["results"])
