<script lang="ts">
	import { tick } from 'svelte';
	import GameVisualization from '$lib/GameVisualization.svelte';
	import LineupPanel from '$lib/components/LineupPanel.svelte';
	import { currentAtBatPitches } from '$lib/visualization.js';
	import {
		isFinal,
		isLive,
		type GameBoxscore,
		type GameFeed,
		type GameStatus,
		type Play,
		type ScheduleGame,
		type TeamRef
	} from '$lib/mlb';

	let {
		game,
		feed,
		boxscore,
		visualizationPlay,
		hitHistory,
		feedLoading,
		onRefresh
	}: {
		game: ScheduleGame;
		feed: GameFeed | null;
		boxscore: GameBoxscore | null;
		visualizationPlay?: Play;
		hitHistory: Play[];
		feedLoading: boolean;
		onRefresh: () => void | Promise<void>;
	} = $props();

	let scoringOnly = $state(false);
	let pitchLedger = $state<HTMLOListElement>();

	const status = $derived<GameStatus>(feed?.gameData.status ?? game.status);
	const away = $derived(feed?.gameData.teams.away ?? game.teams.away.team);
	const home = $derived(feed?.gameData.teams.home ?? game.teams.home.team);
	const linescore = $derived(feed?.liveData.linescore);
	const activeBatterId = $derived(
		isLive(status)
			? (linescore?.offense?.batter?.id ?? feed?.liveData.plays.currentPlay?.matchup?.batter?.id)
			: undefined
	);
	const atBatPitches = $derived(currentAtBatPitches(visualizationPlay));
	const awayScore = $derived(linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0);
	const homeScore = $derived(linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0);
	const plays = $derived(feed?.liveData.plays.allPlays ?? []);
	const latestPlay = $derived(plays.length ? plays[plays.length - 1] : null);
	const visiblePlays = $derived(
		[...plays]
			.filter((play) => play.about?.isComplete && (!scoringOnly || play.about.isScoringPlay))
			.reverse()
	);
	const piratesAreHome = $derived(home?.id === 134);
	const piratesScore = $derived(piratesAreHome ? homeScore : awayScore);
	const opponentScore = $derived(piratesAreHome ? awayScore : homeScore);

	$effect(() => {
		const pitchCount = atBatPitches.length;
		if (!pitchCount || !pitchLedger) return;
		void tick().then(() => {
			if (pitchLedger) pitchLedger.scrollTop = pitchLedger.scrollHeight;
		});
	});

	function shortTeam(team?: TeamRef) {
		return team?.abbreviation ?? team?.name.split(' ').at(-1)?.slice(0, 3).toUpperCase() ?? '—';
	}

	function inningLabel(play: Play) {
		return `${play.about.halfInning === 'top' ? '▲' : '▼'} ${play.about.inning}`;
	}
</script>

