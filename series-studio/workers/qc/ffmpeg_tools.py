"""Thin wrappers around ffmpeg/ffprobe. Every function raises FfmpegError with stderr on failure."""
from __future__ import annotations

import json
import re
import subprocess
from dataclasses import dataclass
from pathlib import Path


class FfmpegError(RuntimeError):
    pass


def _run(cmd: list[str], timeout: int = 600) -> subprocess.CompletedProcess[str]:
    try:
        return subprocess.run(cmd, capture_output=True, text=True, timeout=timeout, check=False)
    except FileNotFoundError as e:  # pragma: no cover - depends on machine
        raise FfmpegError(f"ไม่พบโปรแกรม {cmd[0]} (ติดตั้ง ffmpeg ก่อน)") from e
    except subprocess.TimeoutExpired as e:
        raise FfmpegError(f"{cmd[0]} ใช้เวลานานเกิน {timeout}s") from e


def probe_duration(ffprobe: str, path: Path) -> float:
    p = _run([ffprobe, "-v", "error", "-show_entries", "format=duration:stream=duration,codec_type", "-of", "json", str(path)])
    if p.returncode != 0:
        raise FfmpegError(p.stderr.strip() or f"ffprobe ล้มเหลวกับ {path}")
    data = json.loads(p.stdout or "{}")
    dur = data.get("format", {}).get("duration")
    if dur is None:
        for s in data.get("streams", []):
            if s.get("codec_type") == "video" and s.get("duration"):
                dur = s["duration"]
                break
    if dur is None:
        raise FfmpegError(f"อ่านความยาวไม่ได้: {path}")
    return float(dur)


def has_audio(ffprobe: str, path: Path) -> bool:
    p = _run([ffprobe, "-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "json", str(path)])
    return p.returncode == 0 and bool(json.loads(p.stdout or "{}").get("streams"))


_SCDET = re.compile(r"lavfi\.scd\.time[=:]\s*(?P<t>[0-9.]+)")
_BLACK = re.compile(r"black_start:(?P<s>[0-9.]+) black_end:(?P<e>[0-9.]+)")
_FREEZE_START = re.compile(r"lavfi\.freezedetect\.freeze_start: (?P<t>[0-9.]+)")
_FREEZE_END = re.compile(r"lavfi\.freezedetect\.freeze_end: (?P<t>[0-9.]+)")


def detect_scene_cuts(ffmpeg: str, path: Path, threshold: float = 10.0, min_gap: float = 0.25) -> list[float]:
    """Timestamps (s) of hard cuts found by the scdet filter (score 0-100).

    Detections closer than ``min_gap`` seconds are merged: a cut followed by fast motion in the
    first frames of the new shot is still one cut.
    """
    p = _run([ffmpeg, "-hide_banner", "-nostats", "-i", str(path), "-vf", f"scdet=threshold={threshold}:sc_pass=0", "-an", "-f", "null", "-"])
    raw = sorted(set(round(float(m.group("t")), 3) for m in _SCDET.finditer(p.stderr)))
    cuts: list[float] = []
    for c in raw:
        if not cuts or c - cuts[-1] >= min_gap:
            cuts.append(c)
    return cuts


@dataclass
class Interval:
    start: float
    end: float

    def overlaps(self, s: float, e: float) -> bool:
        return self.start < e and self.end > s


def detect_black(ffmpeg: str, path: Path, min_sec: float, pix_th: float = 0.10) -> list[Interval]:
    p = _run([ffmpeg, "-hide_banner", "-nostats", "-i", str(path), "-vf", f"blackdetect=d={min_sec}:pix_th={pix_th}", "-an", "-f", "null", "-"])
    return [Interval(float(m.group("s")), float(m.group("e"))) for m in _BLACK.finditer(p.stderr)]


def detect_freeze(ffmpeg: str, path: Path, min_sec: float, noise: str = "-60dB") -> list[Interval]:
    p = _run([ffmpeg, "-hide_banner", "-nostats", "-i", str(path), "-vf", f"freezedetect=n={noise}:d={min_sec}", "-an", "-f", "null", "-"])
    starts = [float(m.group("t")) for m in _FREEZE_START.finditer(p.stderr)]
    ends = [float(m.group("t")) for m in _FREEZE_END.finditer(p.stderr)]
    out: list[Interval] = []
    for i, s in enumerate(starts):
        e = ends[i] if i < len(ends) else None
        if e is None:
            # freeze lasted until the end of the clip
            e = probe_duration(ffmpeg.replace("ffmpeg", "ffprobe"), path) if "ffmpeg" in ffmpeg else s + min_sec
        out.append(Interval(s, e))
    return out


def extract_frame(ffmpeg: str, path: Path, t: float, dest: Path, width: int = 640) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    p = _run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-ss", f"{max(t, 0):.3f}", "-i", str(path), "-frames:v", "1", "-vf", f"scale={width}:-2", str(dest)])
    if p.returncode != 0 or not dest.exists():
        raise FfmpegError(p.stderr.strip() or f"ดึงเฟรมที่ {t}s ไม่ได้")
    return dest


def extract_keyframes(ffmpeg: str, path: Path, start: float, duration: float, n: int, dest_dir: Path, stem: str) -> list[Path]:
    """n frames spread inside [start, start+duration): at 10%, 50%, 90% for n=3."""
    if n <= 0:
        return []
    fracs = [0.5] if n == 1 else [0.1 + 0.8 * i / (n - 1) for i in range(n)]
    out = []
    for i, f in enumerate(fracs, 1):
        t = start + duration * f
        out.append(extract_frame(ffmpeg, path, t, dest_dir / f"{stem}_{i}.jpg"))
    return out


def extract_audio_wav(ffmpeg: str, path: Path, dest: Path) -> Path:
    dest.parent.mkdir(parents=True, exist_ok=True)
    p = _run([ffmpeg, "-hide_banner", "-loglevel", "error", "-y", "-i", str(path), "-vn", "-ac", "1", "-ar", "16000", str(dest)])
    if p.returncode != 0:
        raise FfmpegError(p.stderr.strip() or "แยกเสียงไม่ได้")
    return dest
