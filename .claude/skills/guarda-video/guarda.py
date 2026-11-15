#!/usr/bin/env python3
"""Prepara un video perché Claude lo possa "vedere": fotogrammi + trascrizione con i tempi + metadati.

Uso:  python3 <cartella della skill>/guarda.py <URL o file video> <cartella_uscita> [--max-fotogrammi 24] [--lingue it,en] [--cookies file.txt]

Strategia (ogni passo è facoltativo, il risultato dice cosa è riuscito):
  1. metadati e sottotitoli (anche automatici) con yt-dlp, senza scaricare il video;
  2. video in bassa risoluzione con yt-dlp (Instagram/Facebook spesso rispondono 403 dai server: in quel caso si passa oltre);
  3. fotogrammi con ffmpeg: cambi di scena + campionamento regolare, al massimo N, con il tempo nel nome;
  4. se il video non si scarica: miniatura come unico riferimento visivo;
  5. se non ci sono sottotitoli ma c'è il video: trascrizione locale con faster-whisper, solo se è installato.
Nessuna credenziale viene salvata: il file di cookie, se passato, resta dov'è e non viene copiato.
"""
import argparse, glob, json, os, re, shutil, subprocess, sys

def esegui(cmd, timeout=600):
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return r.returncode, (r.stdout + r.stderr)[-2000:]
    except FileNotFoundError: return 127, f"{cmd[0]} non installato"
    except subprocess.TimeoutExpired: return 124, "tempo scaduto"

def ytdlp():
    if shutil.which("yt-dlp"): return ["yt-dlp"]
    try: import yt_dlp  # noqa: F401
    except ImportError: return None
    return [sys.executable, "-m", "yt_dlp"]

def vtt_in_testo(percorso):
    """Sottotitoli VTT → righe «[mm:ss] testo» senza duplicati (i sottotitoli automatici ripetono le righe)."""
    righe, ultimo, t = [], "", "00:00"
    for l in open(percorso, encoding="utf-8", errors="replace"):
        l = l.strip()
        m = re.match(r"(\d+):(\d\d):(\d\d)\.\d+\s+-->", l) or re.match(r"(\d\d):(\d\d)\.\d+\s+-->", l)
        if m:
            g = [int(x) for x in m.groups()]; s = g[0] * 3600 + g[1] * 60 + g[2] if len(g) == 3 else g[0] * 60 + g[1]
            t = f"{s // 60:02d}:{s % 60:02d}"; continue
        if not l or l.startswith(("WEBVTT", "Kind:", "Language:", "NOTE")) or l.isdigit(): continue
        l = re.sub(r"<[^>]+>", "", l).strip()
        if l and l != ultimo: righe.append(f"[{t}] {l}"); ultimo = l
    return "\n".join(righe)

