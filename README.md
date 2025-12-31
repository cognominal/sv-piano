# Piano Chord Sync

A Svelte 5 app for chord practice and MIDI playback. It connects to a
MIDI keyboard, highlights notes on a virtual piano, and provides a MIDI
player with looping, seeking, and sheet music generation.

## Features

- Web MIDI connection with live note feedback
- 88-key virtual piano with expected/active/correct states
- Chord progression table with navigation and accuracy
- MIDI player at `/midi` with:
  - File picker and auto-play on load
  - Playback speed control
  - Seek slider with delayed restart
  - Loop range markers + loop toggle
  - Piano-roll timeline with clickable notes
  - Sampled piano fallback when no MIDI output
- Sheet music rendering from MIDI via a server endpoint

## Sheet Music Pipeline (disabled)

The `/api/partition` endpoint converts MIDI to MusicXML using `music21`.
The `/midi` page posts the selected MIDI file and renders MusicXML with
OpenSheetMusicDisplay.

### Requirements

- Python 3
- music21

Install music21:

```bash
python3 -m pip install music21
```

## Getting Started

Install dependencies:

```bash
bun install
# or
npm install
```

Run the dev server:

```bash
bun run dev
# or
npm run dev
```

Open:

- Home: `http://localhost:5173/`
- MIDI player: `http://localhost:5173/midi`

## Notes

- The MIDI player stores the last file and position in the browser.
- The loop toggle uses full-file looping if no range is marked.

## License

MIT
