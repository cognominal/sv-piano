// See https://kit.svelte.dev/docs/types#app
// for information about these interfaces
declare global {
	namespace App {
		// interface Error {}
		// interface Locals {}
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}

	// Web MIDI API types
	interface Navigator {
		requestMIDIAccess(options?: MIDIOptions): Promise<MIDIAccess>;
	}

	interface MIDIOptions {
		sysex?: boolean;
		software?: boolean;
	}

	interface MIDIAccess extends EventTarget {
		readonly inputs: MIDIInputMap;
		readonly outputs: MIDIOutputMap;
		readonly sysexEnabled: boolean;
		onstatechange: ((event: MIDIConnectionEvent) => void) | null;
	}

	interface MIDIInputMap {
		readonly size: number;
		values(): IterableIterator<MIDIInput>;
		keys(): IterableIterator<string>;
		get(key: string): MIDIInput | undefined;
		has(key: string): boolean;
		entries(): IterableIterator<[string, MIDIInput]>;
		forEach(callback: (value: MIDIInput, key: string, map: MIDIInputMap) => void): void;
	}

	interface MIDIOutputMap {
		readonly size: number;
		values(): IterableIterator<MIDIOutput>;
		keys(): IterableIterator<string>;
		get(key: string): MIDIOutput | undefined;
		has(key: string): boolean;
		entries(): IterableIterator<[string, MIDIOutput]>;
		forEach(callback: (value: MIDIOutput, key: string, map: MIDIOutputMap) => void): void;
	}

	interface MIDIPort extends EventTarget {
		readonly id: string;
		readonly manufacturer?: string;
		readonly name?: string;
		readonly type: MIDIPortType;
		readonly version?: string;
		readonly state: MIDIPortDeviceState;
		readonly connection: MIDIPortConnectionState;
		onstatechange: ((event: MIDIConnectionEvent) => void) | null;
		open(): Promise<MIDIPort>;
		close(): Promise<MIDIPort>;
	}

	interface MIDIInput extends MIDIPort {
		onmidimessage: ((event: MIDIMessageEvent) => void) | null;
	}

	interface MIDIOutput extends MIDIPort {
		send(data: Uint8Array, timestamp?: number): void;
		clear(): void;
	}

	interface MIDIMessageEvent extends Event {
		readonly data: Uint8Array;
		readonly receivedTime: number;
	}

	interface MIDIConnectionEvent extends Event {
		readonly port: MIDIPort;
	}

	type MIDIPortType = "input" | "output";
	type MIDIPortDeviceState = "disconnected" | "connected";
	type MIDIPortConnectionState = "open" | "closed" | "pending";
}

export {};
