"""แคชผลลัพธ์ที่เสียเงินเรียก API แบบ content-addressed

หลักการ: key = sha256 ของ "ทุกอย่างที่มีผลต่อผลลัพธ์"
    เสียง -> model + voice + style + rate + ข้อความ
    ภาพ   -> model + prompt + aspect

ผลที่ได้:
  - ข้อความ/prompt เดิม = ไม่ต้องจ่ายซ้ำ ไม่ว่าจะย้าย segment หรือเปลี่ยนชื่อ id
  - แก้ prompt ของช็อตเดียว = สร้างใหม่เฉพาะช็อตนั้น ที่เหลือหยิบจากแคช
    (ของเดิมเช็คแค่ว่ามีไฟล์ชื่อนี้ไหม → แก้ prompt แล้วไม่สร้างใหม่ ซึ่งผิด)

ที่เก็บ:
  local   $WS_CACHE_DIR (ค่าเริ่มต้น ~/.cache/weird-stories) — อยู่นอก repo
          ไม่ commit เพราะแคชโตไม่หยุด แต่ repo ต้องเล็ก
  remote  S3-compatible (Cloudflare R2 / Backblaze B2 / AWS S3) ถ้าตั้ง env ไว้
          container นี้เป็น ephemeral พอถูกลบแคช local หายหมด remote จึงเป็นตัวกันจ่ายซ้ำข้ามเซสชัน

env ของ remote (ไม่ตั้ง = ใช้แค่แคช local):
    WS_CACHE_S3_BUCKET      ชื่อ bucket
    WS_CACHE_S3_ENDPOINT    เช่น https://<account>.r2.cloudflarestorage.com (AWS S3 ไม่ต้องใส่)
    WS_CACHE_S3_ACCESS_KEY  / WS_CACHE_S3_SECRET_KEY
    WS_CACHE_S3_REGION      ค่าเริ่มต้น auto (R2 ใช้ auto)
    WS_CACHE_S3_PREFIX      ค่าเริ่มต้น weird-stories/

หมายเหตุเรื่องเน็ต: environment นี้บล็อกโดเมนของ R2 กับ B2 อยู่ (gateway ตอบ 403 ตอน CONNECT)
ถ้าจะใช้ ต้องเพิ่มโดเมนพวกนี้ใน network policy ของ environment ก่อน — ดู README หัวข้อ "แคชนอก container"
"""
import hashlib
import json
import os
import sys
from pathlib import Path

CACHE_DIR = Path(os.environ.get("WS_CACHE_DIR", Path.home() / ".cache" / "weird-stories"))
PREFIX = os.environ.get("WS_CACHE_S3_PREFIX", "weird-stories/")

_client = None
_remote_broken = False


def key_for(**parts):
    """สร้าง key จากอินพุต — เรียงคีย์ให้คงที่เพื่อให้ hash เหมือนเดิมทุกครั้ง"""
    blob = json.dumps(parts, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(blob.encode()).hexdigest()


def _local(kind, key, ext):
    return CACHE_DIR / kind / key[:2] / f"{key}{ext}"


def _remote():
    """คืน (client, bucket) ถ้าตั้ง env ครบ ไม่งั้นคืน (None, None)"""
    global _client, _remote_broken
    bucket = os.environ.get("WS_CACHE_S3_BUCKET")
    if not bucket or _remote_broken:
        return None, None
    if _client is None:
        try:
            import boto3
            from botocore.config import Config

            _client = boto3.client(
                "s3",
                endpoint_url=os.environ.get("WS_CACHE_S3_ENDPOINT") or None,
                aws_access_key_id=os.environ.get("WS_CACHE_S3_ACCESS_KEY"),
                aws_secret_access_key=os.environ.get("WS_CACHE_S3_SECRET_KEY"),
                region_name=os.environ.get("WS_CACHE_S3_REGION", "auto"),
                config=Config(retries={"max_attempts": 3, "mode": "standard"},
                              connect_timeout=15, read_timeout=60),
            )
        except Exception as e:
            print(f"  [แคช] ต่อ S3 ไม่ได้ ใช้แคช local อย่างเดียว: {e}", file=sys.stderr)
            _remote_broken = True
            return None, None
    return _client, bucket


def get(kind, key, ext):
    """หาในแคช local ก่อน ไม่เจอค่อยดึงจาก remote คืน bytes หรือ None"""
    path = _local(kind, key, ext)
    if path.exists():
        return path.read_bytes()

    client, bucket = _remote()
    if client is None:
        return None
    try:
        obj = client.get_object(Bucket=bucket, Key=f"{PREFIX}{kind}/{key}{ext}")
        data = obj["Body"].read()
    except Exception:
        return None  # ไม่มีในแคช หรือ remote มีปัญหา — ถือว่า miss แล้วไปเรียก API
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return data


def put(kind, key, ext, data):
    """เก็บลงแคช local แล้วอัปขึ้น remote (ถ้ามี) — remote ล้มไม่ทำให้งานพัง"""
    path = _local(kind, key, ext)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)

    client, bucket = _remote()
    if client is None:
        return
    try:
        client.put_object(Bucket=bucket, Key=f"{PREFIX}{kind}/{key}{ext}", Body=data)
    except Exception as e:
        print(f"  [แคช] อัปขึ้น remote ไม่สำเร็จ (ของยังอยู่ใน local): {e}", file=sys.stderr)


def stats():
    """ขนาดและจำนวนไฟล์ในแคช local"""
    out = {}
    for kind_dir in sorted(p for p in CACHE_DIR.glob("*") if p.is_dir()):
        files = [f for f in kind_dir.rglob("*") if f.is_file()]
        out[kind_dir.name] = (len(files), sum(f.stat().st_size for f in files))
    return out


if __name__ == "__main__":
    print(f"แคชอยู่ที่: {CACHE_DIR}")
    total = 0
    for kind, (n, size) in stats().items():
        print(f"  {kind:8} {n:5} ไฟล์  {size / 1048576:8.1f} MB")
        total += size
    print(f"  {'รวม':8} {'':5}       {total / 1048576:8.1f} MB")
    client, bucket = _remote()
    print("remote:", f"s3://{bucket}/{PREFIX}" if client else "ไม่ได้ตั้งค่า (ใช้ local อย่างเดียว)")
