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
			this.activeNotes.add(message.note);
		} else if (message.type === 'noteOff' && message.note !== undefined) {
			this.activeNotes.delete(message.note);
		}
	}

	// Manually trigger note for testing
	simulateNote(midiNote: number, on: boolean) {
		if (on) {
			this.activeNotes.add(midiNote);
		} else {
			this.activeNotes.delete(midiNote);
		}
	}

	// Clear all active notes (panic button)
	clearAllNotes() {
		this.activeNotes.clear();
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
