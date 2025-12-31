# Piano Chord Synchronization App - Specification

## Overview
A Svelte 5 web application that displays piano chord progressions and synchronizes in real-time with a Casio keyboard connected to Mac via USB/MIDI.

## Core Features

### 1. MIDI Integration
- **Web MIDI API**: Connect to Casio keyboard via browser MIDI support
- **Real-time Input**: Capture note on/off events from the keyboard
- **Device Detection**: Automatically detect and connect to Casio keyboard
- **Connection Status**: Visual indicator of MIDI connection status

### 2. Piano Visualization
- **Virtual Piano**: 88-key piano keyboard display
- **Key Highlighting**: Visual feedback when keys are pressed on physical keyboard
- **Chord Visualization**: Highlight chord notes in different colors (LH vs RH)
- **Note Labels**: Display note names on keys

### 3. Chord Progression Display
- **Progression Table**: Show bars, chords, and fingering information
- **Current Position**: Highlight the current bar being played
- **Left Hand (LH)**: Display chord names and individual notes with fingering
- **Right Hand (RH)**: Display melody notes with fingering numbers
- **Navigation**: Click bars to jump to specific positions

### 4. Synchronization Features
- **Auto-advance**: Move to next bar when chord is played correctly
- **Manual Navigation**: Click to select specific bars
- **Tempo Detection**: Detect playing tempo and adjust accordingly
- **Error Tolerance**: Allow slight timing variations in chord detection

### 5. Data Structure
```typescript
interface ChordProgression {
  bars: Bar[];
}

interface Bar {
  number: number;
  leftHand: {
    chord: string;
    notes: NoteWithFingering[];
  };
  rightHand: {
    notes: NoteWithFingering[];
  };
}

interface NoteWithFingering {
  note: string;  // e.g., "C5", "Eb2"
  fingering: number;  // 1-5 for fingers
}
```

## Technical Architecture

### Frontend Framework
- **Svelte 5**: Latest version with runes for reactive state management
- **TypeScript**: Type safety for MIDI and music theory objects
- **Vite**: Build tool and development server

### MIDI Integration
- **Web MIDI API**: Browser-native MIDI support
- **MIDI Message Parsing**: Convert raw MIDI to note events
- **Note Mapping**: Map MIDI note numbers to piano keys

### State Management
- **Svelte Runes**: `$state()` for reactive chord progression
- **MIDI State**: Track connected devices and current notes
- **Playback State**: Current bar, timing, and synchronization status

### Components Structure
```
src/
├── lib/
│   ├── components/
│   │   ├── PianoKeyboard.svelte
│   │   ├── ChordProgression.svelte
│   │   ├── MIDIConnection.svelte
│   │   └── FingeringDisplay.svelte
│   ├── stores/
│   │   ├── midi.svelte.ts
│   │   └── progression.svelte.ts
│   └── utils/
│       ├── midi-utils.ts
│       └── music-theory.ts
└── app.html
```

## User Interface

### Layout
1. **Header**: App title and MIDI connection status
2. **Piano Display**: Virtual 88-key keyboard with real-time highlighting
3. **Chord Progression**: Table showing bars, chords, and fingering
4. **Controls**: Play/pause, tempo, and navigation buttons

### Visual Design
- **Color Coding**: 
  - Blue for left hand chord notes
  - Green for right hand melody notes
  - Red for currently active/expected notes
- **Typography**: Clear, readable fonts for chord names and fingering
- **Responsive**: Works on desktop and tablet screens

## Sample Data Integration
The app will start with your provided chord progression:

```
Bar 1: C7 (C5-E3-G2-Bb1) | Melody: C1-Eb2-F3-Gb4-G1-Bb2-C3
Bar 2: F7 (F5-A3-C2-Eb1) | Melody: C1-Eb2-F3-Gb4-G1-Bb2-C3  
Bar 3: C7 (C5-E3-G2-Bb1) | Melody: C1-Eb2-F3-Gb4-G1-Bb2-C3
```

## Browser Requirements
- **Chrome/Edge**: Full Web MIDI API support
- **Safari**: Limited MIDI support (may require additional setup)
- **Firefox**: Web MIDI API behind flag (can be enabled)

## Development Setup
1. Node.js 18+ and npm/pnpm
2. Svelte 5 with Vite
3. TypeScript configuration
4. MIDI-enabled browser for testing

## Future Enhancements
- Import/export chord progressions
- Metronome integration
- Recording and playback features
- Multiple keyboard support
- Custom fingering annotations
