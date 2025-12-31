<script lang="ts">
	import { midiState } from '../stores/midi.svelte.js';
	import { isMIDISupported } from '../utils/midi-utils.js';

	// Connection status styling
	function getStatusClass(status: string): string {
		switch (status) {
			case 'connected': return 'status-connected';
			case 'connecting': return 'status-connecting';
			case 'error': return 'status-error';
			default: return 'status-disconnected';
		}
	}

	function getStatusText(status: string): string {
		switch (status) {
			case 'connected': return 'Connected';
			case 'connecting': return 'Connecting...';
			case 'error': return 'Error';
			default: return 'Disconnected';
		}
	}
</script>

<div class="midi-connection">
	<div class="connection-header">
		<h3>MIDI Connection</h3>
		<div class="status {getStatusClass(midiState.connectionStatus)}">
			<span class="status-dot"></span>
			{getStatusText(midiState.connectionStatus)}
		</div>
	</div>

	{#if !isMIDISupported()}
		<div class="error-message">
			<p><strong>Web MIDI API not supported</strong></p>
			<p>Please use Chrome, Edge, or Opera browser for MIDI support.</p>
		</div>
	{:else if midiState.connectionError}
		<div class="error-message">
			<p><strong>Connection Error:</strong></p>
			<p>{midiState.connectionError}</p>
			<button onclick={() => midiState.connect()}>
				Try Again
			</button>
		</div>
	{:else if midiState.connectionStatus === 'disconnected'}
		<div class="connect-section">
			<p>Connect your Casio keyboard to start playing!</p>
			<button 
				onclick={() => midiState.connect()}
				disabled={midiState.isConnecting}
			>
				{midiState.isConnecting ? 'Connecting...' : 'Connect MIDI'}
			</button>
		</div>
	{:else if midiState.connectedDevices.length === 0}
		<div class="no-devices">
			<p>No Casio keyboards detected.</p>
			<p>Make sure your keyboard is connected via USB and turned on.</p>
			<button onclick={() => midiState.connect()}>
				Refresh
			</button>
		</div>
	{:else}
		<div class="device-list">
			<h4>Available Devices:</h4>
			{#each midiState.connectedDevices as device}
				<div 
					class="device-item"
					class:active={midiState.activeDevice?.id === device.id}
				>
					<div class="device-info">
						<span class="device-name">{device.name}</span>
						<span class="device-manufacturer">{device.manufacturer}</span>
					</div>
					
					<div class="device-capabilities">
						{#if device.input}
							<span class="capability input">Input</span>
						{/if}
						{#if device.output}
							<span class="capability output">Output</span>
						{/if}
					</div>

					{#if midiState.activeDevice?.id !== device.id}
						<button 
							onclick={() => midiState.setActiveDevice(device)}
							class="connect-btn"
						>
							Connect
						</button>
					{:else}
						<span class="connected-label">Connected</span>
					{/if}
				</div>
			{/each}
		</div>

		{#if midiState.activeDevice}
			<div class="active-device-info">
				<h4>Active Device: {midiState.activeDevice.name}</h4>
				
				<div class="device-stats">
					<div class="stat">
						<span class="status-label">Active Notes:</span>
						<span class="status-value">{midiState.activeNotes.size}</span>
					</div>

					<div class="stat">
						<span class="status-label">Recent Messages:</span>
						<span class="status-value">{midiState.recentMessages.length}</span>
					</div>
				</div>

				{#if midiState.activeNotes.size > 0}
					<div class="active-notes">
						<span class="notes-label">Currently Playing:</span>
						<div class="notes-display">
							{#each Array.from(midiState.activeNotes) as note}
								<span class="note-chip">{note}</span>
							{/each}
						</div>
					</div>
				{/if}

				<div class="device-actions">
					<button onclick={() => midiState.clearAllNotes()}>
						Clear All Notes
					</button>
				</div>
			</div>
		{/if}
	{/if}

	<!-- Debug section (only show if there are recent messages) -->
	{#if midiState.recentMessages.length > 0}
		<details class="debug-section">
			<summary>Debug Info ({midiState.recentMessages.length} messages)</summary>
			<div class="message-log">
				{#each midiState.recentMessages.slice(0, 10) as message}
					<div class="message-item">
						<span class="message-type">{message.type}</span>
						{#if message.note !== undefined}
							<span class="message-note">Note: {message.note}</span>
						{/if}
						{#if message.velocity !== undefined}
							<span class="message-velocity">Vel: {message.velocity}</span>
						{/if}
						<span class="message-time">{new Date(message.timestamp).toLocaleTimeString()}</span>
					</div>
				{/each}
			</div>
		</details>
	{/if}
</div>

<style>
	.midi-connection {
		background: white;
		border: 1px solid #ddd;
		border-radius: 8px;
		padding: 20px;
		margin-bottom: 20px;
	}

	.connection-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15px;
	}

	.connection-header h3 {
		margin: 0;
		color: #333;
	}

	.status {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 6px 12px;
		border-radius: 20px;
		font-size: 14px;
		font-weight: bold;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
	}

	.status-connected {
		background: #e8f5e8;
		color: #2e7d32;
	}

	.status-connected .status-dot {
		background: #4caf50;
	}

	.status-connecting {
		background: #fff3e0;
		color: #f57c00;
	}

	.status-connecting .status-dot {
		background: #ff9800;
		animation: pulse 1s infinite;
	}

	.status-error {
		background: #ffebee;
		color: #c62828;
	}

	.status-error .status-dot {
		background: #f44336;
	}

	.status-disconnected {
		background: #f5f5f5;
		color: #757575;
	}

	.status-disconnected .status-dot {
		background: #9e9e9e;
	}

	@keyframes pulse {
		0%, 100% { opacity: 1; }
		50% { opacity: 0.5; }
	}

	.error-message,
	.connect-section,
	.no-devices {
		text-align: center;
		padding: 20px;
		background: #f9f9f9;
		border-radius: 4px;
	}

	.error-message {
		background: #ffebee;
		color: #c62828;
	}

	.connect-section p,
	.no-devices p {
		margin: 0 0 15px 0;
		color: #666;
	}

	button {
		background: #2196f3;
		color: white;
		border: none;
		padding: 10px 20px;
		border-radius: 4px;
		cursor: pointer;
		font-size: 14px;
		transition: background-color 0.2s ease;
	}

	button:hover:not(:disabled) {
		background: #1976d2;
	}

	button:disabled {
		background: #ccc;
		cursor: not-allowed;
	}

	.device-list {
		margin-top: 15px;
	}

	.device-list h4 {
		margin: 0 0 10px 0;
		color: #333;
	}

	.device-item {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 12px;
		border: 1px solid #ddd;
		border-radius: 4px;
		margin-bottom: 8px;
		background: #fafafa;
		transition: all 0.2s ease;
	}

	.device-item.active {
		background: #e3f2fd;
		border-color: #2196f3;
	}

	.device-info {
		display: flex;
		flex-direction: column;
		flex: 1;
	}

	.device-name {
		font-weight: bold;
		color: #333;
	}

	.device-manufacturer {
		font-size: 12px;
		color: #666;
	}

	.device-capabilities {
		display: flex;
		gap: 5px;
		margin: 0 10px;
	}

	.capability {
		background: #e0e0e0;
		color: #555;
		padding: 2px 6px;
		border-radius: 10px;
		font-size: 11px;
	}

	.capability.input {
		background: #c8e6c9;
		color: #2e7d32;
	}

	.capability.output {
		background: #ffcdd2;
		color: #c62828;
	}

	.connect-btn {
		background: #4caf50;
		padding: 6px 12px;
		font-size: 12px;
	}

	.connect-btn:hover {
		background: #45a049;
	}

	.connected-label {
		color: #4caf50;
		font-weight: bold;
		font-size: 12px;
	}

	.active-device-info {
		margin-top: 20px;
		padding: 15px;
		background: #f0f8ff;
		border: 1px solid #b3d9ff;
		border-radius: 4px;
	}

	.active-device-info h4 {
		margin: 0 0 10px 0;
		color: #1976d2;
	}

	.device-stats {
		display: flex;
		gap: 20px;
		margin-bottom: 10px;
	}

	.stat {
		display: flex;
		gap: 5px;
		font-size: 14px;
	}

	.status-label {
		color: #666;
	}

	.status-value {
		font-weight: bold;
		color: #333;
	}

	.active-notes {
		margin: 10px 0;
	}

	.notes-label {
		display: block;
		margin-bottom: 5px;
		color: #666;
		font-size: 14px;
	}

	.notes-display {
		display: flex;
		flex-wrap: wrap;
		gap: 5px;
	}

	.note-chip {
		background: #4caf50;
		color: white;
		padding: 2px 8px;
		border-radius: 12px;
		font-size: 12px;
		font-weight: bold;
	}

	.device-actions {
		margin-top: 10px;
	}

	.device-actions button {
		background: #ff5722;
		font-size: 12px;
		padding: 6px 12px;
	}

	.device-actions button:hover {
		background: #e64a19;
	}

	.debug-section {
		margin-top: 20px;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.debug-section summary {
		padding: 10px;
		background: #f5f5f5;
		cursor: pointer;
		font-weight: bold;
	}

	.message-log {
		padding: 10px;
		max-height: 200px;
		overflow-y: auto;
	}

	.message-item {
		display: flex;
		gap: 10px;
		padding: 4px 0;
		font-size: 12px;
		border-bottom: 1px solid #eee;
	}

	.message-type {
		font-weight: bold;
		color: #2196f3;
		min-width: 60px;
	}

	.message-note {
		color: #4caf50;
	}

	.message-velocity {
		color: #ff9800;
	}

	.message-time {
		color: #666;
		margin-left: auto;
	}

	/* Responsive design */
	@media (max-width: 768px) {
		.connection-header {
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
		}

		.device-item {
			flex-direction: column;
			align-items: flex-start;
			gap: 10px;
		}

		.device-stats {
			flex-direction: column;
			gap: 5px;
		}
	}
</style>
