"""Request/response contract between apps/server and the QC worker.

The server writes a request JSON (everything the worker needs, with paths relative to
``root``) and reads the JSON the worker prints on stdout. Keeping the worker ignorant of the
project layout keeps it testable with synthetic clips.
"""
from __future__ import annotations

import json
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any


@dataclass
class DialogueCue:
    char: str
    text: str
    t_start: float
    t_end: float


@dataclass
class ShotRef:
    shot_id: str
    offset_sec: float
    duration_sec: float
    dialogue: list[DialogueCue] = field(default_factory=list)
    characters: list[dict[str, Any]] = field(default_factory=list)  # {id, refs:[rel paths]}
    max_people: int | None = None


@dataclass
class ClipRef:
    batch_id: str
    clip: str  # relative to root
    version: int
    expected_sec: float
    shots: list[ShotRef]


@dataclass
class Thresholds:
    duration_tolerance: float = 0.10
    cut_tolerance: int = 1
    cer_max: float = 0.25
    identity_similarity_min: float = 0.5
    black_min_sec: float = 0.3
    freeze_min_sec: float = 1.0
    scdet_threshold: float = 10.0
    keyframes_per_shot: int = 3
    ocr: bool = False


@dataclass
class QcRequest:
    root: Path
    clips: list[ClipRef]
    thresholds: Thresholds
    medium: str = "live_action"  # live_action | 2d | 3d | mixed
    dialogue_mode: str = "native"
    lang: str = "th"
    tools: dict[str, str] = field(default_factory=lambda: {"ffmpeg": "ffmpeg", "ffprobe": "ffprobe"})
    whisper: dict[str, str] = field(default_factory=lambda: {"model": "large-v3", "device": "auto", "compute_type": "auto"})
    frames_dir: str = "qc/frames"
    checks: list[str] | None = None  # subset of check names to run; None = all

    @staticmethod
    def from_dict(d: dict[str, Any]) -> "QcRequest":
        th = Thresholds(**{k: v for k, v in d.get("thresholds", {}).items() if k in Thresholds.__dataclass_fields__})
        clips = [
            ClipRef(
                batch_id=c["batch_id"],
                clip=c["clip"],
                version=int(c.get("version", 1)),
                expected_sec=float(c["expected_sec"]),
                shots=[
                    ShotRef(
                        shot_id=s["shot_id"],
                        offset_sec=float(s.get("offset_sec", 0)),
                        duration_sec=float(s["duration_sec"]),
                        dialogue=[DialogueCue(**x) for x in s.get("dialogue", [])],
                        characters=list(s.get("characters", [])),
                        max_people=s.get("max_people"),
                    )
                    for s in c["shots"]
                ],
            )
            for c in d["clips"]
        ]
        return QcRequest(
            root=Path(d["root"]),
            clips=clips,
            thresholds=th,
            medium=d.get("medium", "live_action"),
            dialogue_mode=d.get("dialogue_mode", "native"),
            lang=d.get("lang", "th"),
            tools={**{"ffmpeg": "ffmpeg", "ffprobe": "ffprobe"}, **d.get("tools", {})},
            whisper={**{"model": "large-v3", "device": "auto", "compute_type": "auto"}, **d.get("whisper", {})},
            frames_dir=d.get("frames_dir", "qc/frames"),
            checks=d.get("checks"),
        )

    @staticmethod
    def load(path: str | Path) -> "QcRequest":
        with open(path, encoding="utf-8") as f:
            return QcRequest.from_dict(json.load(f))


@dataclass
class Check:
    name: str
    passed: bool
    value: Any = None
    threshold: Any = None
    detail: str | None = None
    skipped: bool = False

    def to_json(self) -> dict[str, Any]:
        out: dict[str, Any] = {"name": self.name, "pass": self.passed, "skipped": self.skipped}
        if self.value is not None:
            out["value"] = self.value
        if self.threshold is not None:
            out["threshold"] = self.threshold
        if self.detail:
            out["detail"] = self.detail
        return out


def skipped(name: str, why: str) -> Check:
    """A check that could not run; never counts as a failure."""
    return Check(name=name, passed=True, skipped=True, detail=why)
