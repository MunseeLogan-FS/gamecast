<script lang="ts">
	import { resolve } from '$app/paths';
	import GameVisualization from '$lib/GameVisualization.svelte';
	import { DEMO_CURRENT_PLAY, DEMO_HIT_HISTORY } from '$lib/demo-data.js';
</script>

<svelte:head>
	<title>Tracking Demo — Pirates Gamecast</title>
	<meta
		name="description"
		content="Explore the Pirates Gamecast pitch-location and batted-ball tracking experience with recorded MLB data."
	/>
</svelte:head>

<header class="topbar">
	<a class="brand" href={resolve('/')} data-sveltekit-reload aria-label="Pirates Gamecast home"
		><span>P</span><strong>Bucs</strong><i>Gamecast</i></a
	>
	<a class="game-link" href={resolve('/')} data-sveltekit-reload>← Today’s game</a>
</header>

<main>
	<section class="intro">
		<div>
			<p class="eyebrow">Recorded tracking demo</p>
			<h1>See the plate.<br />Follow the contact.</h1>
		</div>
		<div class="intro-copy">
			<p>
				Explore the same pitch-location and batted-ball views that appear automatically during a
				Pirates game.
			</p>
			<span>This page uses recorded MLB telemetry. Nothing shown here is live.</span>
		</div>
	</section>

	<section class="showcase" aria-label="Gamecast tracking demonstration">
		<div class="tracker-shell">
			<div class="demo-score">
				<div class="demo-label"><span>Recorded at-bat</span><b>Final / 12</b></div>
				<div class="score-row">
					<div class="score-team away"><span>AZ</span><strong>8</strong></div>
					<i aria-hidden="true"></i>
					<div class="score-team home"><span>PIT</span><strong>7</strong></div>
				</div>
				<div class="matchup">
					<div><small>Batter</small><b>Tyler Callihan</b></div>
					<em>vs</em>
					<div><small>Pitcher</small><b>Gerardo Carrillo</b></div>
				</div>
			</div>
			<GameVisualization currentPlay={DEMO_CURRENT_PLAY} hitHistory={DEMO_HIT_HISTORY} />
		</div>

		<div class="guide">
			<p class="section-number">01 / Pitch location</p>
			<h2>Read the at-bat pitch by pitch.</h2>
			<p>
				Every numbered marker uses MLB’s recorded horizontal and vertical plate coordinates. The
				strike-zone height changes with the batter.
			</p>
			<ul>
				<li><i class="ball"></i><span><b>Ball</b>Outside the recorded call</span></li>
				<li><i class="strike"></i><span><b>Strike</b>Called or swinging</span></li>
				<li><i class="foul"></i><span><b>Foul</b>Blue-outlined strike marker</span></li>
				<li><i class="contact"></i><span><b>In play</b>Contact on the pitch</span></li>
			</ul>
			<div class="contact-guide">
				<p class="section-number">02 / Contact</p>
				<h3>Switch views to follow the ball.</h3>
				<p>
					Select <b>Contact</b> above the visualization to replay a tracked ground ball with exit velocity,
					launch angle, and estimated field location.
				</p>
			</div>
		</div>
	</section>
</main>

<footer>
	<span>Unofficial Pirates Gamecast · Recorded MLB Stats API data</span>
	<a href={resolve('/')} data-sveltekit-reload>Return to today’s game →</a>
