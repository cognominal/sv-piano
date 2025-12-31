<script lang="ts">
	import { midiState } from '../stores/midi.svelte.js';
	import { progressionState } from '../stores/progression.svelte.js';
	import { isWhiteKey, isBlackKey, PIANO_KEYS } from '../utils/midi-utils.js';
	import { midiToNote } from '../utils/music-theory.js';

	// Props
	interface Props {
		showNoteNames?: boolean;
		octaveRange?: [number, number]; // e.g., [2, 6] for C2 to C6
	}
	
	let { showNoteNames = true, octaveRange = [2, 6] }: Props = $props();

	// Calculate visible key range reactively
	const startNote = $derived(octaveRange[0] * 12 + 12); // C of start octave
	const endNote = $derived((octaveRange[1] + 1) * 12 + 12); // C of end octave + 1

	// Get visible keys reactively
	const visibleWhiteKeys = $derived(PIANO_KEYS.WHITE_KEYS.filter(note => note >= startNote && note <= endNote));
	const visibleBlackKeys = $derived(PIANO_KEYS.BLACK_KEYS.filter(note => note >= startNote && note <= endNote));

	// Key styling functions
	function getKeyClass(midiNote: number): string {
		const baseClass = isWhiteKey(midiNote) ? 'white-key' : 'black-key';
		const isActive = midiState.activeNotes.has(midiNote);
		const isExpected = progressionState.expectedNotes.has(midiNote);
		
		let classes = [baseClass];
		
		if (isActive && isExpected) {
			classes.push('correct');
		} else if (isActive) {
			classes.push('active');
		} else if (isExpected) {
			classes.push('expected');
		}
		
		return classes.join(' ');
	}

	// Get black key position relative to white keys
	function getBlackKeyPosition(midiNote: number): number {
		const noteInOctave = midiNote % 12;
		const octaveStart = Math.floor(midiNote / 12) * 12;
		
		// Find the white key to the left of this black key
		const whiteKeyIndex = visibleWhiteKeys.findIndex(whiteKey => {
			const whiteNoteInOctave = whiteKey % 12;
			const whiteOctaveStart = Math.floor(whiteKey / 12) * 12;
			
			return whiteOctaveStart === octaveStart && 
				   ((noteInOctave === 1 && whiteNoteInOctave === 0) ||  // C# after C
				    (noteInOctave === 3 && whiteNoteInOctave === 2) ||  // D# after D
				    (noteInOctave === 6 && whiteNoteInOctave === 5) ||  // F# after F
				    (noteInOctave === 8 && whiteNoteInOctave === 7) ||  // G# after G
				    (noteInOctave === 10 && whiteNoteInOctave === 9));  // A# after A
		});
		
		return whiteKeyIndex;
	}

	// Handle key clicks for testing
	function handleKeyClick(midiNote: number) {
		const isCurrentlyActive = midiState.activeNotes.has(midiNote);
		midiState.simulateNote(midiNote, !isCurrentlyActive);
	}
</script>

<div class="piano-container">
	<div class="piano-keyboard">
		<!-- White keys -->
		<div class="white-keys">
			{#each visibleWhiteKeys as midiNote}
				<button
					class={getKeyClass(midiNote)}
					onclick={() => handleKeyClick(midiNote)}
					aria-label="Note {midiToNote(midiNote)}"
				>
					{#if showNoteNames}
						<span class="note-name">{midiToNote(midiNote)}</span>
					{/if}
				</button>
			{/each}
		</div>

		<!-- Black keys -->
		<div class="black-keys">
			{#each visibleBlackKeys as midiNote}
				{@const position = getBlackKeyPosition(midiNote)}
				{#if position >= 0}
					<button
						class={getKeyClass(midiNote)}
						style="left: {position * 40 + 28}px"
						onclick={() => handleKeyClick(midiNote)}
						aria-label="Note {midiToNote(midiNote)}"
					>
						{#if showNoteNames}
							<span class="note-name">{midiToNote(midiNote)}</span>
						{/if}
					</button>
				{/if}
			{/each}
		</div>
	</div>
</div>

<style>
	.piano-container {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
		background: linear-gradient(to bottom, #f5f5f5, #e0e0e0);
		border-radius: 8px;
		box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
	}

	.piano-keyboard {
		position: relative;
		height: 200px;
		border: 2px solid #333;
		border-radius: 4px;
		overflow: hidden;
	}

	.white-keys {
		display: flex;
		height: 100%;
	}

	.white-key {
		flex: 1;
		height: 100%;
		background: linear-gradient(to bottom, #ffffff, #f8f8f8);
		border: 1px solid #ccc;
		border-top: none;
		cursor: pointer;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 10px;
		transition: all 0.1s ease;
		position: relative;
	}

	.white-key:hover {
		background: linear-gradient(to bottom, #f0f0f0, #e8e8e8);
	}

	.white-key.active {
		background: linear-gradient(to bottom, #4CAF50, #45a049);
		color: white;
	}

	.white-key.expected {
		background: linear-gradient(to bottom, #2196F3, #1976D2);
		color: white;
	}

	.white-key.correct {
		background: linear-gradient(to bottom, #FF9800, #F57C00);
		color: white;
	}

	.black-keys {
		position: absolute;
		top: 0;
		left: 0;
		right: 0;
		height: 60%;
	}

	.black-key {
		position: absolute;
		width: 24px;
		height: 100%;
		background: linear-gradient(to bottom, #2c2c2c, #1a1a1a);
		border: 1px solid #000;
		cursor: pointer;
		display: flex;
		align-items: flex-end;
		justify-content: center;
		padding-bottom: 8px;
		transition: all 0.1s ease;
		color: white;
		font-size: 10px;
	}

	.black-key:hover {
		background: linear-gradient(to bottom, #404040, #2a2a2a);
	}

	.black-key.active {
		background: linear-gradient(to bottom, #4CAF50, #45a049);
	}

	.black-key.expected {
		background: linear-gradient(to bottom, #2196F3, #1976D2);
	}

	.black-key.correct {
		background: linear-gradient(to bottom, #FF9800, #F57C00);
	}

	.note-name {
		font-size: 12px;
		font-weight: bold;
		user-select: none;
	}

	.black-key .note-name {
		font-size: 10px;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.piano-container {
			padding: 10px;
		}
		
		.piano-keyboard {
			height: 150px;
		}
		
		.note-name {
			font-size: 10px;
		}
		
		.black-key .note-name {
			font-size: 8px;
		}
	}
</style>
