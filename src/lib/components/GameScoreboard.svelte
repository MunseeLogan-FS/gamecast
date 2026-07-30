<script lang="ts">
	import {
		isFinal,
		isLive,
		teamLogo,
		type GameFeed,
		type GameStatus,
		type ScheduleGame,
		type TeamRef
	} from '$lib/mlb';

	let { game, feed }: { game: ScheduleGame; feed: GameFeed | null } = $props();

	const status = $derived(feed?.gameData.status ?? game.status);
	const away = $derived(feed?.gameData.teams.away ?? game.teams.away.team);
	const home = $derived(feed?.gameData.teams.home ?? game.teams.home.team);
	const linescore = $derived(feed?.liveData.linescore);
	const awayScore = $derived(linescore?.teams?.away?.runs ?? game.teams.away.score ?? 0);
	const homeScore = $derived(linescore?.teams?.home?.runs ?? game.teams.home.score ?? 0);

	function statusText(gameStatus?: GameStatus) {
		if (!gameStatus) return 'Checking schedule';
		if (isLive(gameStatus) && linescore?.currentInningOrdinal) {
			return `${linescore.inningState ?? ''} ${linescore.currentInningOrdinal}`.trim();
		}
		return gameStatus.detailedState;
	}

	function formatGameTime(value?: string) {
		if (!value) return 'Time TBD';
		const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return new Intl.DateTimeFormat('en-US', {
			timeZone: localTimeZone,
			weekday: 'short',
			month: 'short',
			day: 'numeric',
			hour: 'numeric',
			minute: '2-digit',
			timeZoneName: 'short'
		}).format(new Date(value));
	}

	function shortTeam(team?: TeamRef) {
		return team?.abbreviation ?? team?.name.split(' ').at(-1)?.slice(0, 3).toUpperCase() ?? '—';
	}

	function record(team?: ScheduleGame['teams']['home']) {
		const value = team?.leagueRecord;
		return value ? `${value.wins}–${value.losses}` : '';
	}
</script>

