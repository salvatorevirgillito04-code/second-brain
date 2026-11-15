"""Colonna sonora originale del reel Atenir (v2), sintetizzata da zero: nessun campione, nessun diritto di terzi.

Indie-pop allegro a 96 BPM in Fa maggiore, con swing leggero. Strumenti a sintesi additiva/FM con intonazione esatta
(la v1 usava Karplus-Strong a ritardo intero: note calanti di 10–15 centesimi).
- marimba: melodia principale (gancio di 2 battute, ripetuto con variazione);
- piano elettrico FM: accordi in levare, con «sidechain» dalla cassa;
- chitarra pizzicata additiva: arpeggio in sottofondo;
- basso sincopato; batteria (cassa, rullante con battimani, charleston con swing);
- crescendo prima dell'ingresso delle categorie (3,0 s), stacco con rullata prima del finale (15,5 s);
- campanelle sul logo, fruscio morbido sulle transizioni; riverbero a convoluzione.
Battute a 0,5 s + k·2,5 s: i tagli del video cadono sul primo tempo.

Uso: python3 audio/musica.py [uscita.wav]   (solo numpy; deterministico)
"""
import sys
import wave
import numpy as np

SR = 44100
DURATA = 19.0
BPM = 96
B = 60 / BPM                 # un battito: 0,625 s
INIZIO = 0.5                 # primo battere
BATTUTA = 4 * B              # 2,5 s
SWING = 0.028                # ritardo delle crome in levare (s)
GUADAGNO_DB = -2.4           # aggiustamento finale del livello
N = int(SR * DURATA)
rng = np.random.default_rng(42)

# Bus: ogni strumento va su un bus (stereo) per mix, sidechain e mandata al riverbero.
BUS = {k: np.zeros((N, 2)) for k in ('mel', 'ep', 'chit', 'basso', 'batt', 'fx')}


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def tt(n):
    return np.arange(n) / SR


def metti(bus, seg, t, gain=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= N or i < 0:
        return
    seg = seg[: N - i] * gain
    BUS[bus][i:i + len(seg), 0] += seg * np.sqrt((1 - pan) / 2)
    BUS[bus][i:i + len(seg), 1] += seg * np.sqrt((1 + pan) / 2)


def filtra(x, basso=None, alto=None, ordine=2):
    """Filtro passa-banda nel dominio della frequenza (fase zero), risposta tipo Butterworth."""
    n = len(x)
    X = np.fft.rfft(x, axis=0)
    f = np.fft.rfftfreq(n, 1 / SR)
    g = np.ones_like(f)
    if alto:   # passa-basso: taglia sopra «alto»
        g *= 1 / np.sqrt(1 + (f / alto) ** (2 * ordine))
    if basso:  # passa-alto: taglia sotto «basso»
        with np.errstate(divide='ignore'):
            g *= 1 / np.sqrt(1 + (basso / np.maximum(f, 1e-6)) ** (2 * ordine))
    return np.fft.irfft(X * (g[:, None] if x.ndim == 2 else g), n=n, axis=0)


def adsr(n, a, d, s, r, durata_nota):
    t = tt(n)
    env = np.where(t < a, t / max(a, 1e-4), s + (1 - s) * np.exp(-(t - a) / max(d, 1e-4)))
    rel = np.clip((t - durata_nota) / r, 0, 1)
    return env * (1 - rel)


# ---------------- Strumenti ----------------
def marimba(f, dur=0.9):
    n = int(dur * SR); t = tt(n)
    s = (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.45)
         + 0.35 * np.sin(2 * np.pi * f * 3.93 * t) * np.exp(-t / 0.07)
         + 0.12 * np.sin(2 * np.pi * f * 9.2 * t) * np.exp(-t / 0.025))
    attacco = np.minimum(1, t / 0.002)
    return s * attacco


def piano_el(f, dur):
    """Piano elettrico FM (portante 1:1, indice che cala) con leggero tremolo."""
    n = int((dur + 0.5) * SR); t = tt(n)
    indice = 1.8 * np.exp(-t / 0.25) + 0.25
    mod = indice * np.sin(2 * np.pi * f * t)
    s = np.sin(2 * np.pi * f * t + mod) + 0.25 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t / 0.3)
    s *= 1 + 0.08 * np.sin(2 * np.pi * 4.5 * t)
    return s * adsr(n, 0.004, 0.6, 0.35, 0.25, dur)


