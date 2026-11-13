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

## 1.2
- **Collegamenti scritti**: `[[Titolo]]` nel testo collega la nota con quel titolo (o prima riga) se è unica. Titoli inesistenti o ambigui non vengono collegati e sono segnalati; per quelli inesistenti c'è «Crea nota». I collegamenti scelti dall'elenco restano; quelli scritti si aggiungono al salvataggio.
- **Note simili**: somiglianza tra le parole (Jaccard ≥ 60%). Mostrate nella nota con la percentuale e contate nell'elenco; mai unite automaticamente. Le note con testo identico restano segnalate come duplicati.
- **Chat di Claude**: Impostazioni › Importa chat di Claude, con lo ZIP dell'esportazione di claude.ai o `conversations.json`. Ogni chat diventa una nota *originale*, *privata*, in «Da organizzare», con fonte, data e tag `chat-claude`; prima viene salvata una copia dei dati. Le chat già importate non vengono mai sovrascritte. Gli allegati non vengono importati. Il formato dell'esportazione non è documentato ufficialmente: i campi non riconosciuti vengono segnalati. Limite: file fino a 60 MB.
