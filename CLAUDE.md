# Second Brain – istruzioni per Claude Code

Rispondi in italiano.

App: artifact privato https://claude.ai/artifact/FixFdEmbd31YEYpuNbE4za (sorgente `app/index.html`).
Archivio: database dell'artifact (strumento `ArtifactData`). Backup nel repository: `strumenti/backup.mjs`.

## «aggiorna stato»

Quando l'utente scrive «aggiorna stato», esegui SOLO questo, senza pianificazioni e senza toccare altre collezioni:

1. Chiama `list_sessions` (connettore claude-code-remote) con `mine: true`, `limit: 50`.
   Subito dopo annota l'ora UTC: `date -u +%Y-%m-%dT%H:%M:%SZ` → `<rilevato_il>`.
2. Salva la risposta così com'è in `<scratchpad>/lista.json`.
3. Ricava l'id di questa sessione con `get_session` senza argomenti → `<id_rilevatore>`.
4. `node strumenti/istantanea.mjs ok <scratchpad>/lista.json <rilevato_il> <id_rilevatore> <scratchpad>/stato`
   Lo script tiene solo: id, titolo, stato, categoria di stato, origine, date. Nessun riassunto o contenuto.
5. Leggi `stato_lavoro/istantanea` e `stato_lavoro/ultimo_tentativo` con `ArtifactData get` per avere le versioni,
   poi `ArtifactData batch` con due `set` (`file_path` dai file prodotti), ciascuno con il proprio `if_version`
   (omesso solo se il documento non esiste).
6. Se un passo fallisce: NON scrivere `istantanea`. Esegui
   `node strumenti/istantanea.mjs errore "<passo e messaggio>" <scratchpad>/stato`
   e salva solo `stato_lavoro/ultimo_tentativo`. L'istantanea precedente resta visibile nella pagina.
7. Rispondi con: numero di sessioni lette, ora della rilevazione, eventuale troncamento o errore.

Regole:
- Non associare sessioni ad agenti o stanze: le associazioni le crea l'utente nella pagina (collezione `collegamenti`).
- Lo stato salvato è una rilevazione puntuale, non uno stato in tempo reale.
- Nessun token o credenziale nel codice o nel repository.
