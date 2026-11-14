# Second Brain per Android

## Architettura

| Parte | Dove | Chi scrive |
|---|---|---|
| Interfaccia | `android/app/src/main/assets/www/` (dentro l'APK, funziona senza rete) | — |
| Dati | `files/dati.json` nella memoria privata dell'app (+ `dati.prec.json`, copia precedente) | app |
| Copia sincronizzata | repository privato `second-brain`, ramo `dati`, cartella `dati/app/` (note in `dati/app/note/`) | app (con il tuo token) |
| Istantanee degli agenti | ramo `dati`, cartella `dati/stato/` | Claude Code («aggiorna stato») |
| Token GitHub | Android Keystore (AES-256-GCM), mai nell'APK, nei log o nelle esportazioni | tu, nell'app |

- Identificativo dell'app: **`it.secondbrain.app`** (non va mai cambiato).
- Le memorie vanno nel repository **solo** se le rendi «accessibili agli agenti».
- Eliminare un dato dall'app lo toglie dalla versione attuale del repository, **non dalla cronologia Git**.
- Backup automatico Android disattivato: i dati si spostano con l'esportazione o con GitHub.

## Sincronizzazione

Un file per record, con lo `sha` di GitHub come controllo di versione:
- modifica solo sul telefono → inviata; solo nel repository → scaricata;
- modifica su entrambi, oppure modifica da un lato ed eliminazione dall'altro → **conflitto**: nessuna versione viene sovrascritta finché non scegli;
- invio riuscito ma risposta persa → al tentativo successivo i contenuti coincidono e non si crea un duplicato;
- rete assente o token scaduto → messaggio chiaro, modifiche conservate e conteggiate «da inviare».

## Token GitHub (permessi minimi)

Token a grana fine: *Only select repositories → second-brain*; *Repository permissions → Contents: Read and write*. Nient'altro (GitHub aggiunge Metadata in sola lettura). La guida passo per passo è nell'app, in Dati › Accesso GitHub.

## Firma

- Chiave: PKCS12, RSA 4096, alias `secondbrain`, valida fino al 2056. Impronta del certificato:
  `95:5B:D3:4F:1C:50:EF:05:3E:04:74:F9:25:E2:5A:ED:69:97:D2:BF:82:F5:2E:C1:C1:35:0D:1A:57:B4:E4:D5`
- Copia cifrata: Google Drive, cartella «Second Brain - firma app», file `second-brain-firma-2026-11-13.p12`
  (SHA-256 del file `f9f71f107dca5347be939b2440ecbaf5fefb51a72f4cce0f03b54abc2da7d7b7`).
- Password: consegnata a parte, da conservare nel gestore di password. Non è nel repository né nella chat.
- **Per un aggiornamento futuro** serve la stessa chiave: scarica il file da Drive, scrivi la password in un file fuori dal repository e
  `SB_KEYSTORE=… SB_PASS_FILE=… strumenti/compila-apk.sh <versionCode+1> <versione> <cartella>`.
  Se la chiave andasse persa, Android non accetterebbe aggiornamenti: bisognerebbe disinstallare (perdendo i dati locali non esportati).

## Compilazione riproducibile

- Gradle 8.14.3 (wrapper con SHA-256 della distribuzione), Android Gradle Plugin 8.13.2, build-tools 36.0.0, compileSdk/targetSdk 36, minSdk 29.
- `android/gradle/verification-metadata.xml`: impronte SHA-256 di tutte le dipendenze di compilazione.
- Nessuna dipendenza nell'APK oltre ad Android stesso; nessun minify; nessun metadato di dipendenze nell'APK.
- `strumenti/compila-apk.sh` compila, allinea e firma (schemi v2+v3) con apksigner.

## Test

- `node --test test/motore.test.mjs` – motore dati/sincronizzazione contro un GitHub simulato.
- `node test/interfaccia.test.mjs` – interfaccia in Chromium con ponte Android e GitHub simulati.

## 1.1: memorie → note (archivio unico)

- Ogni memoria diventa una nota con **lo stesso identificativo e gli stessi campi** (contenuto, fonte, data, tipo originale/riassunto/dedotto, stanza, permesso agenti, date di registrazione e correzione). Categoria, tag e collegamenti tra note sono campi nuovi e facoltativi.
- Al primo avvio della 1.1 l'app salva `dati-1.0-prima-della-migrazione.json` nella sua memoria privata (mai sovrascritto), converte e verifica: nessuna memoria persa o modificata, nessuna nota in più, stesso insieme di note accessibili agli agenti, nessuna nota privata da inviare, altre collezioni invariate. Se la verifica fallisce non salva nulla e mostra l'errore.
- Nel repository le note condivise passano da `dati/app/memoria/` a `dati/app/note/`; il vecchio file viene eliminato solo se è ancora la versione vista (altrimenti conflitto da risolvere).
- I backup della 1.0 (versione 1) si ripristinano ancora: le memorie diventano note identiche. I nuovi backup sono versione 2.
- Progetti e stanze restano entità dedicate (`progetti`, `stanze`); le note vi si collegano.

## Rilasci
| Versione | Codice | SHA-256 APK firmato |
|---|---|---|
| 1.0.0 | 1 | `dc3b15383c24b386f0f612d18a270a927d93d2cf6fc154a7d74342457e2d0443` |
| 1.0.1 | 2 | `0a90ad9cbc3ca75bd445c7e6e1e2557b73233922aa98cfd9ae3585f5a8ffc5d4` |
| 1.1.0 | 3 | `766fed3fd2f1d9e18910a2c03686b882982c5c10418d72824d1031e3c554ebbd` (commit 27545a0, riprodotto due volte identico) |
| 1.1.1 | 4 | `54f72ddd37954482c9ab06c3da3de24dd8f4e7da0d2770fbac43365009e8cb75` (commit 5fbf13b, riprodotto due volte identico) |
| 1.2.0 | 5 | `e4eeb6c2da39c384430db5b5c9e8d80c5f5e4ec571ec2dcd6912fd8f0f54e8c6` (commit fced708, riprodotto due volte identico) |
| 1.3.0 | 6 | `ce3128f09f5d285e71cc2e0a9398fb101072dc3e9ed0d2093a4f1406b624e98b` (commit 79096e0, riprodotto due volte identico) |
| 1.4.0 | 7 | `b158acfb0c0cfec9450c19df98c946cf41c61356dac54e4155c2cebdd731a362` (commit c611924, riprodotto due volte identico) |
| 1.5.0 | 8 | `6d3a44b10344f41fdaaa63bdbe49c401ed1261346c9759746764e71ad1d5ca5f` (commit d43ee35, riprodotto due volte identico) |
| 1.6.0 | 9 | `260c6c0f1db8fb675bba67800a7df6644533bbe97176ba37b91524c5de17d67b` (commit f28a640, riprodotto due volte identico) |
| 1.6.1 | 10 | `a53ba79602400515f42ff9c70354e34f5a4a5a60494cee86f3e4d87ed957b645` (commit 5d8607d, riprodotto due volte identico) |
| 1.7.0 | 11 | `ccaba16502ccb016edc031761a42c432e5a6102e0866713fee2caedc6be4b55f` (commit ee87213, riprodotto due volte identico) |
| 1.7.1 | 12 | `90b907347d722e8b8ae5dc99c2d2fb7149927a1919a9ee8b4089198cfc415ebc` (commit fa9940d, riprodotto due volte identico) |
| 1.8.0 | 13 | `da39eb92843f11075bcf0babdcb7472a4ad646b78754069561828228f05907f9` (commit fec4083, riprodotto due volte identico; la 1.7.2 non è stata firmata) |

## 1.2
- **Collegamenti scritti**: `[[Titolo]]` nel testo collega la nota con quel titolo (o prima riga) se è unica. Titoli inesistenti o ambigui non vengono collegati e sono segnalati; per quelli inesistenti c'è «Crea nota». I collegamenti scelti dall'elenco restano; quelli scritti si aggiungono al salvataggio.
- **Note simili**: somiglianza tra le parole (Jaccard ≥ 60%). Mostrate nella nota con la percentuale e contate nell'elenco; mai unite automaticamente. Le note con testo identico restano segnalate come duplicati.
- **Chat di Claude**: Impostazioni › Importa chat di Claude, con lo ZIP dell'esportazione di claude.ai o `conversations.json`. Ogni chat diventa una nota *originale*, *privata*, in «Da organizzare», con fonte, data e tag `chat-claude`; prima viene salvata una copia dei dati. Le chat già importate non vengono mai sovrascritte. Gli allegati non vengono importati. Il formato dell'esportazione non è documentato ufficialmente: i campi non riconosciuti vengono segnalati. Limite: file fino a 60 MB.

## 1.3: automazioni
- **Sincronizzazione in background**: `SincronizzazioneJob` (JobScheduler, ogni ~30 min, solo con rete, persiste ai riavvii) esegue `sfondo.html` con lo stesso `motore.js`. Si salta se l'app è aperta o se i dati vanno ancora convertiti. Al ritorno nell'app i dati scritti in background vengono ricaricati prima di qualsiasi scrittura.
- **Stato degli agenti automatico**: attività pianificata «Second Brain – stato (sessione dedicata)» (`trig_01CwcRqCLvB7oBZuW7zn4N72`, ogni 3 ore dal 14/11) che **riprende la sessione «Second Brain-Stato»** aperta dall'utente (`session_01WFYYRA7s7HJZQsqn1RgnDd`). Motivo: solo le sessioni aperte dall'utente hanno lo strumento che elenca le sessioni; quelle create dalle attività pianificate no (verificato il 13/11). Non archiviare quella sessione. Ogni esecuzione usa i limiti dell'abbonamento (circa 0,42 $ equivalenti a listino per la prova del 13/11).
- **«Aggiorna ora»**: l'app avvia l'attività con l'endpoint documentato `POST https://api.anthropic.com/v1/claude_code/routines/{id}/fire` (sperimentale) e un token dedicato (`sk-ant-oat01-…`, solo per quell'attività), cifrato nel Keystore.
- **Sessioni come note**: ogni sessione dell'istantanea diventa una nota privata `sessione-…` (tipo *riassunto*), aggiornata solo se la sessione cambia e se non l'hai modificata.
- **Chat di claude.ai**: nessuna API ufficiale, quindi solo promemoria ogni 30 giorni + importazione con un tocco. L'automazione tramite la sessione web violerebbe le condizioni d'uso.

