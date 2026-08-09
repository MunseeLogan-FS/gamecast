<script lang="ts">
	import { gameLifecycleGroup, isPiratesGame } from '$lib/game-selection';
	import { teamLogo, type ScheduleGame, type TeamRef } from '$lib/mlb';

	let {
		games,
		selectedGamePk = null,
		onSelect
	}: {
		games: ScheduleGame[];
		selectedGamePk?: number | null;
		onSelect: (gamePk: number) => void;
	} = $props();

	const piratesGames = $derived(games.filter(isPiratesGame));
	const leagueGames = $derived(games.filter((game) => !isPiratesGame(game)));
	const groups = $derived(
		(
			[
				['live', 'Live now'],
				['preview', 'Upcoming'],
				['final', 'Final'],
				['other', 'Other']
			] as const
		)
			.map(([key, label]) => ({
				key,
				label,
				games: leagueGames.filter((game) => gameLifecycleGroup(game) === key)
			}))
			.filter((group) => group.games.length)
	);

	function shortTeam(team: TeamRef) {
		return team.abbreviation ?? team.name.split(' ').at(-1)?.slice(0, 3).toUpperCase() ?? '—';
	}

	function gameTime(value: string) {
		return new Intl.DateTimeFormat('en-US', {
			hour: 'numeric',
			minute: '2-digit',
			timeZoneName: 'short'
		}).format(new Date(value));
	}

	function displayStatus(game: ScheduleGame) {
		const group = gameLifecycleGroup(game);
		if (group === 'live' || group === 'final' || group === 'other') {
			return game.status.detailedState;
		}
		return gameTime(game.gameDate);
	}

	function accessibleLabel(game: ScheduleGame) {
		const away = game.teams.away.team.name;
		const home = game.teams.home.team.name;
		const status = displayStatus(game);
		const hasScore = game.teams.away.score !== undefined || game.teams.home.score !== undefined;
		const score = hasScore
			? `, ${game.teams.away.score ?? 0} to ${game.teams.home.score ?? 0}`
			: '';
		return `${away} at ${home}, ${status}${score}`;
	}
</script>

<nav class="game-picker" aria-label="Today's MLB games">
	{#if piratesGames.length}
		<section class="game-group pirates-group" aria-labelledby="pirates-games-label">
			<h2 id="pirates-games-label"><span>Pirates</span><small>Pinned</small></h2>
			<div class="game-row">
				{#each piratesGames as game (game.gamePk)}
					{@render gameCard(game)}
				{/each}
			</div>
		</section>
	{/if}

	{#each groups as group (group.key)}
		<section class="game-group" aria-labelledby={`game-group-${group.key}`}>
			<h2 id={`game-group-${group.key}`}>{group.label}</h2>
			<div class="game-row">
				{#each group.games as game (game.gamePk)}
					{@render gameCard(game)}
				{/each}
			</div>
		</section>
	{/each}
</nav>

{#snippet gameCard(game: ScheduleGame)}
	<button
		type="button"
		class="game-card"
		class:pirates={isPiratesGame(game)}
		class:live={gameLifecycleGroup(game) === 'live'}
		class:selected={game.gamePk === selectedGamePk}
		aria-pressed={game.gamePk === selectedGamePk}
		aria-label={accessibleLabel(game)}
		onclick={() => onSelect(game.gamePk)}
	>
		<span class="card-status">{displayStatus(game)}</span>
		<span class="club-row">
			<img src={teamLogo(game.teams.away.team.id)} alt="" />
			<strong>{shortTeam(game.teams.away.team)}</strong>
			{#if game.teams.away.score !== undefined}<b>{game.teams.away.score}</b>{/if}
		</span>
		<span class="club-row">
			<img src={teamLogo(game.teams.home.team.id)} alt="" />
			<strong>{shortTeam(game.teams.home.team)}</strong>
			{#if game.teams.home.score !== undefined}<b>{game.teams.home.score}</b>{/if}
		</span>
		<span class="full-matchup">
			{game.teams.away.team.name}<i>at</i>{game.teams.home.team.name}
		</span>
	</button>
{/snippet}

<style>
	.game-picker {
		margin-bottom: 16px;
		display: flex;
		gap: 20px;
		overflow-x: auto;
		overscroll-behavior-inline: contain;
		scrollbar-width: thin;
		padding: 1px 1px 10px;
	}
	.game-group {
		flex: 0 0 auto;
	}
	.game-group h2 {
		min-height: 20px;
		margin: 0 0 6px;
		display: flex;
		align-items: center;
		gap: 7px;
		color: #6f706c;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.game-group h2 small {
		padding: 2px 5px;
		color: #765716;
		background: #fff0c9;
		font-size: 7px;
		letter-spacing: 0.09em;
	}
	.game-row {
		display: flex;
		gap: 7px;
	}
	.game-card {
		width: 142px;
		min-height: 88px;
		padding: 9px 11px;
		position: relative;
		text-align: left;
		color: #252522;
		background: #fff;
		border: 1px solid #d9d9d4;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.035);
		cursor: pointer;
	}
	.game-card:hover {
		border-color: #9b9c96;
	}
	.game-card.selected {
		border-color: var(--game-accent, #fdb827);
		box-shadow: inset 0 -4px 0 var(--game-accent, #fdb827);
	}
	.game-card.pirates:not(.selected) {
		border-color: #d7b75d;
	}
	.card-status {
		display: block;
		margin-bottom: 6px;
		color: #747570;
		font-size: 8px;
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.game-card.live .card-status {
		color: #c52b25;
	}
	.club-row {
		display: grid;
		grid-template-columns: 18px 1fr auto;
		gap: 6px;
		align-items: center;
		min-height: 23px;
	}
	.club-row img {
		width: 18px;
		height: 18px;
		object-fit: contain;
	}
	.club-row strong {
		font-size: 11px;
		letter-spacing: 0.04em;
	}
	.club-row b {
		font-size: 14px;
		font-variant-numeric: tabular-nums;
	}
	.full-matchup {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}
	.full-matchup i {
		margin: 0 4px;
	}
	@media (max-width: 570px) {
		.game-picker {
			margin-inline: -14px;
			padding-inline: 14px;
			scroll-padding-inline: 14px;
		}
		.game-card {
			width: 132px;
		}
	}
</style>
