#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""แปลงตัวเลข/เวลา/เงิน ในข้อความไทยให้เป็นคำอ่าน ก่อนส่งเข้า TTS

จุดอ่อนที่พบจากการทดสอบ (OmniVoice-Thai อ่านเลขดิบไม่ได้) แก้ด้วยไฟล์นี้:

    from normalize_th import normalize_th
    normalize_th("เมื่อเวลา 18:30 น. ยอดวิว 2,500,000 วิว รายได้ 64,000 บาท")
    # -> "เมื่อเวลาสิบแปดนาฬิกาสามสิบนาที ยอดวิว สองล้านห้าแสน วิว รายได้ หกหมื่นสี่พัน บาท"

ครอบคลุม: เวลา (18:30 น. / 18.30 น. / 9:05:30), เงินบาท+สตางค์, เปอร์เซ็นต์,
เบอร์โทร (อ่านทีละตัว), ทศนิยม, เลขจำนวนเต็ม (มี/ไม่มีจุลภาค)
ถ้าติดตั้ง pythainlp ไว้จะใช้ num_to_thaiword ของ pythainlp — ไม่มีก็ใช้ fallback ในไฟล์นี้
"""

import re

try:
    from pythainlp.util import num_to_thaiword  # pip install pythainlp (แนะนำ)
except Exception:
    _DIGITS = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
    _UNITS = ["", "สิบ", "ร้อย", "พัน", "หมื่น", "แสน"]

    def _read_group(part: str) -> str:
        n = int(part)
        if n == 0:
            return ""
        digits = str(n)
        length = len(digits)
        out = ""
        for i, ch in enumerate(digits):
            d = int(ch)
            pos = length - i - 1
            if d == 0:
                continue
            if pos == 1:  # หลักสิบ: สิบ/ยี่สิบ ไม่ใช่ หนึ่งสิบ/สองสิบ
                out += "สิบ" if d == 1 else ("ยี่สิบ" if d == 2 else _DIGITS[d] + "สิบ")
            elif pos == 0 and d == 1 and length > 1:  # หลักหน่วยเป็น 1 และมีหลักหน้า -> เอ็ด
                out += "เอ็ด"
            else:
                out += _DIGITS[d] + _UNITS[pos]
        return out

    def num_to_thaiword(n) -> str:
        n = int(n)
        if n == 0:
            return "ศูนย์"
        if n < 0:
            return "ลบ" + num_to_thaiword(-n)
        s = str(n)
        parts = []
        while s:  # แบ่งกลุ่มละ 6 หลัก (คั่นด้วย "ล้าน")
            parts.insert(0, s[-6:])
            s = s[:-6]
        out = ""
        for i, part in enumerate(parts):
            g = _read_group(part)
            if g:
                out += g + "ล้าน" * (len(parts) - 1 - i)
        return out


def _read_digits(s: str) -> str:
    d = ["ศูนย์", "หนึ่ง", "สอง", "สาม", "สี่", "ห้า", "หก", "เจ็ด", "แปด", "เก้า"]
    return "".join(d[int(c)] for c in s if c.isdigit())


def _read_int(s: str) -> str:
    return num_to_thaiword(int(s.replace(",", "")))


def _read_time(h: str, m: str, s: str = None) -> str:
    out = num_to_thaiword(int(h)) + "นาฬิกา"
    if int(m):
        out += num_to_thaiword(int(m)) + "นาที"
    if s and int(s):
        out += num_to_thaiword(int(s)) + "วินาที"
    return out


def normalize_th(text: str) -> str:
    """แปลงตัวเลขทุกแบบในข้อความไทยเป็นคำอ่าน (ลำดับ pattern สำคัญ — อย่าสลับ)"""
    # 1) เวลา 18:30 น. / 18.30 น. (จุดต้องมี น. กำกับ กันชนทศนิยม)
    text = re.sub(
        r"(\d{1,2})[.:](\d{2})\s*(?:น\.|นาฬิกา)",
        lambda m: _read_time(m.group(1), m.group(2)), text)
    # 2) เวลาแบบโคลอน 18:30 หรือ 18:30:45 (ไม่มี น. ก็อ่านเป็นเวลา)
    text = re.sub(
        r"(\d{1,2}):(\d{2})(?::(\d{2}))?",
        lambda m: _read_time(m.group(1), m.group(2), m.group(3)), text)
    # 3) เงินบาทมีสตางค์ 1,234.50 บาท
    text = re.sub(
        r"([\d,]+)\.(\d{1,2})\s*บาท",
        lambda m: _read_int(m.group(1)) + "บาท" + _read_int(m.group(2)) + "สตางค์", text)
    # 4) เปอร์เซ็นต์
    text = re.sub(
        r"([\d,]+(?:\.\d+)?)\s*(?:%|เปอร์เซ็นต์)",
        lambda m: normalize_th(m.group(1)) + "เปอร์เซ็นต์", text)
    # 5) เบอร์โทร (0 นำหน้า 9-10 หลัก) อ่านทีละตัว
    text = re.sub(r"\b0\d{8,9}\b", lambda m: _read_digits(m.group(0)), text)
    # 6) ทศนิยมทั่วไป 3.14 -> สามจุดหนึ่งสี่
    text = re.sub(
        r"(\d[\d,]*)\.(\d+)",
        lambda m: _read_int(m.group(1)) + "จุด" + _read_digits(m.group(2)), text)
    # 7) จำนวนเต็มที่เหลือทั้งหมด (รวมแบบมีจุลภาค)
    text = re.sub(r"\d[\d,]*", lambda m: _read_int(m.group(0)), text)
    return text


if __name__ == "__main__":
    tests = [
        "เมื่อเวลา 18:30 น. ของวันที่ 2 สิงหาคม 2569 ยอดวิวพุ่งไปถึง 2,500,000 วิว สร้างรายได้กว่า 64,000 บาท",
        "ราคา 1,234.50 บาท ลดอีก 15% เหลือขายแค่ 3 วันเท่านั้น",
        "โทร 0812345678 ได้ตั้งแต่ 9:05 ถึง 21:00 น.",
        "ค่าพายคือ 3.14 โดยประมาณ และปีนี้คือปี 2026",
    ]
    for t in tests:
        print("ก่อน:", t)
        print("หลัง:", normalize_th(t))
        print()
