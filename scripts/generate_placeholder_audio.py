#!/usr/bin/env python3
"""
Generates SYNTHETIC PLACEHOLDER audio so the game runs end to end with no downloads.
Output: public/assets/audio/*.mp3  (same filenames the game expects).

!! These are placeholders. Replace them with real recordings before the ceremony,
   especially announcer-goal.mp3 (this one is a robotic vowel synth, NOT a real announcer).
Requires: python3, numpy, scipy, ffmpeg (with libmp3lame).
"""
import os, subprocess, tempfile
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 44100
rng = np.random.default_rng(7)
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'assets', 'audio')
os.makedirs(OUT, exist_ok=True)

def tvec(n): return np.arange(n) / SR
def norm(x, peak=0.8): return x / (np.max(np.abs(x)) + 1e-9) * peak
def noise(n): return rng.standard_normal(n)
def bp(x, lo, hi, order=2):
    return signal.sosfilt(signal.butter(order, [lo, hi], btype='band', fs=SR, output='sos'), x)
def lp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='low', fs=SR, output='sos'), x)
def hp(x, f, order=2):
    return signal.sosfilt(signal.butter(order, f, btype='high', fs=SR, output='sos'), x)
def smooth_noise(n, fc):
    x = lp(noise(n), fc, 2); return x / (np.std(x) + 1e-9)

def save(name, x):
    x = np.clip(x, -1, 1)
    with tempfile.TemporaryDirectory() as d:
        wav = os.path.join(d, 'x.wav')
        wavfile.write(wav, SR, (x * 32767).astype(np.int16))
        dst = os.path.join(OUT, name)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', wav, '-codec:a', 'libmp3lame', '-b:a', '160k', '-ac', '1', dst], check=True)
    print('wrote', name, f'{len(x)/SR:.1f}s')

# ---------------- kick ----------------
def make_kick():
    n = int(0.45 * SR); t = tvec(n)
    f = 55 + 150 * np.exp(-t / 0.03)
    thump = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.07)
    slap = bp(noise(n), 700, 3800) * np.exp(-t / 0.012)
    click = hp(noise(n), 3000) * np.exp(-t / 0.004) * 0.4
    return norm(thump * 0.95 + slap * 0.55 + click, 0.85)

# ---------------- net ----------------
def make_net():
    n = int(1.1 * SR); t = tvec(n)
    swish = bp(noise(n), 500, 5500) * np.minimum(t / 0.006, 1) * np.exp(-t / 0.2)
    thud = np.sin(2 * np.pi * 85 * t) * np.exp(-t / 0.09) * 0.5
    rattle = bp(noise(n), 2200, 7500) * np.exp(-t / 0.45) * (1 + np.sin(2 * np.pi * 31 * t)) * 0.25
    return norm(swish * 0.8 + thud + rattle, 0.8)

# ---------------- stadium ambience (seamless loop) ----------------
def make_ambience(seconds=24, xf=1.5):
    n = int((seconds + xf) * SR); t = tvec(n)
    base = bp(noise(n), 180, 2600) * (0.6 + 0.25 * smooth_noise(n, 0.4))
    low = lp(noise(n), 160) * 0.5
    voices = np.zeros(n)
    for _ in range(14):
        f0 = rng.uniform(110, 280)
        vib = 1 + 0.01 * np.sin(2 * np.pi * rng.uniform(3, 6) * t + rng.uniform(0, 6))
        saw = signal.sawtooth(2 * np.pi * np.cumsum(f0 * vib) / SR)
        amp = np.clip(0.5 + 0.5 * smooth_noise(n, rng.uniform(0.15, 0.5)), 0, 1) ** 2
        voices += bp(saw, 450, 1600) * amp
    x = base + low + voices * 0.08
    N = int(seconds * SR); X = int(xf * SR)
    out = x[:N].copy()
    fade = np.linspace(0, 1, X)
    out[:X] = out[:X] * fade + x[N:N + X] * (1 - fade)
    return norm(out, 0.55)

# ---------------- crowd cheer ----------------
def make_cheer(seconds=8):
    n = int(seconds * SR); t = tvec(n)
    env = np.minimum(t / 0.7, 1) ** 1.5 * np.where(t < 4.2, 1.0, np.exp(-(t - 4.2) / 1.5))
    roar = bp(noise(n), 350, 4800) * env
    voices = np.zeros(n)
    for _ in range(70):
        f0 = rng.uniform(170, 460)
        vib = 1 + 0.015 * np.sin(2 * np.pi * rng.uniform(4, 7) * t + rng.uniform(0, 6))
        saw = signal.sawtooth(2 * np.pi * np.cumsum(f0 * vib) / SR)
        voices += bp(saw, 650, 1500) * env * rng.uniform(0.3, 1)
    claps = np.zeros(n)
    for _ in range(int(seconds * 90)):
        i = rng.integers(int(0.5 * SR), n - 2000)
        claps[i:i + 400] += hp(noise(400), 1200) * np.exp(-np.arange(400) / 60) * rng.uniform(0.2, 0.8) * (env[i] ** 0.5)
    return norm(roar * 0.9 + voices * 0.05 + claps * 0.35, 0.85)

