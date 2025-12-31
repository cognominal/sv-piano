<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { midiState } from '$lib/stores/midi.svelte.js';
	import { progressionState } from '$lib/stores/progression.svelte.js';
	import PianoKeyboard from '$lib/components/PianoKeyboard.svelte';
	import ChordProgression from '$lib/components/ChordProgression.svelte';
	import MIDIConnection from '$lib/components/MIDIConnection.svelte';

	let updateInterval: number;

	onMount(() => {
		// Auto-connect to MIDI on page load
		midiState.connect();

		// Set up regular updates for synchronization logic
		updateInterval = setInterval(() => {
			progressionState.update();
		}, 50); // 20 FPS update rate
	});

	onDestroy(() => {
		if (updateInterval) {
			clearInterval(updateInterval);
		}
	});
</script>

<svelte:head>
	<title>Piano Chord Synchronization</title>
	<meta name="description" content="Synchronize your Casio keyboard with chord progressions" />
</svelte:head>

<main>
	<div class="app-container">
		<header class="app-header">
			<h1>🎹 Piano Chord Synchronization</h1>
			<p>Connect your Casio keyboard and play along with chord progressions</p>
		</header>

		<div class="content-grid">
			<!-- MIDI Connection Panel -->
			<section class="midi-section">
				<MIDIConnection />
			</section>

			<!-- Piano Keyboard Display -->
			<section class="piano-section">
				<h2>Virtual Piano</h2>
				<PianoKeyboard showNoteNames={true} octaveRange={[2, 6]} />
				
				<div class="keyboard-info">
					<div class="legend">
						<div class="legend-item">
							<span class="color-box expected"></span>
							<span>Expected Notes</span>
						</div>
						<div class="legend-item">
							<span class="color-box active"></span>
							<span>Playing</span>
						</div>
						<div class="legend-item">
							<span class="color-box correct"></span>
							<span>Correct Match</span>
						</div>
					</div>
				</div>
			</section>

			<!-- Chord Progression Display -->
			<section class="progression-section">
				<ChordProgression />
			</section>

			<!-- Instructions -->
			<section class="instructions-section">
				<div class="instructions">
					<h3>How to Use</h3>
					<ol>
						<li><strong>Connect:</strong> Make sure your Casio keyboard is connected via USB and click "Connect MIDI"</li>
						<li><strong>Play:</strong> Press the left-hand chord notes shown in the current bar</li>
						<li><strong>Advance:</strong> When you play the correct chord, the app will automatically move to the next bar</li>
						<li><strong>Navigate:</strong> Click on any bar in the progression to jump to that position</li>
						<li><strong>Practice:</strong> Use the piano visualization to see which keys to press</li>
					</ol>
					
					<div class="tips">
						<h4>Tips:</h4>
						<ul>
							<li>Blue keys show the expected chord notes</li>
							<li>Green keys show currently pressed keys</li>
							<li>Orange keys show when you're playing the correct chord</li>
							<li>You can disable auto-advance to practice individual chords</li>
							<li>The fingering numbers show suggested finger positions</li>
						</ul>
					</div>
				</div>
			</section>
		</div>

		<!-- Status Bar -->
		<footer class="status-bar">
			<div class="status-item">
				<span class="status-label">MIDI:</span>
				<span class="status-value {midiState.connectionStatus}">
					{midiState.connectionStatus.toUpperCase()}
				</span>
			</div>
			
			{#if midiState.activeDevice}
				<div class="status-item">
					<span class="status-label">Device:</span>
					<span class="status-value">{midiState.activeDevice.name}</span>
				</div>
			{/if}
			
			<div class="status-item">
				<span class="status-label">Notes:</span>
				<span class="status-value">{midiState.activeNotes.size} active</span>
			</div>
			
			{#if progressionState.isPlaying}
				<div class="status-item">
					<span class="status-label">Mode:</span>
					<span class="status-value playing">PLAYING</span>
				</div>
			{/if}
			
			{#if progressionState.totalAttempts > 0}
				<div class="status-item">
					<span class="status-label">Accuracy:</span>
					<span class="status-value">{progressionState.accuracy.toFixed(1)}%</span>
				</div>
			{/if}
		</footer>
	</div>
</main>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		min-height: 100vh;
	}

	.app-container {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	.app-header {
		text-align: center;
		padding: 30px 20px;
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.2);
	}

	.app-header h1 {
		margin: 0 0 10px 0;
		color: #333;
		font-size: 2.5rem;
		font-weight: 700;
		text-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
	}

	.app-header p {
		margin: 0;
		color: #666;
		font-size: 1.1rem;
	}

	.content-grid {
		flex: 1;
		display: grid;
		grid-template-columns: 1fr;
		gap: 20px;
		padding: 20px;
		max-width: 1400px;
		margin: 0 auto;
		width: 100%;
	}

	.midi-section,
	.piano-section,
	.progression-section,
	.instructions-section {
		background: rgba(255, 255, 255, 0.95);
		backdrop-filter: blur(10px);
		border-radius: 12px;
		padding: 0;
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
		border: 1px solid rgba(255, 255, 255, 0.2);
	}

	.piano-section h2,
	.instructions-section h3 {
		margin: 0 0 20px 0;
		padding: 20px 20px 0 20px;
		color: #333;
		font-size: 1.5rem;
	}

	.keyboard-info {
		padding: 20px;
		background: #f8f9fa;
		border-top: 1px solid #e9ecef;
	}

	.legend {
		display: flex;
		justify-content: center;
		gap: 30px;
		flex-wrap: wrap;
	}

	.legend-item {
		display: flex;
		align-items: center;
		gap: 8px;
		font-size: 14px;
		color: #555;
	}

	.color-box {
		width: 20px;
		height: 20px;
		border-radius: 4px;
		border: 1px solid #ddd;
	}

	.color-box.expected {
		background: #2196F3;
	}

	.color-box.active {
		background: #4CAF50;
	}

	.color-box.correct {
		background: #FF9800;
	}

	.instructions {
		padding: 20px;
	}

	.instructions h3 {
		margin: 0 0 15px 0;
		padding: 0;
		color: #333;
	}

	.instructions h4 {
		margin: 20px 0 10px 0;
		color: #555;
	}

	.instructions ol,
	.instructions ul {
		padding-left: 20px;
		line-height: 1.6;
	}

	.instructions li {
		margin-bottom: 8px;
		color: #555;
	}

	.tips {
		margin-top: 20px;
		padding-top: 20px;
		border-top: 1px solid #eee;
	}

	.status-bar {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 30px;
		padding: 15px 20px;
		background: rgba(0, 0, 0, 0.8);
		backdrop-filter: blur(10px);
		color: white;
		font-size: 14px;
		flex-wrap: wrap;
	}

	.status-item {
		display: flex;
		align-items: center;
		gap: 5px;
	}

	.status-label {
		font-weight: bold;
		opacity: 0.8;
	}

	.status-value {
		padding: 2px 8px;
		border-radius: 10px;
		font-weight: bold;
		background: rgba(255, 255, 255, 0.1);
	}

	.status-value.connected {
		background: #4CAF50;
		color: white;
	}

	.status-value.connecting {
		background: #FF9800;
		color: white;
	}

	.status-value.error {
		background: #f44336;
		color: white;
	}

	.status-value.playing {
		background: #2196F3;
		color: white;
		animation: pulse 1.5s infinite;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.7; }
	}

	/* Responsive Design */
	@media (max-width: 1200px) {
		.content-grid {
			padding: 15px;
		}
		
		.app-header h1 {
			font-size: 2rem;
		}
	}

	@media (max-width: 768px) {
		.app-header {
			padding: 20px 15px;
		}
		
		.app-header h1 {
			font-size: 1.8rem;
		}
		
		.content-grid {
			padding: 10px;
			gap: 15px;
		}
		
		.legend {
			gap: 15px;
		}
		
		.status-bar {
			gap: 15px;
			flex-direction: column;
			padding: 10px;
		}
		
		.status-bar > div {
			display: flex;
			gap: 15px;
			flex-wrap: wrap;
			justify-content: center;
		}
	}

	@media (max-width: 480px) {
		.app-header h1 {
			font-size: 1.5rem;
		}
		
		.legend {
			flex-direction: column;
			align-items: center;
			gap: 10px;
		}
	}
</style>
