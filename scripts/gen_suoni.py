#!/usr/bin/env python3
"""Genera i suoni di gioco come file MP3 (44.1 kHz, mono).

Perché file e non Web Audio API: nel build di produzione (WebKitGTK) l'uscita
della Web Audio API risulta muta, mentre la riproduzione di file media funziona
(lo dimostrano soundboard e sottofondo). Perché MP3 (non WAV): è il formato che
il soundboard usa e che si è dimostrato funzionante su questo sistema.

I beep sono sintetizzati come PCM, scritti in WAV temporaneo e poi convertiti
in MP3 con ffmpeg. Rilancia questo script per rigenerarli.

Output: src/assets/suoni/*.mp3
"""
import math
import os
import struct
import subprocess
import wave

SR = 44100
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "src", "assets", "suoni")


def scrivi(nome, campioni):
    """nome senza estensione → scrive <nome>.mp3 (via WAV temporaneo + ffmpeg)."""
    os.makedirs(OUT_DIR, exist_ok=True)
    wav_path = os.path.join(OUT_DIR, nome + ".wav")
    mp3_path = os.path.join(OUT_DIR, nome + ".mp3")
    frames = bytearray()
    for s in campioni:
        v = max(-1.0, min(1.0, s))
        frames += struct.pack("<h", int(v * 32767))
    with wave.open(wav_path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(bytes(frames))
    subprocess.run(
        ["ffmpeg", "-y", "-loglevel", "error", "-i", wav_path, "-b:a", "128k", mp3_path],
        check=True,
    )
    os.remove(wav_path)
    print("scritto", os.path.relpath(mp3_path), f"({len(campioni)} campioni)")


def silenzio(durata):
    return [0.0] * int(durata * SR)


def sine(freq, durata, peak, tau, fase=0.0):
    """Sinusoide con attacco breve (5ms) e decadimento esponenziale (tau)."""
    n = int(durata * SR)
    out = []
    attacco = int(0.005 * SR)
    for i in range(n):
        t = i / SR
        env = math.exp(-t / tau)
        if i < attacco:
            env *= i / attacco
        out.append(peak * env * math.sin(2 * math.pi * freq * t + fase))
    return out


def square(freq, durata, peak, tau):
    n = int(durata * SR)
    out = []
    attacco = int(0.004 * SR)
    for i in range(n):
        t = i / SR
        env = math.exp(-t / tau)
        if i < attacco:
            env *= i / attacco
        s = 1.0 if math.sin(2 * math.pi * freq * t) >= 0 else -1.0
        out.append(peak * env * s)
    return out


def mix(*tracce):
    n = max(len(t) for t in tracce)
    out = [0.0] * n
    for t in tracce:
        for i, s in enumerate(t):
            out[i] += s
    return out


def concat(*tracce):
    out = []
    for t in tracce:
        out.extend(t)
    return out


# 1) VIA AL TIMER: due note sine ascendenti (660 → 990).
nota1 = sine(660, 0.34, 0.32, 0.10)
nota2 = concat(silenzio(0.13), sine(990, 0.30, 0.32, 0.10))
scrivi("timer-inizio", mix(nota1, nota2))

# 2) UN MINUTO: campana (fondamentale 880 + armonica metallica ~2.756).
campana = mix(
    sine(880, 1.8, 0.30, 0.55),
    sine(880 * 2.756, 1.0, 0.13, 0.30),
)
scrivi("timer-1min", campana)

# 3) SCADUTO: 4 beep square rapidi "ti ti ti ti".
beep = square(1100, 0.10, 0.32, 0.05)
gap = silenzio(0.04)  # 0.10 + 0.04 = 0.14s di passo, come SVEGLIA_GAP
scrivi("timer-scaduto", concat(beep, gap, beep, gap, beep, gap, beep))

