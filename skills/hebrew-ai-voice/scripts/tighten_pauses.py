"""Shorten the pauses of a voice-over to a target total, without touching the speech.

A pause is a run of 10 ms frames more than 32 dB below the loudest frame, at least 150 ms long,
between the first and the last word. Every pause is scaled by one factor k (never below 120 ms)
and cut from its middle with a 10 ms crossfade, so breaths and the edges of words stay.
k is found so the pauses add up to the target.

The target is either seconds, or `auto`: pauses = 15% of the rest of the take, which is Vesper's
ratio in the IMSC ad (4.61 s of pauses in 35.24 s), so it fits a text of any length.
Run with a target of 99 to only measure (the output is then an unchanged copy).

usage: python3 tighten_pauses.py in.wav out.wav auto|target_pause_seconds
  ffmpeg -i take.mp3 take.wav
  python3 tighten_pauses.py take.wav tight.wav auto
  ffmpeg -i tight.wav -c:a libmp3lame -b:a 128k final.mp3"""
import sys, wave
import numpy as np

src, dst, target = sys.argv[1], sys.argv[2], sys.argv[3]
VESPER_RATIO = 4.61 / (35.24 - 4.61)
w = wave.open(src)
sr, ch = w.getframerate(), w.getnchannels()
x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(float)
if ch > 1:
    x = x.reshape(-1, ch).mean(axis=1)
hop = sr // 100
n = len(x) // hop
db = 20 * np.log10(np.array([np.sqrt(np.mean(x[i * hop:(i + 1) * hop] ** 2)) for i in range(n)]) + 1e-9)
quiet = db < db.max() - 32
speech = np.where(~quiet)[0]
runs, cur = [], None
for i in range(speech[0], speech[-1] + 1):
    if quiet[i] and cur is None:
        cur = i
    if not quiet[i] and cur is not None:
        if i - cur >= 15:
            runs.append((cur, i))
        cur = None
lens = np.array([(b - a) * 0.01 for a, b in runs])
target = VESPER_RATIO * (len(x) / sr - lens.sum()) if target == 'auto' else float(target)
MIN = 0.12
lo, hi = 0.0, 1.0
for _ in range(50):
    k = (lo + hi) / 2
    if np.maximum(MIN, lens * k).sum() > target:
        hi = k
    else:
        lo = k
new = np.maximum(MIN, np.minimum(lens, lens * k))
fade = int(0.01 * sr)
ramp = np.linspace(1, 0, fade)
out, pos = [], 0
for (a, b), L, N in zip(runs, lens, new):
    cut = int(round((L - N) * sr))
    if cut < 2 * fade:
        continue
    c0 = (a + b) * hop // 2 - cut // 2
    c1 = c0 + cut
    out.append(x[pos:c0 - fade])
    out.append(x[c0 - fade:c0] * ramp + x[c1:c1 + fade] * ramp[::-1])
    pos = c1 + fade
out.append(x[pos:])
y = np.concatenate(out)
o = wave.open(dst, 'wb')
o.setnchannels(1); o.setsampwidth(2); o.setframerate(sr)
o.writeframes(np.clip(y, -32768, 32767).astype(np.int16).tobytes())
o.close()
print(f'{len(runs)} pauses {lens.sum():.2f}s -> {new.sum():.2f}s (k={k:.2f}), length {len(x) / sr:.2f}s -> {len(y) / sr:.2f}s')