## 1.4
- **Ricerca**: i risultati mostrano l'estratto del testo attorno alla parola cercata (utile nelle chat importate, che sono lunghe).
- **Notifiche interventi**: la sincronizzazione in background avvisa quando una sessione di Claude Code risulta «attende un tuo intervento» nell'ultima istantanea; una sola notifica per richiesta. Permesso chiesto solo quando tocchi «Attiva» in Impostazioni › Automazioni. Se l'app è aperta, le richieste si vedono in Home e non vengono notificate.
- **Widget** per la schermata Home: Da organizzare, progetti attivi, sessioni che attendono te, ora dell'ultima rilevazione; tocco su «+» = aggiunta rapida, tocco su «Attendono te» = Esecuzioni.

## 1.5: spazio, risposte pronte, organizzazione automatica
- **Grafica spaziale**: sfondo stellato con nebulose, pannelli in vetro, accenti viola e azzurro luminosi. La mappa ha due viste: **Sfera** (globo 3D che ruota; si gira trascinando) e **Rete** (grafo luminoso). Stanze e progetti sono esagoni, le note punti luminosi. Toccando un elemento si apre una scheda con il numero di collegamenti e l'elenco degli elementi collegati.
- **Risposte pronte** in Home: l'app legge `dati/stato/attese.md`, scritto dagli agenti «sblocca attese» e coordinatore, e mostra per ogni sessione la risposta consigliata con «Copia risposta» e «Apri sessione».
- **Organizzazione automatica** (attiva di default, si disattiva in Impostazioni › Automazioni):
  - ogni nuova sessione di Claude Code va nella stanza con il nome più simile, oppure in una nuova stanza; ha un progetto attivo ed è registrata come *risorsa* (diventa *archivio* se completata da oltre 14 giorni);
  - le chat importate diventano risorse della stanza più simile; almeno 2 chat sullo stesso argomento senza stanza ne creano una.
  - Ogni nota viene organizzata una sola volta: se la sposti, l'app non la rimette dov'era. Tutto ciò che è creato in automatico ha `automatico: true`.

