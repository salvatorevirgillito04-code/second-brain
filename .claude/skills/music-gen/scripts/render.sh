#!/usr/bin/env bash
# render.sh — render a MIDI file to audio using the best available toolchain.
#
# Usage:
#   render.sh --check                 # probe the environment, report what's available
#   render.sh in.mid out.wav          # render to WAV (fluidsynth > timidity)
#   render.sh in.mid out.mp3          # render, then convert to MP3 (needs ffmpeg)
#
# Exits non-zero with a clear message if no renderer or no SoundFont is found.

set -euo pipefail

SAMPLE_RATE=44100

# Common SoundFont locations across distros / Homebrew.
SOUNDFONT_CANDIDATES=(
  "$HOME/.local/share/soundfonts/FluidR3_GM.sf2"
  "/usr/share/sounds/sf2/FluidR3_GM.sf2"
  "/usr/share/sounds/sf2/default-GM.sf2"
  "/usr/share/soundfonts/FluidR3_GM.sf2"
  "/usr/share/soundfonts/default.sf2"
  "/opt/homebrew/share/fluid-soundfont/FluidR3_GM.sf2"
  "/usr/local/share/fluid-soundfont/FluidR3_GM.sf2"
)

have() { command -v "$1" >/dev/null 2>&1; }

find_soundfont() {
  if [[ -n "${SOUNDFONT:-}" && -f "${SOUNDFONT}" ]]; then
    echo "$SOUNDFONT"; return 0
  fi
  for sf in "${SOUNDFONT_CANDIDATES[@]}"; do
    [[ -f "$sf" ]] && { echo "$sf"; return 0; }
  done
  return 1
}

do_check() {
  echo "== music-gen toolchain check =="
  for t in fluidsynth timidity sox ffmpeg python3; do
    if have "$t"; then echo "  [ok]   $t"; else echo "  [MISS] $t"; fi
  done
  if have python3 && python3 -c "import mido" 2>/dev/null; then
    echo "  [ok]   python mido module"
  else
    echo "  [MISS] python mido module  (pip install mido)"
  fi
  if sf=$(find_soundfont); then
    echo "  [ok]   SoundFont: $sf"
  else
    echo "  [MISS] SoundFont (.sf2)  — needed for MIDI rendering"
    echo "         Linux:  sudo apt install fluid-soundfont-gm"
    echo "         or set SOUNDFONT=/path/to/your.sf2"
  fi
  echo "Render path: $(have fluidsynth && echo fluidsynth || (have timidity && echo timidity || echo 'NONE — install fluidsynth'))"
}

if [[ "${1:-}" == "--check" ]]; then
  do_check
  exit 0
fi

if [[ $# -lt 2 ]]; then
  echo "usage: render.sh in.mid out.{wav,mp3}   (or: render.sh --check)" >&2
  exit 2
fi

IN="$1"; OUT="$2"
[[ -f "$IN" ]] || { echo "error: input MIDI not found: $IN" >&2; exit 1; }

# If the user wants mp3, render to a temp wav first, then convert.
TARGET_WAV="$OUT"
WANT_MP3=0
if [[ "$OUT" == *.mp3 ]]; then
  WANT_MP3=1
  TARGET_WAV="${OUT%.mp3}.tmp.wav"
fi

render_with_fluidsynth() {
  local sf; sf=$(find_soundfont) || return 1
  fluidsynth -ni "$sf" "$IN" -F "$TARGET_WAV" -r "$SAMPLE_RATE" >/dev/null 2>&1
}

render_with_timidity() {
  timidity "$IN" -Ow -o "$TARGET_WAV" -s "$SAMPLE_RATE" >/dev/null 2>&1
}

if have fluidsynth && find_soundfont >/dev/null 2>&1; then
  render_with_fluidsynth
elif have timidity; then
  render_with_timidity
else
  {
    echo "error: no usable MIDI renderer."
    echo "  - install fluidsynth + a GM SoundFont, or"
    echo "  - install timidity"
    echo "Run 'render.sh --check' for details."
  } >&2
  exit 1
fi

[[ -f "$TARGET_WAV" ]] || { echo "error: rendering produced no output" >&2; exit 1; }

if [[ "$WANT_MP3" -eq 1 ]]; then
  if ! have ffmpeg; then
    echo "error: mp3 requested but ffmpeg not installed. WAV is at: $TARGET_WAV" >&2
    exit 1
  fi
  ffmpeg -y -i "$TARGET_WAV" -codec:a libmp3lame -qscale:a 2 "$OUT" >/dev/null 2>&1
  rm -f "$TARGET_WAV"
  echo "rendered: $OUT (mp3)"
else
  echo "rendered: $OUT (wav, ${SAMPLE_RATE} Hz)"
fi