<section class="game-dashboard">
	<div class="game-primary-grid">
		<aside class="at-bat-panel">
			<p class="section-label">{isFinal(status) ? 'Final frame' : 'At bat'}</p>
			<div class="matchup-names">
				<div>
					<span>Batter</span><strong
						>{linescore?.offense?.batter?.fullName ??
							latestPlay?.matchup?.batter?.fullName ??
							'—'}</strong
					>
				</div>
				<div>
					<span>Pitcher</span><strong
						>{linescore?.defense?.pitcher?.fullName ??
							latestPlay?.matchup?.pitcher?.fullName ??
							'—'}</strong
					>
				</div>
			</div>
			{#if isLive(status)}
				<div
					class="count-board"
					aria-label={`${linescore?.balls ?? 0} balls, ${linescore?.strikes ?? 0} strikes, ${linescore?.outs ?? 0} outs`}
				>
					<div>
						<span>B</span><b>{linescore?.balls ?? 0}</b><i
							>{#each [0, 1, 2] as i (i)}<em class:on={(linescore?.balls ?? 0) > i}></em>{/each}</i
						>
					</div>
					<div>
						<span>S</span><b>{Math.min(linescore?.strikes ?? 0, 2)}</b><i
							>{#each [0, 1] as i (i)}<em class:on={(linescore?.strikes ?? 0) > i}></em>{/each}</i
						>
					</div>
					<div>
						<span>O</span><b>{Math.min(linescore?.outs ?? 0, 2)}</b><i
							>{#each [0, 1] as i (i)}<em class:on={(linescore?.outs ?? 0) > i}></em>{/each}</i
						>
					</div>
				</div>
				<div class="due-up">
					<span>On deck</span><strong>{linescore?.offense?.onDeck?.fullName ?? '—'}</strong>
					<span>In the hole</span><strong>{linescore?.offense?.inHole?.fullName ?? '—'}</strong>
				</div>
			{/if}
			{#if isLive(status) && atBatPitches.length}
				<div class="at-bat-pitches" aria-live="polite">
					<div class="pitch-ledger-heading">
						<span>At-bat pitches</span><strong>{atBatPitches.length}</strong>
					</div>
					<ol bind:this={pitchLedger}>
						{#each atBatPitches as pitch, index (pitch.number)}
							<li class:latest={index === atBatPitches.length - 1}>
								<span class="pitch-symbol {pitch.kind}">{pitch.number}</span>
								<span class="pitch-call">
									<strong>{pitch.call}</strong>
									{#if pitch.detail}<small>{pitch.detail}</small>{/if}
								</span>
							</li>
						{/each}
					</ol>
				</div>
			{/if}
			{#if latestPlay?.result.description}
				<div class="last-call">
					<span>Latest</span>
					<p>{latestPlay.result.description}</p>
				</div>
			{/if}
			<div class="pirates-pulse">
				<span>Pirates</span><strong>{piratesScore}</strong><span>Opponent</span><strong
					>{opponentScore}</strong
				>
			</div>
		</aside>

		<div class="tracking-panel">
			<div class="tracking-context">
				<div>
					<p class="section-label">Live field</p>
					<strong>Pitch & contact tracker</strong>
				</div>
				<span>Estimated MLB coordinates</span>
			</div>
			<GameVisualization currentPlay={visualizationPlay} {hitHistory} live={isLive(status)} />
		</div>

		<div class="lineup-slot"><LineupPanel {boxscore} {away} {home} {activeBatterId} /></div>
	</div>

	<div class="play-panel">
		<div class="panel-heading">
			<div>
				<p class="section-label">Game log</p>
				<h1>Play-by-play</h1>
			</div>
			<div class="panel-actions">
				<div class="filter-switch" role="group" aria-label="Filter plays">
					<button class:active={!scoringOnly} onclick={() => (scoringOnly = false)}>All</button>
					<button class:active={scoringOnly} onclick={() => (scoringOnly = true)}>Scoring</button>
				</div>
				<button
					class="refresh"
					class:spinning={feedLoading}
					onclick={onRefresh}
					aria-label="Refresh game data">↻</button
				>
			</div>
		</div>

		{#if feedLoading && !feed}
			<div class="plays-empty">Loading the scorebook…</div>
		{:else if visiblePlays.length}
			<div class="plays" aria-live="polite">
				{#each visiblePlays as play (play.about.atBatIndex)}
					<article class:scoring={play.about.isScoringPlay} class="play-row">
						<div class="inning-tag">{inningLabel(play)}</div>
						<div class="play-copy">
							<strong>{play.result.event ?? 'Play'}</strong>
							<p>{play.result.description ?? 'Play recorded.'}</p>
							<small
								>{play.matchup?.batter?.fullName ?? ''}{play.matchup?.pitcher?.fullName
									? ` vs. ${play.matchup.pitcher.fullName}`
									: ''}</small
							>
						</div>
						<div class="play-score">
							<span>{shortTeam(away)} {play.result.awayScore ?? awayScore}</span>
							<span>{shortTeam(home)} {play.result.homeScore ?? homeScore}</span>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="plays-empty">
				{scoringOnly ? 'No scoring plays yet.' : 'The scorebook opens at first pitch.'}
			</div>
		{/if}
	</div>
</section>

<style>
	.section-label {
		margin: 0 0 9px;
		color: #8a6b20;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.game-dashboard {
		margin-top: 18px;
	}
	.game-primary-grid {
		display: grid;
		grid-template-columns: minmax(240px, 280px) minmax(400px, 1fr) minmax(280px, 320px);
		gap: 16px;
		align-items: stretch;
	}
	.lineup-slot {
		min-width: 0;
	}
	.lineup-slot :global(.lineup-panel) {
		height: 100%;
	}
	.at-bat-panel,
	.tracking-panel,
	.play-panel {
		background: white;
		box-shadow:
			0 0 0 1px rgba(0, 0, 0, 0.09),
			0 10px 30px rgba(0, 0, 0, 0.04);
	}
	.at-bat-panel,
	.tracking-panel {
		min-height: 500px;
		padding: 24px;
	}
	.at-bat-panel {
		display: flex;
		flex-direction: column;
	}
	.play-panel {
		margin-top: 16px;
	}
	.tracking-context {
		min-height: 50px;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 18px;
	}
	.tracking-context strong {
		display: block;
		font:
			850 17px/1 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.tracking-context > span {
		max-width: 100px;
		color: #969690;
		text-align: right;
		font-size: 7px;
		font-weight: 800;
		line-height: 1.4;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.due-up {
		margin: 18px 0;
		padding: 12px 0;
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 6px 12px;
		border-block: 1px solid #ecece8;
	}
	.due-up span {
		color: #888;
		font-size: 7px;
		font-weight: 800;
		text-transform: uppercase;
	}
	.due-up strong {
		text-align: right;
		font-size: 9px;
	}
	.at-bat-pitches {
		margin: 0 0 18px;
		border-bottom: 1px solid #ecece8;
	}
	.pitch-ledger-heading {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 0 7px;
		color: #8a6b20;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.pitch-ledger-heading strong {
		font-size: 9px;
		font-variant-numeric: tabular-nums;
	}
	.at-bat-pitches ol {
		list-style: none;
		max-height: 160px;
		margin: 0;
		padding: 0;
		overflow-y: auto;
		scrollbar-width: thin;
	}
	.at-bat-pitches li {
		min-height: 38px;
		padding: 6px 3px;
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr);
		gap: 9px;
		align-items: center;
		border-top: 1px solid #f0f0ec;
	}
	.at-bat-pitches li.latest {
		background: #fff9e8;
	}
	.pitch-symbol {
		width: 22px;
		height: 22px;
		display: grid;
		place-items: center;
		border: 2px solid #fff;
		border-radius: 50%;
		color: #111;
		box-shadow: 0 0 0 1px #d5d5cf;
		font-size: 9px;
		font-weight: 900;
		font-variant-numeric: tabular-nums;
	}
	.pitch-symbol.ball {
		background: #5bc982;
	}
	.pitch-symbol.strike {
		background: #ee645c;
	}
	.pitch-symbol.foul {
		background: #ee645c;
		border-color: #3b82f6;
		box-shadow: none;
	}
	.pitch-symbol.inplay {
		background: #fdb827;
	}
	.pitch-symbol.neutral {
		background: #c8c8c0;
	}
	.pitch-call {
		min-width: 0;
	}
	.pitch-call strong,
	.pitch-call small {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.pitch-call strong {
		font-size: 10px;
		font-weight: 850;
	}
	.pitch-call small {
		margin-top: 2px;
		color: #888;
		font-size: 8px;
	}
	.matchup-names > div {
		padding: 13px 0;
		border-bottom: 1px solid #ecece8;
	}
	.matchup-names span {
		display: block;
		color: #888;
		font-size: 8px;
		font-weight: 800;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.matchup-names strong {
		display: block;
		margin-top: 5px;
		font:
			800 18px 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.count-board {
		margin: 20px 0;
		padding: 14px 0;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		border-block: 1px solid #ecece8;
	}
	.count-board > div {
		display: grid;
		grid-template-columns: auto auto;
		gap: 4px 9px;
		align-items: center;
		padding: 0 10px;
		border-right: 1px solid #ecece8;
	}
	.count-board > div:last-child {
		border: 0;
	}
	.count-board span {
		color: #777;
		font-size: 9px;
		font-weight: 900;
	}
	.count-board b {
		justify-self: end;
		font-size: 15px;
	}
	.count-board i {
		grid-column: 1/-1;
		display: flex;
		gap: 4px;
	}
	.count-board em {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #deded9;
	}
	.count-board em.on {
		background: #fdb827;
	}
	.count-board > div:last-child em.on {
		background: #d8473f;
	}
	.last-call span {
		color: #8a6b20;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.12em;
		text-transform: uppercase;
	}
	.last-call p {
		margin: 7px 0 20px;
		font-size: 13px;
		line-height: 1.55;
	}
	.pirates-pulse {
		margin-top: auto;
		padding-top: 15px;
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 6px 12px;
		align-items: center;
		border-top: 1px solid #ecece8;
	}
	.pirates-pulse span {
		color: #777;
		font-size: 9px;
		text-transform: uppercase;
	}
	.pirates-pulse strong {
		font-size: 16px;
	}
	.panel-heading {
		min-height: 82px;
		padding: 18px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #e3e3df;
	}
	.panel-heading h1 {
		margin: 0;
		font:
			850 30px/1 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}
	.panel-actions {
		display: flex;
		gap: 8px;
	}
	.filter-switch {
		display: flex;
		padding: 3px;
		background: #eeeeeb;
	}
	.filter-switch button {
		padding: 7px 11px;
		color: #777;
		background: transparent;
		border: 0;
		font-size: 9px;
		font-weight: 800;
		text-transform: uppercase;
		cursor: pointer;
	}
	.filter-switch button.active {
		color: #111;
		background: white;
		box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
	}
	.refresh {
		width: 36px;
		border: 1px solid #d8d8d3;
		background: white;
		cursor: pointer;
		font-size: 17px;
	}
	.refresh.spinning {
		animation: spin 0.8s linear infinite;
	}
	.plays {
		max-height: 650px;
		overflow-y: auto;
	}
	.play-row {
		position: relative;
		min-height: 90px;
		padding: 17px 17px 17px 72px;
		display: grid;
		grid-template-columns: minmax(0, 1fr) 74px;
		gap: 18px;
		border-bottom: 1px solid #ecece8;
	}
	.play-row:last-child {
		border: 0;
	}
	.play-row.scoring {
		background: #fff9e8;
	}
	.play-row.scoring .inning-tag {
		color: #8a6b20;
	}
	.inning-tag {
		position: absolute;
		left: 17px;
		top: 20px;
		width: 38px;
		color: #777;
		font-size: 10px;
		font-weight: 900;
	}
	.play-copy strong {
		font:
			850 14px 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.play-copy p {
		margin: 5px 0;
		color: #3d3d3a;
		font-size: 12px;
		line-height: 1.45;
	}
	.play-copy small {
		color: #999;
		font-size: 8px;
	}
	.play-score {
		align-self: center;
		text-align: right;
	}
	.play-score span {
		display: block;
		font-size: 9px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}
	.play-score span + span {
		margin-top: 5px;
	}
	.plays-empty {
		min-height: 240px;
		display: grid;
		place-items: center;
		color: #888;
		font-size: 11px;
	}
	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
	@media (max-width: 1100px) {
		.game-primary-grid {
			grid-template-columns: minmax(250px, 300px) minmax(0, 1fr);
		}
		.lineup-slot {
			grid-column: 1 / -1;
		}
	}
	@media (max-width: 820px) {
		.game-primary-grid {
			grid-template-columns: 1fr;
		}
		.lineup-slot {
			grid-column: auto;
		}
		.at-bat-panel,
		.tracking-panel {
			min-height: 0;
		}
		.plays {
			max-height: none;
		}
	}
	@media (max-width: 570px) {
		.panel-heading {
			padding: 15px 13px;
			align-items: flex-end;
		}
		.panel-heading h1 {
			font-size: 24px;
		}
		.play-row {
			padding: 15px 12px 15px 56px;
			grid-template-columns: minmax(0, 1fr) 54px;
			gap: 8px;
		}
		.inning-tag {
			left: 12px;
		}
		.play-score span {
			font-size: 8px;
		}
		.filter-switch button {
			padding: 7px 8px;
		}
		.at-bat-panel,
		.tracking-panel {
			padding: 20px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.refresh.spinning {
			animation: none;
		}
	}
</style>
