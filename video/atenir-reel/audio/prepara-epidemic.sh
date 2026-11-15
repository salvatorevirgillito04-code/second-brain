#!/bin/sh
# Prepara la traccia Epidemic Sound per il reel (il file originale NON va nel repository: licenza).
# Ingresso: audio/epidemic/summer-city-edit.wav (versione da 18,804 s di «Summer City (Instrumental Version)»,
# Chasing Madison, creata con lo strumento di modifica di Epidemic Sound).
# 97 → 96 BPM (atempo 0,98969), -40 ms per mettere i tagli del video sul battito, 19,00 s esatti,
# dissolvenza finale, -14 LUFS / picco -1 dBTP.
set -e
cd "$(dirname "$0")/epidemic"
ffmpeg -hide_banner -loglevel error -y -i summer-city-edit.wav \
  -af "atempo=0.989690,atrim=start=0.040,asetpts=PTS-STARTPTS,apad=whole_dur=19,afade=t=out:st=18.4:d=0.6,loudnorm=I=-14:TP=-1:LRA=11,volume=-1.4dB,aresample=44100" \
  -t 19 -c:a pcm_s16le colonna-epidemic.wav
echo "OK $(pwd)/colonna-epidemic.wav"
