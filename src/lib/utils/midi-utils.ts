// MIDI utilities for Web MIDI API integration

export interface MIDIMessage {
	type: 'noteOn' | 'noteOff' | 'control';
	note?: number;
	velocity?: number;
	channel?: number;
	timestamp: number;
}

export interface MIDIDevice {
	id: string;
	name: string;
	manufacturer: string;
	input?: MIDIInput;
	output?: MIDIOutput;
}

// Parse raw MIDI message to structured format
export function parseMIDIMessage(data: Uint8Array): MIDIMessage | null {
	const [status, note, velocity] = data;
	const messageType = status & 0xF0;
	const channel = status & 0x0F;
	
	switch (messageType) {
		case 0x90: // Note On
			return {
				type: velocity > 0 ? 'noteOn' : 'noteOff',
				note,
				velocity,
				channel,
				timestamp: Date.now()
			};
		case 0x80: // Note Off
			return {
				type: 'noteOff',
				note,
				velocity,
				channel,
				timestamp: Date.now()
			};
		default:
			return {
				type: 'control',
				timestamp: Date.now()
			};
	}
}

// Check if Web MIDI API is supported
export function isMIDISupported(): boolean {
	return 'navigator' in globalThis && 'requestMIDIAccess' in navigator;
}

// Get MIDI access with error handling
export async function requestMIDIAccess(): Promise<MIDIAccess | null> {
	if (!isMIDISupported()) {
		console.error('Web MIDI API is not supported in this browser');
		return null;
	}

	try {
		const midiAccess = await navigator.requestMIDIAccess();
		console.log('MIDI access granted');
		return midiAccess;
	} catch (error) {
		console.error('Failed to get MIDI access:', error);
		return null;
	}
}

// Find Casio keyboards in available MIDI devices
export function findCasioDevices(midiAccess: MIDIAccess): MIDIDevice[] {
	const devices: MIDIDevice[] = [];

	// Check inputs
	for (const input of midiAccess.inputs.values()) {
		if (input.name?.toLowerCase().includes('casio') || input.manufacturer?.toLowerCase().includes('casio')) {
			devices.push({
				id: input.id,
				name: input.name || 'Unknown Casio Device',
				manufacturer: input.manufacturer || 'Casio',
				input
			});
		}
	}

	// Check outputs
	for (const output of midiAccess.outputs.values()) {
		if (output.name?.toLowerCase().includes('casio') || output.manufacturer?.toLowerCase().includes('casio')) {
			const existingDevice = devices.find(d => d.name === output.name);
			if (existingDevice) {
				existingDevice.output = output;
			} else {
				devices.push({
					id: output.id,
					name: output.name || 'Unknown Casio Device',
					manufacturer: output.manufacturer || 'Casio',
					output
				});
			}
		}
	}

	return devices;
}

// Setup MIDI input listener
export function setupMIDIInputListener(
	input: MIDIInput,
	onMessage: (message: MIDIMessage) => void
): void {
	input.onmidimessage = (event: MIDIMessageEvent) => {
		if (event.data) {
			const message = parseMIDIMessage(event.data);
			if (message) {
				onMessage(message);
			}
		}
	};
}

// Piano key mapping (88 keys, A0 to C8)
export const PIANO_KEYS = {
	WHITE_KEYS: [21, 23, 24, 26, 28, 29, 31, 33, 35, 36, 38, 40, 41, 43, 45, 47, 48, 50, 52, 53, 55, 57, 59, 60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79, 81, 83, 84, 86, 88, 89, 91, 93, 95, 96, 98, 100, 101, 103, 105, 107, 108],
	BLACK_KEYS: [22, 25, 27, 30, 32, 34, 37, 39, 42, 44, 46, 49, 51, 54, 56, 58, 61, 63, 66, 68, 70, 73, 75, 78, 80, 82, 85, 87, 90, 92, 94, 97, 99, 102, 104, 106],
	LOWEST_NOTE: 21, // A0
	HIGHEST_NOTE: 108 // C8
};

// Check if MIDI note is a white or black key
export function isWhiteKey(midiNote: number): boolean {
	return PIANO_KEYS.WHITE_KEYS.includes(midiNote);
}

export function isBlackKey(midiNote: number): boolean {
	return PIANO_KEYS.BLACK_KEYS.includes(midiNote);
}
