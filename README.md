# Second Brain

App personale (memoria, stanze, agenti, skill, controllo del lavoro) pensata per il telefono Android.
Vincolo: 0 € oltre all'abbonamento Claude.

## Stato attuale: v1 (vedi `docs/v1.md`)

- App: artifact privato https://claude.ai/artifact/FixFdEmbd31YEYpuNbE4za, sorgente `app/index.html`
- Stato degli agenti: su richiesta, scrivendo «aggiorna stato» in Claude Code (procedura in `CLAUDE.md`, script `strumenti/istantanea.mjs`)
- Backup: `strumenti/backup.mjs` (stessa impronta SHA-256 della pagina)
- Prototipo di verifica e risultati: `prototipo/`, `docs/verifica-prototipo.md`

Nessun token o credenziale è presente nel codice o nel repository.

## Backup manuale (da una sessione Claude Code)

1. `ArtifactData list` di ogni collezione (agenti, collegamenti, memoria, skill, stanze, stato_lavoro) con `out_dir` → cartella
2. `node strumenti/backup.mjs componi <cartella> backup/backup-AAAA-MM-GG.json`
3. commit nel repository privato

Ripristino: dalla pagina (sezione Dati) oppure `node strumenti/backup.mjs scomponi <backup.json> <cartella>` e `ArtifactData batch` con `file_path`.
