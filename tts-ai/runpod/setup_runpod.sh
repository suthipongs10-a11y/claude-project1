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

# เก็บโมเดล HF ไว้บน /workspace (volume ใหญ่) — container disk เล็ก เต็มง่าย
export HF_HOME=/workspace/hf_cache
mkdir -p "$HF_HOME"

echo "== [1/3] ติดตั้งไลบรารี (~2 นาที) =="
pip install -q --no-cache-dir omnivoice fastapi "uvicorn[standard]" soundfile pythainlp edge-tts
command -v ffmpeg >/dev/null 2>&1 || (apt-get update -qq && apt-get install -y -qq ffmpeg)

# transformers รุ่นใหม่ (ที่ omnivoice ใช้) ต้องการ torch >= 2.5 (มี DTensor) และ
# torch/torchvision/torchaudio ต้องเป็นชุดเดียวกัน + ตรงกับไดรเวอร์ CUDA ของโฮสต์ (cu124)
# ห้ามใช้ torch รุ่นล่าสุดลอย ๆ — ไดรเวอร์บน RunPod มักรองรับถึง CUDA 12.4 เท่านั้น
python -c "from torch.distributed.tensor import DTensor; import torchvision" 2>/dev/null || {
  echo "== [1.5/3] ติดตั้งชุด torch 2.6.0 + torchvision 0.21.0 + torchaudio 2.6.0 (cu124) (~3-4 นาที) =="
  pip install -q --no-cache-dir -U torch==2.6.0 torchvision==0.21.0 torchaudio==2.6.0 \
    --index-url https://download.pytorch.org/whl/cu124
}
pip cache purge >/dev/null 2>&1 || true  # คืนพื้นที่ container disk

echo "== [1.9/3] ตรวจ import omnivoice =="
python -c "import omnivoice; print('omnivoice พร้อม')" || {
  echo "❌ import omnivoice ไม่ผ่าน — ก๊อป log ทั้งหมดส่งให้ Claude"; exit 1;
}

echo "== [2/3] ตรวจ GPU =="
python -c "import torch; print('GPU:', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'ไม่พบ!!')"

if [ -z "$TTS_API_KEY" ]; then
  echo "คำเตือน: ยังไม่ได้ตั้ง TTS_API_KEY — เซิร์ฟเวอร์จะเปิดแบบไม่มีรหัสผ่าน (ไม่แนะนำ)"
  echo "ตั้งก่อนรัน:  export TTS_API_KEY=รหัสลับของคุณ"
fi

echo "== [3/3] เปิดเซิร์ฟเวอร์ที่พอร์ต 8000 (ครั้งแรกโหลดโมเดล 2-5 นาที รอจนขึ้น '✅ พร้อมรับงาน') =="
echo "URL ภายนอก: https://<POD_ID>-8000.proxy.runpod.net (ดู POD_ID ในหน้า pod)"
pkill -f "uvicorn server:app" 2>/dev/null || true  # เคลียร์ตัวเก่าที่อาจค้างพอร์ตอยู่
exec python -m uvicorn server:app --host 0.0.0.0 --port 8000
