<script lang="ts">
	import { progressionState } from '../stores/progression.svelte.js';
	import { midiState } from '../stores/midi.svelte.js';
	import type { Bar, NoteWithFingering } from '../utils/music-theory.js';

	// Format notes for display
	function formatNotes(notes: NoteWithFingering[]): string {
		return notes.map(note => `${note.note}(${note.fingering})`).join(' - ');
	}

	// Check if a bar is currently active (correct chord being played)
	function isBarActive(bar: Bar, index: number): boolean {
		return index === progressionState.currentBarIndex && progressionState.checkCurrentChord();
	}

	// Handle bar click for navigation
	function goToBar(index: number) {
		progressionState.goToBar(index);
	}
</script>

<div class="chord-progression">
	<div class="progression-header">
		<h2>Chord Progression</h2>
		<div class="progress-info">
			<span>Bar {progressionState.currentBarIndex + 1} of {progressionState.progression.bars.length}</span>
			{#if progressionState.totalAttempts > 0}
				<span class="accuracy">Accuracy: {progressionState.accuracy.toFixed(1)}%</span>
			{/if}
		</div>
	</div>

	<div class="progression-table">
		<div class="table-header">
			<div class="col-bar">Bar</div>
			<div class="col-chord">LH Chord</div>
			<div class="col-notes">LH Notes & Fingering</div>
			<div class="col-melody">RH Melody & Fingering</div>
		</div>

		{#each progressionState.progression.bars as bar, index}
			<button
				class="table-row"
				class:current={index === progressionState.currentBarIndex}
				class:active={isBarActive(bar, index)}
				onclick={() => goToBar(index)}
				onkeydown={(e) => {
					if (e.key === 'Enter' || e.key === ' ') {
						e.preventDefault();
						goToBar(index);
					}
				}}
				aria-label="Go to bar {bar.number}, chord {bar.leftHand.chord}"
				tabindex="0"
			>
				<div class="col-bar">
					<span class="bar-number">{bar.number}</span>
					{#if index === progressionState.currentBarIndex}
						<span class="current-indicator">▶</span>
					{/if}
				</div>
				
				<div class="col-chord">
					<span class="chord-name">{bar.leftHand.chord}</span>
				</div>
				
				<div class="col-notes">
					<span class="notes-list">{formatNotes(bar.leftHand.notes)}</span>
				</div>
				
				<div class="col-melody">
					<span class="melody-list">{formatNotes(bar.rightHand.notes)}</span>
				</div>
			</button>
		{/each}
	</div>

	<!-- Playback controls -->
	<div class="playback-controls">
		<button 
			onclick={() => progressionState.previousBar()}
			disabled={progressionState.isFirstBar}
		>
			Previous
		</button>
		
		{#if progressionState.isPlaying}
			<button onclick={() => progressionState.pause()}>
				Pause
			</button>
		{:else}
			<button onclick={() => progressionState.play()}>
				Play
			</button>
		{/if}
		
		<button onclick={() => progressionState.stop()}>
			Stop
		</button>
		
		<button 
			onclick={() => progressionState.nextBar()}
			disabled={progressionState.isLastBar}
		>
			Next
		</button>
		
		<label class="auto-advance">
			<input 
				type="checkbox" 
				bind:checked={progressionState.autoAdvance}
			/>
			Auto-advance
		</label>
	</div>

	<!-- Current chord info -->
	{#if progressionState.currentBar}
		<div class="current-chord-info">
			<h3>Current: {progressionState.currentBar.leftHand.chord}</h3>
			<div class="chord-details">
				<div class="left-hand">
					<h4>Left Hand</h4>
					<div class="notes">
						{#each progressionState.currentBar.leftHand.notes as note}
							<span 
								class="note-badge"
								class:active={midiState.activeNotes.has(note.midiNumber)}
							>
								{note.note}<sub>{note.fingering}</sub>
							</span>
						{/each}
					</div>
				</div>
				
				<div class="right-hand">
					<h4>Right Hand</h4>
					<div class="notes">
						{#each progressionState.currentBar.rightHand.notes as note}
							<span 
								class="note-badge melody"
								class:active={midiState.activeNotes.has(note.midiNumber)}
							>
								{note.note}<sub>{note.fingering}</sub>
							</span>
						{/each}
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	.chord-progression {
		width: 100%;
		max-width: 1200px;
		margin: 0 auto;
		padding: 20px;
		background: white;
		border-radius: 8px;
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.progression-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 20px;
		padding-bottom: 10px;
		border-bottom: 2px solid #eee;
	}

	.progression-header h2 {
		margin: 0;
		color: #333;
	}

	.progress-info {
		display: flex;
		gap: 20px;
		font-size: 14px;
		color: #666;
	}

	.accuracy {
		font-weight: bold;
		color: #4CAF50;
	}

	.progression-table {
		width: 100%;
		border: 1px solid #ddd;
		border-radius: 4px;
		overflow: hidden;
		margin-bottom: 20px;
	}

	.table-header {
		display: grid;
		grid-template-columns: 80px 120px 1fr 1fr;
		background: #f5f5f5;
		font-weight: bold;
		border-bottom: 2px solid #ddd;
	}

	.table-header > div {
		padding: 12px;
		border-right: 1px solid #ddd;
	}

	.table-header > div:last-child {
		border-right: none;
	}

	.table-row {
		display: grid;
		grid-template-columns: 80px 120px 1fr 1fr;
		border: none;
		border-bottom: 1px solid #eee;
		cursor: pointer;
		transition: background-color 0.2s ease;
		background: none;
		width: 100%;
		text-align: left;
		font-family: inherit;
		font-size: inherit;
		padding: 0;
	}

	.table-row:hover {
		background-color: #f9f9f9;
	}

	.table-row.current {
		background-color: #e3f2fd;
		border-left: 4px solid #2196F3;
	}

	.table-row.active {
		background-color: #fff3e0;
		border-left: 4px solid #FF9800;
	}

	.table-row > div {
		padding: 12px;
		border-right: 1px solid #eee;
		display: flex;
		align-items: center;
	}

	.table-row > div:last-child {
		border-right: none;
	}

	.col-bar {
		justify-content: center;
		font-weight: bold;
	}

	.current-indicator {
		margin-left: 8px;
		color: #2196F3;
	}

	.chord-name {
		font-weight: bold;
		font-size: 16px;
		color: #333;
	}

	.notes-list,
	.melody-list {
		font-family: monospace;
		font-size: 13px;
		color: #555;
	}

	.playback-controls {
		display: flex;
		gap: 10px;
		align-items: center;
		margin-bottom: 20px;
		padding: 15px;
		background: #f8f8f8;
		border-radius: 4px;
	}

	.playback-controls button {
		padding: 8px 16px;
		border: 1px solid #ddd;
		background: white;
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.playback-controls button:hover:not(:disabled) {
		background: #e0e0e0;
	}

	.playback-controls button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.auto-advance {
		display: flex;
		align-items: center;
		gap: 5px;
		margin-left: auto;
		cursor: pointer;
	}

	.current-chord-info {
		background: #f0f8ff;
		border: 1px solid #b3d9ff;
		border-radius: 4px;
		padding: 15px;
	}

	.current-chord-info h3 {
		margin: 0 0 10px 0;
		color: #1976D2;
	}

	.chord-details {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 20px;
	}

	.chord-details h4 {
		margin: 0 0 8px 0;
		color: #333;
		font-size: 14px;
	}

	.notes {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.note-badge {
		background: #e3f2fd;
		color: #1976D2;
		padding: 4px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: bold;
		border: 1px solid #bbdefb;
		transition: all 0.2s ease;
	}

	.note-badge.melody {
		background: #f3e5f5;
		color: #7b1fa2;
		border-color: #ce93d8;
	}

	.note-badge.active {
		background: #4CAF50;
		color: white;
		border-color: #45a049;
		transform: scale(1.1);
	}

	.note-badge sub {
		font-size: 10px;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.table-header,
		.table-row {
			grid-template-columns: 60px 100px 1fr;
		}

		.col-melody {
			display: none;
		}

		.chord-details {
			grid-template-columns: 1fr;
		}

		.playback-controls {
			flex-wrap: wrap;
		}
	}
</style>
