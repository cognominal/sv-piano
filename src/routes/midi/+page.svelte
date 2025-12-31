<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import PianoKeyboard from '../../lib/components/PianoKeyboard.svelte';
	import { midiState } from '../../lib/stores/midi.svelte.js';

	let fileInput: HTMLInputElement | null = null;
	let fileName = '';
	let isLoading = false;
	let isPlaying = false;
	type MidiClass = { new (data: ArrayBuffer): { tracks: { notes: MidiNote[] }[]; duration: number } };
	type MidiNote = { time: number; duration: number; velocity: number; midi: number };
	let midi: InstanceType<MidiClass> | null = null;
	let midiCtor: MidiClass | null = null;
	let errorMessage = '';
	let durationSeconds = 0;
	let playbackRate = 1;
	let currentPosition = 0;
	let rafId: number | null = null;
	let seekTimeout: number | null = null;
	let lastStoredPosition = 0;
	let loopStart: number | null = null;
	let loopEnd: number | null = null;
	let isLooping = false;
	let loopDelayTimeout: number | null = null;

	const STATE_KEY = 'sv-piano:midi-player';
	const DB_NAME = 'sv-piano';
	const STORE_NAME = 'midi-files';
	const FILE_KEY = 'last-midi';

	let timeouts: number[] = [];

	function clearTimers() {
		timeouts.forEach((id) => clearTimeout(id));
		timeouts = [];
		if (loopDelayTimeout !== null) {
			clearTimeout(loopDelayTimeout);
			loopDelayTimeout = null;
		}
	}

	function saveState() {
		if (!browser) return;
		const payload = {
			fileName,
			position: currentPosition,
			playbackRate
		};
		localStorage.setItem(STATE_KEY, JSON.stringify(payload));
	}

	function loadState() {
		if (!browser) return;
		const raw = localStorage.getItem(STATE_KEY);
		if (!raw) return;
		try {
			const parsed = JSON.parse(raw) as { fileName?: string; position?: number; playbackRate?: number };
			if (typeof parsed.playbackRate === 'number') {
				playbackRate = parsed.playbackRate;
			}
			if (typeof parsed.position === 'number') {
				currentPosition = parsed.position;
				lastStoredPosition = parsed.position;
			}
			if (typeof parsed.fileName === 'string') {
				fileName = parsed.fileName;
			}
		} catch {
			// ignore invalid data
		}
	}

	function openDatabase(): Promise<IDBDatabase> {
		return new Promise((resolve, reject) => {
			const request = indexedDB.open(DB_NAME, 1);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME);
				}
			};
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});
	}

	async function storeMidiFile(buffer: ArrayBuffer, name: string) {
		if (!browser) return;
		const db = await openDatabase();
		const tx = db.transaction(STORE_NAME, 'readwrite');
		tx.objectStore(STORE_NAME).put({ name, buffer }, FILE_KEY);
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async function loadMidiFile(): Promise<{ name: string; buffer: ArrayBuffer } | null> {
		if (!browser) return null;
		const db = await openDatabase();
		const tx = db.transaction(STORE_NAME, 'readonly');
		const request = tx.objectStore(STORE_NAME).get(FILE_KEY);
		return await new Promise((resolve, reject) => {
			request.onsuccess = () => {
				resolve((request.result as { name: string; buffer: ArrayBuffer }) ?? null);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async function ensureMidiCtor(): Promise<MidiClass> {
		if (midiCtor) return midiCtor;
		const module = await import('@tonejs/midi');
		const resolved = (module as { default?: { Midi?: MidiClass }; Midi?: MidiClass }).default?.Midi ?? module.Midi;
		if (!resolved) throw new Error('MIDI parser not available');
		midiCtor = resolved;
		return resolved;
	}

	function stopProgressTracking() {
		if (rafId !== null) {
			cancelAnimationFrame(rafId);
			rafId = null;
		}
}

	function stopPlayback() {
		clearTimers();
		stopProgressTracking();
		midiState.clearAllNotes();
		isPlaying = false;
	}

	function schedulePlayback(currentMidi: InstanceType<MidiClass>, startOffset = 0, endOffset?: number) {
		const notes = currentMidi.tracks.flatMap((track) => track.notes);
		notes.sort((a, b) => a.time - b.time);

		const startTime = performance.now();
		const offset = Math.max(0, Math.min(startOffset, currentMidi.duration));
		const stopAt = Math.max(offset, Math.min(endOffset ?? currentMidi.duration, currentMidi.duration));
		notes.forEach((note) => {
			const noteEnd = note.time + note.duration;
			if (noteEnd < offset) return;
			if (note.time > stopAt) return;

			const startDelta = note.time - offset;
			const endDelta = Math.min(noteEnd, stopAt) - offset;
			const startMs = Math.max(0, (startDelta * 1000) / playbackRate);
			const endMs = Math.max(0, (endDelta * 1000) / playbackRate);
			const velocity = Math.round(note.velocity * 127);

		timeouts.push(
			window.setTimeout(() => {
				midiState.playNote(note.midi, true, velocity);
				}, Math.max(0, startMs - (performance.now() - startTime)))
			);

			timeouts.push(
				window.setTimeout(() => {
					midiState.playNote(note.midi, false);
				}, Math.max(0, endMs - (performance.now() - startTime)))
			);
		});

		const endMs = ((stopAt - offset) * 1000) / playbackRate;
		timeouts.push(
			window.setTimeout(() => {
				stopPlayback();
				currentPosition = 0;
				saveState();
				if (isLooping && loopStart !== null && loopEnd !== null) {
					loopDelayTimeout = window.setTimeout(() => {
						midiState.clearAllNotes();
						isPlaying = true;
						schedulePlayback(currentMidi, loopStart, loopEnd);
					}, 5000);
				}
			}, Math.max(0, endMs - (performance.now() - startTime)))
		);

		const startOffsetTime = performance.now();
		const progress = () => {
			const elapsedSeconds = ((performance.now() - startOffsetTime) / 1000) * playbackRate;
			currentPosition = Math.min(stopAt, offset + elapsedSeconds);
			if (currentPosition - lastStoredPosition >= 0.5 || currentPosition === 0) {
				lastStoredPosition = currentPosition;
				saveState();
			}
			if (isPlaying) {
				rafId = requestAnimationFrame(progress);
			}
		};
	stopProgressTracking();
	rafId = requestAnimationFrame(progress);
}

	async function handleFileChange(event: Event) {
		if (!browser) return;
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];
		if (!file) return;

		stopPlayback();
		isLoading = true;
		errorMessage = '';
		fileName = file.name;

		try {
			const MidiCtor = await ensureMidiCtor();
			const buffer = await file.arrayBuffer();
			await storeMidiFile(buffer, file.name);
			const parsed = new MidiCtor(buffer);
			midi = parsed;
			durationSeconds = parsed.duration;
			currentPosition = 0;
			lastStoredPosition = 0;
			saveState();
			isPlaying = true;
			schedulePlayback(midi, 0);
		} catch (error) {
			midi = null;
			durationSeconds = 0;
			errorMessage = error instanceof Error ? error.message : 'Failed to load MIDI file';
		} finally {
			isLoading = false;
		}
	}

	function handlePickFile() {
		fileInput?.click();
	}

	function handlePlay() {
		if (!midi || isPlaying) return;
		midiState.clearAllNotes();
		isPlaying = true;
		const end = isLooping && loopEnd !== null ? loopEnd : undefined;
		schedulePlayback(midi, currentPosition, end);
	}

	function handleReplay() {
		if (!midi) return;
		stopPlayback();
		midiState.clearAllNotes();
		isPlaying = true;
		currentPosition = 0;
		const end = isLooping && loopEnd !== null ? loopEnd : undefined;
		schedulePlayback(midi, 0, end);
	}

	function handleStop() {
		if (!isPlaying) return;
		stopPlayback();
		saveState();
	}

	function handleSeekInput(event: Event) {
		const target = event.target as HTMLInputElement;
		currentPosition = Number(target.value);
		lastStoredPosition = currentPosition;
		saveState();
		if (seekTimeout) {
			clearTimeout(seekTimeout);
		}
		stopPlayback();
	seekTimeout = window.setTimeout(() => {
			if (!midi) return;
			midiState.clearAllNotes();
			isPlaying = true;
			const end = isLooping && loopEnd !== null ? loopEnd : undefined;
			schedulePlayback(midi, currentPosition, end);
		}, 1000);
	}

	function markLoopStart() {
		loopStart = currentPosition;
		if (loopEnd !== null && loopEnd < loopStart) {
			loopEnd = loopStart;
		}
	}

	function markLoopEnd() {
		loopEnd = currentPosition;
		if (loopStart !== null && loopEnd < loopStart) {
			loopStart = loopEnd;
		}
	}

	function startLoop() {
		if (!midi || loopStart === null || loopEnd === null) return;
		stopPlayback();
		isLooping = true;
		midiState.clearAllNotes();
		isPlaying = true;
		schedulePlayback(midi, loopStart, loopEnd);
	}

	function stopLoop() {
		isLooping = false;
		if (isPlaying) {
			stopPlayback();
		}
	}

	onDestroy(() => {
		stopPlayback();
	});

	onMount(async () => {
		if (!browser) return;
		loadState();
		try {
			const stored = await loadMidiFile();
			if (!stored) return;
			const MidiCtor = await ensureMidiCtor();
			const parsed = new MidiCtor(stored.buffer);
			midi = parsed;
			durationSeconds = parsed.duration;
			fileName = stored.name;
			currentPosition = Math.min(currentPosition, parsed.duration);
		} catch {
			// ignore restore failures
		}
	});
</script>

<svelte:head>
	<title>MIDI Player</title>
	<meta name="description" content="Play a MIDI file and visualize notes on the keyboard" />
</svelte:head>

<main class="midi-page">
	<section class="player-panel">
		<header>
			<h1>MIDI Player</h1>
			<p>Select a MIDI file to play and visualize.</p>
		</header>

		<div class="controls">
			<input
				type="file"
				accept=".mid,.midi"
				bind:this={fileInput}
				onchange={handleFileChange}
				class="file-input"
			/>
			<button type="button" class="action" onclick={handlePickFile}>
				Choose MIDI File
			</button>
			<button type="button" class="action" onclick={handlePlay} disabled={!midi || isLoading || isPlaying}>
				Play
			</button>
			<button type="button" class="action" onclick={handleReplay} disabled={!midi || isLoading}>
				Replay
			</button>
			<button type="button" class="action" onclick={handleStop} disabled={!isPlaying}>
				Stop
			</button>
		</div>

		<div class="status">
			<div class="status-item">
				<span class="label">File:</span>
				<span class="value">{fileName || 'None selected'}</span>
			</div>
			<div class="status-item">
				<span class="label">Duration:</span>
				<span class="value">{durationSeconds ? (durationSeconds / playbackRate).toFixed(2) + 's' : '--'}</span>
			</div>
			{#if errorMessage}
				<div class="status-error">{errorMessage}</div>
			{/if}
		</div>

		<div class="playback-sliders">
			<div class="speed-control">
				<label for="speed">Speed</label>
				<input
					id="speed"
					type="range"
					min="0.5"
					max="2"
					step="0.05"
					bind:value={playbackRate}
					disabled={isPlaying}
				/>
				<span class="speed-value">{playbackRate.toFixed(2)}x</span>
			</div>

			<div class="seek-control">
				<label for="seek">Position</label>
				<input
					id="seek"
					type="range"
					min="0"
					max={durationSeconds || 0}
					step="0.01"
					value={currentPosition}
					oninput={handleSeekInput}
					disabled={!midi || isLoading}
				/>
				<span class="time-indicator">
					{currentPosition.toFixed(2)}s / {durationSeconds ? durationSeconds.toFixed(2) + 's' : '--'}
				</span>
			</div>
		</div>

		<div class="loop-controls">
			<button type="button" class="action ghost" onclick={markLoopStart} disabled={!midi || isLoading}>
				Mark Loop Start
			</button>
			<button type="button" class="action ghost" onclick={markLoopEnd} disabled={!midi || isLoading}>
				Mark Loop End
			</button>
			<button
				type="button"
				class="action"
				onclick={isLooping ? stopLoop : startLoop}
				disabled={!midi || isLoading || loopStart === null || loopEnd === null}
			>
				{isLooping ? 'Stop Loop' : 'Loop Span'}
			</button>
			<span class="loop-indicator">
				{#if loopStart !== null && loopEnd !== null}
					Loop: {loopStart.toFixed(2)}s → {loopEnd.toFixed(2)}s
				{:else}
					Loop: not set
				{/if}
			</span>
		</div>
	</section>

	<section class="keyboard-panel">
		<h2>Virtual Keyboard</h2>
		<PianoKeyboard showNoteNames={false} octaveRange={[1, 7]} showExpected={false} />
	</section>
</main>

<style>
	.midi-page {
		min-height: 100vh;
		padding: 24px;
		display: grid;
		gap: 24px;
		background: linear-gradient(135deg, #eef2ff 0%, #e0f2fe 100%);
	}

	.player-panel,
	.keyboard-panel {
		background: white;
		border-radius: 16px;
		padding: 20px;
		box-shadow: 0 12px 28px rgba(15, 23, 42, 0.12);
		border: 1px solid rgba(148, 163, 184, 0.3);
	}

	.player-panel header h1 {
		margin: 0 0 6px 0;
		font-size: 1.8rem;
		color: #1e293b;
	}

	.player-panel header p {
		margin: 0 0 16px 0;
		color: #475569;
	}

	.controls {
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
		margin-bottom: 12px;
	}

	.file-input {
		display: none;
	}

	.action {
		background: #2563eb;
		color: white;
		border: none;
		padding: 10px 18px;
		border-radius: 10px;
		font-weight: 600;
		cursor: pointer;
		transition: transform 0.15s ease, box-shadow 0.15s ease;
		box-shadow: 0 6px 14px rgba(37, 99, 235, 0.25);
	}

	.action:disabled {
		background: #94a3b8;
		cursor: not-allowed;
		box-shadow: none;
	}

	.action:not(:disabled):hover {
		transform: translateY(-1px);
		box-shadow: 0 8px 18px rgba(37, 99, 235, 0.35);
	}

	.action.ghost {
		background: transparent;
		color: #2563eb;
		border: 1px solid rgba(37, 99, 235, 0.4);
		box-shadow: none;
	}

	.action.ghost:hover:not(:disabled) {
		background: rgba(37, 99, 235, 0.08);
		box-shadow: none;
	}

	.status {
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
		font-size: 14px;
	}

	.status-item {
		display: flex;
		gap: 6px;
		color: #334155;
	}

	.label {
		font-weight: 600;
	}

	.status-error {
		color: #b91c1c;
		font-weight: 600;
	}

	.playback-sliders {
		margin-top: 14px;
		display: flex;
		flex-wrap: wrap;
		gap: 16px;
	}

	.speed-control {
		display: flex;
		align-items: center;
		gap: 12px;
		color: #334155;
		flex: 1 1 240px;
	}

	.speed-control label {
		font-weight: 600;
	}

	.speed-control input[type='range'] {
		flex: 1;
		accent-color: #2563eb;
	}

	.speed-value {
		min-width: 48px;
		font-weight: 600;
		text-align: right;
	}

	.seek-control {
		display: flex;
		align-items: center;
		gap: 12px;
		color: #334155;
		flex: 2 1 320px;
	}

	.seek-control label {
		font-weight: 600;
	}

	.seek-control input[type='range'] {
		flex: 1;
		accent-color: #2563eb;
	}

	.time-indicator {
		min-width: 140px;
		font-weight: 600;
		text-align: right;
	}

	.loop-controls {
		margin-top: 16px;
		display: flex;
		flex-wrap: wrap;
		gap: 12px;
		align-items: center;
	}

	.loop-indicator {
		color: #334155;
		font-weight: 600;
	}

	.keyboard-panel h2 {
		margin: 0 0 12px 0;
		color: #1e293b;
	}

	@media (max-width: 768px) {
		.midi-page {
			padding: 16px;
		}
	}
</style>
