#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_image.py — สร้างภาพช็อตด้วย Wan (DashScope / Alibaba Model Studio)

DashScope image API เป็นแบบ async: POST สร้าง task -> ได้ task_id -> poll จน
SUCCEEDED -> โหลดรูปจาก url สคริปต์นี้ห่อครบทั้งวงจร + ใส่ STYLE/CHARLOCK ให้
อัตโนมัติ (อ่านจาก CHANNEL-STYLE.md ผ่าน --style-file) เพื่อคุมสไตล์ทุกช็อต

โมเดลสร้างภาพ = Wan (`wan2.7-image` / `wan2.7-image-pro`) — Qwen-Image ไม่มีในแพลน
NOTE: image gen ใช้ได้เฉพาะ native async path นี้ ไม่ใช่ OpenAI-compatible (/compatible-mode)

ตั้งค่าคีย์ + host (Token Plan ใช้ host ของแพลนเอง):
  PowerShell:
    $env:DASHSCOPE_API_KEY="sk-sp-..."
    $env:DASHSCOPE_BASE="https://token-plan.ap-southeast-1.maas.aliyuncs.com"

ใช้ (ทีละภาพ):
  python images/gen_image.py --prompt "prompt" --out images/out/test.png

ใช้ (ยิงทั้งแพ็ก prompts.json = [{"id":"img01","prompt":"..."}, ...]):
  python images/gen_image.py --pack projects/video-01-blackhole/PROMPTS.json \
      --outdir projects/video-01-blackhole/frames

หมายเหตุ:
  - ค่าเริ่มต้น 16:9 (1664*928) ตามสเปกช่อง
  - host: --base-url หรือ env DASHSCOPE_BASE (ดีฟอลต์ host ของ Token Plan)
    ถ้าเป็นคีย์ DashScope ทั่วไป ใช้ --region intl/cn ได้
  - watermark ปิด, prompt_extend ปิด (เราคุม prompt เอง ไม่ให้โมเดลแต่งเพิ่ม)
