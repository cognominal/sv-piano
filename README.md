# 🎹 Piano Chord Synchronization App

A Svelte 5 web application that displays piano chord progressions and synchronizes in real-time with your Casio keyboard connected to Mac via USB/MIDI.

![Piano App Demo](https://via.placeholder.com/800x400/667eea/ffffff?text=Piano+Chord+Sync+App)

## Features

### 🎵 Real-time MIDI Integration
- **Web MIDI API**: Connects directly to your Casio keyboard via browser
- **Live Feedback**: Visual indication when keys are pressed
- **Auto-detection**: Automatically finds and connects to Casio keyboards
- **Connection Status**: Clear visual feedback of MIDI connection state

### 🎹 Interactive Piano Display
- **88-key Virtual Piano**: Full piano keyboard visualization
- **Color-coded Keys**: 
  - 🔵 Blue: Expected chord notes
  - 🟢 Green: Currently pressed keys  
  - 🟠 Orange: Correct chord match
- **Note Labels**: Optional note name display on keys
- **Responsive Design**: Works on desktop and tablet

### 📊 Chord Progression Interface
- **Visual Progression**: Table showing bars, chords, and fingering
- **Current Position**: Highlighted current bar with progress indicator
- **Click Navigation**: Jump to any bar by clicking
- **Fingering Display**: Shows suggested finger positions (1-5)
- **Left/Right Hand**: Separate display for chord and melody notes

### 🎯 Smart Synchronization
- **Auto-advance**: Moves to next bar when correct chord is played
- **Chord Detection**: Intelligent matching with timing tolerance
- **Manual Control**: Option to disable auto-advance for practice
- **Accuracy Tracking**: Shows performance statistics

## Sample Chord Progression

The app comes loaded with a 3-bar jazz progression:

| Bar | LH Chord | LH Notes & Fingering | RH Melody & Fingering |
|-----|----------|---------------------|----------------------|
| 1   | C7       | C5(5) - E3(3) - G2(2) - Bb1(1) | C1(1) - Eb2(2) - F3(3) - Gb4(4) - G1(1) - Bb2(2) - C3(3) |
| 2   | F7       | F5(5) - A3(3) - C2(2) - Eb1(1) | C1(1) - Eb2(2) - F3(3) - Gb4(4) - G1(1) - Bb2(2) - C3(3) |
| 3   | C7       | C5(5) - E3(3) - G2(2) - Bb1(1) | C1(1) - Eb2(2) - F3(3) - Gb4(4) - G1(1) - Bb2(2) - C3(3) |

## Getting Started

### Prerequisites
- **Node.js 18+** and npm/pnpm
- **Modern Browser** with Web MIDI API support:
  - ✅ Chrome/Chromium 43+
  - ✅ Edge 79+
  - ✅ Opera 30+
  - ❌ Firefox (requires manual enable)
  - ❌ Safari (limited support)
- **Casio Keyboard** with USB MIDI capability
- **USB Cable** to connect keyboard to Mac

### Installation

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd sv-piano
   ```

2. **Install dependencies**:
   ```bash
   npm install
   # or
   pnpm install
   ```

3. **Start development server**:
   ```bash
   npm run dev
   # or
   pnpm dev
   ```

4. **Open in browser**:
   Navigate to `http://localhost:5173`

### Hardware Setup

1. **Connect Keyboard**: 
   - Connect your Casio keyboard to Mac via USB cable
   - Turn on the keyboard
   - Ensure it's in MIDI mode (check keyboard manual)

2. **Browser Permissions**:
   - When prompted, allow MIDI access in your browser
   - The app will automatically detect your Casio keyboard

3. **Test Connection**:
   - Press keys on your keyboard
   - You should see the virtual piano keys light up in green

## Usage Guide

### Basic Operation

1. **Connect MIDI**:
   - Click "Connect MIDI" button
   - Select your Casio keyboard from the device list
   - Status should show "Connected" with a green dot

2. **Start Playing**:
   - The current bar will be highlighted in blue
   - Press the left-hand chord notes shown for that bar
   - Blue keys on the virtual piano show which notes to press

3. **Auto-advance**:
   - When you play the correct chord, the app automatically moves to the next bar
   - Hold the chord for at least 500ms for it to register
   - Orange highlighting indicates you're playing the correct chord

4. **Manual Navigation**:
   - Click on any bar in the progression table to jump to it
   - Use Previous/Next buttons for step-by-step navigation
   - Click Stop to return to the beginning

### Practice Tips

- **Focus on Left Hand**: The app primarily tracks left-hand chord changes
- **Use Fingering Numbers**: Numbers in parentheses show suggested finger positions
- **Check Accuracy**: Your performance percentage is shown in real-time
- **Disable Auto-advance**: Turn off for focused practice on individual chords
- **Visual Feedback**: Use the color-coded piano to see what you're playing

### Troubleshooting

**MIDI Not Connecting?**
- Ensure keyboard is powered on and connected via USB
- Try a different USB port or cable
- Restart the browser and try again
- Check if keyboard appears in system MIDI devices

**Keys Not Responding?**
- Verify MIDI connection status is "Connected"
- Try pressing keys more firmly
- Check if keyboard is in the correct MIDI mode
- Refresh the page and reconnect

**Browser Not Supported?**
- Use Chrome, Edge, or Opera for best compatibility
- Firefox users: Enable `dom.webmidi.enabled` in `about:config`
- Safari has limited MIDI support

## Development

### Project Structure
```
src/
├── lib/
│   ├── components/          # Svelte components
│   │   ├── PianoKeyboard.svelte    # Virtual piano display
│   │   ├── ChordProgression.svelte # Progression table
│   │   └── MIDIConnection.svelte   # MIDI setup panel
│   ├── stores/             # Svelte 5 state management
│   │   ├── midi.svelte.ts         # MIDI connection state
│   │   └── progression.svelte.ts  # Chord progression state
│   └── utils/              # Utility functions
│       ├── midi-utils.ts          # Web MIDI API helpers
│       └── music-theory.ts        # Music theory functions
└── routes/
    ├── +layout.svelte      # App layout
    └── +page.svelte        # Main application page
```

### Key Technologies
- **Svelte 5**: Latest version with runes for reactive state
- **TypeScript**: Type safety for MIDI and music objects  
- **Web MIDI API**: Browser-native MIDI communication
- **CSS Grid/Flexbox**: Responsive layout design
- **Vite**: Fast development and build tooling

### Building for Production
```bash
npm run build
npm run preview
```

### Customization

**Adding New Progressions**:
Edit `src/lib/utils/music-theory.ts` and modify the `sampleProgression` object.

**Changing Piano Range**:
Modify the `octaveRange` prop in `+page.svelte`:
```svelte
<PianoKeyboard octaveRange={[1, 7]} />
```

**Adjusting Chord Detection**:
Modify tolerance in `music-theory.ts`:
```typescript
isChordMatch(playedNotes, expectedNotes, 0.9) // 90% match required
```

## Browser Compatibility

| Browser | MIDI Support | Status |
|---------|-------------|---------|
| Chrome 43+ | ✅ Full | Recommended |
| Edge 79+ | ✅ Full | Recommended |
| Opera 30+ | ✅ Full | Supported |
| Firefox | ⚠️ Manual Enable | Limited |
| Safari | ❌ Partial | Not Recommended |

## Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Make your changes and test thoroughly
4. Submit a pull request with a clear description

## License

MIT License - see LICENSE file for details.

## Support

For issues or questions:
1. Check the troubleshooting section above
2. Open an issue on GitHub with details about your setup
3. Include browser version, keyboard model, and error messages

---

**Happy Playing! 🎹🎵**
