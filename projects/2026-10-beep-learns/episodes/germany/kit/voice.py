#!/usr/bin/env python3
"""MOTION STUDIO — voice lines with Piper (neural, free) + cartoon pitch + lip-sync data.
lines.txt format (one per line):   id|who|spoken text|caption text (optional)
  - use " / " inside spoken text for a deliberate comic pause (0.32 s)
  - spoken text may use phonetic spelling for foreign words; caption shows the real word
cast.json: {"B": {"speaker": 552, "length": 0.92, "pitch": 1.22, "robot": 0.25}, ...}
Output: vo/<id>.wav (48 kHz mono), lipsync.js (window.LIPS / module.exports)
"""
import json, os, subprocess, sys, wave
import numpy as np
VDIR = os.environ.get('PIPER_VOICES', os.path.expanduser('~/.piper-voices'))
MODEL = os.path.join(VDIR, 'en-us-libritts-high.onnx')
cast = json.load(open('cast.json'))
os.makedirs('vo', exist_ok=True)
out = {}

def run(cmd, inp=None):
    r = subprocess.run(cmd, input=inp, capture_output=True)
    if r.returncode: sys.stderr.write(r.stderr.decode()[-500:]); raise SystemExit(1)

def robotize(path, amt):
    w = wave.open(path); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768; w.close()
    t = np.arange(len(x)) / sr
    y = x * (1 - amt) + x * np.sin(2 * np.pi * 90 * t) * amt * 1.6
    d = int(sr * .003); z = y.copy()
    for i in range(d, len(z)): z[i] += z[i - d] * .35
    z = np.tanh(z * 1.3); z /= (np.abs(z).max() + 1e-9) / .9
    w = wave.open(path, 'wb'); w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((z * 32767).astype(np.int16).tobytes()); w.close()

for line in open('lines.txt', encoding='utf-8'):
    line = line.strip()
    if not line or line.startswith('#'): continue
    parts = line.split('|'); id, who, spoken = parts[0], parts[1], parts[2]
    caption = parts[3] if len(parts) > 3 else spoken.replace(' / ', ' ')
    c = cast[who]
    segs = [p.strip() for p in spoken.split('/') if p.strip()]
    files = []
    for i, p in enumerate(segs):
        raw, trim = f'vo/_r_{id}_{i}.wav', f'vo/_t_{id}_{i}.wav'
        run(['piper', '-m', MODEL, '--speaker', str(c['speaker']), '--length_scale', str(c.get('length', 1)), '--noise_scale', '.75', '--noise_w', '.9', '-f', raw], p.encode())
        run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-i', raw, '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,apad=pad_dur=0.32', '-ar', '22050', trim])
        files.append(trim)
    lst = f'vo/_l_{id}.txt'; open(lst, 'w').write(''.join(f"file '{os.path.basename(f)}'\n" for f in files))
    pitch = c.get('pitch', 1.0)
    af = (f'rubberband=pitch={pitch}:formant=shifted,' if abs(pitch - 1) > .01 else '') + 'areverse,silenceremove=start_periods=1:start_threshold=-50dB,areverse,aresample=48000,loudnorm=I=-16:TP=-1.5'
    try: run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-af', af, '-ar', '48000', '-ac', '1', f'vo/{id}.wav'])
    except SystemExit:  # rubberband not available -> asetrate fallback
        af2 = f'asetrate={int(22050 * pitch)},aresample=48000,loudnorm=I=-16:TP=-1.5'
        run(['ffmpeg', '-nostdin', '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst, '-af', af2, '-ar', '48000', '-ac', '1', f'vo/{id}.wav'])
    if c.get('robot'): robotize(f'vo/{id}.wav', c['robot'])
    for f in os.listdir('vo'):
        if f.startswith(('_r_', '_t_', '_l_')) and id in f: os.remove(os.path.join('vo', f))
    w = wave.open(f'vo/{id}.wav'); sr = w.getframerate(); x = np.frombuffer(w.readframes(w.getnframes()), np.int16).astype(float) / 32768
    hop = sr // 30; env = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2)) for i in range(0, len(x), hop)])
    env = np.clip(env / (np.percentile(env, 95) + 1e-9), 0, 1); sm = np.convolve(env, [.25, .5, .25], 'same')
    on, silent = [], 99
    for i, v in enumerate(sm):
        if v > .08:
            if silent >= 7: on.append(round(i / 30, 3))
            silent = 0
        else: silent += 1
    out[id] = {'who': who, 'text': caption, 'dur': round(len(x) / sr, 3), 'env': [round(float(v), 2) for v in sm], 'segs': on}
    print(f'{id:14s} {who:3s} {out[id]["dur"]:5.2f}s  segs={on}')
open('lipsync.js', 'w').write('(function(r){const L=' + json.dumps(out) + ';if(typeof module!=="undefined")module.exports=L;else r.LIPS=L;})(typeof window!=="undefined"?window:globalThis);')
