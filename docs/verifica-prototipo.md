# Verifica del prototipo A+B – 13 novembre 2026

Artifact privato: https://claude.ai/artifact/FixFdEmbd31YEYpuNbE4za (visibile solo al proprietario)
Capacità dichiarate: `db`, `downloads`, `mcp` → *Claude Code Remote* (13 strumenti dichiarati, la pagina ne chiama solo 2 in lettura).
Tutti i dati usati sono fittizi e marcati `fittizio: true`.

## Risultati (aggiornati dopo la prova dal telefono, 06:16–06:25 UTC)

| # | Prova | Risultato | Evidenza | Limite riscontrato |
|---|---|---|---|---|
| 0 | Repository privato | ✅ Superata | Metadati GitHub: `"private": true, "visibility": "private"` | — |
| 1 | Apertura e uso da Android | ✅ Superata | 6 aperture registrate in `visite`: 2 dall'**app Claude per Android** (Android 16, WebView `Claude/1.261106.19`, 360 px) e 4 da **Chrome per Android** (980 px). In tutte: archivio, connettori e download disponibili | In Chrome la larghezza era 980 px, probabile visualizzazione "sito desktop": da controllare la leggibilità |
| 2 | Stanza e memoria persistenti | ✅ Superata | Stanza creata dal telefono alle 06:20:07 e memoria alle 06:20:39; presenti nelle aperture successive (06:21, 06:22) e ancora nell'archivio | — |
| 3 | Connettore dall'artifact | ❌ **Lettura sessioni non disponibile** | Prima del consenso: 13 strumenti dichiarati (stato `unknown`). Dopo il consenso: **solo 2** effettivi, `list_environments` e `list_triggers`, entrambi in sola lettura. `list_sessions` rifiutato due volte con `blocked_by_policy` | Dalla pagina non si possono leggere né avviare sessioni. Si può leggere solo l'elenco delle attività pianificate e degli ambienti |
| 4 | Strumenti: conversazione vs artifact | ✅ Superata | Conversazione: 36 strumenti `claude-code-remote`. Artifact: 13 dichiarati → 2 concessi | La differenza è imposta dalla piattaforma (`blocked_by_policy`), non dalla pagina |
| 5 | Esportazione e ripristino identici | ✅ Superata | Dalla pagina: impronta file `4e666f21…284c` = impronta dopo il ripristino (`identico: true`). Controllo incrociato in Node sugli stessi dati: stessa impronta, `diff -r` senza differenze. Da Claude Code: `a249cb5e…2d6d` identica | Il download chiede conferma; il ripristino richiede di scegliere il file a mano |
| 6 | Backup archivio → repository | ✅ Superata (manuale) · 🟡 indiretta (non interattiva) | Questa sessione: `ArtifactData list` → `strumenti/backup.mjs` → `backup/backup-fittizio.json`. Una sessione separata, senza persona collegata, ha letto `stanze` senza richieste di permesso | Una **sessione pianificata** non è stata provata (nessuna pianificazione attivata) |
| 7 | Limiti dell'archivio | ✅ Superata in parte | 25.000 documenti per artifact (riportato dal servizio); 300 KiB rifiutato dallo strumento ("307233 byte, limite 262144"); 250 KiB accettato e poi eliminato. Dalla pagina: nessun documento di prova rimasto in `prove_limiti` | Tetto di dimensione totale non pubblicato; errore documentato `quota_exceeded`. Esito del pulsante sulla pagina non registrato: non so se è stato premuto |

## Conseguenza per l'architettura

L'opzione A regge per **memoria, stanze, esportazione e ripristino**. Non regge per il **collegamento diretto agli agenti dalla pagina**.
Alternativa concreta: una sessione Claude Code (che ha tutti gli strumenti) legge lo stato reale delle sessioni e lo scrive nell'archivio dell'artifact; la pagina lo mostra con l'orario dell'ultimo aggiornamento e la scritta "non in tempo reale". La lettura dell'archivio da una sessione senza persona è provata; l'esecuzione pianificata no.

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

## Prova dal telefono (eseguita)

1. Apri il link dell'artifact da Chrome (e, se possibile, dall'app Claude).
2. Crea una stanza e una memoria fittizie, chiudi tutto, riapri: devono esserci ancora.
3. Premi "Elenca strumenti" e poi "Leggi stato sessioni", concedendo il consenso quando richiesto.
4. Premi "Esporta JSON", poi carica lo stesso file in "File da ripristinare": deve comparire "Ripristino identico".
5. Facoltativo: "Prova documento da 300 KiB" deve essere rifiutato.

Poi scrivimi "fatto": rileggo `visite`, `prove_connettore` e `prove_ripristino` e completo la tabella.
