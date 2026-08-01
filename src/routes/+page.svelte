<script lang="ts">
	import { onMount } from 'svelte';
	import { resolve } from '$app/paths';
	import GamePreview from '$lib/components/GamePreview.svelte';
	import GameScoreboard from '$lib/components/GameScoreboard.svelte';
	import LiveDashboard from '$lib/components/LiveDashboard.svelte';
	import OffDayView from '$lib/components/OffDayView.svelte';
	import { preservePitchTelemetry } from '$lib/visualization.js';
	import {
		PREVIEW_REFRESH_MS,
		SCHEDULE_REFRESH_MS,
		easternDateKey,
		fetchCurrentVisualization,
		fetchGameBoxscore,
		fetchGameFeed,
		fetchHitHistory,
		fetchPiratesSchedule,
		fetchSeasonProfiles,
		isLive,
		isPreview,
		liveRefreshDelay,
		previewProfileIds,
		type GameBoxscore,
		type GameFeed,
		type Play,
		type ScheduleGame,
		type SeasonPlayerProfile
	} from '$lib/mlb';

	let gameDate = $state(easternDateKey());
	let todayGames = $state<ScheduleGame[]>([]);
	let nextGame = $state<ScheduleGame | null>(null);
	let selectedGamePk = $state<number | null>(null);
	let feed = $state<GameFeed | null>(null);
	let boxscore = $state<GameBoxscore | null>(null);
	let previewProfiles = $state<Record<number, SeasonPlayerProfile>>({});
	let visualizationPlay = $state<Play | undefined>();
	let hitHistory = $state<Play[]>([]);
	let loading = $state(true);
	let feedLoading = $state(false);
	let error = $state('');
	let lastUpdated = $state<Date | null>(null);

	let scheduleTimer: ReturnType<typeof setInterval> | undefined;
	let feedTimer: ReturnType<typeof setTimeout> | undefined;
	let scheduleController: AbortController | undefined;
	let feedController: AbortController | undefined;
	let boxscoreController: AbortController | undefined;
	let previewProfilesController: AbortController | undefined;
	let visualizationController: AbortController | undefined;
	let hitHistoryController: AbortController | undefined;

	const selectedGame = $derived(todayGames.find((game) => game.gamePk === selectedGamePk) ?? null);
	const status = $derived(feed?.gameData.status ?? selectedGame?.status);
	const linescore = $derived(feed?.liveData.linescore);

	function pickGame(games: ScheduleGame[]) {
		const liveGame = games.find((game) => isLive(game.status));
		if (liveGame) return liveGame;
		const existing = games.find((game) => game.gamePk === selectedGamePk);
		if (existing) return existing;
		const preview = games.find((game) => isPreview(game.status));
		return preview ?? games[games.length - 1] ?? null;
	}

	async function refreshSchedule(initial = false) {
		const newDate = easternDateKey();
		if (newDate !== gameDate) {
			gameDate = newDate;
			selectedGamePk = null;
			feed = null;
			boxscore = null;
			previewProfiles = {};
			visualizationPlay = undefined;
			hitHistory = [];
		}

		scheduleController?.abort();
		scheduleController = new AbortController();
		try {
			const schedule = await fetchPiratesSchedule(gameDate, scheduleController.signal);
			const datedGames = schedule.dates.flatMap((date) =>
				date.games.map((game) => ({ ...game, scheduleDate: date.date }))
			);
			todayGames = datedGames
				.filter((game) => game.scheduleDate === gameDate)
				.sort((a, b) => new Date(a.gameDate).getTime() - new Date(b.gameDate).getTime());
			nextGame = datedGames.find((game) => game.scheduleDate > gameDate) ?? null;

			const chosen = pickGame(todayGames);
			if (chosen && chosen.gamePk !== selectedGamePk) {
				await selectGame(chosen.gamePk);
			} else if (chosen && isLive(chosen.status)) {
				void loadHitHistory(chosen.gamePk);
			} else if (!chosen) {
				selectedGamePk = null;
				feed = null;
				boxscore = null;
				previewProfiles = {};
				visualizationPlay = undefined;
				hitHistory = [];
			}
			error = '';
		} catch (requestError) {
			if ((requestError as Error).name !== 'AbortError') {
				error = 'MLB data is temporarily unavailable. Retrying automatically.';
			}
		} finally {
			if (initial) loading = false;
		}
	}

	async function loadFeed(gamePk: number, showLoader = true) {
		feedController?.abort();
		feedController = new AbortController();
		if (showLoader) feedLoading = true;
		try {
			feed = await fetchGameFeed(gamePk, feedController.signal);
			lastUpdated = new Date();
			error = '';
		} catch (requestError) {
			if ((requestError as Error).name !== 'AbortError') {
				error = 'The live feed missed a turn. Retrying automatically.';
			}
		} finally {
			feedLoading = false;
		}
	}

	async function loadBoxscore(gamePk: number) {
		boxscoreController?.abort();
		boxscoreController = new AbortController();
		try {
			const data = await fetchGameBoxscore(gamePk, boxscoreController.signal);
			if (selectedGamePk === gamePk) boxscore = data;
		} catch (requestError) {
			if ((requestError as Error).name !== 'AbortError' && selectedGamePk === gamePk) {
				boxscore = null;
			}
		}
	}

	async function loadPreviewProfiles(gamePk: number) {
		previewProfilesController?.abort();
		previewProfilesController = new AbortController();
		const ids = previewProfileIds(feed ?? undefined, boxscore ?? undefined);
		if (!ids.length) {
			previewProfiles = {};
			return;
		}
		try {
			const profiles = await fetchSeasonProfiles(
				ids,
				Number((selectedGame?.gameDate ?? gameDate).slice(0, 4)),
				previewProfilesController.signal
			);
			if (selectedGamePk === gamePk) {
				previewProfiles = Object.fromEntries(profiles.map((profile) => [profile.id, profile]));
			}
		} catch (requestError) {
			if ((requestError as Error).name !== 'AbortError' && selectedGamePk === gamePk) {
				previewProfiles = {};
			}
		}
	}

	async function loadVisualization(gamePk: number) {
		visualizationController?.abort();
		visualizationController = new AbortController();
		try {
			const data = await fetchCurrentVisualization(gamePk, visualizationController.signal);
			if (selectedGamePk === gamePk) {
				visualizationPlay = preservePitchTelemetry(
					visualizationPlay,
					data.liveData.plays.currentPlay
				);
			}
		} catch (requestError) {
			if ((requestError as Error).name !== 'AbortError') visualizationPlay = undefined;
		}
	}

	async function loadHitHistory(gamePk: number) {
		hitHistoryController?.abort();
		hitHistoryController = new AbortController();
		try {
			const data = await fetchHitHistory(gamePk, hitHistoryController.signal);
			if (selectedGamePk === gamePk) hitHistory = data.allPlays ?? [];
		} catch (requestError) {
			if ((requestError as Error).name !== 'AbortError') hitHistory = [];
		}
	}

	async function refreshSelectedGameData(gamePk: number, showLoader = false) {
		await Promise.all([loadFeed(gamePk, showLoader), loadBoxscore(gamePk)]);
		const currentStatus = feed?.gameData.status ?? selectedGame?.status;
		if (isPreview(currentStatus)) {
			visualizationController?.abort();
			hitHistoryController?.abort();
			visualizationPlay = undefined;
			hitHistory = [];
			await loadPreviewProfiles(gamePk);
		} else {
			previewProfilesController?.abort();
			previewProfiles = {};
			await Promise.all([loadVisualization(gamePk), loadHitHistory(gamePk)]);
		}
	}

	function queueFeedRefresh() {
		if (feedTimer) clearTimeout(feedTimer);
		if (!selectedGamePk) return;
		const currentStatus = feed?.gameData.status ?? selectedGame?.status;
		const delay = isLive(currentStatus)
			? liveRefreshDelay(linescore, feed?.liveData.plays.currentPlay)
			: isPreview(currentStatus)
				? PREVIEW_REFRESH_MS
				: null;
		if (!delay) return;
		const gamePk = selectedGamePk;
		feedTimer = setTimeout(async () => {
			if (selectedGamePk !== gamePk) return;
			await refreshSelectedGameData(gamePk);
			queueFeedRefresh();
		}, delay);
	}

	async function selectGame(gamePk: number) {
		if (feedTimer) clearTimeout(feedTimer);
		if (gamePk !== selectedGamePk) {
			feed = null;
			boxscore = null;
			previewProfiles = {};
			visualizationPlay = undefined;
			hitHistory = [];
		}
		selectedGamePk = gamePk;
		await refreshSelectedGameData(gamePk, true);
		queueFeedRefresh();
	}

	async function manualRefresh() {
		await refreshSchedule();
		if (selectedGamePk) await refreshSelectedGameData(selectedGamePk);
		queueFeedRefresh();
	}

	function formatToday(value: string) {
		const [year, month, day] = value.split('-').map(Number);
		return new Intl.DateTimeFormat('en-US', {
			weekday: 'long',
			month: 'long',
			day: 'numeric'
		}).format(new Date(year, month - 1, day));
	}

	onMount(() => {
		void refreshSchedule(true);
		scheduleTimer = setInterval(() => void refreshSchedule(), SCHEDULE_REFRESH_MS);
		return () => {
			if (scheduleTimer) clearInterval(scheduleTimer);
			if (feedTimer) clearTimeout(feedTimer);
			scheduleController?.abort();
			feedController?.abort();
			boxscoreController?.abort();
			previewProfilesController?.abort();
			visualizationController?.abort();
			hitHistoryController?.abort();
		};
	});