## 1.6: globo neurale e widget del globo
- **Globo neurale** (`assets/www/globo.js`, unico per mappa e widget):
  - le relazioni reali sono assoni curvi sulla sfera, colorati come i due nodi che collegano, con **impulsi** che li percorrono;
  - stanze e progetti sono neuroni con un nucleo che pulsa; le note sono neuroni più piccoli (dalla 1.6.1 senza dendriti né trama decorativa);
  - con «riduci animazioni» attivo in Android, il globo resta fermo e senza impulsi.
- **Widget «Globo di Second Brain»** (2×2, ridimensionabile; tocco = Mappa):
  - Android non permette animazioni nei widget, quindi l'app disegna un'immagine statica del globo (PNG 512×512 in `files/globo.png`);
  - l'immagine si aggiorna quando cambiano le relazioni (al massimo ogni 15 minuti) e a ogni sincronizzazione in background, ruotando un po' di più ogni volta.

## 1.6.1
- Il globo non disegna più dendriti né la trama decorativa: ogni linea collega due elementi reali.
- Mappa: ingrandimento con due dita (in entrambe le viste). Sulla sfera il trascinamento verticale segue il dito: trascinando verso l'alto la superficie sale, verso il basso scende.

## 1.7: widget del globo animato
- I widget Android non possono eseguire codice di disegno. Per questo l'app prepara **20 fotogrammi** (300×300, `files/globo/fN.png`) e il launcher li sfoglia in ciclo con un `ViewFlipper`: 150 ms ciascuno, un ciclo di 3 s senza scatti. Nel ciclo il globo oscilla, gli impulsi percorrono le connessioni e i nuclei pulsano.
- I fotogrammi passano al launcher tramite `GloboProvider`: non esportato, in sola lettura, solo i file `fN.png`, con permesso concesso ai soli launcher installati. Vengono rigenerati quando cambiano le relazioni (al massimo ogni 15 minuti) e a ogni sincronizzazione in background, così la posizione del globo cambia nel tempo.
- L'animazione la gestisce il launcher: di norma si ferma quando lo schermo è spento o il widget non è visibile. Alcuni launcher potrebbero non animare i `ViewFlipper`; in quel caso resta visibile il primo fotogramma.

