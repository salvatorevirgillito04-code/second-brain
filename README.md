# Second Brain

App personale (memoria, stanze, agenti, skill, controllo del lavoro) pensata per il telefono Android.
Vincolo: 0 € oltre all'abbonamento Claude.

## Stato attuale: prototipo di verifica (0.1)

Non è ancora l'app. Serve a confermare che l'opzione **A+B** funzioni davvero:

- **A** – interfaccia come artifact privato su claude.ai, con archivio dell'artifact (`db`), download (`downloads`) e connettore *Claude Code Remote* (`mcp`).
- **B** – copia di sicurezza nel repository privato, in JSON con impronta SHA-256.

| Percorso | Contenuto |
|---|---|
| `prototipo/index.html` | Pagina di prova pubblicata come artifact privato |
| `strumenti/backup.mjs` | Compone, scompone e verifica i backup (stessa impronta della pagina) |
| `backup/backup-fittizio.json` | Backup di prova, **solo dati fittizi** |
| `docs/verifica-prototipo.md` | Risultati delle prove |

Nessun token o credenziale è presente nel codice o nel repository: la pagina usa le funzioni della piattaforma con l'identità di chi la apre.

## Backup manuale (da una sessione Claude Code)

1. `ArtifactData list` delle collezioni `stanze` e `memoria` con `out_dir` → cartella di esportazione
2. `node strumenti/backup.mjs componi <cartella> backup/backup-AAAA-MM-GG.json`
3. commit nel repository privato

Ripristino: `node strumenti/backup.mjs scomponi <backup.json> <cartella>` e reinvio dei file con `ArtifactData batch` (`file_path`).