def pizzico(f, dur=1.2, posizione=0.18):
    """Corda pizzicata additiva: armoniche smorzate (alte più in fretta), intonazione esatta."""
    n = int(dur * SR); t = tt(n)
    s = np.zeros(n)
    for k in range(1, 14):
        if f * k > 15000:
            break
        a = abs(np.sin(np.pi * k * posizione)) / k ** 1.1
        s += a * np.sin(2 * np.pi * f * k * t + k) * np.exp(-t * (1.6 + 0.9 * k))
    return s * np.minimum(1, t / 0.0015)


def basso(f, dur):
    n = int((dur + 0.08) * SR); t = tt(n)
    s = np.sin(2 * np.pi * f * t) + 0.45 * np.sin(4 * np.pi * f * t) * np.exp(-t / 0.12) + 0.2 * np.sin(6 * np.pi * f * t) * np.exp(-t / 0.06)
    return np.tanh(1.4 * s) * adsr(n, 0.005, 0.25, 0.6, 0.06, dur)


def cassa():
    n = int(0.4 * SR); t = tt(n)
    f = 50 + 110 * np.exp(-t / 0.035)
    corpo = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t / 0.16)
    click = filtra(rng.uniform(-1, 1, n), basso=2000) * np.exp(-t / 0.004) * 0.4
    return corpo + click


def rullante():
    n = int(0.35 * SR); t = tt(n)
    tono = (np.sin(2 * np.pi * 185 * t) + 0.6 * np.sin(2 * np.pi * 330 * t)) * np.exp(-t / 0.06)
    rum = filtra(rng.uniform(-1, 1, n), basso=1500, alto=9000) * np.exp(-t / 0.13)
    # battimani: tre colpi ravvicinati
    mani = np.zeros(n)
    for k, d in enumerate((0, 0.011, 0.022)):
        i = int(d * SR); m = n - i
        mani[i:] += filtra(rng.uniform(-1, 1, m), basso=900, alto=4000) * np.exp(-tt(m) / (0.008 if k < 2 else 0.09))
    return 0.5 * tono + 0.6 * rum + 0.5 * mani


def charleston(aperto=False):
    n = int((0.35 if aperto else 0.09) * SR); t = tt(n)
    x = filtra(rng.uniform(-1, 1, n), basso=7000)
    return x * np.exp(-t / (0.12 if aperto else 0.022))


def campana(f, dur=1.6):
    n = int(dur * SR); t = tt(n)
    return (np.sin(2 * np.pi * f * t) * np.exp(-t / 0.6) + 0.3 * np.sin(2 * np.pi * f * 2.76 * t) * np.exp(-t / 0.2)
            + 0.1 * np.sin(2 * np.pi * f * 5.4 * t) * np.exp(-t / 0.08)) * np.minimum(1, t / 0.002)


def salita(dur):
    """Crescendo di rumore filtrato che si apre (prima dell'ingresso dei prodotti)."""
    n = int(dur * SR); t = tt(n)
    x = rng.uniform(-1, 1, n)
    pezzi = 24
    out = np.zeros(n)
    lung = n // pezzi
    for k in range(pezzi):
        seg = x[k * lung:(k + 1) * lung]
        out[k * lung:(k + 1) * lung] = filtra(seg, basso=300 + 40 * k, alto=900 + 380 * k)
    return out * (t / dur) ** 2


def fruscio(dur=0.55):
    n = int(dur * SR); t = tt(n)
    x = filtra(rng.uniform(-1, 1, n), basso=500, alto=3500)
    return x * np.sin(np.pi * t / dur) ** 2


# ---------------- Partitura ----------------
# Fmaj7 – Am7 – Dm7 – B♭maj7 (voicing medio per il piano elettrico)
ACCORDI = [([65, 69, 72, 76], 41), ([64, 67, 69, 72], 45), ([62, 65, 69, 72], 38), ([62, 65, 69, 70], 34)]
# Gancio della marimba: (croma 0–7, nota MIDI, durata in crome) per le 4 battute del giro
GANCIO = [
    [(0, 81, 1), (1, 84, 1), (2, 81, 1), (3, 79, 1), (5, 77, 2)],              # A5 C6 A5 G5 – F5
    [(0, 76, 1), (1, 79, 1), (2, 76, 1), (3, 84, 2), (6, 81, 2)],              # E5 G5 E5 C6 – A5
    [(0, 77, 1), (1, 81, 1), (2, 84, 1), (3, 86, 2), (5, 84, 1), (6, 81, 2)],  # F5 A5 C6 D6 C6 A5
    [(0, 86, 2), (2, 84, 2), (4, 81, 2), (6, 79, 2)],                           # D6 C6 A5 G5
]
ARPEGGIO = [0, 2, 1, 3, 2, 1, 3, 2]
LINEA_BASSO = [(0, 0, 1.4), (1.5, 0, 0.4), (2, 7, 0.9), (3, 12, 0.4), (3.5, 7, 0.4)]   # (battito, intervallo, durata)


