"""CLI: python -m workers.qc.run --request <request.json>  (prints the report JSON on stdout)

Also: python -m workers.qc.run --episode <projects/<series>/episodes/epNN> for a quick local run that
builds a request from shots.json + gen/<shot>/vN.json pointers (thresholds = defaults).
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .engine import run_request
from .request import QcRequest


def request_from_episode(ep_dir: Path, ffmpeg: str = "ffmpeg", ffprobe: str = "ffprobe") -> dict:
    series_root = ep_dir.parent.parent
    shots = json.loads((ep_dir / "shots.json").read_text(encoding="utf-8"))
    clips: dict[str, dict] = {}
    for shot in shots["shots"]:
        gen_dir = ep_dir / "gen" / shot["id"]
        pointers = sorted(gen_dir.glob("v*.json"), key=lambda p: int(p.stem[1:])) if gen_dir.exists() else []
        if not pointers:
            continue
        ptr = json.loads(pointers[-1].read_text(encoding="utf-8"))
        version = int(pointers[-1].stem[1:])
        entry = clips.setdefault(ptr["batch_id"], {"batch_id": ptr["batch_id"], "clip": ptr["clip"], "version": version, "expected_sec": 0.0, "shots": []})
        entry["expected_sec"] = round(entry["expected_sec"] + float(shot["duration_sec"]), 3)
        entry["shots"].append({
            "shot_id": shot["id"],
            "offset_sec": ptr["offset_sec"],
            "duration_sec": shot["duration_sec"],
            "dialogue": shot.get("dialogue", []),
            "characters": [{"id": c["id"], "refs": []} for c in shot.get("characters", [])],
            "max_people": shot.get("max_people"),
        })
    rel = ep_dir.relative_to(series_root).as_posix()
    return {"root": str(series_root), "tools": {"ffmpeg": ffmpeg, "ffprobe": ffprobe}, "clips": list(clips.values()), "frames_dir": f"{rel}/qc/frames", "thresholds": {}}


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="workers.qc.run")
    ap.add_argument("--request", help="request JSON written by the server")
    ap.add_argument("--episode", help="episode folder (quick local mode)")
    ap.add_argument("--ffmpeg", default="ffmpeg")
    ap.add_argument("--ffprobe", default="ffprobe")
    args = ap.parse_args(argv)
    if not args.request and not args.episode:
        ap.error("ต้องระบุ --request หรือ --episode")
    req = QcRequest.load(args.request) if args.request else QcRequest.from_dict(request_from_episode(Path(args.episode), args.ffmpeg, args.ffprobe))
    report = run_request(req)
    json.dump(report, sys.stdout, ensure_ascii=False)
    sys.stdout.write("\n")
    return 0 if not report["errors"] else 2


if __name__ == "__main__":
    raise SystemExit(main())
