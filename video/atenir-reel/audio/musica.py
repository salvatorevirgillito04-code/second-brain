"""Colonna sonora originale del reel Atenir, sintetizzata da zero (nessun campione, nessun diritto di terzi).

Indie-pop acustico a 96 BPM in Fa maggiore: chitarra pizzicata (Karplus-Strong), pad morbido, basso,
batteria leggera, campanelle sul logo e fruscio stereo sulle transizioni (segue il nastro da sinistra a destra).
Le battute iniziano a 0,5 s + k·2,5 s: i tagli del video (3,0 / 5,5 / 8,0 / 10,5 / 13,0 / 15,5 s) cadono sul primo tempo.

Uso: python3 audio/musica.py [uscita.wav]   (solo numpy; deterministico: stesso seme, stesso file)
"""
import sys
import wave
import numpy as np

SR = 44100
DURATA = 19.0
BPM = 96
BATTITO = 60 / BPM            # 0,625 s
INIZIO = 0.5                  # primo battere
BATTUTA = 4 * BATTITO         # 2,5 s = una scena
N = int(SR * DURATA)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)


def hz(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def metti(seg, t, gain=1.0, pan=0.0):
    """Somma un segnale mono a partire da t secondi, con panorama (-1 sinistra … 1 destra)."""
    i = int(t * SR)
    if i >= N:
        return
    seg = seg[: N - i] * gain
    L[i:i + len(seg)] += seg * np.sqrt((1 - pan) / 2)
    R[i:i + len(seg)] += seg * np.sqrt((1 + pan) / 2)


def inviluppo(n, a, d_tau):
    t = np.arange(n) / SR
    env = np.exp(-t / d_tau)
    na = max(1, int(a * SR))
    env[:na] *= np.linspace(0, 1, na)
    return env


def pizzico(freq, durata=1.6, brillantezza=0.5):
    """Corda pizzicata Karplus-Strong, calcolata a blocchi (vettoriale)."""
    n = int(durata * SR)
    p = max(2, int(SR / freq))
    rumore = rng.uniform(-1, 1, p)
    # filtro passa-basso sull'eccitazione: più morbido, meno «plasticoso»
    for _ in range(int(3 * (1 - brillantezza)) + 1):
        rumore = 0.5 * (rumore + np.roll(rumore, 1))
    y = np.zeros(n + p + 1)
    y[:p] = rumore
    decay = 0.996
    k = p
    while k < n + p:
        fine = min(k + p, n + p)
        idx = np.arange(k, fine)
        y[idx] = decay * 0.5 * (y[idx - p] + y[idx - p - 1])
        k = fine
    out = y[:n]
    return out * inviluppo(n, 0.002, durata / 2.2)


def pad(freqs, durata):
    n = int(durata * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for det in (-0.12, 0.12):  # leggero chorus
            ff = f * 2 ** (det / 12)
            s += np.sin(2 * np.pi * ff * t) + 0.25 * np.sin(4 * np.pi * ff * t) + 0.08 * np.sin(6 * np.pi * ff * t)
    env = np.minimum(1, t / 0.35) * np.minimum(1, (durata - t) / 0.4)
    return s * env / (len(freqs) * 2)


def basso(freq, durata):
    n = int(durata * SR)
    t = np.arange(n) / SR
    s = np.tanh(1.6 * (np.sin(2 * np.pi * freq * t) + 0.3 * np.sin(4 * np.pi * freq * t)))
    return s * inviluppo(n, 0.008, 0.45) * np.minimum(1, (durata - t) / 0.05)


def cassa():
    n = int(0.35 * SR)
    t = np.arange(n) / SR
    f = 48 + 90 * np.exp(-t / 0.03)
    fase = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(fase) * np.exp(-t / 0.12)


def rumore_filtrato(n, alfa):
    x = rng.uniform(-1, 1, n)
    # passa-alto semplice (differenza) + passa-basso a un polo
    x = np.diff(x, prepend=0)
    y = np.empty(n)
    acc = 0.0
    for i in range(n):  # n piccolo: va bene il ciclo
        acc += alfa * (x[i] - acc)
        y[i] = acc
    return y


def schiocco():
    n = int(0.22 * SR)
    t = np.arange(n) / SR
    corpo = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.03) * 0.5
    return (rumore_filtrato(n, 0.5) * np.exp(-t / 0.06) + corpo)


def shaker():
    n = int(0.08 * SR)
    t = np.arange(n) / SR
    return rumore_filtrato(n, 0.9) * np.exp(-t / 0.018)


def campana(freq, durata=1.4):
    n = int(durata * SR)
    t = np.arange(n) / SR
    s = (np.sin(2 * np.pi * freq * t) + 0.35 * np.sin(2 * np.pi * freq * 2.76 * t) * np.exp(-t / 0.25)
         + 0.15 * np.sin(2 * np.pi * freq * 5.4 * t) * np.exp(-t / 0.1))
    return s * inviluppo(n, 0.002, 0.45)


def fruscio(durata=0.6):
    """Fruscio «di filo»: rumore filtrato con crescendo e chiusura, per le transizioni."""
    n = int(durata * SR)
    t = np.arange(n) / SR
    x = rng.uniform(-1, 1, n)
    # passa-banda che si apre (sweep): media mobile di lunghezza decrescente
    y = np.zeros(n)
    acc = 0.0
    for i in range(n):
        alfa = 0.02 + 0.18 * (i / n) ** 1.5
        acc += alfa * (x[i] - acc)
        y[i] = acc
    y = (y - 0.6 * np.concatenate(([0.0], y[:-1]))) * 3
    env = np.sin(np.pi * np.clip(t / durata, 0, 1)) ** 1.5
    return y * env


# ---------- Armonia: Fa maj7 – La m7 – Re m7 – Si♭ maj7 ----------
ACCORDI = [
    ([53, 57, 60, 64], 41),   # Fmaj7, basso F2
    ([57, 60, 64, 67], 45),   # Am7,   basso A2
    ([50, 53, 57, 60], 38),   # Dm7,   basso D2
    ([46, 50, 53, 57], 34),   # Bbmaj7, basso Bb1
]
ARPEGGIO = [0, 2, 1, 3, 2, 1, 3, 2]   # 8 crome per battuta

# Battute: indice b → inizio INIZIO + b·BATTUTA. b=0 è l'aggancio (0,5–3,0 s), b=7 il finale (18,0 s).
for b in range(8):
    t0 = INIZIO + b * BATTUTA
    note, radice = ACCORDI[b % 4] if b < 7 else ACCORDI[0]
    finale = b == 7
    # pad
    metti(pad([hz(m) for m in note], BATTUTA + 0.3 if not finale else DURATA - t0), t0, 0.16)
    # chitarra: arpeggio in ottava alta, leggermente a destra; nel finale un solo accordo arpeggiato lento
    if finale:
        for j, m in enumerate(note + [note[0] + 12]):
            metti(pizzico(hz(m + 12), 1.0), t0 + j * 0.06, 0.32, 0.25)
    else:
        for j, idx in enumerate(ARPEGGIO):
            vel = 0.36 if j % 2 == 0 else 0.26
            metti(pizzico(hz(note[idx] + 12), 1.4), t0 + j * BATTITO / 2, vel, 0.25)
    # basso e batteria: dall'ingresso delle categorie (b ≥ 1); respiro nella scena «Fatto a mano» (b = 5)
    if 1 <= b <= 6:
        metti(basso(hz(radice), BATTITO * 1.9), t0, 0.30)
        metti(basso(hz(radice + 7), BATTITO * 0.9), t0 + 2.5 * BATTITO, 0.22)
    if 1 <= b <= 6 and b != 5:
        for q in range(4):
            tq = t0 + q * BATTITO
            if q in (0, 2):
                metti(cassa(), tq, 0.42)
            else:
                metti(schiocco(), tq, 0.20, -0.1)
            for s16 in range(4):
                metti(shaker(), tq + s16 * BATTITO / 4, 0.05 if s16 % 2 else 0.08, -0.35)
    if b == 5:  # solo cassa morbida sul battere, per non perdere il passo
        metti(cassa(), t0, 0.35)
    if finale:
        metti(cassa(), t0, 0.45)

# Levare iniziale (0–0,5 s): un accordo sfiorato che sale
for j, m in enumerate([53, 57, 60, 64, 65]):
    metti(pizzico(hz(m + 12), 1.0, 0.3), 0.04 + j * 0.08, 0.18, 0.2)

# Campanelle sul logo (si completa a 1,35 s) e sull'invito finale (16,2 s)
for j, m in enumerate([84, 88, 91, 96]):          # C6 E6 G6 C7
    metti(campana(hz(m)), 1.05 + j * 0.09, 0.10, -0.3 + j * 0.2)
for j, m in enumerate([81, 84, 89]):              # A5 C6 F6
    metti(campana(hz(m)), 16.2 + j * 0.12, 0.08, 0.2 - j * 0.2)

# Fruscio sulle transizioni: il nastro va da sinistra a destra in 0,5 s → panorama che si sposta
for tw in [2.75, 5.25, 7.75, 10.25, 12.75, 15.25]:
    f = fruscio(0.6)
    passi = 6
    lung = len(f) // passi
    for k in range(passi):
        metti(f[k * lung:(k + 1) * lung], tw - 0.05 + k * lung / SR, 0.18, -0.9 + 1.8 * k / (passi - 1))

# ---------- Mix finale ----------
mix = np.stack([L, R], axis=1)
# riverbero leggero: due echi diffusi incrociati
for ritardo, g in ((0.043, 0.18), (0.071, 0.14), (0.113, 0.1)):
    d = int(ritardo * SR)
    mix[d:, 0] += g * mix[:-d, 1]
    mix[d:, 1] += g * mix[:-d, 0]
# dissolvenza in entrata brevissima e in uscita sull'ultimo secondo
t = np.arange(N) / SR
mix *= (np.minimum(1, t / 0.01) * np.clip((DURATA - t) / 1.0, 0, 1) ** 0.8)[:, None]
# limitatore morbido e normalizzazione a -1 dBFS
mix = np.tanh(mix * 1.2)
mix *= 10 ** (-1 / 20) / np.max(np.abs(mix))

uscita = sys.argv[1] if len(sys.argv) > 1 else 'audio/colonna.wav'
with wave.open(uscita, 'wb') as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes((mix * 32767).astype('<i2').tobytes())
print(f'OK {uscita}: {DURATA} s, {SR} Hz, stereo')
