# Verifica del prototipo A+B – 13 novembre 2026

Artifact privato: https://claude.ai/artifact/FixFdEmbd31YEYpuNbE4za (visibile solo al proprietario)
Capacità dichiarate: `db`, `downloads`, `mcp` → *Claude Code Remote* (13 strumenti dichiarati, la pagina ne chiama solo 2 in lettura).
Tutti i dati usati sono fittizi e marcati `fittizio: true`.

## Risultati

| # | Prova | Risultato | Evidenza | Limite riscontrato |
|---|---|---|---|---|
| 0 | Repository privato | ✅ Superata | Metadati GitHub: `"private": true, "visibility": "private"` | — |
| 1 | Apertura e uso da Android | ⏳ Non verificato | Serve la prova dal telefono. La pagina registra a ogni apertura sistema, larghezza e capacità disponibili nella collezione `visite`, che posso rileggere | Non è noto se l'app Android di Claude mostri gli artifact con capacità; in alternativa Chrome su claude.ai |
| 2 | Stanza e memoria persistenti | 🟡 Parziale | Scrittura e rilettura dall'archivio riuscite da Claude Code (`stanze` 1 doc, `memoria` 2 doc, versione 1). Una seconda sessione indipendente le ha rilette | Persistenza dopo chiusura/riapertura **dal telefono**: non verificato |
| 3 | Connettore dall'artifact | ⏳ Non verificato | Manifest accettato alla pubblicazione (`mcp: Claude Code Remote[13 tools]`). I pulsanti "Elenca strumenti" e "Leggi stato sessioni" salvano l'esito in `prove_connettore` | Gli strumenti realmente concessi alla pagina possono essere meno dei 13 dichiarati; il primo uso chiede il consenso |
| 4 | Strumenti: conversazione vs artifact | 🟡 Parziale | Conversazione: 36 strumenti `claude-code-remote` (elenco sotto). Artifact: 13 dichiarati, quelli effettivi solo dopo la prova 3 | Strumenti legati alla sessione chiamante (`send_later`, `watch_url`…) non valgono per una pagina |
| 5 | Esportazione e ripristino identici | ✅ Superata (lato Claude Code) | Impronta SHA-256 del backup `a249cb5e…2d6d` = impronta dei dati riletti da `ripristino/claude` dopo il ripristino; `diff -r` senza differenze | Esportazione e ripristino **dalla pagina sul telefono**: non verificato (download con conferma, scelta del file) |
| 6 | Backup archivio → repository | ✅ Superata (manuale) · 🟡 indiretta (non interattiva) | Questa sessione: `ArtifactData list` → `strumenti/backup.mjs` → `backup/backup-fittizio.json` nel repository. Una sessione separata, avviata via strumento e senza persona collegata, ha letto `stanze` (1 doc) senza richieste di permesso | Una **sessione pianificata** non è stata provata (nessuna pianificazione attivata): resta da confermare |
| 7 | Limiti dell'archivio | ✅ Superata in parte | 25.000 documenti per artifact (riportato dal servizio); documento da 300 KiB rifiutato ("307233 byte, il limite è 262144"); 250 KiB accettato e poi eliminato | Tetto di dimensione totale non pubblicato; al tetto l'errore documentato è `quota_exceeded` (scritture nuove rifiutate, aggiornamenti che non crescono ammessi). Il rifiuto a 300 KiB è avvenuto lato strumento, non è stato visto l'errore lato server |

## Strumenti `claude-code-remote` disponibili in questa conversazione (36)

add_repo, archive_session, confirm_repository_trust, create_environment, create_session, create_trigger,
delete_trigger, fire_trigger, get_environment, get_event, get_session, get_trigger, interrupt_session,
list_computer_folders, list_environments, list_events, list_repos, list_sessions, list_triggers,
read_documentation, register_repo_root, report_preview_port, request_computer_folder, request_credential,
send_later, send_message, set_session_tags, set_session_title, subscribe_pr_activity, switch_environment,
unarchive_session, unsubscribe_pr_activity, unwatch_url, update_environment, update_trigger, watch_url

## Dichiarati per l'artifact (13)

Lettura: list_sessions, get_session, list_events, get_event, list_environments, get_environment, list_triggers, get_trigger, list_repos
Azioni (dichiarate per le fasi future, **non chiamate** dal prototipo): create_session, send_message, interrupt_session, archive_session

## Osservazioni utili per il controllo del lavoro

- `list_sessions` restituisce per ogni sessione `session_status`, `status_bucket` (WORKING, COMPLETED, FAILED…), `origin` (es. `android`), `updated_at`: è la base reale per mostrare un agente "al lavoro".
- `list_events` di una sessione include l'esito del turno e una stima del costo a listino: utile per mostrare risultati ed errori.
- La sessione di prova creata per il punto 6 ha consumato limiti del piano (stima a listino ≈ 0,58 $, nessun addebito extra).

## Cosa fare dal telefono

1. Apri il link dell'artifact da Chrome (e, se possibile, dall'app Claude).
2. Crea una stanza e una memoria fittizie, chiudi tutto, riapri: devono esserci ancora.
3. Premi "Elenca strumenti" e poi "Leggi stato sessioni", concedendo il consenso quando richiesto.
4. Premi "Esporta JSON", poi carica lo stesso file in "File da ripristinare": deve comparire "Ripristino identico".
5. Facoltativo: "Prova documento da 300 KiB" deve essere rifiutato.

Poi scrivimi "fatto": rileggo `visite`, `prove_connettore` e `prove_ripristino` e completo la tabella.