<section class="scoreboard" aria-label="Game score">
	<div class="game-meta">
		<div class="status-badge" class:live={isLive(status)}><i></i>{statusText(status)}</div>
		<span>{formatGameTime(game.gameDate)}</span>
		<span>{feed?.gameData.venue?.name ?? game.venue?.name ?? 'Venue TBD'}</span>
	</div>

	<div class="score-grid">
		<div class="team away-team">
			<img src={teamLogo(away?.id)} alt="" />
			<div class="team-name">
				<small>{shortTeam(away)}</small><strong>{away?.name}</strong><span
					>{record(game.teams.away)}</span
				>
			</div>
		</div>
		<div class="score away-score">{awayScore}</div>
		<div class="game-center">
			<span>{isFinal(status) ? 'FINAL' : statusText(status).toUpperCase()}</span>
			{#if isLive(status)}
				<div class="diamond" aria-label="Base runners">
					<i class:occupied={!!linescore?.offense?.second} class="second"></i>
					<i class:occupied={!!linescore?.offense?.third} class="third"></i>
					<i class:occupied={!!linescore?.offense?.first} class="first"></i>
				</div>
			{/if}
		</div>
		<div class="score home-score">{homeScore}</div>
		<div class="team home-team">
			<img src={teamLogo(home?.id)} alt="" />
			<div class="team-name">
				<small>{shortTeam(home)}</small><strong>{home?.name}</strong><span
					>{record(game.teams.home)}</span
				>
			</div>
		</div>
	</div>

	{#if linescore?.innings?.length}
		<div class="line-table-wrap">
			<table class="line-table">
				<thead>
					<tr
						><th></th>{#each linescore.innings as inning (inning.num)}<th>{inning.num}</th
							>{/each}<th>R</th><th>H</th><th>E</th></tr
					>
				</thead>
				<tbody>
					<tr
						><th>{shortTeam(away)}</th>{#each linescore.innings as inning (inning.num)}<td
								>{inning.away?.runs ?? '–'}</td
							>{/each}<td class="total">{awayScore}</td><td>{linescore.teams?.away?.hits ?? '–'}</td
						><td>{linescore.teams?.away?.errors ?? '–'}</td></tr
					>
					<tr
						><th>{shortTeam(home)}</th>{#each linescore.innings as inning (inning.num)}<td
								>{inning.home?.runs ?? '–'}</td
							>{/each}<td class="total">{homeScore}</td><td>{linescore.teams?.home?.hits ?? '–'}</td
						><td>{linescore.teams?.home?.errors ?? '–'}</td></tr
					>
				</tbody>
			</table>
		</div>
	{/if}
</section>

<style>
	.scoreboard {
		background: white;
		border: 1px solid #ddddda;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.05);
	}
	.game-meta {
		min-height: 42px;
		padding: 0 18px;
		display: flex;
		align-items: center;
		gap: 18px;
		color: #757571;
		border-bottom: 1px solid #e7e7e3;
		font-size: 9px;
		font-weight: 650;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.status-badge {
		margin-right: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: #444;
		font-weight: 900;
	}
	.status-badge i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #777;
	}
	.status-badge.live {
		color: #c52b25;
	}
	.status-badge.live i {
		background: #e5483f;
		box-shadow: 0 0 0 4px rgba(229, 72, 63, 0.15);
		animation: pulse 1.8s infinite;
	}
	.score-grid {
		min-height: 166px;
		padding: 22px clamp(22px, 5vw, 68px);
		display: grid;
		grid-template-columns: minmax(160px, 1fr) auto 110px auto minmax(160px, 1fr);
		align-items: center;
		gap: clamp(16px, 3vw, 42px);
	}
	.team {
		display: flex;
		align-items: center;
		gap: 16px;
	}
	.home-team {
		flex-direction: row-reverse;
		text-align: right;
	}
	.team img {
		width: 68px;
		height: 68px;
		object-fit: contain;
	}
	.team-name small,
	.team-name strong,
	.team-name span {
		display: block;
	}
	.team-name small {
		color: #999;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.15em;
	}
	.team-name strong {
		margin: 4px 0 5px;
		font:
			850 18px/1 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.team-name span {
		color: #888;
		font-size: 10px;
	}
	.score {
		font:
			900 clamp(48px, 6vw, 82px)/1 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.06em;
		font-variant-numeric: tabular-nums;
	}
	.game-center {
		text-align: center;
	}
	.game-center > span {
		display: block;
		color: #777;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.12em;
	}
	.diamond {
		position: relative;
		width: 44px;
		height: 35px;
		margin: 16px auto 0;
	}
	.diamond i {
		position: absolute;
		width: 13px;
		height: 13px;
		background: #d8d8d2;
		border: 1px solid #bdbdb7;
		transform: rotate(45deg);
	}
	.diamond i.occupied {
		background: #fdb827;
		border-color: #c98f08;
	}
	.diamond .second {
		left: 16px;
		top: 0;
	}
	.diamond .third {
		left: 2px;
		top: 14px;
	}
	.diamond .first {
		right: 2px;
		top: 14px;
	}
	.line-table-wrap {
		overflow-x: auto;
		border-top: 1px solid #e7e7e3;
	}
	.line-table {
		width: 100%;
		min-width: 620px;
		border-collapse: collapse;
		font-size: 10px;
		font-variant-numeric: tabular-nums;
	}
	.line-table th,
	.line-table td {
		height: 28px;
		padding: 0 9px;
		text-align: center;
		border-right: 1px solid #eeeeeb;
	}
	.line-table thead {
		color: #999;
		background: #f7f7f5;
		font-size: 8px;
	}
	.line-table tbody th {
		padding-left: 18px;
		text-align: left;
		font-weight: 900;
	}
	.line-table .total {
		color: #111;
		background: #fff9e9;
		font-weight: 900;
	}
	@keyframes pulse {
		50% {
			opacity: 0.45;
			box-shadow: 0 0 0 7px rgba(229, 72, 63, 0);
		}
	}
	@media (max-width: 820px) {
		.score-grid {
			padding: 20px;
			grid-template-columns: 1fr auto 70px auto 1fr;
			gap: 12px;
		}
		.team img {
			width: 48px;
			height: 48px;
		}
		.team-name strong {
			font-size: 13px;
		}
		.score {
			font-size: 50px;
		}
		.game-meta span:last-child {
			display: none;
		}
	}
	@media (max-width: 570px) {
		.score-grid {
			grid-template-columns: 1fr auto 42px auto 1fr;
			padding: 17px 12px;
		}
		.team {
			gap: 7px;
		}
		.team img {
			width: 36px;
			height: 36px;
		}
		.team-name strong {
			display: none;
		}
		.score {
			font-size: 40px;
		}
		.game-center > span {
			font-size: 7px;
		}
		.diamond {
			margin-top: 10px;
			transform: scale(0.8);
		}
		.game-meta {
			gap: 10px;
			padding: 0 12px;
		}
		.game-meta > span {
			font-size: 7px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.status-badge.live i {
			animation: none;
		}
	}
</style>