</script>

<svelte:head>
	<title>Pirates Gamecast — Live Play-by-Play</title>
	<meta
		name="description"
		content="A fast, focused Pittsburgh Pirates score and play-by-play gamecast powered by MLB data."
	/>
	<meta name="theme-color" content="#111111" />
</svelte:head>

<div class="app-shell">
	<header class="topbar">
		<div class="brand" aria-label="Pirates Gamecast">
			<span class="brand-mark">P</span>
			<div><strong>BUCS</strong><small>GAMECAST</small></div>
		</div>
		<div class="date-lockup"><span>{formatToday(gameDate)}</span><small>Local time</small></div>
		<div class="connection" class:live={isLive(status)}>
			<i></i><span>{isLive(status) ? 'Live feed' : 'Auto refresh'}</span>
		</div>
	</header>

	<main>
		{#if error}
			<div class="notice" role="status">
				<span>{error}</span><button onclick={manualRefresh}>Try now</button>
			</div>
		{/if}

		{#if loading}
			<section class="loading-state" aria-live="polite">
				<div class="loader-mark">P</div>
				<strong>Checking today’s card</strong>
				<span>Connecting to MLB Stats</span>
			</section>
		{:else if !selectedGame}
			<OffDayView {nextGame} />
		{:else}
			{#if todayGames.length > 1}
				<nav class="game-picker" aria-label="Today's Pirates games">
					{#each todayGames as game, index (game.gamePk)}
						<button
							class:active={game.gamePk === selectedGamePk}
							onclick={() => selectGame(game.gamePk)}
						>
							Game {game.gameNumber ?? index + 1}<span>{game.status.detailedState}</span>
						</button>
					{/each}
				</nav>
			{/if}

			{#if isPreview(status)}
				<GamePreview game={selectedGame} {feed} {boxscore} profiles={previewProfiles} />
			{:else}
				<GameScoreboard game={selectedGame} {feed} />
				<LiveDashboard
					game={selectedGame}
					{feed}
					{boxscore}
					{visualizationPlay}
					{hitHistory}
					{feedLoading}
					onRefresh={manualRefresh}
				/>
			{/if}
		{/if}
	</main>

	<footer>
		<span>Unofficial Pirates gamecast</span>
		<span>Locations reconstructed from available MLB tracking data.</span>
		<a href={resolve('/demo')} data-sveltekit-reload>Tracking demo</a>
		<section class="fan-section" aria-label="Fans">
			<span>Fans</span>
			<ol>
				<li><span>01</span><strong>Gage Asing</strong></li>
			</ol>
		</section>
		<span
			>Data: MLB Stats API · No tracking · {lastUpdated
				? `Updated ${lastUpdated.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}`
				: 'Awaiting data'}</span
		>
	</footer>
</div>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(html) {
		background: #f3f3f1;
		color-scheme: light;
	}
	:global(body) {
		margin: 0;
		background: #f3f3f1;
		color: #171717;
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;
	}
	:global(button) {
		font: inherit;
	}
	:global(::selection) {
		color: #111;
		background: #fdb827;
	}
	:global(:focus-visible) {
		outline: 3px solid #fdb827;
		outline-offset: 3px;
	}
	.app-shell {
		min-height: 100vh;
	}
	.topbar {
		height: 74px;
		padding: 0 max(24px, calc((100vw - 1380px) / 2));
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		color: white;
		background: #111;
		border-bottom: 4px solid #fdb827;
	}
	.brand {
		display: flex;
		align-items: center;
		gap: 12px;
	}
	.brand-mark {
		width: 38px;
		height: 42px;
		display: grid;
		place-items: center;
		color: #111;
		background: #fdb827;
		font:
			900 27px/1 Georgia,
			serif;
		transform: skew(-5deg);
	}
	.brand div {
		display: flex;
		flex-direction: column;
	}
	.brand strong {
		font:
			850 16px/1 'Arial Narrow',
			'Roboto Condensed',
			sans-serif;
		letter-spacing: 0.16em;
	}
	.brand small {
		margin-top: 4px;
		color: #9e9e9a;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.22em;
	}
	.date-lockup {
		text-align: center;
	}
	.date-lockup span,
	.date-lockup small {
		display: block;
	}
	.date-lockup span {
		font-size: 12px;
		font-weight: 700;
		letter-spacing: 0.03em;
	}
	.date-lockup small {
		margin-top: 4px;
		color: #8d8d89;
		font-size: 8px;
		text-transform: uppercase;
		letter-spacing: 0.15em;
	}
	.connection {
		justify-self: end;
		display: flex;
		align-items: center;
		gap: 8px;
		color: #a5a5a1;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.connection i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #777;
	}
	.connection.live {
		color: #fff;
	}
	.connection.live i {
		background: #e5483f;
		box-shadow: 0 0 0 4px rgba(229, 72, 63, 0.15);
		animation: pulse 1.8s infinite;
	}
	main {
		max-width: 1380px;
		margin: auto;
		padding: 28px 24px 80px;
	}
	.notice {
		margin-bottom: 16px;
		padding: 11px 14px;
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #70360d;
		background: #fff1d6;
		border: 1px solid #e7c88f;
		font-size: 12px;
	}
	.notice button {
		padding: 5px 10px;
		border: 1px solid #b47b25;
		background: transparent;
		cursor: pointer;
	}
	.loading-state {
		min-height: 560px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.loader-mark {
		width: 64px;
		height: 70px;
		margin-bottom: 22px;
		display: grid;
		place-items: center;
		color: #111;
		background: #fdb827;
		font:
			900 42px Georgia,
			serif;
		animation: breathe 1.8s ease-in-out infinite;
	}
	.loading-state strong {
		font:
			800 25px 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}
	.loading-state span {
		margin-top: 8px;
		color: #777;
		font-size: 11px;
	}
	.game-picker {
		display: flex;
		gap: 8px;
		margin-bottom: 12px;
	}
	.game-picker button {
		min-width: 120px;
		padding: 9px 13px;
		text-align: left;
		color: #666;
		background: #e7e7e4;
		border: 1px solid #d6d6d1;
		cursor: pointer;
		font-size: 10px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.game-picker button span {
		display: block;
		margin-top: 3px;
		font-size: 8px;
		font-weight: 600;
	}
	.game-picker button.active {
		color: #111;
		background: #fdb827;
		border-color: #e1a00b;
	}
	footer {
		max-width: 1380px;
		margin: auto;
		padding: 20px 24px 35px;
		display: flex;
		gap: 24px;
		align-items: center;
		justify-content: space-between;
		color: #8b8b87;
		border-top: 1px solid #d8d8d3;
		font-size: 8px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	footer a {
		color: #7b5c12;
		text-decoration: none;
		font-weight: 900;
	}
	footer a:hover {
		color: #111;
	}
	.fan-section {
		display: flex;
		gap: 8px;
		align-items: center;
	}
	.fan-section > span {
		color: #8b8b87;
	}
	.fan-section ol {
		list-style: none;
		margin: 0;
		padding: 0;
	}
	.fan-section li {
		display: flex;
		gap: 5px;
		align-items: baseline;
	}
	.fan-section li span {
		color: #b28a2b;
		font-variant-numeric: tabular-nums;
	}
	.fan-section strong {
		color: #353531;
		font-weight: 900;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
			box-shadow: 0 0 0 7px rgba(229, 72, 63, 0);
		}
	}
	@keyframes breathe {
		50% {
			transform: scale(0.96);
			opacity: 0.8;
		}
	}
	@media (max-width: 820px) {
		.topbar {
			padding: 0 18px;
			grid-template-columns: 1fr 1fr;
		}
		.date-lockup {
			display: none;
		}
		main {
			padding: 18px 14px 60px;
		}
	}
	@media (max-width: 570px) {
		.topbar {
			height: 66px;
		}
		.connection span {
			display: none;
		}
		footer {
			flex-direction: column;
			gap: 8px;
			line-height: 1.5;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
			animation: none !important;
			transition: none !important;
		}
	}
</style>