def durata(video):
    c, o = esegui(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", video], 60)
    try: return float(o.strip().splitlines()[-1])
    except Exception: return 0.0

def fotogrammi(video, out, massimo):
    d = durata(video); cart = os.path.join(out, "fotogrammi"); os.makedirs(cart, exist_ok=True)
    tempi = set()
    # cambi di scena
    c, o = esegui(["ffmpeg", "-hide_banner", "-i", video, "-vf", "select='gt(scene,0.30)',showinfo", "-an", "-f", "null", "-"], 900)
    for m in re.finditer(r"pts_time:([\d.]+)", o): tempi.add(round(float(m.group(1)), 1))
    # campionamento regolare (copre anche video senza tagli), più fitto nei primi 3 secondi (l'aggancio)
    if d > 0:
        for x in (0.0, 0.5, 1.0, 2.0, 3.0): tempi.add(min(x, max(d - 0.1, 0)))
        passo = max(d / max(massimo - 5, 1), 0.5)
        x = 3.0
        while x < d: tempi.add(round(x, 1)); x += passo
    scelti = sorted(tempi)
    if len(scelti) > massimo:  # tiene i primi 5 e distribuisce il resto in modo uniforme
        testa, resto = scelti[:5], scelti[5:]; k = massimo - 5
        scelti = testa + [resto[int(i * len(resto) / k)] for i in range(k)]
    fatti = []
    for s in scelti:
        nome = os.path.join(cart, f"t{int(s // 60):02d}m{s % 60:04.1f}s.jpg")
        c, _ = esegui(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", "-ss", str(s), "-i", video, "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-q:v", "4", nome], 120)
        if c == 0 and os.path.exists(nome): fatti.append(os.path.relpath(nome, out))
    return d, fatti

def whisper(video, out):
    try: from faster_whisper import WhisperModel
    except ImportError: return None, "faster-whisper non installato"
    try:
        modello = WhisperModel("small", device="cpu", compute_type="int8")
        seg, info = modello.transcribe(video, vad_filter=True)
        testo = "\n".join(f"[{int(s.start // 60):02d}:{int(s.start % 60):02d}] {s.text.strip()}" for s in seg)
        return testo, f"whisper ({info.language})"
    except Exception as e: return None, f"whisper non riuscito: {e.__class__.__name__}"

def main():
    a = argparse.ArgumentParser(); a.add_argument("sorgente"); a.add_argument("uscita")
    a.add_argument("--max-fotogrammi", type=int, default=24); a.add_argument("--lingue", default="it,it-orig,en,en-orig"); a.add_argument("--cookies")
    o = a.parse_args(); os.makedirs(o.uscita, exist_ok=True)
    esito = {"sorgente": o.sorgente, "passi": {}, "avvisi": []}
    video = o.sorgente if os.path.isfile(o.sorgente) else None
    trascrizione = None
    if not video:
        y = ytdlp()
        if not y: esito["avvisi"].append("yt-dlp non disponibile: installalo con «pip install yt-dlp yt-dlp-ejs»")
        else:
            base = y + ["--no-playlist", "--js-runtimes", "node"] + (["--cookies", o.cookies] if o.cookies else [])
            c, m = esegui(base + ["--skip-download", "--write-info-json", "--write-thumbnail", "--convert-thumbnails", "jpg", "-o", os.path.join(o.uscita, "sorgente.%(ext)s"), o.sorgente], 300)
            esito["passi"]["metadati"] = "ok" if c == 0 else "errore: " + (m.strip().splitlines()[-1][:200] if m.strip() else "?")
            # sottotitoli una lingua alla volta: un errore (es. 429 su una lingua) non blocca le altre
            for lingua in o.lingue.split(","):
                c, m = esegui(base + ["--skip-download", "--write-subs", "--write-auto-subs", "--sub-langs", lingua, "--sub-format", "vtt", "-o", os.path.join(o.uscita, "sorgente.%(ext)s"), o.sorgente], 180)
                if glob.glob(os.path.join(o.uscita, "sorgente.*.vtt")): break
            c, m = esegui(base + ["-f", "b[height<=480]/bv*[height<=480]+ba/w", "-o", os.path.join(o.uscita, "video.%(ext)s"), o.sorgente], 600)
            trovati = [f for f in glob.glob(os.path.join(o.uscita, "video.*")) if not f.endswith((".part", ".ytdl"))]
            if c == 0 and trovati: video = trovati[0]; esito["passi"]["video"] = "scaricato"
            else:
                esito["passi"]["video"] = "non scaricato: " + (m.strip().splitlines()[-1][:200] if m.strip() else "errore")
                if "403" in m or "login" in m.lower(): esito["avvisi"].append("Il sito blocca il download dai server (tipico di Instagram/Facebook). Alternative: carica il video come file, oppure usa un connettore di trascrizione.")
        info = glob.glob(os.path.join(o.uscita, "sorgente.info.json"))
        if info:
            j = json.load(open(info[0], encoding="utf-8"))
            esito["metadati"] = {k: j.get(k) for k in ("title", "uploader", "duration", "upload_date", "view_count", "like_count", "webpage_url", "description") if j.get(k) is not None}
            if "description" in esito["metadati"]: esito["metadati"]["description"] = esito["metadati"]["description"][:1500]
            os.remove(info[0])  # contiene URL firmati e dati superflui
        sub = sorted(glob.glob(os.path.join(o.uscita, "sorgente.*.vtt")))
        if sub:
            trascrizione = vtt_in_testo(sub[0]); esito["passi"]["trascrizione"] = "sottotitoli " + os.path.basename(sub[0]).split(".")[1]
        mini = glob.glob(os.path.join(o.uscita, "sorgente.jpg"))
        if mini: esito["miniatura"] = os.path.basename(mini[0])
    if video:
        if not shutil.which("ffmpeg"): esito["avvisi"].append("ffmpeg non installato: niente fotogrammi")
        else:
            d, f = fotogrammi(video, o.uscita, o.max_fotogrammi); esito["durata_s"] = round(d, 1); esito["fotogrammi"] = f
            esito["passi"]["fotogrammi"] = f"{len(f)} estratti"
        if not trascrizione:
            trascrizione, come = whisper(video, o.uscita); esito["passi"]["trascrizione"] = come if trascrizione else "non disponibile (" + come + ")"
    elif "miniatura" in esito: esito["avvisi"].append("Solo la miniatura come riferimento visivo: l'analisi delle immagini sarà limitata.")
    if trascrizione:
        open(os.path.join(o.uscita, "trascrizione.txt"), "w", encoding="utf-8").write(trascrizione); esito["trascrizione"] = "trascrizione.txt"
    elif "trascrizione" not in esito["passi"]: esito["passi"]["trascrizione"] = "non disponibile"
    json.dump(esito, open(os.path.join(o.uscita, "esito.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(json.dumps(esito, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
