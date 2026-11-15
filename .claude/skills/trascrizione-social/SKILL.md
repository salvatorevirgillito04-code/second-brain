---
name: trascrizione-social
description: Ottiene la trascrizione del parlato di un Reel, TikTok, Short, post di X o Facebook usando un connettore di trascrizione se collegato (es. TranscriptFetch, Supadata), altrimenti i sottotitoli via guarda-video. Usala quando serve solo cosa si dice in un video social, soprattutto da telefono.
---
1. Se in questa conversazione è disponibile uno strumento di un connettore di trascrizione (nomi tipo TranscriptFetch, Supadata, TranscriptMagic), usalo con l'URL. I connettori leggono **solo il parlato**, non le immagini.
2. Altrimenti esegui la skill `guarda-video`, che prende i sottotitoli quando esistono.
3. Restituisci:
   - la trascrizione pulita con i tempi;
   - un riassunto in 5 punti;
   - la lingua;
   - la fonte della trascrizione (connettore, sottotitoli o Whisper).
4. Se nessuna via funziona, dillo chiaramente e proponi di allegare il video come file.
Non chiedere né salvare chiavi API in chat o nel repository: i connettori si collegano da claude.ai › Impostazioni › Connettori.
