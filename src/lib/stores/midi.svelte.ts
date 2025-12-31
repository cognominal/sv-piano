// MIDI state management using Svelte 5 runes

import { 
	requestMIDIAccess, 
	findCasioDevices, 
	setupMIDIInputListener, 
	type MIDIDevice, 
	type MIDIMessage 
} from '../utils/midi-utils.js';

// MIDI connection state
class MIDIState {
	midiAccess = $state<MIDIAccess | null>(null);
	connectedDevices = $state<MIDIDevice[]>([]);
	activeDevice = $state<MIDIDevice | null>(null);
	isConnecting = $state(false);
	connectionError = $state<string | null>(null);
	
	// Currently pressed keys (MIDI note numbers)
	activeNotes = $state<Set<number>>(new Set());
	
	// Recent MIDI messages for debugging
	recentMessages = $state<MIDIMessage[]>([]);
	private audioContext: AudioContext | null = null;
	private localOscillators = new Map<
		number,
		{ osc: OscillatorNode; gain: GainNode; filter: BiquadFilterNode }
	>();
	private sampleBuffers = new Map<number, AudioBuffer>();
	private sampleLoads = new Map<number, Promise<AudioBuffer>>();
	private activeSampleNotes = new Map<number, { source: AudioBufferSourceNode; gain: GainNode }>();
	private sampleFiles = new Map<number, string>([
		[36, '/samples/piano/C2.mp3'],
		[48, '/samples/piano/C3.mp3'],
		[60, '/samples/piano/C4.mp3'],
		[72, '/samples/piano/C5.mp3'],
		[84, '/samples/piano/C6.mp3']
	]);

	async connect() {
		this.isConnecting = true;
		this.connectionError = null;

		try {
			const access = await requestMIDIAccess();
			if (!access) {
				throw new Error('Could not get MIDI access');
			}

			this.midiAccess = access;
			this.updateDevices();

			// Listen for device connection changes
			access.onstatechange = () => {
				this.updateDevices();
			};

		} catch (error) {
			this.connectionError = error instanceof Error ? error.message : 'Unknown MIDI error';
			console.error('MIDI connection failed:', error);
		} finally {
			this.isConnecting = false;
		}
	}

	private updateDevices() {
		if (!this.midiAccess) return;

		const devices = findCasioDevices(this.midiAccess);
		this.connectedDevices = devices;

		// Auto-connect to first Casio device if none is active
		if (devices.length > 0 && !this.activeDevice) {
			this.setActiveDevice(devices[0]);
		}

		// Check if active device is still connected
		if (this.activeDevice && !devices.find(d => d.id === this.activeDevice!.id)) {
			this.activeDevice = null;
		}
	}

	setActiveDevice(device: MIDIDevice) {
		// Disconnect from previous device
		if (this.activeDevice?.input) {
			this.activeDevice.input.onmidimessage = null;
		}

		this.activeDevice = device;
		
		// Setup input listener for new device
		if (device.input) {
			setupMIDIInputListener(device.input, (message) => {
				this.handleMIDIMessage(message);
			});
		}
	}

	private handleMIDIMessage(message: MIDIMessage) {
		// Add to recent messages (keep last 50)
		this.recentMessages = [message, ...this.recentMessages.slice(0, 49)];

		// Handle note on/off
		if (message.type === 'noteOn' && message.note !== undefined) {
			this.setActiveNote(message.note, true);
		} else if (message.type === 'noteOff' && message.note !== undefined) {
			this.setActiveNote(message.note, false);
		}
	}

	// Manually trigger note for testing
	simulateNote(midiNote: number, on: boolean) {
		this.setActiveNote(midiNote, on);
	}

	// Play note locally or send to MIDI output if available
	playNote(midiNote: number, on: boolean, velocity = 100) {
		const output = this.activeDevice?.output;
		if (output) {
			const status = on ? 0x90 : 0x80;
			const vel = on ? velocity : 0;
			output.send([status, midiNote, vel]);
		} else if (on) {
			this.startLocalNote(midiNote, velocity);
		} else {
			this.stopLocalNote(midiNote);
		}

		this.setActiveNote(midiNote, on);
	}

	private setActiveNote(midiNote: number, on: boolean) {
		const nextNotes = new Set(this.activeNotes);
		if (on) {
			nextNotes.add(midiNote);
		} else {
			nextNotes.delete(midiNote);
		}
		this.activeNotes = nextNotes;
	}

	private ensureAudioContext(): AudioContext | null {
		if (!this.audioContext) {
			try {
				this.audioContext = new AudioContext();
			} catch {
				return null;
			}
		}

		if (this.audioContext.state === 'suspended') {
			void this.audioContext.resume();
		}

		return this.audioContext;
	}

	private startLocalNote(midiNote: number, velocity: number) {
		if (this.activeSampleNotes.has(midiNote) || this.localOscillators.has(midiNote)) return;
		const sampleNote = this.getNearestSampleNote(midiNote);
		if (sampleNote === null) {
			this.startSynthNote(midiNote, velocity);
			return;
		}

		this.loadSample(sampleNote)
			.then((buffer) => {
				if (this.activeSampleNotes.has(midiNote)) return;
				this.startSampleNote(midiNote, sampleNote, buffer, velocity);
			})
			.catch(() => {
				this.startSynthNote(midiNote, velocity);
			});
	}

