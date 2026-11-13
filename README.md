# Second Brain

App personale (memoria, stanze, agenti, skill, controllo del lavoro) pensata per il telefono Android.
Vincolo: 0 € oltre all'abbonamento Claude.

## Stato attuale: app Android 1.0 (vedi `docs/android.md`)

- App: `android/` – identificativo `it.secondbrain.app`, dati sul telefono, sincronizzazione con questo repository (ramo `dati`)
- Firma: chiave nel Google Drive privato (cartella «Second Brain - firma app"), password nel gestore di password; mai nel repository
- Compilazione: `strumenti/compila-apk.sh` (riproducibile, dipendenze verificate)
- Stato degli agenti: «aggiorna stato» in Claude Code scrive `dati/stato/` sul ramo `dati` (procedura in `CLAUDE.md`)
- Migrazione: `backup/migrazione-artifact-2026-11-13.json` (copia dei dati dell'artifact della v1, che resta intatto)
- Test: `node --test test/motore.test.mjs`, `node test/interfaccia.test.mjs`
- Storico: v1 web in `app/`, prototipo in `prototipo/`, report in `docs/`

Nessun token, chiave o password è presente nel codice o nel repository.