# ---------------- celebration fanfare (original, simple) ----------------
def tone(freq, dur, vel=0.5, brass=True):
    n = int(dur * SR); t = tvec(n)
    x = signal.sawtooth(2 * np.pi * freq * t) * 0.6 + signal.square(2 * np.pi * freq * 2.003 * t) * 0.15
    env = np.minimum(t / 0.03, 1) * np.where(t > dur - 0.08, np.maximum(0, (dur - t) / 0.08), 1)
    return lp(x, 3200 if brass else 1800) * env * vel

def make_celebration():
    beat = 0.5; total = 13.0; n = int(total * SR); out = np.zeros(n)
    def put(sig, at):
        i = int(at * SR); j = min(n, i + len(sig))
        if i < n: out[i:j] += sig[:j - i]
    mel = [(392, .5), (523, .5), (659, .5), (784, 1.5), (659, .5), (784, .5), (880, .5), (1047, 1.5),
           (880, .5), (784, .5), (659, .5), (784, .5), (1047, 2.0)]
    for rep in range(2):
        tpos = rep * 10 * beat * 2 / 2 * 2  # 10 beats = 5s per rep
        tpos = rep * 5.0
        for f, d in mel:
            put(tone(f * (1.0 if rep == 0 else 1.125), d * beat * 0.95, 0.5), tpos); tpos += d * beat
    # pads
    chords = [(262, 330, 392), (349, 440, 523), (392, 494, 587), (262, 330, 392)]
    for k in range(8):
        for f in chords[k % 4]:
            put(tone(f, 2.4, 0.16, brass=False), k * 1.25)
    # drums
    for b in range(int(total / beat)):
        at = b * beat
        if b % 2 == 0:
            m = int(0.3 * SR); tt = tvec(m)
            put(np.sin(2 * np.pi * np.cumsum(50 + 110 * np.exp(-tt / 0.03)) / SR) * np.exp(-tt / 0.1) * 0.8, at)
        if b % 4 == 2:
            m = int(0.2 * SR); put(bp(noise(m), 1200, 6000) * np.exp(-tvec(m) / 0.05) * 0.6, at)
        m = int(0.06 * SR); put(hp(noise(m), 6000) * np.exp(-tvec(m) / 0.012) * 0.25, at + beat / 2)
    tail = np.minimum(1, (total - tvec(n)) / 1.2)
    return norm(out * tail, 0.8)

# ---------------- announcer placeholder: formant "GOAAAL" ----------------
def formant(x, formants):
    y = x
    for f, bw in formants:
        r = np.exp(-np.pi * bw / SR); th = 2 * np.pi * f / SR
        y = signal.lfilter([1 - r], [1, -2 * r * np.cos(th), r * r], y)
    return y

def make_announcer(seconds=2.8):
    n = int(seconds * SR); t = tvec(n)
    f0 = np.interp(t, [0, 0.15, 0.9, 2.0, seconds], [120, 150, 215, 200, 150])
    f0 = f0 * (1 + 0.012 * np.sin(2 * np.pi * 5.5 * t))
    src = signal.sawtooth(2 * np.pi * np.cumsum(f0) / SR)
    src = src + 0.15 * noise(n) * 0.2
    vo = formant(src, [(570, 90), (840, 100), (2410, 200)])
    vl = formant(src, [(400, 90), (1100, 120), (2500, 200)])
    mix = np.clip((t - (seconds - 0.7)) / 0.5, 0, 1)
    voice = vo * (1 - mix) + vl * mix
    g = np.minimum(t / 0.05, 1) * np.where(t > seconds - 0.3, np.maximum(0, (seconds - t) / 0.3), 1)
    amp = g * (0.55 + 0.45 * np.minimum(t / 0.5, 1))
    burst = lp(noise(int(0.07 * SR)), 900) * np.exp(-tvec(int(0.07 * SR)) / 0.02)
    voice = voice * amp
    voice[:len(burst)] += burst * 3
    voice = np.tanh(norm(voice, 1.0) * 2.2)
    return norm(voice, 0.9)

if __name__ == '__main__':
    save('kick.mp3', make_kick())
    save('net.mp3', make_net())
    save('stadium-ambience.mp3', make_ambience())
    save('crowd-cheer.mp3', make_cheer())
    save('celebration.mp3', make_celebration())
    save('announcer-goal.mp3', make_announcer())
    print('Done. These are SYNTHETIC PLACEHOLDERS - replace with real recordings.')
