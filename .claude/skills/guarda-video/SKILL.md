---
name: guarda-video
description: Fa "vedere" a Claude un video (YouTube, TikTok, X, Instagram, Facebook o un file caricato) estraendo fotogrammi con i tempi, trascrizione e metadati, poi lo analizza. Usala quando l'utente incolla il link di un video o allega un video e chiede di guardarlo, riassumerlo o analizzarlo.
---
# Guarda un video

1. Prepara le dipendenze, solo se mancano: `pip install -q yt-dlp yt-dlp-ejs`. Servono anche `ffmpeg` e `node`.
2. Esegui `python3 <cartella di questa skill>/guarda.py "<URL o percorso del file>" <scratchpad>/video-<breve> --max-fotogrammi 24`.
   - Per Instagram e X con login: aggiungi `--cookies <file>` solo se l'utente ti dà il file dei cookie. Non salvarlo e non metterlo nel repository.
3. Leggi `esito.json`, poi apri **tutti** i fotogrammi in `fotogrammi/` (o la miniatura) e `trascrizione.txt`. I nomi dei file contengono il tempo (es. `t00m03.0s.jpg`).
4. Rispondi in italiano con:
   - **Di cosa parla**: 3–5 righe.
   - **Cosa si vede**: le scene principali con i tempi, testi in sovrimpressione, persone e oggetti, presi dai fotogrammi.
   - **Cosa si dice**: punti chiave della trascrizione con i tempi.
   - **Limiti**: cosa non è stato possibile ottenere (video non scaricato, trascrizione mancante, solo miniatura) e perché.
5. Onestà: descrivi solo ciò che vedi nei fotogrammi e leggi nella trascrizione. Se hai solo la trascrizione, dillo e non inventare le immagini. Se hai solo la miniatura, l'analisi visiva è limitata a quella.

Quando il download è bloccato (403 o login, frequente con Instagram, Facebook e Threads dai server):
- proponi di caricare il video come file (dal telefono: Condividi → salva il video, poi allegalo);
- oppure usa la skill `trascrizione-social`, se c'è un connettore di trascrizione.

Se l'utente vuole conservarlo: prepara una nota breve (titolo, link, 5 punti chiave, tag) da incollare nell'aggiunta rapida di Second Brain. Non scrivere nei dati dell'app.
