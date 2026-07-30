<script lang="ts">
	import {
		lineupForTeam,
		playerSeasonStats,
		playerSeasonSummary,
		teamLogo,
		type GameBoxscore,
		type GameFeed,
		type LineupEntry,
		type ScheduleGame,
		type SeasonPlayerProfile
	} from '$lib/mlb';

	let {
		game,
		feed,
		boxscore,
		profiles
	}: {
		game: ScheduleGame;
		feed: GameFeed | null;
		boxscore: GameBoxscore | null;
		profiles: Record<number, SeasonPlayerProfile>;
	} = $props();

	let mobileSide = $state<'away' | 'home'>('away');
	let selectedEntry = $state<{ entry: LineupEntry; side: 'away' | 'home' } | null>(null);

	const away = $derived(feed?.gameData.teams.away ?? game.teams.away.team);
	const home = $derived(feed?.gameData.teams.home ?? game.teams.home.team);
	const awayStarter = $derived(
		feed?.gameData.probablePitchers?.away ?? game.teams.away.probablePitcher
	);
	const homeStarter = $derived(
		feed?.gameData.probablePitchers?.home ?? game.teams.home.probablePitcher
	);
	const awayLineup = $derived(
		lineupForTeam(boxscore?.teams.away).filter((entry) => entry.kind === 'batter')
	);
	const homeLineup = $derived(
		lineupForTeam(boxscore?.teams.home).filter((entry) => entry.kind === 'batter')
	);
	const selectedProfile = $derived(
		selectedEntry ? profiles[selectedEntry.entry.player.person.id] : undefined
	);
	const selectedStats = $derived(
		selectedEntry ? playerSeasonStats(selectedProfile, selectedEntry.entry.kind) : []
	);
	const piratesSide = $derived(game.teams.home.team.id === 134 ? 'home' : 'away');
	const television = $derived(
		game.broadcasts?.find(
			(broadcast) => broadcast.homeAway === piratesSide && broadcast.type === 'TV'
		)?.name
	);
	const radio = $derived(
		game.broadcasts?.find(
			(broadcast) =>
				broadcast.homeAway === piratesSide && ['AM', 'FM', 'Radio'].includes(broadcast.type)
		)?.name
	);

	function shortTeam(team?: { abbreviation?: string; name: string }) {
		return team?.abbreviation ?? team?.name.split(' ').at(-1)?.slice(0, 3).toUpperCase() ?? '—';
	}

	function teamRecord(side: 'away' | 'home') {
		const record = game.teams[side].leagueRecord;
		return record ? `${record.wins}–${record.losses}` : '';
	}

	function formatGameTime(value: string, includeDate = true) {
		const localTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
		return new Intl.DateTimeFormat('en-US', {
			timeZone: localTimeZone,
			...(includeDate ? { weekday: 'short', month: 'short', day: 'numeric' } : {}),
			hour: 'numeric',
			minute: '2-digit',
			timeZoneName: 'short'
		}).format(new Date(value));
	}

	function headshot(personId?: number) {
		return personId
			? `https://img.mlbstatic.com/mlb-photos/image/upload/w_260,q_auto:best/v1/people/${personId}/headshot/67/current`
			: '';
	}

	function starterRows(personId?: number) {
		return playerSeasonStats(personId ? profiles[personId] : undefined, 'pitcher').slice(0, 6);
	}

	function selectPlayer(entry: LineupEntry, side: 'away' | 'home') {
		selectedEntry = { entry, side };
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && selectedEntry) selectedEntry = null;
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<section class="preview" aria-label="Upcoming game preview">
	<section class="preview-scoreboard" aria-label="Upcoming game matchup">
		<div class="preview-meta">
			<span class="upcoming"><i></i>{game.status.detailedState || 'Upcoming'}</span>
			<span>{formatGameTime(game.gameDate)}</span>
			<span>{feed?.gameData.venue?.name ?? game.venue?.name ?? 'Venue TBD'}</span>
		</div>
		<div class="matchup-hero">
			<div class="hero-team away">
				<img src={teamLogo(away?.id)} alt="" />
				<div>
					<span>{shortTeam(away)}</span>
					<strong>{away?.name}</strong>
					<small>{teamRecord('away')}</small>
				</div>
			</div>
			<div class="first-pitch">
				<span>First pitch</span>
				<strong>{formatGameTime(game.gameDate, false)}</strong>
				<b>AT</b>
			</div>
			<div class="hero-team home">
				<img src={teamLogo(home?.id)} alt="" />
				<div>
					<span>{shortTeam(home)}</span>
					<strong>{home?.name}</strong>
					<small>{teamRecord('home')}</small>
				</div>
			</div>
		</div>
	</section>

	<div class="preview-grid">
		<section class="starters-card">
			<header class="card-heading">
				<div>
					<span>Matchup</span>
					<h2>Probable starters</h2>
				</div>
				<small>Subject to change</small>
			</header>
			<div class="starters">
				{#each [['away', awayStarter, away], ['home', homeStarter, home]] as [side, starter, team], index (side)}
					{@const person = starter as typeof awayStarter}
					{@const club = team as typeof away}
					<div class:pirates={club?.id === 134} class="starter">
						<div class="starter-portrait">
							{#if person?.id}
								<img src={headshot(person.id)} alt="" />
							{:else}
								<img class="team-fallback" src={teamLogo(club?.id)} alt="" />
							{/if}
							<span>{side === 'away' ? 'Away starter' : 'Home starter'}</span>
						</div>
						<div class="starter-copy">
							<small>{shortTeam(club)}</small>
							<h3>{person?.fullName ?? 'Starter not announced'}</h3>
							{#if person?.id && profiles[person.id]?.pitchHand}
								<p>{profiles[person.id].pitchHand?.description}-handed pitcher</p>
							{/if}
							<div class="starter-stats">
								{#each starterRows(person?.id) as stat (stat.label)}
									<div><span>{stat.label}</span><strong>{stat.value}</strong></div>
								{/each}
							</div>
						</div>
					</div>
					{#if index === 0}<b class="versus">VS</b>{/if}
				{/each}
			</div>
		</section>

		<aside class="details-card">
			<header class="card-heading">
				<div>
					<span>Pregame</span>
					<h2>Game details</h2>
				</div>
			</header>
			<dl>
				<div>
					<dt>First pitch</dt>
					<dd>{formatGameTime(game.gameDate, false)}</dd>
				</div>
				<div>
					<dt>Venue</dt>
					<dd>{feed?.gameData.venue?.name ?? game.venue?.name ?? 'TBD'}</dd>
				</div>
				{#if game.seriesGameNumber && game.gamesInSeries}
					<div>
						<dt>Series</dt>
						<dd>Game {game.seriesGameNumber} of {game.gamesInSeries}</dd>
					</div>
				{/if}
				{#if feed?.gameData.weather?.temp || feed?.gameData.weather?.condition}
					<div>
						<dt>Weather</dt>
						<dd>
							{feed.gameData.weather.temp ? `${feed.gameData.weather.temp}°` : ''}{feed.gameData
								.weather.condition
								? ` · ${feed.gameData.weather.condition}`
								: ''}
						</dd>
					</div>
				{/if}
				{#if television}<div>
						<dt>TV</dt>
						<dd>{television}</dd>
					</div>{/if}
				{#if radio}<div>
						<dt>Radio</dt>
						<dd>{radio}</dd>
					</div>{/if}
			</dl>
		</aside>
	</div>

	<section
		class="preview-lineups"
		class:both-pending={!awayLineup.length && !homeLineup.length}
		aria-label="Starting lineups"
	>
		<header class="lineups-heading">
			<div>
				<span>Game card</span>
				<h2>Starting lineups</h2>
			</div>
			<div class="mobile-tabs" role="tablist" aria-label="Preview team lineup">
				<button class:active={mobileSide === 'away'} onclick={() => (mobileSide = 'away')}
					>{shortTeam(away)}</button
				>
				<button class:active={mobileSide === 'home'} onclick={() => (mobileSide = 'home')}
					>{shortTeam(home)}</button
				>
			</div>
		</header>
		<div class="lineup-columns">
			{#each [['away', away, awayLineup], ['home', home, homeLineup]] as [side, team, entries] (side)}
				{@const teamSide = side as 'away' | 'home'}
				{@const club = team as typeof away}
				{@const lineup = entries as LineupEntry[]}
				<div class:hidden-mobile={mobileSide !== teamSide} class="preview-team-lineup">
					<div class="team-lineup-heading">
						<div><img src={teamLogo(club?.id)} alt="" /><strong>{club?.name}</strong></div>
						<span class:confirmed={lineup.length > 0}
							>{lineup.length ? 'Confirmed' : 'Not yet posted'}</span
						>
					</div>
					{#if lineup.length}
						<ol>
							{#each lineup as entry (`${teamSide}-${entry.player.person.id}`)}
								<li>
									<button onclick={() => selectPlayer(entry, teamSide)}>
										<span class="order">{entry.order}</span>
										<span class="lineup-player">
											<strong>{entry.player.person.fullName}</strong>
											<small
												>{playerSeasonSummary(profiles[entry.player.person.id], 'batter') ||
													'Season statistics pending'}</small
											>
										</span>
										<span class="position">{entry.player.position?.abbreviation ?? '—'}</span>
									</button>
								</li>
							{/each}
						</ol>
					{:else}
						<div class="lineup-pending">
							<strong>Lineup not posted</strong>
							<span>MLB will publish this batting order closer to first pitch.</span>
						</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if selectedEntry}
			<div
				class="season-dialog"
				role="dialog"
				aria-label={`${selectedEntry.entry.player.person.fullName} 2026 season statistics`}
			>
				<div class="dialog-topline">
					<span
						>2026 season · {selectedEntry.side === 'away' ? shortTeam(away) : shortTeam(home)}</span
					>
					<button onclick={() => (selectedEntry = null)} aria-label="Close player season stats"
						>×</button
					>
				</div>
				<div class="dialog-player">
					<div class="jersey">
						{selectedEntry.entry.player.jerseyNumber ?? selectedEntry.entry.order}
					</div>
					<div>
						<small>Batting {selectedEntry.entry.order}</small>
						<h3>{selectedEntry.entry.player.person.fullName}</h3>
						<p>
							{selectedEntry.entry.player.position?.name ??
								selectedEntry.entry.player.position?.abbreviation}
						</p>
					</div>
				</div>
				<div class="dialog-stats">
					{#each selectedStats as stat (stat.label)}
						<div><span>{stat.label}</span><strong>{stat.value}</strong></div>
					{/each}
				</div>
				<p class="dialog-note">Regular-season statistics · Updated by MLB</p>
			</div>
		{/if}
	</section>

	<p class="coverage-note"><i></i>Live tracking and play-by-play begin at first pitch.</p>
</section>

<style>
	.preview {
		margin-top: 0;
	}
	.preview-scoreboard,
	.starters-card,
	.details-card,
	.preview-lineups {
		background: #fff;
		border: 1px solid #ddddda;
		box-shadow: 0 6px 24px rgba(0, 0, 0, 0.05);
	}
	.preview-meta {
		min-height: 42px;
		padding: 0 18px;
		display: flex;
		align-items: center;
		gap: 18px;
		color: #757571;
		border-bottom: 1px solid #e7e7e3;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.upcoming {
		margin-right: auto;
		display: inline-flex;
		align-items: center;
		gap: 8px;
		color: #665019;
		font-weight: 900;
	}
	.upcoming i,
	.coverage-note i {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #fdb827;
		box-shadow: 0 0 0 4px rgba(253, 184, 39, 0.14);
	}
	.matchup-hero {
		min-height: 190px;
		padding: 24px clamp(26px, 6vw, 80px);
		display: grid;
		grid-template-columns: 1fr 170px 1fr;
		gap: 36px;
		align-items: center;
	}
	.hero-team {
		display: flex;
		align-items: center;
		gap: 18px;
	}
	.hero-team.home {
		flex-direction: row-reverse;
		text-align: right;
	}
	.hero-team img {
		width: 82px;
		height: 82px;
		object-fit: contain;
	}
	.hero-team span,
	.hero-team strong,
	.hero-team small {
		display: block;
	}
	.hero-team span {
		color: #999;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.14em;
	}
	.hero-team strong {
		margin: 5px 0 7px;
		font:
			850 clamp(20px, 2.3vw, 30px)/0.95 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}
	.hero-team small {
		color: #777;
		font-size: 12px;
	}
	.first-pitch {
		text-align: center;
	}
	.first-pitch span {
		display: block;
		color: #8a6b20;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.first-pitch strong {
		display: block;
		margin: 8px 0 10px;
		font:
			850 22px/1 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.first-pitch b {
		display: block;
		color: #aaa;
		font-size: 11px;
		letter-spacing: 0.15em;
	}
	.preview-grid {
		margin-top: 16px;
		display: grid;
		grid-template-columns: minmax(0, 2.15fr) minmax(280px, 0.85fr);
		gap: 16px;
	}
	.card-heading,
	.lineups-heading {
		min-height: 78px;
		padding: 16px 20px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #e6e6e2;
	}
	.card-heading span,
	.lineups-heading span {
		color: #8a6b20;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.17em;
		text-transform: uppercase;
	}
	.card-heading h2,
	.lineups-heading h2 {
		margin: 4px 0 0;
		font:
			850 26px/1 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.02em;
		text-transform: uppercase;
	}
	.card-heading > small {
		color: #999;
		font-size: 9px;
		font-weight: 700;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.starters {
		min-height: 335px;
		display: grid;
		grid-template-columns: 1fr 28px 1fr;
		align-items: stretch;
	}
	.starter {
		padding: 22px;
		display: grid;
		grid-template-columns: 125px minmax(0, 1fr);
		gap: 20px;
		align-items: center;
	}
	.starter.pirates {
		background: linear-gradient(135deg, #fffdf6, #fff8df);
	}
	.starter-portrait {
		align-self: stretch;
		min-height: 230px;
		display: flex;
		flex-direction: column;
		justify-content: flex-end;
		overflow: hidden;
		background: #f0f0ed;
		border-bottom: 4px solid #c6c6c0;
	}
	.starter.pirates .starter-portrait {
		border-color: #fdb827;
	}
	.starter-portrait img {
		width: 100%;
		min-height: 0;
		flex: 1;
		object-fit: cover;
		object-position: center top;
	}
	.starter-portrait img.team-fallback {
		padding: 28px;
		object-fit: contain;
		filter: grayscale(1);
		opacity: 0.45;
	}
	.starter-portrait span {
		padding: 8px;
		color: #666;
		background: #e3e3df;
		text-align: center;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.starter-copy > small {
		color: #8c8c86;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.14em;
	}
	.starter-copy h3 {
		margin: 6px 0;
		font:
			850 clamp(22px, 2.2vw, 32px)/0.95 'Arial Narrow',
			sans-serif;
		letter-spacing: -0.025em;
		text-transform: uppercase;
	}
	.starter-copy p {
		margin: 0 0 18px;
		color: #777;
		font-size: 11px;
	}
	.starter-stats {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		background: #deded9;
		border: 1px solid #deded9;
	}
	.starter-stats div {
		min-width: 0;
		padding: 9px 6px;
		background: #fff;
		text-align: center;
	}
	.starter-stats span,
	.starter-stats strong {
		display: block;
	}
	.starter-stats span {
		color: #888;
		font-size: 8px;
		font-weight: 900;
		text-transform: uppercase;
	}
	.starter-stats strong {
		margin-top: 4px;
		font-size: 15px;
		font-variant-numeric: tabular-nums;
	}
	.versus {
		align-self: center;
		color: #aaa;
		text-align: center;
		font-size: 9px;
	}
	.details-card dl {
		margin: 0;
		padding: 8px 20px 18px;
	}
	.details-card dl div {
		padding: 14px 0;
		display: grid;
		grid-template-columns: 86px 1fr;
		gap: 12px;
		border-bottom: 1px solid #ecece8;
	}
	.details-card dl div:last-child {
		border: 0;
	}
	.details-card dt {
		color: #888;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.details-card dd {
		margin: 0;
		text-align: right;
		font-size: 12px;
		font-weight: 750;
		line-height: 1.35;
	}
	.preview-lineups {
		position: relative;
		margin-top: 16px;
		overflow: hidden;
	}
	.mobile-tabs {
		display: none;
	}
	.lineup-columns {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}
	.preview-team-lineup + .preview-team-lineup {
		border-left: 1px solid #e2e2de;
	}
	.team-lineup-heading {
		min-height: 62px;
		padding: 10px 18px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #f7f7f4;
		border-bottom: 1px solid #e4e4df;
	}
	.team-lineup-heading > div {
		display: flex;
		align-items: center;
		gap: 10px;
	}
	.team-lineup-heading img {
		width: 34px;
		height: 34px;
	}
	.team-lineup-heading strong {
		font:
			800 15px 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.team-lineup-heading > span {
		padding: 5px 7px;
		color: #777;
		background: #e7e7e2;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.07em;
		text-transform: uppercase;
	}
	.team-lineup-heading > span.confirmed {
		color: #35592b;
		background: #e4f1df;
	}
	.preview-team-lineup ol {
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.preview-team-lineup li button {
		width: 100%;
		min-height: 58px;
		padding: 9px 16px;
		display: grid;
		grid-template-columns: 24px minmax(0, 1fr) 34px;
		gap: 10px;
		align-items: center;
		color: #171717;
		background: #fff;
		border: 0;
		border-bottom: 1px solid #eeeeeb;
		text-align: left;
		cursor: pointer;
	}
	.preview-team-lineup li button:hover {
		background: #fff9e8;
	}
	.order,
	.position {
		color: #92928d;
		font-size: 11px;
		font-weight: 900;
	}
	.position {
		text-align: right;
	}
	.lineup-player {
		min-width: 0;
	}
	.lineup-player strong,
	.lineup-player small {
		display: block;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.lineup-player strong {
		font-size: 14px;
	}
	.lineup-player small {
		margin-top: 4px;
		color: #878782;
		font-size: 10px;
	}
	.lineup-pending {
		min-height: 270px;
		padding: 40px;
		display: grid;
		place-content: center;
		text-align: center;
	}
	.preview-lineups.both-pending .lineup-pending {
		min-height: 180px;
	}
	.lineup-pending strong {
		font:
			800 19px 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.lineup-pending span {
		max-width: 260px;
		margin-top: 8px;
		color: #888;
		font-size: 11px;
		line-height: 1.5;
	}
	.season-dialog {
		position: absolute;
		inset: 0;
		z-index: 4;
		padding: 24px;
		color: #fff;
		background: #151514;
		overflow-y: auto;
	}
	.dialog-topline {
		display: flex;
		justify-content: space-between;
		align-items: center;
		color: #d4a528;
		font-size: 11px;
		font-weight: 900;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.dialog-topline button {
		width: 36px;
		height: 36px;
		color: #fff;
		background: transparent;
		border: 1px solid #555;
		font-size: 24px;
		cursor: pointer;
	}
	.dialog-player {
		margin: 28px 0 24px;
		display: flex;
		align-items: center;
		gap: 18px;
	}
	.jersey {
		width: 64px;
		height: 72px;
		display: grid;
		place-items: center;
		color: #111;
		background: #fdb827;
		font:
			900 30px 'Arial Narrow',
			sans-serif;
		transform: skew(-4deg);
	}
	.dialog-player small {
		color: #aaa;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.dialog-player h3 {
		margin: 5px 0 3px;
		font:
			850 clamp(28px, 4vw, 46px)/0.95 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
	}
	.dialog-player p {
		margin: 0;
		color: #aaa;
		font-size: 12px;
	}
	.dialog-stats {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 1px;
		background: #444;
		border: 1px solid #444;
	}
	.dialog-stats div {
		padding: 16px 10px;
		background: #20201f;
	}
	.dialog-stats span,
	.dialog-stats strong {
		display: block;
	}
	.dialog-stats span {
		color: #a9a9a3;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.dialog-stats strong {
		margin-top: 5px;
		font-size: 24px;
		font-variant-numeric: tabular-nums;
	}
	.dialog-note {
		margin-top: 20px;
		color: #888;
		font-size: 10px;
	}
	.coverage-note {
		margin: 18px 0 0;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 10px;
		color: #777;
		font-size: 10px;
		font-weight: 700;
		letter-spacing: 0.04em;
	}
	@media (max-width: 1100px) {
		.preview-grid {
			grid-template-columns: 1fr;
		}
		.details-card dl {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 0 20px;
		}
		.details-card dl div {
			grid-template-columns: 1fr;
		}
		.details-card dd {
			margin-top: 5px;
			text-align: left;
		}
	}
	@media (max-width: 820px) {
		.preview-meta span:last-child {
			display: none;
		}
		.matchup-hero {
			grid-template-columns: 1fr 84px 1fr;
			gap: 14px;
			padding: 22px 16px;
		}
		.hero-team {
			flex-direction: column;
			gap: 9px;
			text-align: center;
		}
		.hero-team.home {
			flex-direction: column;
			text-align: center;
		}
		.hero-team img {
			width: 56px;
			height: 56px;
		}
		.hero-team strong {
			font-size: 17px;
		}
		.first-pitch strong {
			font-size: 16px;
		}
		.starters {
			grid-template-columns: 1fr;
		}
		.starter {
			grid-template-columns: 115px minmax(0, 1fr);
		}
		.versus {
			padding: 8px;
		}
		.details-card dl {
			grid-template-columns: repeat(2, 1fr);
		}
		.mobile-tabs {
			display: flex;
			padding: 3px;
			background: #ecece8;
		}
		.mobile-tabs button {
			min-width: 46px;
			min-height: 31px;
			color: #777;
			background: transparent;
			border: 0;
			font-size: 11px;
			font-weight: 900;
		}
		.mobile-tabs button.active {
			color: #111;
			background: #fff;
			box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
		}
		.lineup-columns {
			display: block;
		}
		.preview-team-lineup + .preview-team-lineup {
			border-left: 0;
		}
		.preview-team-lineup.hidden-mobile {
			display: none;
		}
		.dialog-stats {
			grid-template-columns: repeat(2, 1fr);
		}
	}
	@media (max-width: 570px) {
		.preview-meta {
			padding: 0 12px;
			gap: 8px;
		}
		.matchup-hero {
			min-height: 168px;
			grid-template-columns: 1fr 64px 1fr;
			padding: 18px 10px;
		}
		.hero-team img {
			width: 48px;
			height: 48px;
		}
		.hero-team strong {
			display: none;
		}
		.hero-team span {
			font-size: 11px;
		}
		.first-pitch span {
			font-size: 7px;
		}
		.first-pitch strong {
			font-size: 13px;
		}
		.card-heading,
		.lineups-heading {
			min-height: 70px;
			padding: 14px;
		}
		.card-heading h2,
		.lineups-heading h2 {
			font-size: 22px;
		}
		.card-heading > small {
			display: none;
		}
		.starter {
			padding: 15px;
			grid-template-columns: 92px minmax(0, 1fr);
			gap: 14px;
		}
		.starter-portrait {
			min-height: 180px;
		}
		.starter-copy h3 {
			font-size: 22px;
		}
		.starter-stats {
			grid-template-columns: repeat(2, 1fr);
		}
		.details-card dl {
			grid-template-columns: 1fr 1fr;
			padding-inline: 14px;
		}
		.season-dialog {
			padding: 18px;
		}
		.dialog-player {
			align-items: flex-start;
		}
		.jersey {
			width: 52px;
			height: 60px;
			font-size: 25px;
		}
		.dialog-player h3 {
			font-size: 27px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		* {
			transition: none !important;
			animation: none !important;
		}
	}
</style>
