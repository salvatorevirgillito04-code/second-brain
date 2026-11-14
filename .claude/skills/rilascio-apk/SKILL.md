---
name: rilascio-apk
description: Compila, firma e verifica un nuovo APK di Second Brain (stessa chiave, stesso identificativo, versionCode +1). Usala quando l'utente chiede una nuova versione dell'app.
---
1. Esegui i test: `node --test test/motore.test.mjs` e `node test/interfaccia.test.mjs`. Devono passare tutti; fai prima il commit del codice.
2. Password: l'utente la inserisce nella pagina di consegna (mai in chat). Ricostruisci la chiave dalla copia su Drive e controlla l'impronta del certificato con keytool (`docs/android.md` › Firma).
3. Compila due volte: `SB_KEYSTORE=… SB_PASS_FILE=… strumenti/compila-apk.sh <codice> <versione> <cartella>`. Poi `cmp` deve trovare i due file identici.
4. Controlla con `aapt2 dump badging` versionCode e permessi. Nessuna password e nessun token (`github_pat_…`, `sk-ant-oat01-…`) nell'APK estratto.
5. Elimina la password dalla pagina di consegna e distruggi con `shred` i file temporanei.
6. Aggiungi la riga della versione in `docs/android.md` › Rilasci, fai commit e push sul ramo di lavoro, poi consegna APK e SHA256SUMS.
7. Separa ciò che hai provato in simulazione da ciò che l'utente deve verificare sul telefono.
