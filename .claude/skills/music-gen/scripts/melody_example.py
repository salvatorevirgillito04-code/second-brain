#!/usr/bin/env python3
"""melody_example.py — reference for composing multi-track MIDI with mido.

A short 8-bar piece in C major: piano melody, sustained string chords, a bass
line, and a simple drum groove on channel 9. This is a *pattern reference* for
the music-gen skill — read it, understand the conventions, then write fresh
composition logic for whatever the user actually asked for. Don't just rerun it.

Run:  python3 melody_example.py song.mid
Then: bash render.sh song.mid song.wav
"""
import sys
from mido import Message, MidiFile, MidiTrack, MetaMessage, bpm2tempo

TPB = 480  # ticks per beat
BPM = 96

# General MIDI program numbers (0-indexed)
PIANO, STRINGS, BASS = 0, 48, 32

# C major scale degrees as MIDI note numbers (C4 = 60)
SCALE = [60, 62, 64, 65, 67, 69, 71, 72]
# Chord progression: C - Am - F - G (two bars each could be done; here one bar each, x2)
CHORDS = [
    [48, 52, 55],  # C  (C3 E3 G3)
    [45, 48, 52],  # Am (A2 C3 E3)
    [41, 45, 48],  # F  (F2 A2 C3)
    [43, 47, 50],  # G  (G2 B2 D3)
]


def add_notes(track, events):
    """events: list of (note, channel, velocity, start_beats, dur_beats).
    Converts absolute beat times into delta-time on/off messages."""
    msgs = []
    for note, ch, vel, start, dur in events:
        msgs.append((int(start * TPB), Message("note_on", note=note, channel=ch, velocity=vel)))
        msgs.append((int((start + dur) * TPB), Message("note_off", note=note, channel=ch, velocity=0)))
    msgs.sort(key=lambda m: m[0])
    prev = 0
    for abs_tick, msg in msgs:
        track.append(msg.copy(time=abs_tick - prev))
        prev = abs_tick


def main(out_path):
    mid = MidiFile(ticks_per_beat=TPB)

    # --- Tempo / meta track ---
    meta = MidiTrack(); mid.tracks.append(meta)
    meta.append(MetaMessage("set_tempo", tempo=bpm2tempo(BPM)))
    meta.append(MetaMessage("time_signature", numerator=4, denominator=4))

    # --- Melody (piano) ---
    mel = MidiTrack(); mid.tracks.append(mel)
    mel.append(Message("program_change", program=PIANO, channel=0))
    melody_pattern = [0, 2, 4, 2, 5, 4, 2, 0]  # scale-degree indices, one per beat
    mel_events = []
    for bar in range(4):
        for beat, deg in enumerate(melody_pattern):
            start = bar * 8 + beat  # 8 beats spanned below; keep simple 1/beat
            if start >= 32:
                break
            mel_events.append((SCALE[deg], 0, 90, start, 0.9))
    add_notes(mel, mel_events)

    # --- Chords (strings), one chord per 2 beats, looping the progression ---
    chd = MidiTrack(); mid.tracks.append(chd)
    chd.append(Message("program_change", program=STRINGS, channel=1))
    chd_events = []
    for i in range(8):  # 8 chord slots over 32 beats (4 beats each)
        chord = CHORDS[i % len(CHORDS)]
        for n in chord:
            chd_events.append((n, 1, 60, i * 4, 3.8))
    add_notes(chd, chd_events)

    # --- Bass: root of each chord, on the beat ---
    bs = MidiTrack(); mid.tracks.append(bs)
    bs.append(Message("program_change", program=BASS, channel=2))
    bs_events = []
    for i in range(8):
        root = CHORDS[i % len(CHORDS)][0] - 12  # one octave down
        for beat in range(4):
            bs_events.append((root, 2, 75, i * 4 + beat, 0.9))
    add_notes(bs, bs_events)

    # --- Drums on channel 9: kick (36) on 1&3, snare (38) on 2&4, hat (42) every beat ---
    dr = MidiTrack(); mid.tracks.append(dr)
    dr_events = []
    for beat in range(32):
        dr_events.append((42, 9, 70, beat, 0.25))            # closed hat
        if beat % 4 in (0, 2):
            dr_events.append((36, 9, 100, beat, 0.25))        # kick
        if beat % 4 in (1, 3):
            dr_events.append((38, 9, 90, beat, 0.25))         # snare
    add_notes(dr, dr_events)

    mid.save(out_path)
    print(f"wrote {out_path}  ({BPM} BPM, C major, ~{32/ (BPM/60):.0f}s)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else "song.mid")
