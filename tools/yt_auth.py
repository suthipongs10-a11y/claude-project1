#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
yt_auth.py — ขอ refresh token ของ YouTube (รันบน "คอมคุณ" ครั้งเดียวพอ)

ทำไมต้องรันบนคอมคุณ: ขั้นตอนนี้ต้องเปิดเบราว์เซอร์ล็อกอินบัญชี Google ของคุณเอง
sandbox ทำแทนไม่ได้ (และไม่ควรทำแทน) — ได้ refresh token มาแล้วค่อยส่งให้ผมใช้

เตรียมก่อน (ทำใน Google Cloud Console ครั้งเดียว):
 1. สร้าง project ใหม่
 2. เปิดใช้ "YouTube Data API v3"
 3. OAuth consent screen -> External -> กรอกชื่อแอป/อีเมล
    -> Audience: เพิ่มอีเมลตัวเองใน "Test users"
 4. Credentials -> Create credentials -> OAuth client ID -> **Desktop app**
    -> ได้ client_id กับ client_secret

ใช้:
  python tools/yt_auth.py --client-id XXX.apps.googleusercontent.com --client-secret YYY

จะเปิดเบราว์เซอร์ให้กด "อนุญาต" แล้วพิมพ์ refresh token ออกมา
เอาไปใส่ไฟล์ .env (ไฟล์นี้ถูก gitignore อยู่แล้ว ไม่ขึ้น GitHub):
  YT_CLIENT_ID=...
  YT_CLIENT_SECRET=...
  YT_REFRESH_TOKEN=...
"""
import argparse, http.server, json, secrets, threading, urllib.parse, urllib.request, webbrowser

AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
TOKEN_URL = "https://oauth2.googleapis.com/token"
# ขอเฉพาะสิทธิ์ที่จำเป็น: อัปโหลดคลิป + ตั้งปก (ไม่ขอสิทธิ์อ่าน/ลบทั้งช่อง)
SCOPE = "https://www.googleapis.com/auth/youtube.upload"

_got = {}


class Handler(http.server.BaseHTTPRequestHandler):
    def do_GET(self):
        q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
        _got.update({k: v[0] for k, v in q.items()})
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.end_headers()
        ok = "code" in _got
        msg = "เรียบร้อย! กลับไปดูที่หน้าต่าง terminal ได้เลย" if ok else f"ผิดพลาด: {_got}"
        self.wfile.write(f"<html><body style='font-family:sans-serif;padding:40px'>"
                         f"<h2>{msg}</h2></body></html>".encode())

    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--client-id", required=True)
    ap.add_argument("--client-secret", required=True)
    ap.add_argument("--port", type=int, default=8731)
    args = ap.parse_args()

    redirect = f"http://127.0.0.1:{args.port}"
    state = secrets.token_urlsafe(16)
    params = {
        "client_id": args.client_id,
        "redirect_uri": redirect,
        "response_type": "code",
        "scope": SCOPE,
        "access_type": "offline",      # ขอ refresh token
        "prompt": "consent",           # บังคับให้ออก refresh token ใหม่ทุกครั้ง
        "state": state,
    }
    url = AUTH_URL + "?" + urllib.parse.urlencode(params)

    srv = http.server.HTTPServer(("127.0.0.1", args.port), Handler)
    threading.Thread(target=srv.handle_request, daemon=True).start()

    print("เปิดเบราว์เซอร์ให้กดอนุญาต...")
    print(f"ถ้าไม่เด้งเอง เปิดลิงก์นี้เอง:\n{url}\n")
    webbrowser.open(url)

    while "code" not in _got and "error" not in _got:
        threading.Event().wait(0.3)
    if "error" in _got:
        raise SystemExit(f"❌ ไม่ได้รับอนุญาต: {_got['error']}")
    if _got.get("state") != state:
        raise SystemExit("❌ state ไม่ตรง (อาจโดนดักกลางทาง) ยกเลิก")

    body = urllib.parse.urlencode({
        "code": _got["code"],
        "client_id": args.client_id,
        "client_secret": args.client_secret,
        "redirect_uri": redirect,
        "grant_type": "authorization_code",
    }).encode()
    req = urllib.request.Request(TOKEN_URL, data=body,
                                 headers={"Content-Type": "application/x-www-form-urlencoded"})
    tok = json.load(urllib.request.urlopen(req))
    rt = tok.get("refresh_token")
    if not rt:
        raise SystemExit(f"❌ ไม่ได้ refresh token กลับมา: {tok}")

    print("\n" + "=" * 60)
    print("✅ สำเร็จ — เอา 3 บรรทัดนี้ไปใส่ไฟล์ .env")
    print("=" * 60)
    print(f"YT_CLIENT_ID={args.client_id}")
    print(f"YT_CLIENT_SECRET={args.client_secret}")
    print(f"YT_REFRESH_TOKEN={rt}")
    print("=" * 60)
    print("\n⚠️ refresh token = กุญแจอัปโหลดเข้าช่องคุณ อย่าโพสต์ในที่สาธารณะ")
    print("   ถ้าหลุด ให้ถอนสิทธิ์ที่ https://myaccount.google.com/permissions")


if __name__ == "__main__":
    main()