	private startSampleNote(
		midiNote: number,
		sampleNote: number,
		buffer: AudioBuffer,
		velocity: number
	) {
		const context = this.ensureAudioContext();
		if (!context) return;

		const source = context.createBufferSource();
		const gain = context.createGain();
		const now = context.currentTime;
		const playbackRate = Math.pow(2, (midiNote - sampleNote) / 12);
		const velocityGain = Math.min(Math.max(velocity / 127, 0.1), 1) * 0.5;

		source.buffer = buffer;
		source.playbackRate.value = playbackRate;
		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.linearRampToValueAtTime(velocityGain, now + 0.005);
		gain.gain.exponentialRampToValueAtTime(velocityGain * 0.4, now + 0.2);

		source.connect(gain).connect(context.destination);
		source.start();

		this.activeSampleNotes.set(midiNote, { source, gain });
	}

	private startSynthNote(midiNote: number, velocity: number) {
		if (this.localOscillators.has(midiNote)) return;
		const context = this.ensureAudioContext();
		if (!context) return;

		const osc = context.createOscillator();
		const gain = context.createGain();
		const filter = context.createBiquadFilter();
		const frequency = 440 * Math.pow(2, (midiNote - 69) / 12);
		const velocityGain = Math.min(Math.max(velocity / 127, 0.1), 1) * 0.3;
		const now = context.currentTime;

		osc.type = 'triangle';
		osc.frequency.value = frequency;
		filter.type = 'lowpass';
		filter.frequency.value = Math.min(5000, frequency * 6);
		filter.Q.value = 0.7;

		gain.gain.setValueAtTime(0.0001, now);
		gain.gain.linearRampToValueAtTime(velocityGain, now + 0.01);
		gain.gain.exponentialRampToValueAtTime(velocityGain * 0.35, now + 0.2);

		osc.connect(filter).connect(gain).connect(context.destination);
		osc.start();

		this.localOscillators.set(midiNote, { osc, gain, filter });
	}

	private stopLocalNote(midiNote: number) {
		const sample = this.activeSampleNotes.get(midiNote);
		if (sample) {
			const now = this.audioContext?.currentTime ?? 0;
			sample.gain.gain.setTargetAtTime(0.0001, now, 0.08);
			sample.source.stop(now + 0.25);
			sample.source.disconnect();
			sample.gain.disconnect();
			this.activeSampleNotes.delete(midiNote);
		}

		const node = this.localOscillators.get(midiNote);
		if (!node) return;

		const now = this.audioContext?.currentTime ?? 0;
		node.gain.gain.setTargetAtTime(0.0001, now, 0.08);
		node.osc.stop(now + 0.25);
		node.osc.disconnect();
		node.gain.disconnect();
		node.filter.disconnect();
		this.localOscillators.delete(midiNote);
	}

	// Clear all active notes (panic button)
	clearAllNotes() {
		this.activeNotes = new Set();
		this.activeSampleNotes.forEach(({ source, gain }) => {
			const now = this.audioContext?.currentTime ?? 0;
			gain.gain.setTargetAtTime(0.0001, now, 0.08);
			source.stop(now + 0.25);
			source.disconnect();
			gain.disconnect();
		});
		this.activeSampleNotes.clear();
		this.localOscillators.forEach(({ osc, gain, filter }) => {
			const now = this.audioContext?.currentTime ?? 0;
			gain.gain.setTargetAtTime(0.0001, now, 0.08);
			osc.stop(now + 0.25);
			osc.disconnect();
			gain.disconnect();
			filter.disconnect();
		});
		this.localOscillators.clear();
	}

	private getNearestSampleNote(midiNote: number): number | null {
		const available = Array.from(this.sampleFiles.keys());
		if (available.length === 0) return null;
		return available.reduce((closest, current) => {
			return Math.abs(current - midiNote) < Math.abs(closest - midiNote) ? current : closest;
		}, available[0]);
	}

	private loadSample(sampleNote: number): Promise<AudioBuffer> {
		const existing = this.sampleBuffers.get(sampleNote);
		if (existing) return Promise.resolve(existing);

		const pending = this.sampleLoads.get(sampleNote);
		if (pending) return pending;

		const context = this.ensureAudioContext();
		if (!context) return Promise.reject(new Error('Audio context unavailable'));

		const url = this.sampleFiles.get(sampleNote);
		if (!url) return Promise.reject(new Error('Sample file missing'));

		const loadPromise = fetch(url)
			.then((res) => {
				if (!res.ok) throw new Error(`Failed to load sample ${url}`);
				return res.arrayBuffer();
			})
			.then((data) => context.decodeAudioData(data))
			.then((buffer) => {
				this.sampleBuffers.set(sampleNote, buffer);
				return buffer;
			})
			.finally(() => {
				this.sampleLoads.delete(sampleNote);
			});

		this.sampleLoads.set(sampleNote, loadPromise);
		return loadPromise;
	}

	// Get connection status
	get connectionStatus(): 'disconnected' | 'connecting' | 'connected' | 'error' {
		if (this.connectionError) return 'error';
		if (this.isConnecting) return 'connecting';
		if (this.activeDevice) return 'connected';
		return 'disconnected';
	}
}

// Export singleton instance
export const midiState = new MIDIState();