def croma(t0, j):
    return t0 + j * B / 2 + (SWING if j % 2 else 0)


# struttura: b = 0 introduzione, 1–4 categorie, 5 «Fatto a mano» (stacco), 6 invito finale, 7 chiusura
CASSE = []
for b in range(8):
    t0 = INIZIO + b * BATTUTA
    note, radice = ACCORDI[b % 4]
    piena = b in (1, 2, 3, 4, 6)

    # Piano elettrico: introduzione e stacco = accordi lunghi; parti piene = colpi in levare
    if b in (0, 5):
        for k, m in enumerate(note):
            metti('ep', piano_el(hz(m), BATTUTA * 0.95), t0 + k * 0.012, 0.16, -0.2 + 0.13 * k)
    elif b == 7:
        for k, m in enumerate(ACCORDI[0][0] + [77]):
            metti('ep', piano_el(hz(m), 1.0), t0 + k * 0.03, 0.17, -0.2 + 0.1 * k)
    else:
        for j in (1, 3, 4, 6):     # «e» di 1, «e» di 2, 3, «e» di 3 → groove sincopato
            for k, m in enumerate(note):
                metti('ep', piano_el(hz(m), B * 0.4), croma(t0, j), 0.11, -0.2 + 0.13 * k)

    # Chitarra pizzicata: arpeggio in ottava alta (sottofondo), assente nello stacco
    if b not in (5, 7):
        for j, idx in enumerate(ARPEGGIO):
            metti('chit', pizzico(hz(note[idx] + 12)), croma(t0, j), 0.15 if j % 2 == 0 else 0.10, 0.45)

    # Marimba: il gancio nelle parti piene; nello stacco solo le prime due note, piano
    if piena or b == 5:
        frase = GANCIO[b % 4] if b != 6 else GANCIO[0][:3] + [(3, 84, 1), (4, 86, 2), (6, 89, 2)]  # finale: sale a F6
        if b == 5:
            frase = [(0, 81, 2), (4, 84, 4)]
        for j, m, d in frase:
            metti('mel', marimba(hz(m), 0.5 + 0.2 * d), croma(t0, j), 0.34 if b != 5 else 0.22, -0.15)
    if b == 7:
        metti('mel', marimba(hz(89), 1.6), t0, 0.32, -0.1)

    # Basso
    if piena:
        for beat, iv, d in LINEA_BASSO:
            metti('basso', basso(hz(radice + iv), d * B), t0 + beat * B, 0.42)
    elif b == 7:
        metti('basso', basso(hz(41), 0.9), t0, 0.42)

    # Batteria
    if piena:
        for q in range(4):
            tq = t0 + q * B
            if q in (0, 2):
                metti('batt', cassa(), tq, 0.62); CASSE.append(tq)
            if q == 1 or q == 3:
                metti('batt', rullante(), tq, 0.36, 0.05)
            if q == 2:
                metti('batt', cassa(), tq + B / 2 + SWING, 0.45); CASSE.append(tq + B / 2 + SWING)
        for j in range(8):
            aperto = j == 7
            metti('batt', charleston(aperto), croma(t0, j), (0.13 if j % 2 == 0 else 0.09) * (1.3 if aperto else 1), -0.3)
    if b == 5:  # stacco: charleston leggero, poi rullata in crescendo sull'ultimo battito
        for j in range(8):
            metti('batt', charleston(), croma(t0, j), 0.07, -0.3)
        for k in range(8):
            metti('batt', rullante(), t0 + 3 * B + k * B / 8, 0.08 + 0.035 * k, 0.05)
    if b == 7:
        metti('batt', cassa(), t0, 0.6); CASSE.append(t0)
        metti('batt', charleston(True), t0, 0.12, -0.3)

# Introduzione: levare sfiorato e crescendo verso il primo taglio (3,0 s)
for j, m in enumerate([65, 69, 72, 76, 77]):
    metti('chit', pizzico(hz(m + 12), 1.0), 0.04 + j * 0.07, 0.13, 0.3)
metti('fx', salita(1.25), 3.0 - 1.25, 0.16)
for k in range(4):   # rullante che accelera nell'ultimo mezzo battito prima del 3,0
    metti('batt', rullante(), 3.0 - B / 2 + k * B / 8, 0.06 + 0.04 * k, 0.05)