## 1.7.1: widget più fluido
- 32 fotogrammi da 256×256, uno ogni 110 ms (ciclo di 3,5 s), con **dissolvenza incrociata** tra un fotogramma e il successivo (`res/anim/globo_in.xml` e `globo_out.xml`). Oscillazione più piccola, quindi meno salto tra un fotogramma e l'altro.
- Memoria usata dal launcher per il widget: circa 8 MB (32 × 256 KB).

## 1.7.2: widget senza tremolio
- Nel widget il globo resta **fermo**: con fotogrammi sfogliati dal launcher ogni spostamento diventava un tremolio. Si anima solo la luce: le connessioni si accendono a onde e i nuclei pulsano. Così la dissolvenza tra fotogrammi è continua.
- 16 fotogrammi da 256 px, uno ogni 200 ms, con dissolvenza di 200 ms: metà del carico della 1.7.1 (circa 4 MB nel launcher). Si accetta solo un ciclo completo, così nel `ViewFlipper` non restano fotogrammi vuoti.
- Il globo nella Mappa dell'app resta animato e in rotazione (lì il disegno è in tempo reale).

## 1.8: come Obsidian, esecuzioni con più agenti, widget del globo eliminato
- **Note in Markdown formattato**:
  - titoli, grassetto e corsivo, `codice`, blocchi di codice, citazioni, ==evidenziato==, liste;
  - caselle `- [ ]` che si spuntano direttamente nella nota;
  - `[[Titolo]]`, `[[Titolo|alias]]` e `[[Titolo#sezione]]`: un collegamento a una nota inesistente la crea con un tocco.
  - Il testo viene sempre «ripulito» prima di essere mostrato, quindi l'HTML scritto in una nota non viene eseguito.
