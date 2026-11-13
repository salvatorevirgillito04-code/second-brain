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