# Campanelle: logo completo (~1,35 s) e «Link in bio» (16,25 s)
for j, m in enumerate([84, 88, 91, 96]):
    metti('fx', campana(hz(m)), 1.05 + j * 0.08, 0.07, -0.4 + 0.25 * j)
for j, m in enumerate([89, 93, 96]):
    metti('fx', campana(hz(m)), 16.25 + j * 0.1, 0.06, 0.3 - 0.25 * j)

# Fruscio morbido sulle transizioni, che va da sinistra a destra con le pennellate
for tw in [2.75, 5.25, 7.75, 10.25, 12.75, 15.25]:
    f = fruscio(0.55); passi = 5; lung = len(f) // passi
    for k in range(passi):
        metti('fx', f[k * lung:(k + 1) * lung], tw + k * lung / SR, 0.10, -0.8 + 1.6 * k / (passi - 1))

# ---------------- Mix ----------------
# Sidechain: piano elettrico e chitarra «respirano» con la cassa (pompaggio leggero, stile pop moderno)
t = tt(N)
duck = np.ones(N)
for tk in CASSE:
    i = int(tk * SR); m = min(N - i, int(0.3 * SR))
    duck[i:i + m] = np.minimum(duck[i:i + m], 1 - 0.38 * np.exp(-tt(m) / 0.09))
for k in ('ep', 'chit'):
    BUS[k] *= duck[:, None]

BUS['basso'] = filtra(BUS['basso'], basso=35, alto=2500)
BUS['chit'] = filtra(BUS['chit'], basso=180)
BUS['ep'] = filtra(BUS['ep'], basso=120, alto=6000)
secco = sum(BUS.values())

# Riverbero a convoluzione: risposta all'impulso sintetica (rumore smorzato, 1,4 s), stereo decorrelato
lung_ir = int(1.4 * SR)
ir_t = tt(lung_ir)
ir = rng.normal(0, 1, (lung_ir, 2)) * np.exp(-ir_t / 0.32)[:, None]
ir[: int(0.012 * SR)] = 0                       # pre-ritardo
ir = filtra(ir, basso=250, alto=6500)
ir /= np.sqrt(np.sum(ir ** 2, axis=0, keepdims=True))
mandata = 0.30 * BUS['mel'] + 0.22 * BUS['ep'] + 0.18 * BUS['chit'] + 0.08 * BUS['batt'] + 0.35 * BUS['fx']
nfft = 1 << int(np.ceil(np.log2(N + lung_ir)))
riv = np.stack([np.fft.irfft(np.fft.rfft(mandata[:, c], nfft) * np.fft.rfft(ir[:, c], nfft), nfft)[:N] for c in range(2)], axis=1)

mix = secco + 0.55 * riv
mix = filtra(mix, basso=28)
# dissolvenza in uscita sull'ultimo secondo e mezzo
mix *= (np.minimum(1, t / 0.005) * np.clip((DURATA - t) / 1.5, 0, 1) ** 0.7)[:, None]

# Compressione morbida sul totale + limitatore, poi livello di uscita: circa -14 LUFS, picco ≤ -1 dBFS
def comprimi(x, soglia=0.35, rapporto=2.5):
    a = np.abs(x).max(axis=1)
    inv = np.zeros(N); acc = 0.0
    att, rel = np.exp(-1 / (0.005 * SR)), np.exp(-1 / (0.12 * SR))
    for i in range(0, N, 64):           # inviluppo a blocchi di 64 campioni (abbastanza fine, veloce)
        v = a[i:i + 64].max()
        acc = att * acc + (1 - att) * v if v > acc else rel * acc + (1 - rel) * v
        inv[i:i + 64] = acc
    sopra = np.maximum(inv / soglia, 1)
    return x * (sopra ** (1 / rapporto - 1))[:, None]

mix /= np.max(np.abs(mix))
mix = comprimi(mix, soglia=0.5, rapporto=2.0)
mix = np.tanh(mix * 1.1) / np.tanh(1.1)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))
mix *= 10 ** (GUADAGNO_DB / 20)   # tarato con ffmpeg ebur128 per circa -14 LUFS

uscita = sys.argv[1] if len(sys.argv) > 1 else 'audio/colonna.wav'
with wave.open(uscita, 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mix, -1, 1) * 32767).astype('<i2').tobytes())
print(f'OK {uscita}: {DURATA} s, {SR} Hz, stereo')
