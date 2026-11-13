# Second Brain – istruzioni per Claude Code

Rispondi in italiano.

App: Android (`android/`), dati sul telefono, sincronizzati nel repository privato `second-brain`, **ramo `dati`**:
- `dati/app/<collezione>/<id>.json` – stanze, agenti, skill, collegamenti e le sole memorie che l'utente ha reso accessibili agli agenti. Li scrive l'app. **Non modificarli** salvo richiesta esplicita dell'utente.
- `dati/stato/istantanea.json`, `dati/stato/ultimo_tentativo.json` – li scrive SOLO Claude Code con «aggiorna stato». L'app li legge e basta.

Gli agenti che devono consultare la memoria leggono `dati/app/memoria/*.json` dal ramo `dati` (solo memorie condivise).
L'artifact della v1 (https://claude.ai/artifact/FixFdEmbd31YEYpuNbE4za) resta come archivio originale in sola lettura: non scriverci.

## «aggiorna stato»

Quando l'utente scrive «aggiorna stato», esegui SOLO questo, senza pianificazioni:

1. `list_sessions` (connettore claude-code-remote) con `mine: true`, `limit: 50`; subito dopo `date -u +%Y-%m-%dT%H:%M:%SZ` → `<rilevato_il>`.
2. Salva la risposta in `<scratchpad>/lista.json`; ricava l'id di questa sessione con `get_session` senza argomenti → `<id_rilevatore>`.
3. `node strumenti/istantanea.mjs ok <scratchpad>/lista.json <rilevato_il> <id_rilevatore> <scratchpad>/stato`
   (tiene solo id, titolo, stato, categoria, origine, date; nessun riassunto o contenuto).
4. Pubblica sul ramo `dati` solo i due file di stato:
   ```
   git fetch origin dati && git worktree add <scratchpad>/ramo-dati origin/dati --detach
   cp <scratchpad>/stato/istantanea.json <scratchpad>/stato/ultimo_tentativo.json <scratchpad>/ramo-dati/dati/stato/
   cd <scratchpad>/ramo-dati && git add dati/stato && git commit -m "Stato agenti: rilevazione <rilevato_il>" && git push origin HEAD:dati
   ```
   Se `origin/dati` non esiste ancora: fermati e chiedi all'utente di fare prima una sincronizzazione dall'app (è l'app a creare il ramo).
   Se il push è rifiutato perché il ramo è avanzato: `git pull --rebase origin dati` e ripeti (i file di stato non sono mai scritti dall'app, quindi non ci sono conflitti di contenuto).
5. Se un passo fallisce: NON pubblicare `istantanea.json`. Esegui
   `node strumenti/istantanea.mjs errore "<passo e messaggio>" <scratchpad>/stato` e pubblica solo `ultimo_tentativo.json`.
6. Rispondi con: numero di sessioni lette, ora della rilevazione, eventuale troncamento o errore. Ricorda all'utente di toccare «Scarica istantanea dal repository» nell'app.

Autorizzazione: per «aggiorna stato» il push è consentito solo sul ramo `dati` e solo per `dati/stato/*` (vedi docs/android.md).

Regole:
- Non associare sessioni ad agenti o stanze: le associazioni le crea l'utente nell'app (`collegamenti`).
- Lo stato salvato è una rilevazione puntuale, non uno stato in tempo reale.
- Nessun token, chiave o password nel codice o nel repository. La chiave di firma è nel Google Drive dell'utente (cartella «Second Brain - firma app»), la password nel suo gestore di password.
