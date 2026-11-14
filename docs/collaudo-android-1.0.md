# Collaudo utente – Second Brain Android 1.0

Esito dichiarato dall'utente: **superato**, su OPPO con Android 16 (comunicato il 13/11/2026).

| Controllo | Esito |
|---|---|
| Installazione 1.0.0, nome e icona | superato (utente) |
| Importazione del backup della v1 con il selettore file | superato (utente) |
| Token GitHub e prima sincronizzazione (creazione ramo `dati`) | superato (utente) |
| Aggiornamento 1.0.0 → 1.0.1 con dati conservati | superato (utente) |
| Conflitto reale app / GitHub | superato (utente) |
| Modalità aereo: modifiche in attesa | superato (utente) |
| Esportazione con il selettore file | superato (utente) |
| Memoria resa privata: rimozione dal repository (DELETE) | superato (utente) |

APK collaudati: 1.0.0 `dc3b1538…0443`, 1.0.1 `0a90ad9c…c5d4`. Certificato `955BD34F…57B4E4D5`, identificativo `it.secondbrain.app`.

## Nota del 13/11/2026 (verifica sul repository)
Su GitHub non esiste il ramo `dati` (rami presenti: solo `ccr-b772bd68-cobgte`, che è anche il predefinito).
La prima sincronizzazione crea quel ramo, quindi dal repository **non risulta una sincronizzazione riuscita**.
Da ricontrollare sul telefono: Dati › Sincronizzazione › «Ultima riuscita» e «Ultimo errore».
Gli altri controlli (installazione, migrazione, aggiornamento, offline, esportazione) non dipendono dal repository.

## Aggiornamento del 13/11/2026, ore 20:30 – sincronizzazione riuscita (app 1.1.0)
Causa del problema precedente: il token a grana fine non aveva repository né permessi. Corretto dall'utente
(solo `second-brain`, Contents: Read and write). Verifica sul repository: ramo `dati` creato dall'app con 7 file
(2 agenti, 1 collegamento, 2 skill, 2 stanze) = le 7 modifiche in attesa. Nessun file in `dati/app/note/` né in
`dati/app/memoria/`: nessuna nota privata inviata.

## Collaudo utente 1.1.1 (13/11/2026)
Esito dichiarato dall'utente: **superato** su OPPO (Android 16). Aggiornamento 1.1.0 → 1.1.1 con dati conservati,
versione «1.1.1 (4)» in Avanzate, sincronizzazione completata senza errori.
APK `54f72ddd…cb75`, certificato `955BD34F…57B4E4D5`.

## Collaudo 1.3.0 (14/11/2026, controllo delle 00:41 UTC)

Verificato dal repository e dall'attività pianificata:
- L'attività «Second Brain – stato (sessione dedicata)» è partita alle 00:18 UTC con esito riuscito e ha pubblicato `Stato agenti: rilevazione 2026-11-14T00:19:14Z` (commit a5f95a6): 11 sessioni, nessun troncamento, solo `dati/stato/`. La prossima esecuzione è alle 02:18 UTC.
- Ultimo avvio registrato: quello pianificato delle 00:18. Dopo le 22:18 UTC non risultano avvii da «Aggiorna ora».
- L'app ha inviato 13 modifiche al ramo `dati` dalle 21:00 UTC (stanze e note di sessione). Le 5 note `sessione-…` presenti nel repository sono state rese accessibili agli agenti dall'utente.

Da controllare sul telefono:
- che la sincronizzazione in background avvenga con l'app chiusa (in Impostazioni › Automazioni, l'ora dell'«ultima sincronizzazione in background»);
- il pulsante «Aggiorna ora» con il token dell'attività.
- 14/11/2026: l'utente conferma sul telefono che i controlli rimasti (sincronizzazione in background con l'app chiusa e «Aggiorna ora») sono andati bene: «Fatto, tutto corretto».
