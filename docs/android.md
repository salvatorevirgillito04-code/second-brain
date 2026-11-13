# Second Brain per Android

## Architettura

| Parte | Dove | Chi scrive |
|---|---|---|
| Interfaccia | `android/app/src/main/assets/www/` (dentro l'APK, funziona senza rete) | — |
| Dati | `files/dati.json` nella memoria privata dell'app (+ `dati.prec.json`, copia precedente) | app |
| Copia sincronizzata | repository privato `second-brain`, ramo `dati`, cartella `dati/app/` | app (con il tuo token) |
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