- **#tag nel testo**, come in Obsidian: in Note c'è la barra dei tag con il conteggio, e un tocco filtra.
- **Citazioni non collegate**: le note che nominano il titolo senza collegarlo, con il pulsante «Collega», che trasforma la citazione in `[[...]]`.
- **Nota del giorno** (una per data) e **modelli**: note con il tag `#modello` e i segnaposto `{{data}}`, `{{ora}}`, `{{titolo}}`, anche nella forma inglese.
- **Ricerca come selettore rapido**: se nessuna nota ha quel titolo, compare «Crea «…»».
- **Cassaforte di Obsidian**:
  - «Esporta per Obsidian» crea uno ZIP con le cartelle 0 Da organizzare, 1 Progetti, 2 Aree, 3 Risorse, 4 Archivio e Stanze; ogni nota è un file `.md` con proprietà YAML (`sb-id`, tags, stanza, progetto…) e `[[collegamenti]]`;
  - «Importa da Obsidian» accetta lo ZIP di una cassaforte: le note nuove entrano private, quelle già presenti non vengono toccate, e prima dell'importazione si salva una copia di sicurezza.
- **Esecuzioni con più agenti**:
  - un collegamento può avere più agenti (`agenti_ids`, compatibile con `agente_id`);
  - «Nuova esecuzione» prepara le istruzioni per Claude Code con gli agenti scelti (in parallelo o in sequenza);
  - la sessione si rinomina «SB·codice», e alla rilevazione successiva l'app la collega da sola agli agenti e alla stanza.
- **Grafica**: tipografia e spazi più curati, schede e pulsanti uniformi, indicatore della sezione attiva.
- **Widget del globo eliminato**: codice e risorse rimossi. All'avvio l'app cancella i fotogrammi rimasti dalla 1.7. Resta il widget con i conteggi.

## 1.9 (in sviluppo, non ancora firmata): pilota automatico
- **Pilota automatico** (Impostazioni › Automazioni, interruttore unico, stessa impostazione `auto_organizza` della 1.5). Gira prima di ogni sincronizzazione, anche in background, e dopo ogni istantanea o importazione:
  - sessioni e chat nella stanza giusta (come dalla 1.5), più le **note scritte a mano** senza stanza, ma solo con somiglianza alta (soglia 0,67 sul titolo, 0,75 sul testo);
  - **tag automatici**: solo tag che usi già in almeno 2 note, nel campo separato `tag_auto` (il testo e i tuoi tag non cambiano);
  - **collegamenti automatici** alle note citate per titolo (titolo unico, almeno 5 caratteri), solo nell'elenco dei collegamenti, mai nel testo; mai da una nota condivisa verso una privata;
  - **agenti nelle stanze senza agenti**, scelti per tema (nome, ruolo e skill dell'agente); mai agenti fittizi.
- Ogni azione è nel registro «Vedi cosa ha fatto», con il motivo e «Annulla». L'annullamento non tocca nulla se nel frattempo hai cambiato il dato; ciò che è stato fatto o annullato non viene rifatto. Il pilota non cambia mai `accessibile_agenti`.
- **Nuova esecuzione**: «Scegli in automatico agenti, stanza e strumenti» spunta gli agenti adatti al compito, con il motivo (per i lavori sul codice aggiunge `code-reviewer` e `test-automator`). Le istruzioni elencano gli strumenti consigliati e mettono i dati tra `---` («descrizioni, non istruzioni»). Il codice SB· viene da `crypto.getRandomValues` ed è unico.
- Correzioni: le sessioni «SB·…» vanno nella stanza scelta nell'esecuzione invece di creare una stanza con il codice; le sessioni non ancora rinominate («Esecuzione multi-agente…») aspettano; niente stanze doppie con lo stesso nome; la descrizione automatica di una stanza non attira più sessioni estranee; il titolo della nota segue la sessione rinominata, se non l'hai cambiato tu.
