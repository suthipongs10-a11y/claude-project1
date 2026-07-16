#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
gen_gemini_tts.py — สร้างเสียงพากย์ไทยด้วย Gemini TTS (Google AI Studio)

ใช้สำหรับ:
  1) A/B test เสียง (gen ประโยคเดียวหลายเสียง แล้วฟังเลือก)
  2) gen VO จริงต่อคลิป (ใส่ไฟล์บทเต็ม)

ต้องตั้ง env: GEMINI_API_KEY  (จาก https://aistudio.google.com/apikey)
ติดตั้ง:      pip install google-genai

ตัวอย่าง:
  # A/B test — gen ทุกเสียงใน SHORTLIST จากไฟล์ sample
  python gen_gemini_tts.py --text tts/sample-th.txt --out tts/samples --ab

  # gen เสียงเดียว (โปรดักชัน)
  python gen_gemini_tts.py --text clips/narration.txt --out clips \
      --voice Charon --name voiceover

หมายเหตุ: Gemini TTS คืน PCM 24kHz 16-bit mono — สคริปต์ห่อเป็น .wav ให้อัตโนมัติ
ขั้นถัดไปคือ tts/align_th.py เพื่อทำ word-timings.json (Gemini ไม่มี timestamp)
"""
import argparse, os, sys, wave, pathlib

# เสียงที่คัดมาให้ลองสำหรับผู้บรรยายสารคดี/explainer (โทนน่าฟัง มีพลัง)
# รายชื่อเต็ม 30 เสียงดูที่ https://ai.google.dev/gemini-api/docs/speech-generation
SHORTLIST = ["Charon", "Kore", "Puck", "Enceladus", "Umbriel", "Algieba"]

# คำสั่งคุมโทน (เติมหน้าบท) — ปรับได้ตามอารมณ์ช่อง "ถอดรหัสจักรวาล"
STYLE_PROMPT = (
    "อ่านด้วยน้ำเสียงผู้บรรยายสารคดีวิทยาศาสตร์ภาษาไทย "
    "ตื่นเต้น อยากรู้อยากเห็น ชวนติดตาม จังหวะกระชับ ไม่เนือย: "
)

RATE = 24000  # Gemini TTS output sample rate


def pcm_to_wav(pcm: bytes, path: str, rate: int = RATE):
    with wave.open(path, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)   # 16-bit
        wf.setframerate(rate)
        wf.writeframes(pcm)


def synth(client, model: str, voice: str, text: str) -> bytes:
    from google.genai import types
    resp = client.models.generate_content(
        model=model,
        contents=STYLE_PROMPT + text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(voice_name=voice)
                )
            ),
        ),
    )
    return resp.candidates[0].content.parts[0].inline_data.data


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--text", required=True, help="ไฟล์ .txt บทพากย์ (UTF-8)")
    ap.add_argument("--out", default="tts/samples", help="โฟลเดอร์เอาต์พุต")
    ap.add_argument("--voice", default="Iapetus", help="ชื่อเสียง (โหมดเสียงเดียว) — ช่องใช้ Iapetus")
    ap.add_argument("--name", default="voiceover", help="ชื่อไฟล์ (โหมดเสียงเดียว)")
    ap.add_argument("--model", default="gemini-2.5-flash-preview-tts")
    ap.add_argument("--ab", action="store_true",
                    help="gen ทุกเสียงใน SHORTLIST เพื่อ A/B test")
    args = ap.parse_args()

    key = os.environ.get("GEMINI_API_KEY")
    if not key:
        sys.exit("ERROR: ตั้ง env GEMINI_API_KEY ก่อน (https://aistudio.google.com/apikey)")

    try:
        from google import genai
    except ImportError:
        sys.exit("ERROR: pip install google-genai")

    text = pathlib.Path(args.text).read_text(encoding="utf-8").strip()
    if not text:
        sys.exit("ERROR: ไฟล์บทว่าง")

    os.makedirs(args.out, exist_ok=True)
    client = genai.Client(api_key=key)

    voices = SHORTLIST if args.ab else [args.voice]
    for v in voices:
        out = os.path.join(args.out, (f"sample-{v}" if args.ab else args.name) + ".wav")
        print(f"[gen] {v} -> {out}")
        try:
            pcm = synth(client, args.model, v, text)
            pcm_to_wav(pcm, out)
        except Exception as e:
            print(f"  !! เสียง {v} ล้มเหลว: {e}")
    print("เสร็จ — ฟังไฟล์ใน", args.out, "แล้วเลือกเสียงที่ชอบ")


if __name__ == "__main__":
    main()
