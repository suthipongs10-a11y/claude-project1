"""Synthetic clips built with ffmpeg so QC can be tested without any generator."""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import pytest

FFMPEG = shutil.which("ffmpeg")
FFPROBE = shutil.which("ffprobe")

needs_ffmpeg = pytest.mark.skipif(not FFMPEG or not FFPROBE, reason="ffmpeg not installed")


def _src(kind: str, seconds: float, size: str = "320x240") -> str:
    """lavfi sources with motion so freezedetect does not fire on 'good' footage."""
    if kind == "a":
        return f"testsrc2=size={size}:rate=24:duration={seconds}"
    if kind == "b":
        return f"mandelbrot=size={size}:rate=24,trim=duration={seconds}"
    if kind == "c":
        return f"life=size={size}:rate=24:ratio=0.3:mold=10,trim=duration={seconds}"
    if kind == "black":
        return f"color=black:size={size}:rate=24:duration={seconds}"
    if kind == "frozen":
        return f"color=0x3355aa:size={size}:rate=24:duration={seconds}"
    raise ValueError(kind)


def make_clip(dest: Path, segments: list[tuple[str, float]], audio: bool = False) -> Path:
    """Concatenate lavfi segments into one mp4 (hard cuts between segments)."""
    assert FFMPEG
    inputs: list[str] = []
    filt = []
    for i, (kind, sec) in enumerate(segments):
        inputs += ["-f", "lavfi", "-i", _src(kind, sec)]
        filt.append(f"[{i}:v]format=yuv420p,setsar=1[v{i}]")
    n = len(segments)
    filt.append("".join(f"[v{i}]" for i in range(n)) + f"concat=n={n}:v=1:a=0[outv]")
    cmd = [FFMPEG, "-hide_banner", "-loglevel", "error", "-y", *inputs]
    if audio:
        total = sum(s for _, s in segments)
        cmd += ["-f", "lavfi", "-i", f"sine=frequency=440:duration={total}"]
    cmd += ["-filter_complex", ";".join(filt), "-map", "[outv]"]
    if audio:
        cmd += ["-map", f"{n}:a", "-c:a", "aac"]
    cmd += ["-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", str(dest)]
    subprocess.run(cmd, check=True)
    return dest


@pytest.fixture(scope="session")
def clips(tmp_path_factory: pytest.TempPathFactory) -> dict[str, Path]:
    root = tmp_path_factory.mktemp("clips")
    out = {
        # planned: 2 shots, 3s + 4s = 7s
        "good": make_clip(root / "good.mp4", [("a", 3), ("b", 4)]),
        # too short: 5s instead of 7s
        "short": make_clip(root / "short.mp4", [("a", 2), ("b", 3)]),
        # 1.2 s of black inside shot 2
        "black": make_clip(root / "black.mp4", [("a", 3), ("b", 1.5), ("black", 1.2), ("b", 1.3)]),
        # frozen frame for 2s inside shot 1
        "frozen": make_clip(root / "frozen.mp4", [("frozen", 2), ("a", 1), ("b", 4)]),
        # extra cuts: 4 segments where 2 were planned
        "cuts": make_clip(root / "cuts.mp4", [("a", 1.5), ("c", 1.5), ("b", 2), ("a", 2)]),
        # with an audio track (for the has_audio path)
        "audio": make_clip(root / "audio.mp4", [("a", 3), ("b", 4)], audio=True),
    }
    return out
