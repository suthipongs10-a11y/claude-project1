#!/usr/bin/env bash
# ติดตั้ง + เปิดเซิร์ฟเวอร์เสียงบน RunPod Pod — รันครั้งเดียวหลังเปิด pod
#
# ใช้ (ใน Web Terminal ของ pod):
#   cd /workspace \
#     && git clone -b claude/tts-ai-tools-resources-m5rku5 https://github.com/suthipongs10-a11y/claude-project1.git \
#     && export TTS_API_KEY=ตั้งรหัสลับเอง \
#     && bash claude-project1/tts-ai/runpod/setup_runpod.sh
#
# ครั้งถัดไป (pod เดิม/มี volume): ข้าม clone ได้ รันแค่ 2 บรรทัดสุดท้าย
set -e
cd "$(dirname "$0")"

echo "== [1/3] ติดตั้งไลบรารี (~2 นาที) =="
pip install -q omnivoice fastapi "uvicorn[standard]" soundfile pythainlp edge-tts
command -v ffmpeg >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq ffmpeg)

echo "== [2/3] ตรวจ GPU =="
python -c "import torch; print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'ไม่พบ!!')"

if [ -z "$TTS_API_KEY" ]; then
  echo "คำเตือน: ยังไม่ได้ตั้ง TTS_API_KEY — เซิร์ฟเวอร์จะเปิดแบบไม่มีรหัสผ่าน (ไม่แนะนำ)"
  echo "ตั้งก่อนรัน:  export TTS_API_KEY=รหัสลับของคุณ"
fi

echo "== [3/3] เปิดเซิร์ฟเวอร์ที่พอร์ต 8000 (ครั้งแรกโหลดโมเดล 2-5 นาที รอจนขึ้น '✅ พร้อมรับงาน') =="
echo "URL ภายนอก: https://<POD_ID>-8000.proxy.runpod.net (ดู POD_ID ในหน้า pod)"
exec python -m uvicorn server:app --host 0.0.0.0 --port 8000
