#!/usr/bin/env bash
# MOTION STUDIO — one-time environment setup (Linux/macOS with node + python3 + ffmpeg).
# Usage: bash kit/setup.sh   (run from the episode folder that contains kit/)
set -e
command -v ffmpeg >/dev/null || { echo "ffmpeg missing: install it (apt-get install -y ffmpeg / brew install ffmpeg)"; exit 1; }
[ -f package.json ] || npm init -y >/dev/null
# fonts (local, no CDN at render time)
[ -d node_modules/@fontsource/fredoka ] || npm i @fontsource/fredoka @fontsource/pacifico >/dev/null 2>&1
# playwright (use a global copy if present)
if ! node -e "require.resolve('playwright')" 2>/dev/null; then
  if [ -d /opt/npm-tools/node_modules/playwright ]; then mkdir -p node_modules && ln -sf /opt/npm-tools/node_modules/playwright node_modules/playwright && ln -sf /opt/npm-tools/node_modules/playwright-core node_modules/playwright-core;
  else npm i playwright >/dev/null 2>&1 && npx playwright install chromium; fi
fi
# neural voices (Piper) — free, offline. Voices come from GitHub releases.
python3 -c "import piper" 2>/dev/null || pip install -q piper-tts 2>/dev/null || pip install -q --break-system-packages piper-tts
VDIR=${PIPER_VOICES:-$HOME/.piper-voices}; mkdir -p "$VDIR"
if [ ! -f "$VDIR/en-us-libritts-high.onnx" ]; then
  curl -sSL -o /tmp/libritts.tgz https://github.com/rhasspy/piper/releases/download/v0.0.2/voice-en-us-libritts-high.tar.gz && tar xzf /tmp/libritts.tgz -C "$VDIR"
fi
ls "$VDIR"/*.onnx >/dev/null && echo "voices OK in $VDIR"
python3 -c "import numpy" 2>/dev/null || pip install -q numpy 2>/dev/null || pip install -q --break-system-packages numpy
echo "MOTION STUDIO setup complete"
