---
name: music-gen
description: Generate music and audio from scratch — melodies, chord progressions, full arrangements, sound effects, or simple tones. Produces playable audio files (WAV/MP3) using system utilities. Use this skill whenever the user wants to create, compose, generate, or synthesize music or sound, mentions MIDI, melodies, chords, beats, a "track", a "tune", a jingle, background music, or asks to turn a musical idea/description into an audio file — even if they don't say the word "music" explicitly.
---

# Music Generation

This skill generates music by composing it as MIDI (where Claude's music-theory
knowledge is strongest), then rendering MIDI to real instrument sounds with a
SoundFont. It falls back to direct waveform synthesis when no MIDI toolchain is
available.

## Decision: which route?

1. **Melodies, chords, arrangements, songs** → MIDI route (default). Compose with
   `mido`, render with `scripts/render.sh`. Best quality, real instruments.
2. **Tones, beeps, sirens, sweeps, simple SFX** → direct synth with `sox`/`ffmpeg`.
   No SoundFont needed. See "Direct synthesis" below.
3. **"Generate a track that sounds like <artist/genre>" (AI text-to-music)** → this
   skill does NOT do that. Tell the user it needs a model (local MusicGen via
   `audiocraft`, or a cloud service like Suno/Replicate behind an MCP server), not
   system utilities, and offer to help set that up separately.

## Step 0 — Detect the toolchain (always do this first)

Run the probe before composing so you know which route is viable:

```bash
bash scripts/render.sh --check
```

It reports which of `fluidsynth`, `timidity`, `sox`, `ffmpeg`, `python3 + mido`
are present, and whether a SoundFont was found. Do not assume tools exist — Claude
Code runs on many machines. If something needed is missing, tell the user the exact
install command for their OS instead of failing silently:

- macOS (Homebrew): `brew install fluid-synth sox ffmpeg && pip install mido`
- Debian/Ubuntu: `sudo apt install fluidsynth fluid-soundfont-gm sox ffmpeg && pip install mido`
- The GM SoundFont (`FluidR3_GM.sf2` or `default-GM.sf2`) is the one part people
  most often lack. `render.sh` looks in common locations; if none found, point the
  user to the `fluid-soundfont-gm` package (Linux) or a free download.

## Step 1 — Compose the MIDI

Write a Python script using `mido` that builds the MIDI programmatically. Keep
real musical structure in mind: pick a key and tempo, build chord progressions,
voice them across tracks (melody / chords / bass / drums on channel 9), use note
velocities for dynamics, and respect note-off timing so notes don't hang.

`scripts/melody_example.py` is a working reference — a short multi-track piece in
C major. Read it for the patterns (track setup, program changes, note on/off
deltas, the channel-9 drum convention) and adapt rather than copying blindly.
General MIDI program numbers matter: e.g. 0 = Acoustic Grand Piano, 24 = Nylon
Guitar, 32 = Acoustic Bass, 48 = Strings. Drums always go on channel 9.

Save the generated MIDI to the working directory (e.g. `song.mid`).

## Step 2 — Render to audio

```bash
bash scripts/render.sh song.mid song.wav          # WAV via best available renderer
bash scripts/render.sh song.mid song.mp3          # auto-converts to MP3 if ffmpeg present
```

`render.sh` tries `fluidsynth` first (best), then `timidity`, picks up a SoundFont
automatically, renders at 44.1 kHz, and converts to MP3 with `ffmpeg` if the output
name ends in `.mp3`. It exits non-zero with a clear message if no renderer or no
SoundFont is available — read its stderr and relay the fix to the user.

## Direct synthesis (route 2, no MIDI)

For tones and effects, skip MIDI entirely:

```bash
sox -n tone.wav synth 3 sine 440                              # 440 Hz, 3 s
sox -n chord.wav synth 4 sine 261 sine 329 sine 392 fade 0 4 1  # Cmaj chord, fade out
sox -n sweep.wav synth 2 sine 200-2000                        # rising sweep
ffmpeg -f lavfi -i "sine=frequency=440:duration=3" tone.wav   # ffmpeg equivalent
```

For melodies without a SoundFont, you can also generate raw samples in pure Python
with `wave` + `numpy` (additive synthesis / simple envelopes) — usable but sounds
synthetic; prefer the MIDI route when a SoundFont exists.

## Output conventions

- Write deliverables the user keeps to the outputs directory if one exists; tell
  them the path and present the file.
- Default to WAV for fidelity; offer MP3 if they want something smaller/shareable.
- Mention tempo, key, and instrumentation in your summary so the result is editable.
- Keep generated MIDI alongside the audio — it's the editable source.

## Notes

- This skill is deterministic: same script → same audio. There is no randomness
  unless you add it. If the user wants variation, seed and expose it.
- Do not claim "AI-generated music" — this is algorithmic composition + sampled
  instruments, which is a different (and honest) thing.
