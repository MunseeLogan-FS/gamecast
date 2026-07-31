<script lang="ts">
	import {
		lineupForTeam,
		playerGameStats,
		type GameBoxscore,
		type LineupEntry,
		type TeamRef
	} from '$lib/mlb';

	let {
		boxscore,
		away,
		home,
		activeBatterId
	}: {
		boxscore: GameBoxscore | null;
		away?: TeamRef;
		home?: TeamRef;
		activeBatterId?: number;
	} = $props();

	let activeSide = $state<'away' | 'home'>('home');
	let selectedEntry = $state<LineupEntry | null>(null);
	let initializedTeams = $state('');
	let followedBatterId = $state<number | undefined>();

	const activeTeam = $derived(boxscore?.teams[activeSide]);
	const entries = $derived(lineupForTeam(activeTeam));
	const hitters = $derived(entries.filter((entry) => entry.kind === 'batter'));
	const pitchers = $derived(entries.filter((entry) => entry.kind === 'pitcher'));
	const activeBatterSide = $derived.by(() => {
		if (!activeBatterId || !boxscore) return null;
		if (boxscore.teams.away.players[`ID${activeBatterId}`]) return 'away';
		if (boxscore.teams.home.players[`ID${activeBatterId}`]) return 'home';
		return null;
	});
	const modalStats = $derived(
		selectedEntry ? playerGameStats(selectedEntry.player, selectedEntry.kind) : []
	);
	const modalSummary = $derived.by(() => {
		if (!selectedEntry) return '';
		const stats =
			selectedEntry.kind === 'pitcher'
				? selectedEntry.player.stats?.pitching
				: selectedEntry.player.stats?.batting;
		return typeof stats?.summary === 'string' ? stats.summary : '';
	});

	$effect(() => {
		const key = `${boxscore?.teams.away.team.id ?? ''}:${boxscore?.teams.home.team.id ?? ''}`;
		if (key && key !== initializedTeams) {
			activeSide = boxscore?.teams.home.team.id === 134 ? 'home' : 'away';
			selectedEntry = null;
			followedBatterId = undefined;
			initializedTeams = key;
		}
	});

	$effect(() => {
		if (!activeBatterId) {
			followedBatterId = undefined;
			return;
		}
		if (activeBatterSide && activeBatterId !== followedBatterId) {
			activeSide = activeBatterSide;
			selectedEntry = null;
			followedBatterId = activeBatterId;
		}
	});

	function selectSide(side: 'away' | 'home') {
		activeSide = side;
		selectedEntry = null;
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && selectedEntry) selectedEntry = null;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="lineup-panel" aria-label="Game lineup">
	<header>
		<div>
			<span class="kicker">Game card</span>
			<h2>Lineup</h2>
		</div>
		<div class="team-tabs" role="tablist" aria-label="Team lineup">
			<button
				role="tab"
				aria-selected={activeSide === 'away'}
				class:active={activeSide === 'away'}
				onclick={() => selectSide('away')}>{away?.abbreviation ?? 'Away'}</button
			>
			<button
				role="tab"
				aria-selected={activeSide === 'home'}
				class:active={activeSide === 'home'}
				onclick={() => selectSide('home')}>{home?.abbreviation ?? 'Home'}</button
			>
		</div>
	</header>

	<div class="lineup-scroll">
		{#if hitters.length}
			<ol class="hitters">
				{#each hitters as entry (`${entry.kind}-${entry.player.person.id}`)}
					<li class:at-bat={entry.player.person.id === activeBatterId}>
						<button
							onclick={() => (selectedEntry = entry)}
							aria-current={entry.player.person.id === activeBatterId ? 'true' : undefined}
							aria-label={`${entry.player.person.fullName}${entry.player.person.id === activeBatterId ? ', currently at bat' : ''}`}
						>
							<span class="order">{entry.order}</span>
							<span class="player-name">
								<strong>{entry.player.person.fullName}</strong>
								<small>{entry.player.stats?.batting?.summary ?? 'Game stats pending'}</small>
							</span>
							<span class="position"
								>{entry.player.person.id === activeBatterId
									? 'At bat'
									: (entry.player.position?.abbreviation ?? '—')}</span
							>
						</button>
					</li>
				{/each}
			</ol>
			{#if pitchers.length}
				<div class="pitchers-heading"><span>Pitchers used</span><i></i></div>
				<ul class="pitchers">
					{#each pitchers as entry (`${entry.kind}-${entry.player.person.id}`)}
						<li>
							<button onclick={() => (selectedEntry = entry)}>
								<span class="pitcher-mark">P</span>
								<span class="player-name">
									<strong>{entry.player.person.fullName}</strong>
									<small>{entry.player.stats?.pitching?.summary ?? 'Game stats pending'}</small>
								</span>
								<span class="position">›</span>
							</button>
						</li>
					{/each}
				</ul>
			{/if}
		{:else}
			<div class="empty-lineup">
				<strong>Lineup pending</strong>
				<span>MLB has not published this game card yet.</span>
			</div>
		{/if}
	</div>

	{#if selectedEntry}
		<div
			class="player-dialog"
			role="dialog"
			aria-label={`${selectedEntry.player.person.fullName} game stats`}
		>
			<div class="dialog-topline">
				<span>{activeTeam?.team.abbreviation ?? activeTeam?.team.name}</span>
				<button onclick={() => (selectedEntry = null)} aria-label="Close player stats">×</button>
			</div>
			<div class="player-heading">
				<div class="jersey">{selectedEntry.player.jerseyNumber ?? selectedEntry.order ?? 'P'}</div>
				<div>
					<small
						>{selectedEntry.kind === 'pitcher'
							? 'Pitcher'
							: `Batting ${selectedEntry.order}`}</small
					>
					<h3>{selectedEntry.player.person.fullName}</h3>
					<p>
						{selectedEntry.player.position?.name ??
							selectedEntry.player.position?.abbreviation ??
							''}
					</p>
				</div>
			</div>
			{#if modalSummary}<p class="summary">{modalSummary}</p>{/if}
			<div class="stat-grid">
				{#each modalStats as stat (stat.label)}
					<div><span>{stat.label}</span><strong>{stat.value}</strong></div>
				{/each}
			</div>
			<p class="dialog-note">Game statistics only · Select another player after closing</p>
		</div>
	{/if}
</section>

<style>
	.lineup-panel {
		position: relative;
		min-height: 500px;
		overflow: hidden;
		background: #fff;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.09),
			0 10px 30px rgba(0, 0, 0, 0.04);
	}
	header {
		height: 74px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #e8e8e4;
	}
	.kicker {
		color: #8a6b20;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	h2 {
		margin: 3px 0 0;
		font:
			850 23px/1 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}
	.team-tabs {
		display: flex;
		padding: 3px;
		background: #eeeeeb;
	}
	.team-tabs button {
		min-width: 42px;
		min-height: 30px;
		padding: 0 8px;
		color: #777;
		background: transparent;
		border: 0;
		font-size: 11px;
		font-weight: 900;
		cursor: pointer;
	}
	.team-tabs button.active {
		color: #111;
		background: #fff;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
	}
	.lineup-scroll {
		max-height: 580px;
		overflow-y: auto;
	}
	.hitters,
	.pitchers {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	li button {
		width: 100%;
		min-height: 58px;
		padding: 10px 14px;
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) auto;
		gap: 8px;
		align-items: center;
		text-align: left;
		color: #171717;
		background: #fff;
		border: 0;
		border-bottom: 1px solid #eeeeeb;
		cursor: pointer;
	}
	li button:hover {
		background: #fff9e8;
	}
	li.at-bat button,
	li.at-bat button:hover {
		background: #fff4cf;
		box-shadow: inset 4px 0 #fdb827;
	}
	li.at-bat .order {
		width: 24px;
		height: 24px;
		display: grid;
		place-items: center;
		color: #111;
		background: #fdb827;
	}
	li.at-bat .player-name strong {
		font-weight: 900;
	}
	li.at-bat .position {
		color: #76560c;
		font-size: 8px;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.order,
	.pitcher-mark {
		color: #9a9a95;
		font-size: 11px;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
	}
	.pitcher-mark {
		width: 20px;
		height: 20px;
		display: grid;
		place-items: center;
		color: #111;
		background: #fdb827;
	}
	.player-name {
		min-width: 0;
	}
	.player-name strong,
	.player-name small {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.player-name strong {
		font-size: 14px;
		font-weight: 800;
	}
	.player-name small {
		margin-top: 4px;
		color: #8a8a85;
		font-size: 10px;
	}
	.position {
		color: #777;
		font-size: 11px;
		font-weight: 900;
	}
	.pitchers-heading {
		padding: 14px 14px 7px;
		display: flex;
		align-items: center;
		gap: 9px;
		color: #8a6b20;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.pitchers-heading i {
		height: 1px;
		flex: 1;
		background: #e2e2dd;
	}
	.empty-lineup {
		min-height: 360px;
		padding: 30px;
		display: grid;
		place-content: center;
		text-align: center;
	}
	.empty-lineup strong {
		font:
			850 18px 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.empty-lineup span {
		max-width: 190px;
		margin-top: 7px;
		color: #888;
		font-size: 9px;
		line-height: 1.5;
	}
	.player-dialog {
		position: absolute;
		inset: 0;
		z-index: 3;
		padding: 18px;
		color: #171717;
		background: rgba(250, 250, 248, 0.98);
		backdrop-filter: blur(8px);
		animation: dialog-in 0.18s ease-out;
	}
	.dialog-topline {
		display: flex;
		align-items: center;
		justify-content: space-between;
		color: #8a6b20;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	.dialog-topline button {
		width: 34px;
		height: 34px;
		color: #111;
		background: #fff;
		border: 1px solid #ddd;
		cursor: pointer;
		font-size: 20px;
		line-height: 1;
	}
	.player-heading {
		margin-top: 35px;
		display: grid;
		grid-template-columns: 54px 1fr;
		gap: 14px;
		align-items: center;
	}
	.jersey {
		width: 54px;
		height: 58px;
		display: grid;
		place-items: center;
		color: #111;
		background: #fdb827;
		font:
			900 22px 'Arial Narrow',
			sans-serif;
	}
	.player-heading small {
		color: #888;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.player-heading h3 {
		margin: 4px 0 3px;
		font:
			900 28px/0.98 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.03em;
		text-transform: uppercase;
	}
	.player-heading p {
		margin: 0;
		color: #777;
		font-size: 12px;
	}
	.summary {
		margin: 26px 0 12px;
		padding: 12px 0;
		border-block: 1px solid #deded9;
		font-size: 14px;
		font-weight: 750;
	}
	.stat-grid {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		box-shadow: 0 0 0 1px #deded9;
	}
	.stat-grid div {
		min-height: 72px;
		padding: 11px;
		display: flex;
		flex-direction: column;
		justify-content: space-between;
		box-shadow: inset -1px -1px #e5e5e1;
	}
	.stat-grid span {
		color: #888;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.stat-grid strong {
		font-size: 24px;
		font-variant-numeric: tabular-nums;
	}
	.dialog-note {
		margin-top: 16px;
		color: #969690;
		font-size: 9px;
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}
	@keyframes dialog-in {
		from {
			opacity: 0;
			transform: translateX(8px);
		}
	}
	@media (max-width: 1020px) {
		.lineup-panel {
			min-height: 0;
		}
		.lineup-scroll {
			max-height: 520px;
		}
		.player-dialog {
			min-height: 100%;
		}
	}
	@media (max-width: 620px) {
		.lineup-scroll {
			max-height: none;
		}
		.player-dialog {
			padding: 16px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.player-dialog {
			animation: none;
		}
	}
</style>