</footer>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #eeede9;
		color: #111;
		font-family:
			Inter,
			ui-sans-serif,
			system-ui,
			-apple-system,
			sans-serif;
	}
	.topbar {
		height: 68px;
		padding: 0 max(24px, calc((100vw - 1120px) / 2));
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #111;
		color: #fff;
		border-bottom: 3px solid #fdb827;
	}
	.brand {
		display: flex;
		align-items: center;
		color: inherit;
		text-decoration: none;
		text-transform: uppercase;
	}
	.brand > span {
		width: 38px;
		height: 38px;
		display: grid;
		place-items: center;
		margin-right: 11px;
		background: #fdb827;
		color: #111;
		font:
			950 23px/1 Georgia,
			serif;
		transform: skew(-5deg);
	}
	.brand strong {
		font:
			900 15px/1 'Arial Narrow',
			Arial,
			sans-serif;
		letter-spacing: 0.08em;
	}
	.brand i {
		margin-left: 8px;
		color: #8f8f89;
		font:
			800 8px/1.2 ui-sans-serif,
			sans-serif;
		letter-spacing: 0.14em;
		font-style: normal;
	}
	.game-link {
		color: #d0d0ca;
		font-size: 9px;
		font-weight: 850;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	.game-link:hover {
		color: #fdb827;
	}
	main {
		max-width: 1120px;
		margin: auto;
		padding: 64px 24px 80px;
	}
	.intro {
		display: grid;
		grid-template-columns: 1.2fr 0.8fr;
		gap: 70px;
		align-items: end;
		margin-bottom: 48px;
	}
	.eyebrow,
	.section-number {
		margin: 0 0 13px;
		color: #8d6b18;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.16em;
		text-transform: uppercase;
	}
	.intro h1 {
		margin: 0;
		font:
			950 clamp(42px, 6vw, 76px)/0.9 'Arial Narrow',
			Arial,
			sans-serif;
		letter-spacing: -0.045em;
		text-transform: uppercase;
	}
	.intro-copy {
		padding: 0 0 4px;
		border-top: 1px solid #b9b7b0;
	}
	.intro-copy p {
		margin: 18px 0 12px;
		font-size: 15px;
		line-height: 1.55;
	}
	.intro-copy span {
		color: #77756e;
		font-size: 10px;
		line-height: 1.5;
	}
	.showcase {
		display: grid;
		grid-template-columns: 360px minmax(0, 1fr);
		gap: 72px;
		align-items: start;
	}
	.tracker-shell {
		padding: 24px;
		background: #fff;
		box-shadow: 0 18px 50px rgba(25, 23, 16, 0.12);
	}
	.demo-score {
		padding-bottom: 2px;
	}
	.demo-label {
		display: flex;
		justify-content: space-between;
		color: #77746d;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.13em;
		text-transform: uppercase;
	}
	.demo-label b {
		color: #8d6b18;
	}
	.score-row {
		display: grid;
		grid-template-columns: 1fr minmax(24px, 42px) 1fr;
		gap: 10px;
		align-items: center;
		margin: 20px 0 18px;
		font:
			900 14px/1 'Arial Narrow',
			Arial,
			sans-serif;
	}
	.score-team {
		display: flex;
		align-items: center;
		gap: 10px;
		min-width: 0;
	}
	.score-team.home {
		justify-content: flex-end;
	}
	.score-team strong {
		font-size: 30px;
		font-variant-numeric: tabular-nums;
	}
	.score-row > i {
		width: 100%;
		height: 1px;
		background: #d3d1ca;
	}
	.matchup {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		gap: 13px;
		align-items: center;
		padding-top: 15px;
		border-top: 1px solid #dddcd6;
	}
	.matchup div:last-child {
		text-align: right;
	}
	.matchup small {
		display: block;
		margin-bottom: 5px;
		color: #89877f;
		font-size: 7px;
		font-weight: 900;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}
	.matchup b {
		display: block;
		font:
			850 11px/1.2 'Arial Narrow',
			Arial,
			sans-serif;
		text-transform: uppercase;
	}
	.matchup em {
		color: #aaa79f;
		font-size: 8px;
		font-style: normal;
		font-weight: 800;
		text-transform: uppercase;
	}
	.guide {
		padding-top: 28px;
		max-width: 540px;
	}
	.guide h2 {
		max-width: 470px;
		margin: 0 0 20px;
		font:
			950 clamp(32px, 4vw, 52px)/0.95 'Arial Narrow',
			Arial,
			sans-serif;
		letter-spacing: -0.035em;
		text-transform: uppercase;
	}
	.guide > p:not(.section-number),
	.contact-guide p {
		max-width: 500px;
		color: #5f5d56;
		font-size: 13px;
		line-height: 1.65;
	}
	.guide ul {
		list-style: none;
		margin: 30px 0 42px;
		padding: 0;
		border-top: 1px solid #cbc9c2;
	}
	.guide li {
		display: grid;
		grid-template-columns: 12px 1fr;
		gap: 13px;
		align-items: center;
		padding: 13px 0;
		border-bottom: 1px solid #cbc9c2;
	}
	.guide li > i {
		width: 9px;
		height: 9px;
		border-radius: 50%;
	}
	.guide li .ball {
		background: #5bc982;
	}
	.guide li .strike {
		background: #ee645c;
	}
	.guide li .foul {
		background: #ee645c;
		border: 2px solid #3b82f6;
	}
	.guide li .contact {
		background: #fdb827;
	}
	.guide li span {
		display: flex;
		justify-content: space-between;
		color: #7b7972;
		font-size: 9px;
	}
	.guide li b {
		color: #1d1c19;
		font-size: 10px;
		text-transform: uppercase;
	}
	.contact-guide {
		padding: 25px 0 0;
		border-top: 3px solid #111;
	}
	.contact-guide h3 {
		margin: 0 0 11px;
		font:
			900 22px/1 'Arial Narrow',
			Arial,
			sans-serif;
		text-transform: uppercase;
	}
	.contact-guide p b {
		color: #111;
	}
	footer {
		min-height: 70px;
		padding: 20px max(24px, calc((100vw - 1120px) / 2));
		display: flex;
		align-items: center;
		justify-content: space-between;
		background: #111;
		color: #767671;
		font-size: 8px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	footer a {
		color: #fdb827;
		text-decoration: none;
	}
	@media (max-width: 760px) {
		.topbar {
			padding: 0 18px;
		}
		.brand i {
			display: none;
		}
		main {
			padding: 42px 18px 60px;
		}
		.intro {
			grid-template-columns: 1fr;
			gap: 28px;
		}
		.intro-copy {
			max-width: 520px;
		}
		.showcase {
			grid-template-columns: 1fr;
			gap: 45px;
		}
		.tracker-shell {
			width: 100%;
			max-width: 360px;
			margin: auto;
		}
		.guide {
			padding-top: 0;
		}
		footer {
			gap: 20px;
			align-items: flex-start;
			flex-direction: column;
			padding: 24px 18px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		* {
			scroll-behavior: auto !important;
		}
	}
</style>
