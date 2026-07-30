<script lang="ts">
	import { teamLogo, type ScheduleGame } from '$lib/mlb';

	let { nextGame }: { nextGame: ScheduleGame | null } = $props();

	const opponentId = $derived(
		nextGame
			? nextGame.teams.away.team.id === 134
				? nextGame.teams.home.team.id
				: nextGame.teams.away.team.id
			: undefined
	);

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
</script>

<section class="off-day">
	<p class="section-label">Today</p>
	<h1>No Pirates game today.</h1>
	{#if nextGame}
		<div class="next-game">
			<span>Next up</span>
			<img src={teamLogo(opponentId)} alt="" />
			<div>
				<strong>{nextGame.teams.away.team.name} at {nextGame.teams.home.team.name}</strong>
				<small>{formatGameTime(nextGame.gameDate)} · {nextGame.venue?.name}</small>
			</div>
		</div>
	{/if}
	<p class="quiet">
		This page checks the schedule every minute and will pick up the next game automatically.
	</p>
</section>

<style>
	.off-day {
		min-height: 560px;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		text-align: center;
	}
	.section-label {
		margin: 0 0 9px;
		color: #8a6b20;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	h1 {
		margin: 0 0 32px;
		font:
			850 clamp(36px, 6vw, 68px)/0.95 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.035em;
		text-transform: uppercase;
	}
	.next-game {
		min-width: min(520px, 100%);
		padding: 17px 20px;
		display: grid;
		grid-template-columns: auto 44px 1fr;
		gap: 16px;
		align-items: center;
		text-align: left;
		background: white;
		border-top: 3px solid #fdb827;
		box-shadow: 0 8px 25px rgba(0, 0, 0, 0.06);
	}
	.next-game > span {
		color: #777;
		font-size: 9px;
		font-weight: 800;
		text-transform: uppercase;
		writing-mode: vertical-rl;
	}
	.next-game img {
		width: 44px;
		height: 44px;
	}
	.next-game strong,
	.next-game small {
		display: block;
	}
	.next-game strong {
		font-size: 14px;
	}
	.next-game small {
		margin-top: 6px;
		color: #777;
		font-size: 10px;
	}
	.quiet {
		margin-top: 24px;
		color: #888;
		font-size: 11px;
	}
	@media (max-width: 570px) {
		.next-game {
			grid-template-columns: 35px 1fr;
		}
		.next-game > span {
			display: none;
		}
		.next-game img {
			width: 35px;
			height: 35px;
		}
	}
</style>
