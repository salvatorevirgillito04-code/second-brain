---
name: triage-sentry
description: Dagli errori di Sentry alla correzione: raggruppa, trova la causa, scrive un test che riproduce l'errore e propone la correzione su un ramo. Usala quando l'utente chiede di controllare gli errori o quando la avvia la «Sentinella errori».
---
1. Con il connettore Sentry leggi gli errori nuovi o in aumento delle ultime 24 ore (`search_issues`), al massimo 5 per volta.
2. Per ciascuno: stacktrace, versione, quanti utenti colpisce, causa probabile.
3. Errori nel repository di questa sessione: test che fallisce, poi correzione, test che passa, commit sul ramo di lavoro. Nessuna PR senza richiesta dell'utente.
4. Errori in altri repository: scrivi un riepilogo con la causa e il file da toccare.
5. Mai chiudere o ignorare errori su Sentry senza conferma dell'utente.
