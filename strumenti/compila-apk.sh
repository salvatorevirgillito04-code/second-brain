#!/usr/bin/env bash
# Compila e firma l'APK di Second Brain in modo ripetibile.
#
# Uso:
#   SB_KEYSTORE=/percorso/second-brain-firma.p12 SB_PASS_FILE=/percorso/password.txt \
#   strumenti/compila-apk.sh <versionCode> <versionName> <cartella_uscita>
#
# Requisiti: JDK 17+, Android SDK con build-tools 36.0.0 e platform 36 (ANDROID_HOME o android/local.properties).
# La chiave e la password restano FUORI dal repository: lo script le legge solo dai percorsi indicati.
# Identificativo fisso: it.secondbrain.app. Alias della chiave: secondbrain.
set -euo pipefail
CODICE="${1:?versionCode}"; NOME="${2:?versionName}"; OUT="${3:?cartella di uscita}"
: "${SB_KEYSTORE:?percorso del keystore}"; : "${SB_PASS_FILE:?file con la password}"
RADICE="$(cd "$(dirname "$0")/.." && pwd)"
SDK="${ANDROID_HOME:-$(sed -n 's/^sdk.dir=//p' "$RADICE/android/local.properties" 2>/dev/null)}"
BT="$SDK/build-tools/36.0.0"
[ -x "$BT/apksigner" ] || { echo "build-tools 36.0.0 non trovati in $SDK" >&2; exit 1; }
case "$(git -C "$RADICE" status --porcelain -- android)" in "") ;; *) echo "ATTENZIONE: modifiche non salvate in android/ (la build non corrisponde a un commit)" >&2;; esac

export SOURCE_DATE_EPOCH="$(git -C "$RADICE" log -1 --format=%ct)"
cd "$RADICE/android"
./gradlew -q --no-daemon --max-workers=1 clean assembleRelease -PsbVersionCode="$CODICE" -PsbVersionName="$NOME"
mkdir -p "$OUT"
NON_FIRMATO="app/build/outputs/apk/release/app-release-unsigned.apk"
ALLINEATO="$OUT/second-brain-$NOME-allineato.apk"
FINALE="$OUT/second-brain-$NOME.apk"
"$BT/zipalign" -f -p 4 "$NON_FIRMATO" "$ALLINEATO"
"$BT/apksigner" sign --ks "$SB_KEYSTORE" --ks-type PKCS12 --ks-key-alias secondbrain \
  --ks-pass "file:$SB_PASS_FILE" \
  --v1-signing-enabled false --v2-signing-enabled true --v3-signing-enabled true \
  --out "$FINALE" "$ALLINEATO"
rm -f "$ALLINEATO" "$FINALE.idsig"
"$BT/apksigner" verify --verbose --print-certs "$FINALE" | grep -E "Verified using|Signer #1 certificate SHA-256"
echo "non firmato sha256: $(sha256sum "$NON_FIRMATO" | cut -d' ' -f1)"
echo "APK firmato sha256: $(sha256sum "$FINALE" | cut -d' ' -f1)  $FINALE"
