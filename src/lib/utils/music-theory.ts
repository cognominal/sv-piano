// Music theory utilities for note conversion and chord analysis

export interface NoteWithFingering {
	note: string;  // e.g., "C5", "Eb2"
	fingering: number;  // 1-5 for fingers
	midiNumber: number;  // MIDI note number 0-127
}

export interface Bar {
	number: number;
	leftHand: {
		chord: string;
		notes: NoteWithFingering[];
	};
	rightHand: {
		notes: NoteWithFingering[];
	};
}

export interface ChordProgression {
	bars: Bar[];
}

// Convert note name to MIDI number (C4 = 60)
export function noteToMidi(note: string): number {
	const noteMap: Record<string, number> = {
		'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3,
		'E': 4, 'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8,
		'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
	};

	const match = note.match(/^([A-G][b#]?)(\d+)$/);
	if (!match) throw new Error(`Invalid note format: ${note}`);

	const [, noteName, octaveStr] = match;
	const octave = parseInt(octaveStr);
	
	return (octave + 1) * 12 + noteMap[noteName];
}

// Convert MIDI number to note name
export function midiToNote(midiNumber: number): string {
	const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
	const octave = Math.floor(midiNumber / 12) - 1;
	const noteIndex = midiNumber % 12;
	
	return `${noteNames[noteIndex]}${octave}`;
}

// Parse note string with fingering to create NoteWithFingering object
export function parseNoteWithFingering(noteStr: string, fingering: number): NoteWithFingering {
	return {
		note: noteStr,
		fingering,
		midiNumber: noteToMidi(noteStr)
	};
}

// Sample chord progression data
export const sampleProgression: ChordProgression = {
	bars: [
		{
			number: 1,
			leftHand: {
				chord: "C7",
				notes: [
					parseNoteWithFingering("C1", 5),
					parseNoteWithFingering("E1", 3),
					parseNoteWithFingering("G1", 2),
					parseNoteWithFingering("Bb1", 1)
				]
			},
			rightHand: {
				notes: [
					parseNoteWithFingering("C1", 1),
					parseNoteWithFingering("Eb2", 2),
					parseNoteWithFingering("F3", 3),
					parseNoteWithFingering("Gb4", 4),
					parseNoteWithFingering("G1", 1),
					parseNoteWithFingering("Bb2", 2),
					parseNoteWithFingering("C3", 3)
				]
			}
		},
		{
			number: 2,
			leftHand: {
				chord: "F7",
				notes: [
					parseNoteWithFingering("F5", 5),
					parseNoteWithFingering("A3", 3),
					parseNoteWithFingering("C2", 2),
					parseNoteWithFingering("Eb1", 1)
				]
			},
			rightHand: {
				notes: [
					parseNoteWithFingering("C1", 1),
					parseNoteWithFingering("Eb2", 2),
					parseNoteWithFingering("F3", 3),
					parseNoteWithFingering("Gb4", 4),
					parseNoteWithFingering("G1", 1),
					parseNoteWithFingering("Bb2", 2),
					parseNoteWithFingering("C3", 3)
				]
			}
		},
		{
			number: 3,
			leftHand: {
				chord: "C7",
				notes: [
					parseNoteWithFingering("C5", 5),
					parseNoteWithFingering("E3", 3),
					parseNoteWithFingering("G2", 2),
					parseNoteWithFingering("Bb1", 1)
				]
			},
			rightHand: {
				notes: [
					parseNoteWithFingering("C1", 1),
					parseNoteWithFingering("Eb2", 2),
					parseNoteWithFingering("F3", 3),
					parseNoteWithFingering("Gb4", 4),
					parseNoteWithFingering("G1", 1),
					parseNoteWithFingering("Bb2", 2),
					parseNoteWithFingering("C3", 3)
				]
			}
		}
	]
};

// Check if a set of MIDI notes matches a chord (with tolerance for timing)
export function isChordMatch(playedNotes: Set<number>, expectedNotes: NoteWithFingering[], tolerance = 0.8): boolean {
	const expectedMidiNumbers = new Set(expectedNotes.map(n => n.midiNumber));
	
	// Calculate how many expected notes are being played
	const matchingNotes = Array.from(expectedMidiNumbers).filter(note => playedNotes.has(note));
	const matchRatio = matchingNotes.length / expectedMidiNumbers.size;
	
	// Also check that we're not playing too many extra notes
	const extraNotes = Array.from(playedNotes).filter(note => !expectedMidiNumbers.has(note));
	const extraRatio = extraNotes.length / playedNotes.size;
	
	return matchRatio >= tolerance && extraRatio <= 0.3;
}
