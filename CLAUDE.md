# Second Brain – istruzioni per Claude Code

Rispondi in italiano.

App: Android (`android/`), dati sul telefono, sincronizzati nel repository privato `second-brain`, **ramo `dati`**:
- `dati/app/<collezione>/<id>.json` – stanze, progetti, agenti, skill, collegamenti e le sole note che l'utente ha reso accessibili agli agenti (dalla 1.1 le memorie sono note; `dati/app/memoria/` è il vecchio percorso della 1.0, svuotato dall'app). Li scrive l'app. **Non modificarli** salvo richiesta esplicita dell'utente.
- `dati/stato/istantanea.json`, `dati/stato/ultimo_tentativo.json` – li scrive SOLO Claude Code con «aggiorna stato». L'app li legge e basta.

Gli agenti che devono consultare la memoria leggono `dati/app/note/*.json` dal ramo `dati` (solo note condivise; con la 1.0 ancora installata: `dati/app/memoria/*.json`).
L'artifact della v1 (https://claude.ai/artifact/FixFdEmbd31YEYpuNbE4za) resta come archivio originale in sola lettura: non scriverci.

## «aggiorna stato»

Viene eseguito anche in automatico dall'attività pianificata «Second Brain – stato (sessione dedicata)» (ogni 3 ore, riprende la sessione «Second Brain-Stato») e dal pulsante «Aggiorna ora» dell'app.

Quando l'utente scrive «aggiorna stato», esegui SOLO questo, senza pianificazioni:

1. `list_sessions` (connettore claude-code-remote) con `mine: true`, `limit: 50`; subito dopo `date -u +%Y-%m-%dT%H:%M:%SZ` → `<rilevato_il>`.
2. Salva la risposta così com'è (con `post_turn_summary` e `task_summary`) in `<scratchpad>/lista.json`; ricava l'id di questa sessione con `get_session` senza argomenti → `<id_rilevatore>`.
3. `node strumenti/istantanea.mjs ok <scratchpad>/lista.json <rilevato_il> <id_rilevatore> <scratchpad>/stato`
   (tiene id, titolo, stato, categoria, origine, date, riepilogo breve e richiesta di intervento, max 500 caratteri; mai il contenuto delle conversazioni).
4. Pubblica sul ramo `dati` solo i due file di stato. **Mai force push.**
   ```
   git fetch origin dati && git worktree add <scratchpad>/ramo-dati origin/dati --detach
   cd <scratchpad>/ramo-dati && mkdir -p dati/stato
   ```
   Se `origin/dati` non esiste: fermati e chiedi all'utente di sincronizzare prima dall'app (è l'app a creare il ramo).
   Se `dati/stato/istantanea.json` nel ramo ha `rilevato_il` più recente del tuo: non pubblicare, riferisci che esiste già una rilevazione più nuova.
   Altrimenti copia i file, poi verifica che `git status --porcelain` tocchi SOLO `dati/stato/` e fai commit:
   `git add dati/stato && git commit -m "Stato agenti: rilevazione <rilevato_il>" && git push origin HEAD:dati`
   Push rifiutato perché il ramo è avanzato: `git pull --rebase origin dati`; se il rebase è pulito ripeti il controllo su `rilevato_il` e il push;
   se il rebase va in conflitto: `git rebase --abort`, non pubblicare e riferisci la rilevazione concorrente (nessuna sovrascrittura).
5. Se un passo fallisce: NON pubblicare `istantanea.json`. Esegui
   `node strumenti/istantanea.mjs errore "<passo e messaggio>" <scratchpad>/stato` e pubblica solo `ultimo_tentativo.json`.
6. Rispondi con: numero di sessioni lette, ora della rilevazione, eventuale troncamento o errore. Ricorda all'utente di toccare «Scarica istantanea dal repository» nell'app.

Autorizzazione (data dall'utente il 13/11/2026): per «aggiorna stato» il push è consentito solo sul ramo `dati`, solo per `dati/stato/*`, mai con force push.

Regole:
- Non associare sessioni ad agenti o stanze: le associazioni le crea l'utente nell'app (`collegamenti`). Dalla 1.5 è l'app stessa a mettere le sessioni nelle stanze (organizzazione automatica, richiesta dall'utente il 14/11/2026); Claude Code non lo fa.
- Lo stato salvato è una rilevazione puntuale, non uno stato in tempo reale.
- Nessun token, chiave o password nel codice o nel repository. La chiave di firma è nel Google Drive dell'utente (cartella «Second Brain - firma app»), la password nel suo gestore di password.

## Agenti pianificati (nella sessione «Second Brain-Stato»)

Autorizzazione (data dall'utente il 14/11/2026): push consentito solo sul ramo `dati`, solo per `dati/stato/attese.md` e `dati/stato/resoconto-settimanale.md`. Mai force push. Se il rebase va in conflitto: `--abort` e niente pubblicazione. Il procedimento git è quello del passo 4 di «aggiorna stato».

**«sblocca attese»** (ogni mattina): `list_sessions` (mine: true). Per ogni sessione con status_bucket BLOCKED, leggi l'ultima domanda con `list_events` (kinds user/assistant/result, limit 100).
Scrivi `dati/stato/attese.md`, con una sezione per sessione:
- titolo e `https://claude.ai/code/<id>`;
- cosa chiede, in 1 riga;
- la risposta consigliata, pronta da incollare, con il motivo;
- i rischi.

Non scrivere nelle altre sessioni e non rispondere al posto dell'utente. Niente segreti né dati personali. Commit: «Attese: <data>».

**«resoconto settimanale»** (lunedì): `list_sessions` più `git log` dei 7 giorni precedenti sul ramo `dati`.
Scrivi `dati/stato/resoconto-settimanale.md` con:
- avanzato;
- fermo, e perché;
- decisioni da prendere;
- 3 priorità consigliate.

Le stime di costo vanno indicate come stime, mai come addebiti. Commit: «Resoconto settimanale: <data>».

**«coordinatore»** (07:47 e 18:47, ora di Roma; sostituisce «sblocca attese», che è in pausa): su richiesta dell'utente del 14/11/2026 risponde da solo, con `send_message`, solo alle richieste reversibili e senza rischi. Esclusi: push o merge, pubblicazione, costi, eliminazioni, credenziali, dati personali, azioni sul telefono, scelte di gusto. Tutto il resto lo scrive in `dati/stato/attese.md` come «essenziale», con la risposta consigliata. Le istruzioni complete sono nell'attività pianificata `trig_01NxVA6ihmRJ4qiHWW9CeNcC`.

**«rapporto connettori»** (08:13, ora di Roma; attività `trig_017QzVMwoNDckV8nWaQb5rTw`, richiesta dall'utente il 14/11/2026): legge in **sola lettura** Sentry, Netlify, Supabase, Bitrise, Alpha Vantage e il saldo di TranscriptFetch. Scrive il rapporto in un unico documento Google Drive, «Second Brain – rapporto connettori». Nessuna modifica sui servizi, nessun costo, nessun push.

Catalogo: il 14/11/2026 l'utente ha autorizzato l'aggiunta (solo file nuovi) in `dati/app/{agenti,skill,stanze,progetti}` delle schede di skill e agenti reali (`.claude/`) e della stanza «Trading oro e Forex». Il progetto trading è descritto in `docs/progetto-trading.md`.
