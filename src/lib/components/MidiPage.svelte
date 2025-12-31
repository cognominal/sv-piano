<script lang="ts">
	import { onDestroy, onMount } from 'svelte';
	import { browser } from '$app/environment';
	import PianoKeyboard from '$lib/components/PianoKeyboard.svelte';
	import { midiToNote } from '$lib/utils/music-theory.js';
	import { midiState } from '$lib/stores/midi.svelte.js';

	let fileInput: HTMLInputElement | null = null;
	let fileName = '';
	let isLoading = false;
	let isPlaying = false;
	type MidiClass = { new (data: ArrayBuffer): { tracks: { notes: MidiNote[] }[]; duration: number } };
	type MidiNote = { time: number; duration: number; velocity: number; midi: number };
	let midi: InstanceType<MidiClass> | null = null;
	let midiCtor: MidiClass | null = null;
	let midiBuffer: ArrayBuffer | null = null;
	let errorMessage = '';
	let durationSeconds = 0;
	let playbackRate = 1;
	let currentPosition = 0;
	let rafId: number | null = null;
	let seekTimeout: number | null = null;
	let lastStoredPosition = 0;
	let timelineNotes: MidiNote[] = [];
	let timelineEl: HTMLDivElement | null = null;
	let timelinePixelsPerSecond = 80;
	let timelineLaneHeight = 8;
	let loopStart: number | null = null;
	let loopEnd: number | null = null;
	let isLooping = false;
	let loopDelayTimeout: number | null = null;
	let sheetContainer: HTMLDivElement | null = null;
	let isRenderingSheet = false;
	let sheetError = '';
	let sheetReady = false;
	let playbackNow = 0;
	type ActiveNote = { midi: number; name: string; startMs: number; endMs: number; durationMs: number };
	let activeNoteSlots: ActiveNote[] = [];
	const activeNoteMap = new Map<number, ActiveNote>();
	let longestNote: ActiveNote | null = null;
	let longestDurationMs = 0;
	const nowPlayingMaxWidthPct = 80;
	const showSheet = false;

	const STATE_KEY = 'sv-piano:midi-player';
	const DB_NAME = 'sv-piano';
	const STORE_NAME = 'midi-files';
	const LIBRARY_STORE = 'midi-library';
	const DB_VERSION = 2;
	const FILE_KEY = 'last-midi';

	type MidiLibraryItem = { name: string; buffer: ArrayBuffer; savedAt: number };
	let libraryFiles: MidiLibraryItem[] = [];
	let isSavingLibrary = false;
	let libraryError = '';
	let timeouts: number[] = [];

	function clearTimers() {
		timeouts.forEach((id) => clearTimeout(id));
		timeouts = [];
		if (loopDelayTimeout !== null) {
			clearTimeout(loopDelayTimeout);
			loopDelayTimeout = null;
		}
	}

	function updateActiveNoteSlots() {
		const notes = Array.from(activeNoteMap.values()).sort((a, b) => b.midi - a.midi);
		activeNoteSlots = notes;
		longestNote = null;
		longestDurationMs = 0;
		for (const note of notes) {
			if (note.durationMs > longestDurationMs) {
				longestDurationMs = note.durationMs;
				longestNote = note;
			}
		}
	}

	function clearActiveNoteSlots() {
		activeNoteMap.clear();
		activeNoteSlots = [];
		longestNote = null;
		longestDurationMs = 0;
	}

	function getNowPlayingBarStyle(note: ActiveNote) {
		if (!longestNote || longestDurationMs === 0) return '';
		const longestMid = (longestNote.startMs + longestNote.endMs) / 2;
		const noteMid = (note.startMs + note.endMs) / 2;
		const width = (note.durationMs / longestDurationMs) * nowPlayingMaxWidthPct;
		const left = 50 + ((noteMid - longestMid) / longestDurationMs) * nowPlayingMaxWidthPct - width / 2;
		const clampedLeft = Math.max(0, Math.min(100 - width, left));
		return `left: ${clampedLeft}%; width: ${width}%`;
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
			const request = indexedDB.open(DB_NAME, DB_VERSION);
			request.onupgradeneeded = () => {
				const db = request.result;
				if (!db.objectStoreNames.contains(STORE_NAME)) {
					db.createObjectStore(STORE_NAME);
				}
				if (!db.objectStoreNames.contains(LIBRARY_STORE)) {
					db.createObjectStore(LIBRARY_STORE, { keyPath: 'name' });
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

	async function saveMidiToLibrary(buffer: ArrayBuffer, name: string) {
		if (!browser) return;
		const db = await openDatabase();
		const tx = db.transaction(LIBRARY_STORE, 'readwrite');
		tx.objectStore(LIBRARY_STORE).put({ name, buffer, savedAt: Date.now() } satisfies MidiLibraryItem);
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
		});
	}

	async function loadLibraryFiles(): Promise<MidiLibraryItem[]> {
		if (!browser) return [];
		const db = await openDatabase();
		const tx = db.transaction(LIBRARY_STORE, 'readonly');
		const request = tx.objectStore(LIBRARY_STORE).getAll();
		return await new Promise((resolve, reject) => {
			request.onsuccess = () => {
				const items = (request.result as MidiLibraryItem[]) ?? [];
				items.sort((a, b) => b.savedAt - a.savedAt);
				resolve(items);
			};
			request.onerror = () => reject(request.error);
		});
	}

	async function deleteLibraryFile(name: string) {
		if (!browser) return;
		const db = await openDatabase();
		const tx = db.transaction(LIBRARY_STORE, 'readwrite');
		tx.objectStore(LIBRARY_STORE).delete(name);
		await new Promise<void>((resolve, reject) => {
			tx.oncomplete = () => resolve();
			tx.onerror = () => reject(tx.error);
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

	async function renderSheet(xml: string) {
		if (!browser || !sheetContainer) return;
		const module = await import('opensheetmusicdisplay');
		const Display = module.OpenSheetMusicDisplay ?? module.default?.OpenSheetMusicDisplay;
		if (!Display) throw new Error('Sheet renderer unavailable');

		if (!sheetContainer.childElementCount) {
			sheetContainer.innerHTML = '';
		}

		const osmd = new Display(sheetContainer, { drawingParameters: 'compact' });
		await osmd.load(xml);
		osmd.render();
		sheetReady = true;
	}

	async function loadMidiFromBuffer(
		buffer: ArrayBuffer,
		name: string,
		autoPlay = false,
		startPosition: number | null = null
	) {
		const MidiCtor = await ensureMidiCtor();
		const parsed = new MidiCtor(buffer);
		midi = parsed;
		durationSeconds = parsed.duration;
		fileName = name;
		midiBuffer = buffer;
		const nextPosition = startPosition ?? 0;
		currentPosition = Math.min(nextPosition, parsed.duration);
		lastStoredPosition = 0;
		timelineNotes = parsed.tracks.flatMap((track) => track.notes).sort((a, b) => a.time - b.time);
		saveState();
		requestAnimationFrame(() => {
			scrollTimelineTo(currentPosition);
		});
		if (autoPlay) {
			isPlaying = true;
			schedulePlayback(midi, currentPosition);
		}
	}

	async function refreshLibrary() {
		libraryError = '';
		try {
			libraryFiles = await loadLibraryFiles();
		} catch (error) {
			libraryError = error instanceof Error ? error.message : 'Failed to load MIDI library';
		}
	}

	async function handleSaveToLibrary() {
		if (!midiBuffer || !fileName) return;
		isSavingLibrary = true;
		libraryError = '';
		try {
			await saveMidiToLibrary(midiBuffer, fileName);
			await refreshLibrary();
		} catch (error) {
			libraryError = error instanceof Error ? error.message : 'Failed to save MIDI file';
		} finally {
			isSavingLibrary = false;
		}
	}

	async function handleLibrarySelect(entry: MidiLibraryItem) {
		stopPlayback();
		isLoading = true;
		errorMessage = '';
		try {
			await storeMidiFile(entry.buffer, entry.name);
			await loadMidiFromBuffer(entry.buffer, entry.name, true);
		} catch (error) {
			midi = null;
			durationSeconds = 0;
			errorMessage = error instanceof Error ? error.message : 'Failed to load MIDI file';
		} finally {
			isLoading = false;
		}
	}

	async function handleDeleteLibrary(entry: MidiLibraryItem, event: Event) {
		event.stopPropagation();
		if (!confirm(`Delete "${entry.name}" from saved MIDI?`)) return;
		libraryError = '';
		try {
			await deleteLibraryFile(entry.name);
			await refreshLibrary();
		} catch (error) {
			libraryError = error instanceof Error ? error.message : 'Failed to delete MIDI file';
		}
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
		clearActiveNoteSlots();
		midiState.clearAllNotes();
		isPlaying = false;
	}

	function pausePlayback() {
		clearTimers();
		stopProgressTracking();
		isPlaying = false;
	}

	function scrollTimelineTo(position: number) {
		if (!timelineEl) return;
		const target = position * timelinePixelsPerSecond - timelineEl.clientWidth / 2;
		const maxScroll = timelineEl.scrollWidth - timelineEl.clientWidth;
		timelineEl.scrollLeft = Math.max(0, Math.min(target, maxScroll));
	}

	function schedulePlayback(currentMidi: InstanceType<MidiClass>, startOffset = 0, endOffset?: number) {
		const notes = timelineNotes.length ? timelineNotes : currentMidi.tracks.flatMap((track) => track.notes);
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
					const startAt = startTime + startMs;
					const endAt = startTime + endMs;
					activeNoteMap.set(note.midi, {
						midi: note.midi,
						name: midiToNote(note.midi),
						startMs: startAt,
						endMs: endAt,
						durationMs: Math.max(1, endAt - startAt)
					});
					updateActiveNoteSlots();
					midiState.playNote(note.midi, true, velocity);
				}, Math.max(0, startMs - (performance.now() - startTime)))
			);

			timeouts.push(
				window.setTimeout(() => {
					activeNoteMap.delete(note.midi);
					updateActiveNoteSlots();
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
			playbackNow = performance.now();
			const elapsedSeconds = ((performance.now() - startOffsetTime) / 1000) * playbackRate;
			currentPosition = Math.min(stopAt, offset + elapsedSeconds);
			if (currentPosition - lastStoredPosition >= 0.5 || currentPosition === 0) {
				lastStoredPosition = currentPosition;
				saveState();
			}
			scrollTimelineTo(currentPosition);
			if (isPlaying) {
				rafId = requestAnimationFrame(progress);
			}
		};
		stopProgressTracking();
		clearActiveNoteSlots();
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
			const buffer = await file.arrayBuffer();
			await storeMidiFile(buffer, file.name);
			await loadMidiFromBuffer(buffer, file.name, true);
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

	async function handleGenerateSheet() {
		if (!browser) return;
		sheetError = '';
		sheetReady = false;
		isRenderingSheet = true;

		try {
			let buffer = midiBuffer;
			if (!buffer) {
				const stored = await loadMidiFile();
				buffer = stored?.buffer ?? null;
				if (stored?.name) {
					fileName = stored.name;
				}
			}
			if (!buffer) throw new Error('No MIDI file loaded');

			const formData = new FormData();
			const name = fileName || 'file.mid';
			formData.append('file', new Blob([buffer], { type: 'audio/midi' }), name);

			const response = await fetch('/api/partition', {
				method: 'POST',
				body: formData
			});

			if (!response.ok) {
				const message = await response.text();
				throw new Error(message || 'Failed to generate sheet music');
			}

			const xml = await response.text();
			await renderSheet(xml);
		} catch (error) {
			sheetError = error instanceof Error ? error.message : 'Failed to generate sheet music';
		} finally {
			isRenderingSheet = false;
		}
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

	function handleTimelineClick(position: number) {
		if (!midi) return;
		stopPlayback();
		currentPosition = Math.max(0, Math.min(position, durationSeconds));
		lastStoredPosition = currentPosition;
		saveState();
		scrollTimelineTo(currentPosition);
		midiState.clearAllNotes();
		isPlaying = true;
		const end = isLooping && loopEnd !== null ? loopEnd : undefined;
		schedulePlayback(midi, currentPosition, end);
	}

	function handleSeekInput(event: Event) {
		const target = event.target as HTMLInputElement;
		currentPosition = Number(target.value);
		lastStoredPosition = currentPosition;
		saveState();
		scrollTimelineTo(currentPosition);
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

	function handleSpaceToggle(event: KeyboardEvent) {
		if (event.code !== 'Space') return;
		const target = event.target as HTMLElement | null;
		if (target?.isContentEditable) return;
		const tag = target?.tagName;
		if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
		if (!midi) return;
		event.preventDefault();
		if (isPlaying) {
			pausePlayback();
			saveState();
		} else {
			handlePlay();
		}
	}

	onDestroy(() => {
		stopPlayback();
		if (browser) {
			window.removeEventListener('keydown', handleSpaceToggle);
		}
	});

	onMount(async () => {
		if (!browser) return;
		window.addEventListener('keydown', handleSpaceToggle);
		midiState.connect();
		loadState();
		await refreshLibrary();
		try {
			const stored = await loadMidiFile();
			if (!stored) return;
			await loadMidiFromBuffer(stored.buffer, stored.name, false, currentPosition);
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
			{#if showSheet}
				<button type="button" class="action ghost" onclick={handleGenerateSheet} disabled={isRenderingSheet}>
					{isRenderingSheet ? 'Rendering…' : 'Generate Sheet'}
				</button>
			{/if}
			<label class="loop-toggle">
				<input
					type="checkbox"
					checked={isLooping}
					disabled={!midi}
					onchange={(event) => {
						const target = event.currentTarget as HTMLInputElement;
						if (target.checked) {
							if (loopStart === null || loopEnd === null) {
								loopStart = 0;
								loopEnd = durationSeconds || 0;
							}
							startLoop();
						} else {
							stopLoop();
						}
					}}
				/>
				Loop
			</label>
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

		<div class="library-panel">
			<div class="library-header">
				{#if midiBuffer && fileName}
					<button
						type="button"
						class="action ghost"
						onclick={handleSaveToLibrary}
						disabled={isSavingLibrary}
					>
						{isSavingLibrary ? 'Saving…' : 'Save Current MIDI'}
					</button>
				{/if}
				<h3>Saved MIDI</h3>
			</div>
			<p class="library-hint">Save the current MIDI to keep it in your library list.</p>
			{#if libraryError}
				<div class="library-error">{libraryError}</div>
			{/if}
			<div class="library-list">
				{#if libraryFiles.length === 0}
					<p class="library-empty">No saved files yet.</p>
				{:else}
				{#each libraryFiles as entry}
					<div class="library-item" class:active={entry.name === fileName}>
						<button
							type="button"
							class="library-select"
							onclick={() => handleLibrarySelect(entry)}
						>
							<span class="library-name">{entry.name}</span>
						</button>
						<button
							type="button"
							class="library-delete"
							aria-label="Delete {entry.name}"
							onclick={(event) => handleDeleteLibrary(entry, event)}
						>
							Delete
						</button>
					</div>
				{/each}
				{/if}
			</div>
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

		<div class="timeline">
			<div class="timeline-scroll" bind:this={timelineEl}>
				<div
					class="timeline-track"
					style="width: {Math.max(1, durationSeconds) * timelinePixelsPerSecond}px; height: {timelineLaneHeight * 12 + 16}px"
				>
					<div
						class="timeline-marker"
						style="left: {currentPosition * timelinePixelsPerSecond}px"
					></div>
					{#each timelineNotes as note}
						<button
							type="button"
							class="note-bar"
							style="left: {note.time * timelinePixelsPerSecond}px; width: {Math.max(4, note.duration * timelinePixelsPerSecond)}px; top: {(11 - (note.midi % 12)) * timelineLaneHeight + 8}px"
							onclick={() => handleTimelineClick(note.time)}
						></button>
					{/each}
				</div>
			</div>
			<div class="timeline-hint">Click a note to jump and restart playback.</div>
		</div>

		<div class="now-playing">
			<div class="now-playing-header">
				<h3>Now Playing</h3>
				<span class="now-playing-count">{activeNoteSlots.length} active</span>
			</div>
			<div class="now-playing-list">
				{#if activeNoteSlots.length === 0}
					<p class="now-playing-empty">No notes sounding.</p>
				{:else}
					{#each activeNoteSlots as note}
						{@const remaining = Math.max(0, note.endMs - playbackNow)}
						{@const ratio = note.durationMs ? remaining / note.durationMs : 0}
						<div class="now-playing-item">
							<span class="now-playing-name">{note.name}</span>
							<div class="now-playing-bar-track">
								<span class="now-playing-now"></span>
								<span class="now-playing-bar" style={getNowPlayingBarStyle(note)}>
									<span
										class="now-playing-bar-fill"
										style="width: {Math.max(0, Math.min(1, ratio)) * 100}%"
									></span>
								</span>
							</div>
						</div>
					{/each}
				{/if}
			</div>
		</div>

		{#if showSheet}
			<div class="sheet-panel">
				<div class="sheet-header">
					<h3>Sheet Music</h3>
					{#if sheetError}
						<span class="sheet-error">{sheetError}</span>
					{/if}
				</div>
				<div class="sheet-output" bind:this={sheetContainer}>
					{#if !sheetReady && !sheetError}
						<p class="sheet-placeholder">Generate a sheet to display the partition.</p>
					{/if}
				</div>
			</div>
		{/if}
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

	.library-panel {
		margin-top: 16px;
		display: grid;
		gap: 10px;
	}

	.library-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 12px;
	}

	.library-header h3 {
		margin: 0;
		font-size: 1rem;
		color: #1e293b;
	}

	.library-hint {
		margin: 0;
		font-size: 13px;
		color: #64748b;
	}

	.library-error {
		color: #b91c1c;
		font-size: 13px;
	}

	.library-list {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: #f8fafc;
		max-height: 220px;
		overflow-y: auto;
	}

	.library-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 6px;
		border-radius: 12px;
		border: 1px solid transparent;
		background: white;
		text-align: left;
		transition: border-color 0.2s ease, box-shadow 0.2s ease;
	}

	.library-item:hover {
		border-color: rgba(37, 99, 235, 0.4);
		box-shadow: 0 6px 14px rgba(37, 99, 235, 0.12);
	}

	.library-item.active {
		border-color: rgba(37, 99, 235, 0.6);
		box-shadow: 0 6px 14px rgba(37, 99, 235, 0.2);
	}

	.library-select {
		flex: 1;
		border: none;
		background: transparent;
		cursor: pointer;
		text-align: left;
		padding: 6px 8px;
		font-weight: 600;
		color: #1e293b;
	}

	.library-delete {
		border: none;
		background: transparent;
		color: #ef4444;
		font-weight: 600;
		cursor: pointer;
		padding: 4px 6px;
		border-radius: 6px;
	}

	.library-delete:hover {
		background: rgba(239, 68, 68, 0.12);
	}

	.library-name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.library-empty {
		margin: 0;
		color: #94a3b8;
		font-size: 13px;
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

	.loop-toggle {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-weight: 600;
		color: #334155;
	}

	.loop-toggle input {
		accent-color: #2563eb;
	}

	.timeline {
		margin-top: 18px;
		display: grid;
		gap: 8px;
	}

	.timeline-scroll {
		overflow-x: auto;
		overflow-y: hidden;
		border: 1px solid rgba(148, 163, 184, 0.4);
		border-radius: 10px;
		background: #f8fafc;
		padding: 12px 0;
	}

	.timeline-track {
		position: relative;
		min-height: 112px;
	}

	.note-bar {
		position: absolute;
		height: 6px;
		background: #93c5fd;
		border-radius: 999px;
		border: none;
		cursor: pointer;
		box-shadow: inset -1px 0 0 rgba(15, 23, 42, 0.2);
		transition: background 0.2s ease, transform 0.2s ease;
	}

	.note-bar:hover {
		background: #2563eb;
		transform: translateY(-1px);
	}

	.timeline-marker {
		position: absolute;
		top: 0;
		bottom: 0;
		width: 2px;
		background: #ef4444;
		box-shadow: 0 0 8px rgba(239, 68, 68, 0.6);
		pointer-events: none;
	}

	.timeline-hint {
		font-size: 12px;
		color: #475569;
	}

	.now-playing {
		margin-top: 16px;
		display: grid;
		gap: 10px;
	}

	.now-playing-header {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
	}

	.now-playing-header h3 {
		margin: 0;
		font-size: 1rem;
		color: #1e293b;
	}

	.now-playing-count {
		font-size: 12px;
		color: #64748b;
	}

	.now-playing-list {
		display: grid;
		gap: 8px;
		padding: 12px;
		border-radius: 12px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		background: #f8fafc;
		min-height: 208px;
		max-height: 208px;
		overflow-y: auto;
	}

	.now-playing-item {
		display: grid;
		gap: 6px;
	}

	.now-playing-name {
		font-weight: 600;
		color: #1e293b;
	}

	.now-playing-bar-track {
		position: relative;
		height: 6px;
		background: rgba(148, 163, 184, 0.2);
		border-radius: 999px;
	}

	.now-playing-now {
		position: absolute;
		left: 50%;
		top: -2px;
		bottom: -2px;
		width: 2px;
		background: #ef4444;
		border-radius: 999px;
		transform: translateX(-50%);
		pointer-events: none;
	}

	.now-playing-bar {
		position: absolute;
		top: 1px;
		height: 4px;
		background: rgba(148, 163, 184, 0.4);
		border-radius: 999px;
		overflow: hidden;
	}

	.now-playing-bar-fill {
		display: block;
		height: 100%;
		background: #2563eb;
		border-radius: inherit;
		transition: width 0.08s linear;
	}

	.now-playing-empty {
		margin: 0;
		color: #94a3b8;
		font-size: 13px;
	}

	.sheet-panel {
		margin-top: 20px;
		display: grid;
		gap: 10px;
	}

	.sheet-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.sheet-header h3 {
		margin: 0;
		color: #1e293b;
	}

	.sheet-error {
		color: #b91c1c;
		font-weight: 600;
	}

	.sheet-output {
		min-height: 200px;
		border: 1px solid rgba(148, 163, 184, 0.4);
		border-radius: 12px;
		padding: 12px;
		background: #ffffff;
		overflow-x: auto;
	}

	.sheet-placeholder {
		margin: 0;
		color: #64748b;
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