"""
import argparse, json, os, sys, time, urllib.request

REGION_HOST = {
    "intl": "https://dashscope-intl.aliyuncs.com",
    "cn": "https://dashscope.aliyuncs.com",
}
# Token Plan (sk-sp-...) ยิง native path บน host ของแพลนเอง
DEFAULT_BASE = "https://token-plan.ap-southeast-1.maas.aliyuncs.com"
CREATE_PATH = "/api/v1/services/aigc/text2image/image-synthesis"
TASK_PATH = "/api/v1/tasks/{task_id}"


def create_task(host: str, key: str, model: str, prompt: str,
                negative: str, size: str) -> str:
    import requests
    body = {
        "model": model,
        "input": {"prompt": prompt},
        "parameters": {"size": size, "n": 1,
                       "prompt_extend": False, "watermark": False},
    }
    if negative:
        body["input"]["negative_prompt"] = negative
    r = requests.post(
        host + CREATE_PATH,
        headers={"Authorization": f"Bearer {key}",
                 "X-DashScope-Async": "enable",
                 "Content-Type": "application/json"},
        json=body, timeout=60,
    )
    if r.status_code != 200:
        raise RuntimeError(f"create HTTP {r.status_code}: {r.text[:400]}")
    out = r.json().get("output", {})
    tid = out.get("task_id")
    if not tid:
        raise RuntimeError(f"ไม่มี task_id ในผลลัพธ์: {r.text[:400]}")
    return tid


def poll_task(host: str, key: str, task_id: str, timeout_s: int = 300) -> str:
    """poll จน SUCCEEDED แล้วคืน url รูปแรก (FAILED/หมดเวลา -> ยก error)"""
    import requests
    url = host + TASK_PATH.format(task_id=task_id)
    deadline = time.time() + timeout_s
    delay = 3
    while time.time() < deadline:
        r = requests.get(url, headers={"Authorization": f"Bearer {key}"}, timeout=30)
        if r.status_code != 200:
            raise RuntimeError(f"poll HTTP {r.status_code}: {r.text[:300]}")
        out = r.json().get("output", {})
        status = out.get("task_status")
        if status == "SUCCEEDED":
            results = out.get("results", [])
            for item in results:
                if item.get("url"):
                    return item["url"]
            raise RuntimeError(f"SUCCEEDED แต่ไม่มี url: {r.text[:400]}")
        if status in ("FAILED", "CANCELED", "UNKNOWN"):
            raise RuntimeError(f"task {status}: {out.get('message') or r.text[:400]}")
        time.sleep(delay)
        delay = min(delay + 2, 10)  # backoff เบา ๆ
    raise RuntimeError(f"หมดเวลารอ task {task_id} ({timeout_s}s)")


def download(url: str, path: str):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    with urllib.request.urlopen(url, timeout=120) as resp, open(path, "wb") as f:
        f.write(resp.read())


def load_style_suffix(style_file: str) -> str:
    """ดึงบล็อก STYLE + CHARLOCK จาก CHANNEL-STYLE.md มาต่อท้าย prompt ทุกช็อต

    อ่านบรรทัดที่ขึ้นต้นด้วย '>' ในหัวข้อ MASCOT และ STYLE BLOCK (บล็อก quote)
    เพื่อให้ทุกภาพ match แบรนด์โดยไม่ต้องพิมพ์ซ้ำใน prompt แต่ละช็อต
    """
    if not style_file or not os.path.exists(style_file):
        return ""
    lines = open(style_file, encoding="utf-8").read().splitlines()
    blocks, grab = [], False
    for ln in lines:
        s = ln.strip()
        if s.startswith("## 2.") or s.startswith("## 3."):
            grab = True
            continue
        if s.startswith("## ") and not (s.startswith("## 2.") or s.startswith("## 3.")):
            grab = False
        if grab and s.startswith(">"):
            blocks.append(s.lstrip("> ").strip())
    return " ".join(b for b in blocks if b)


def gen_one(host, key, model, prompt, negative, size, out_path):
    tid = create_task(host, key, model, prompt, negative, size)
    print(f"    task={tid} รอ...", flush=True)
    url = poll_task(host, key, tid)
    download(url, out_path)
    print(f"    ✅ {out_path}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--prompt", help="prompt เดี่ยว (คู่กับ --out)")
    ap.add_argument("--out", help="path ไฟล์ภาพผลลัพธ์ (โหมด prompt เดี่ยว)")
    ap.add_argument("--pack", help="prompts.json = [{id, prompt, [negative]}]")
    ap.add_argument("--outdir", help="โฟลเดอร์ผลลัพธ์ (โหมด --pack), ตั้งชื่อไฟล์จาก id")
    ap.add_argument("--model", default="wan2.7-image", help="wan2.7-image / wan2.7-image-pro")
    ap.add_argument("--size", default="1664*928", help="16:9=1664*928, 1:1=1328*1328")
    ap.add_argument("--base-url", default=os.environ.get("DASHSCOPE_BASE"),
                    help="base URL (ดีฟอลต์ env DASHSCOPE_BASE / host ของ Token Plan)")
    ap.add_argument("--negative",
                    default=("photorealistic, 3d render, realistic texture, gradient mesh, "
                             "photograph, embedded text, letters, words, thai text, caption, "
                             "watermark, signature, colored mascot, mascot with colored body, "
                             "extra mascot faces, deformed face, blurry, cluttered"),
                    help="negative prompt ร่วมทุกช็อต (มีค่าเริ่มต้นกันตัวหนังสือ/ภาพจริง/มาสคอตเพี้ยน)")
    ap.add_argument("--style-file", default="CHANNEL-STYLE.md",
                    help="ดึง STYLE+CHARLOCK มาต่อท้าย prompt (ตั้ง '' เพื่อปิด)")
    ap.add_argument("--region", default=None, choices=["intl", "cn"],
                    help="ใช้ host DashScope ทั่วไป (ไม่ใช่ Token Plan)")
    args = ap.parse_args()

    key = os.environ.get("DASHSCOPE_API_KEY")
    if not key:
        sys.exit("ERROR: ตั้ง env DASHSCOPE_API_KEY ก่อน (ห้ามฝังคีย์ในไฟล์)")
    try:
        import requests  # noqa: F401
    except ImportError:
        sys.exit("ERROR: pip install requests")

    # host: --base-url/env > --region (dashscope ทั่วไป) > DEFAULT_BASE (Token Plan)
    host = args.base_url or (REGION_HOST[args.region] if args.region else DEFAULT_BASE)
    host = host.rstrip("/")
    print(f"[host] {host} | model {args.model}")
    suffix = load_style_suffix(args.style_file)
    if suffix:
        print(f"[style] ต่อท้าย prompt ทุกช็อต ({len(suffix)} ตัวอักษร)")

    def full(p):
        return f"{p}\n\n{suffix}" if suffix else p

    if args.pack:
        if not args.outdir:
            sys.exit("ERROR: --pack ต้องมี --outdir")
        pack = json.load(open(args.pack, encoding="utf-8"))
        print(f"[pack] {len(pack)} ช็อต -> {args.outdir}")
        failed = []
        for i, shot in enumerate(pack, 1):
            sid = shot["id"]
            out_path = os.path.join(args.outdir, f"{sid}.png")
            if os.path.exists(out_path):
                print(f"[{i}/{len(pack)}] {sid}: มีแล้ว ข้าม")
                continue
            print(f"[{i}/{len(pack)}] {sid}")
            try:
                gen_one(host, key, args.model, full(shot["prompt"]),
                        shot.get("negative", args.negative), args.size, out_path)
            except Exception as e:
                print(f"    ❌ {sid}: {e}")
                failed.append(sid)
        if failed:
            sys.exit(f"\n❌ ช็อตที่พลาด: {failed} (รันซ้ำ ช็อตที่มีแล้วจะถูกข้าม)")
        print("\n✅ ครบทุกช็อต")
        return

    if not (args.prompt and args.out):
        sys.exit("ERROR: ใช้ --prompt+--out (เดี่ยว) หรือ --pack+--outdir (แพ็ก)")
    gen_one(host, key, args.model, full(args.prompt), args.negative,
            args.size, args.out)


if __name__ == "__main__":
    main()
