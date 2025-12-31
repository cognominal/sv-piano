<script>
	import '../app.css';
</script>

<nav class="main-nav">
	<a class="nav-link" href="/">Home</a>
	<a class="nav-link" href="/midi">MIDI Player</a>
</nav>

<slot />

<style>
	.main-nav {
		position: sticky;
		top: 0;
		z-index: 10;
		display: flex;
		gap: 12px;
		align-items: center;
		padding: 12px 20px;
		background: rgba(15, 23, 42, 0.9);
		backdrop-filter: blur(10px);
		border-bottom: 1px solid rgba(255, 255, 255, 0.1);
	}

	.nav-link {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		padding: 8px 14px;
		border-radius: 999px;
		background: rgba(255, 255, 255, 0.1);
		color: #f8fafc;
		text-decoration: none;
		font-weight: 600;
		transition: background 0.2s ease, transform 0.2s ease;
	}

	.nav-link:hover {
		background: rgba(255, 255, 255, 0.2);
		transform: translateY(-1px);
	}
</style>
