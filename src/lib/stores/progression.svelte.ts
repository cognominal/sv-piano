// Chord progression state management using Svelte 5 runes

import { sampleProgression, isChordMatch, type ChordProgression, type Bar } from '../utils/music-theory.js';
import { midiState } from './midi.svelte.js';

class ProgressionState {
	progression = $state<ChordProgression>(sampleProgression);
	currentBarIndex = $state(0);
	isPlaying = $state(false);
	autoAdvance = $state(true);
	
	// Timing and synchronization
	lastChordTime = $state(0);
	chordHoldTime = $state(0);
	minChordHoldDuration = 500; // ms
	
	// Statistics
	correctChords = $state(0);
	totalAttempts = $state(0);

	get currentBar(): Bar | null {
		return this.progression.bars[this.currentBarIndex] || null;
	}

	get isLastBar(): boolean {
		return this.currentBarIndex >= this.progression.bars.length - 1;
	}

	get isFirstBar(): boolean {
		return this.currentBarIndex === 0;
	}

	// Navigation methods
	nextBar() {
		if (!this.isLastBar) {
			this.currentBarIndex++;
		}
	}

	previousBar() {
		if (!this.isFirstBar) {
			this.currentBarIndex--;
		}
	}

	goToBar(index: number) {
		if (index >= 0 && index < this.progression.bars.length) {
			this.currentBarIndex = index;
		}
	}

	// Playback control
	play() {
		this.isPlaying = true;
	}

	pause() {
		this.isPlaying = false;
	}

	stop() {
		this.isPlaying = false;
		this.currentBarIndex = 0;
	}

	// Check if current chord is being played correctly
	checkCurrentChord(): boolean {
		const currentBar = this.currentBar;
		if (!currentBar) return false;

		// Check left hand chord
		const leftHandMatch = isChordMatch(
			midiState.activeNotes,
			currentBar.leftHand.notes
		);

		return leftHandMatch;
	}

	// Update method to be called frequently (e.g., from a component)
	update() {
		if (!this.isPlaying || !this.autoAdvance) return;

		const now = Date.now();
		const isChordCorrect = this.checkCurrentChord();

		if (isChordCorrect) {
			if (this.chordHoldTime === 0) {
				// Just started holding the correct chord
				this.chordHoldTime = now;
			} else if (now - this.chordHoldTime >= this.minChordHoldDuration) {
				// Held chord long enough, advance to next bar
				this.correctChords++;
				this.totalAttempts++;
				this.chordHoldTime = 0;
				this.lastChordTime = now;
				
				if (!this.isLastBar) {
					this.nextBar();
				} else {
					// Reached the end
					this.pause();
				}
			}
		} else {
			// Not playing correct chord
			this.chordHoldTime = 0;
		}
	}

	// Load new progression
	loadProgression(newProgression: ChordProgression) {
		this.progression = newProgression;
		this.currentBarIndex = 0;
		this.isPlaying = false;
		this.resetStats();
	}

	// Reset statistics
	resetStats() {
		this.correctChords = 0;
		this.totalAttempts = 0;
	}

	// Get accuracy percentage
	get accuracy(): number {
		return this.totalAttempts > 0 ? (this.correctChords / this.totalAttempts) * 100 : 0;
	}

	// Check if a specific bar's chord is currently being played
	isBarActive(barIndex: number): boolean {
		if (barIndex !== this.currentBarIndex) return false;
		return this.checkCurrentChord();
	}

	// Get expected notes for current bar (for visualization)
	get expectedNotes(): Set<number> {
		const currentBar = this.currentBar;
		if (!currentBar) return new Set();

		const notes = new Set<number>();
		
		// Add left hand chord notes
		currentBar.leftHand.notes.forEach(note => {
			notes.add(note.midiNumber);
		});

		// Optionally add right hand notes
		// currentBar.rightHand.notes.forEach(note => {
		// 	notes.add(note.midiNumber);
		// });

		return notes;
	}
}

// Export singleton instance
export const progressionState = new ProgressionState();
