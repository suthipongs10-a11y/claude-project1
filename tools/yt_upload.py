#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
yt_upload.py — อัปโหลดคลิปขึ้น YouTube (resumable upload) + ตั้งปก

อ่านค่าจาก env หรือไฟล์ .env: YT_CLIENT_ID / YT_CLIENT_SECRET / YT_REFRESH_TOKEN
(ได้มาจาก tools/yt_auth.py ที่รันบนคอมครั้งเดียว)

ใช้:
  python tools/yt_upload.py \
    --video AGRI_EP01.mp4 \
    --publish channels/agri/projects/ep01-grass-compost/PUBLISH.md \
    --title-key A --thumb channels/agri/projects/ep01-grass-compost/thumb_A.png \
    --privacy private

ค่า --privacy: private (ดีฟอลต์ ปลอดภัยสุด) / unlisted / public
  ตั้ง private ไว้ก่อนเสมอ แล้วเข้าไปกดเผยแพร่เองใน YouTube Studio หลังตรวจแล้ว

หมวดหมู่ (--category): 26=Howto & Style (เกษตร/สุขภาพ), 28=Science & Technology (อวกาศ),
  27=Education
"""
import argparse, json, mimetypes, os, re, sys, urllib.error, urllib.parse, urllib.request

TOKEN_URL = "https://oauth2.googleapis.com/token"
UPLOAD_URL = ("https://youtube.googleapis.com/upload/youtube/v3/videos"
              "?uploadType=resumable&part=snippet,status")
THUMB_URL = ("https://youtube.googleapis.com/upload/youtube/v3/thumbnails/set"
             "?uploadType=media&videoId={vid}")
CHUNK = 8 * 1024 * 1024  # 8 MB ต่อรอบ


def load_env(path=".env"):
    if os.path.exists(path):
        for line in open(path, encoding="utf-8"):
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                os.environ.setdefault(k.strip(), v.strip())


def access_token():
    cid = os.environ.get("YT_CLIENT_ID")
    sec = os.environ.get("YT_CLIENT_SECRET")
    rt = os.environ.get("YT_REFRESH_TOKEN")
    missing = [n for n, v in [("YT_CLIENT_ID", cid), ("YT_CLIENT_SECRET", sec),
                              ("YT_REFRESH_TOKEN", rt)] if not v]
    if missing:
        sys.exit(f"❌ ไม่พบค่า {', '.join(missing)} — รัน tools/yt_auth.py บนคอมก่อน")
    body = urllib.parse.urlencode({
        "client_id": cid, "client_secret": sec,
        "refresh_token": rt, "grant_type": "refresh_token",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=body,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    try:
        return json.load(urllib.request.urlopen(req))["access_token"]
    except urllib.error.HTTPError as e:
        sys.exit(f"❌ แลก token ไม่ผ่าน {e.code}: {e.read().decode()[:400]}\n"
                 f"   (ถ้า consent screen ยังเป็นโหมด Testing, refresh token หมดอายุใน 7 วัน "
                 f"— รัน yt_auth.py ใหม่ หรือย้ายแอปเป็น Production)")


def parse_publish(path, title_key):
    """ดึงชื่อคลิป/คำบรรยาย/แท็ก จาก PUBLISH.md (บล็อก ``` ใต้แต่ละหัวข้อ)"""
    md = open(path, encoding="utf-8").read()
    blocks = re.findall(r"```\n(.*?)\n```", md, re.S)
    if len(blocks) < 3:
        sys.exit("❌ PUBLISH.md ไม่มีบล็อก ``` ครบ (ต้องมี ชื่อ A/B/C, คำบรรยาย, แท็ก)")
    titles = {}
    for m in re.finditer(r"\*\*([ABC])[^*]*\*\*\n```\n(.*?)\n```", md, re.S):
        titles[m.group(1)] = m.group(2).strip()
    if title_key not in titles:
        sys.exit(f"❌ ไม่เจอชื่อคลิปแบบ {title_key} (มี: {sorted(titles)})")
    # คำบรรยาย = บล็อกที่ยาวที่สุด, แท็ก = บล็อกที่มีคอมม่าและอยู่หลังคำบรรยาย
    desc = max(blocks, key=len).strip()
    tags = []
    for b in blocks:
        if "," in b and "\n" not in b.strip():
            tags = [t.strip() for t in b.split(",") if t.strip()]
    return titles[title_key], desc, tags


def start_session(token, meta, size, mime):
    req = urllib.request.Request(
        UPLOAD_URL, data=json.dumps(meta).encode("utf-8"),
        headers={"Authorization": f"Bearer {token}",
                 "Content-Type": "application/json; charset=UTF-8",
                 "X-Upload-Content-Length": str(size),
                 "X-Upload-Content-Type": mime})
    try:
        with urllib.request.urlopen(req) as r:
            loc = r.headers.get("Location")
    except urllib.error.HTTPError as e:
        sys.exit(f"❌ เปิด session ไม่ผ่าน {e.code}: {e.read().decode()[:600]}")
    if not loc:
        sys.exit("❌ ไม่ได้ upload URL กลับมา")
    return loc


def upload(session_url, path, size):
    """ส่งไฟล์ทีละก้อน — ต่อได้ถ้าหลุดกลางทาง (resumable)"""
    sent = 0
    with open(path, "rb") as f:
        while sent < size:
            chunk = f.read(CHUNK)
            end = sent + len(chunk) - 1
            req = urllib.request.Request(session_url, data=chunk, method="PUT",
                                         headers={"Content-Length": str(len(chunk)),
                                                  "Content-Range": f"bytes {sent}-{end}/{size}"})
            try:
                with urllib.request.urlopen(req) as r:
                    print(f"  {end+1}/{size} bytes (100%)")
                    return json.load(r)
            except urllib.error.HTTPError as e:
                if e.code == 308:          # ยังไม่จบ — ส่งก้อนต่อไป
                    rng = e.headers.get("Range")
                    sent = int(rng.split("-")[1]) + 1 if rng else end + 1
                    f.seek(sent)
                    print(f"  {sent}/{size} bytes ({100*sent//size}%)", flush=True)
                else:
                    sys.exit(f"❌ อัปโหลดล้ม {e.code}: {e.read().decode()[:600]}")
    sys.exit("❌ ส่งครบแล้วแต่ไม่ได้ผลลัพธ์กลับมา")


def set_thumb(token, vid, path):
    data = open(path, "rb").read()
    mime = mimetypes.guess_type(path)[0] or "image/png"
    req = urllib.request.Request(THUMB_URL.format(vid=vid), data=data, method="POST",
                                 headers={"Authorization": f"Bearer {token}",
                                          "Content-Type": mime,
                                          "Content-Length": str(len(data))})
    try:
        urllib.request.urlopen(req)
        print("✅ ตั้งปกเรียบร้อย")
    except urllib.error.HTTPError as e:
        print(f"⚠️ ตั้งปกไม่ผ่าน {e.code}: {e.read().decode()[:300]}\n"
              f"   (ช่องต้องยืนยันเบอร์โทรก่อนถึงจะตั้งปกเองได้ — ตั้งมือใน Studio ได้)")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--publish", required=True, help="PUBLISH.md ของโปรเจกต์")
    ap.add_argument("--title-key", default="A", choices=["A", "B", "C"])
    ap.add_argument("--thumb")
    ap.add_argument("--privacy", default="private", choices=["private", "unlisted", "public"])
    ap.add_argument("--category", default="26", help="26=Howto&Style 28=Science 27=Education")
    ap.add_argument("--language", default="th")
    ap.add_argument("--env", default=".env")
    ap.add_argument("--dry-run", action="store_true", help="แสดงค่าที่จะส่ง แต่ไม่อัปโหลดจริง")
    args = ap.parse_args()

    load_env(args.env)
    title, desc, tags = parse_publish(args.publish, args.title_key)
    size = os.path.getsize(args.video)
    meta = {
        "snippet": {"title": title[:100], "description": desc[:5000], "tags": tags[:50],
                    "categoryId": args.category, "defaultLanguage": args.language,
                    "defaultAudioLanguage": args.language},
        "status": {"privacyStatus": args.privacy, "selfDeclaredMadeForKids": False,
                   "license": "youtube", "embeddable": True},
    }
    print(f"ไฟล์   : {args.video} ({size/1024/1024:.1f} MB)")
    print(f"ชื่อ    : {title}")
    print(f"แท็ก   : {len(tags)} ตัว")
    print(f"คำบรรยาย: {len(desc)} ตัวอักษร")
    print(f"สถานะ  : {args.privacy} · หมวด {args.category} · ภาษา {args.language}")
    if args.dry_run:
        print("\n(dry-run — ไม่ได้อัปโหลดจริง)")
        return

    token = access_token()
    mime = mimetypes.guess_type(args.video)[0] or "video/mp4"
    print("\nเปิด session อัปโหลด...")
    sess = start_session(token, meta, size, mime)
    print("กำลังส่งไฟล์...")
    res = upload(sess, args.video, size)
    vid = res.get("id")
    print(f"\n✅ อัปโหลดสำเร็จ: https://youtu.be/{vid}")
    print(f"   สถานะ: {res.get('status', {}).get('privacyStatus')}")
    if args.thumb:
        set_thumb(token, vid, args.thumb)
    print(f"\nแก้ไขต่อได้ที่ https://studio.youtube.com/video/{vid}/edit")


if __name__ == "__main__":
    main()
