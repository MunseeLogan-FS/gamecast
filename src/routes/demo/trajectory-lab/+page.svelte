<script lang="ts">
	import { resolve } from '$app/paths';
	import PitchTrajectory from '$lib/components/PitchTrajectory.svelte';
	import ThreePitchTrajectory from '$lib/components/ThreePitchTrajectory.svelte';
	import { DEMO_CURRENT_PLAY } from '$lib/demo-data.js';

	const pitches = DEMO_CURRENT_PLAY.playEvents ?? [];
	const atBatIndex = DEMO_CURRENT_PLAY.about.atBatIndex;
	let selectedKey = $state(`lab:${atBatIndex}:${pitches.length}`);
	const selectedIndex = $derived(
		Math.max(0, Number.parseInt(selectedKey.split(':').at(-1) ?? `${pitches.length}`, 10) - 1)
	);
	const selectedPitch = $derived(pitches[selectedIndex] ?? pitches.at(-1)!);
</script>

<svelte:head>
	<title>Trajectory Lab — Pirates Gamecast</title>
	<meta
		name="description"
		content="Compare the existing SVG pitch replay with an experimental Three.js catcher view."
	/>
</svelte:head>

<header class="lab-header">
	<div>
		<span>Recorded telemetry experiment</span>
		<h1>Trajectory lab</h1>
	</div>
	<a href={resolve('/demo')} data-sveltekit-reload>Back to tracking demo</a>
</header>

<main>
	<section class="intro">
		<div>
			<p class="eyebrow">SVG vs Three.js</p>
			<h2>Does real perspective make the flight easier to read?</h2>
		</div>
		<p>
			Both panels use the same MLB telemetry and authoritative plate endpoint. Select a pitch in the
			SVG panel; the Three.js view updates to the same pitch.
		</p>
	</section>

	<section class="comparison" aria-label="Pitch trajectory rendering comparison">
		<article class="panel svg-panel">
			<header class="panel-header">
				<div><span>Current approach</span><strong>SVG 2.5D</strong></div>
				<small>No runtime dependency</small>
			</header>
			<PitchTrajectory
				{pitches}
				gameKey="lab"
				{atBatIndex}
				strikeZoneTop={selectedPitch.pitchData?.strikeZoneTop}
				strikeZoneBottom={selectedPitch.pitchData?.strikeZoneBottom}
				batSide={DEMO_CURRENT_PLAY.matchup?.batSide}
				bind:selectedKey
			/>
		</article>

		<article class="panel three-panel">
			<header class="panel-header">
				<div><span>Experimental approach</span><strong>Three.js catcher view</strong></div>
				<small>Low angle behind the plate · real feet</small>
			</header>
			{#key selectedKey}
				<ThreePitchTrajectory
					pitch={selectedPitch}
					pitchNumber={selectedIndex + 1}
					strikeZoneTop={selectedPitch.pitchData?.strikeZoneTop}
					strikeZoneBottom={selectedPitch.pitchData?.strikeZoneBottom}
				/>
			{/key}
		</article>
	</section>

	<section class="questions">
		<div>
			<span>01</span>
			<p>Which view makes release-to-plate depth obvious without explanation?</p>
		</div>
		<div>
			<span>02</span>
			<p>Does the moving ball clarify the pitch, or does it feel like unnecessary spectacle?</p>
		</div>
		<div>
			<span>03</span>
			<p>Is the added Three.js dependency earning enough visual clarity?</p>
		</div>
	</section>
</main>

<style>
	:global(*) {
		box-sizing: border-box;
	}
	:global(body) {
		margin: 0;
		background: #e9e8e3;
		color: #111;
		font-family: Inter, ui-sans-serif, system-ui, sans-serif;
	}
	.lab-header,
	main {
		width: min(1440px, calc(100% - 48px));
		margin-inline: auto;
	}
	.lab-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 26px 0 20px;
		border-bottom: 3px solid #111;
	}
	.lab-header span,
	.eyebrow,
	.panel-header span,
	.panel-header small {
		color: #856512;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}
	h1 {
		margin: 4px 0 0;
		font-size: 24px;
		line-height: 1;
		text-transform: uppercase;
	}
	.lab-header a {
		color: #111;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-decoration: none;
		text-transform: uppercase;
	}
	main {
		padding: 54px 0 80px;
	}
	.intro {
		display: grid;
		grid-template-columns: minmax(0, 1.35fr) minmax(280px, 0.65fr);
		gap: 80px;
		align-items: end;
		margin-bottom: 34px;
	}
	.eyebrow {
		margin: 0 0 12px;
	}
	.intro h2 {
		max-width: 800px;
		margin: 0;
		font:
			950 clamp(38px, 5vw, 70px)/0.9 'Arial Narrow',
			Arial,
			sans-serif;
		letter-spacing: -0.045em;
		text-transform: uppercase;
	}
	.intro > p {
		margin: 0;
		padding-top: 18px;
		border-top: 1px solid #aaa89f;
		font-size: 14px;
		line-height: 1.6;
	}
	.comparison {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 18px;
	}
	.panel {
		min-width: 0;
		background: #111;
		box-shadow: 0 18px 46px rgba(22, 20, 14, 0.16);
	}
	.panel-header {
		height: 68px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 20px;
		padding: 0 18px;
		color: #fff;
		border-top: 3px solid #fdb827;
		border-bottom: 1px solid #333;
	}
	.panel-header div {
		display: flex;
		flex-direction: column;
	}
	.panel-header strong {
		margin-top: 4px;
		font-size: 15px;
		text-transform: uppercase;
	}
	.panel-header small {
		color: #898a84;
		text-align: right;
	}
	.svg-panel :global(.pitch-trajectory) {
		min-height: 520px;
	}
	.questions {
		display: grid;
		grid-template-columns: repeat(3, minmax(0, 1fr));
		gap: 1px;
		margin-top: 24px;
		background: #aaa89f;
		border: 1px solid #aaa89f;
	}
	.questions div {
		display: grid;
		grid-template-columns: 34px 1fr;
		gap: 16px;
		padding: 20px;
		background: #f3f2ee;
	}
	.questions span {
		color: #9a7415;
		font-size: 11px;
		font-weight: 900;
	}
	.questions p {
		margin: 0;
		font-size: 12px;
		font-weight: 700;
		line-height: 1.5;
	}
	@media (max-width: 900px) {
		.intro,
		.comparison {
			grid-template-columns: 1fr;
		}
		.intro {
			gap: 28px;
		}
		.questions {
			grid-template-columns: 1fr;
		}
	}
	@media (max-width: 600px) {
		.lab-header,
		main {
			width: min(100% - 28px, 1440px);
		}
		.lab-header {
			align-items: flex-start;
			gap: 18px;
		}
		.lab-header a {
			max-width: 120px;
			text-align: right;
		}
		main {
			padding-top: 38px;
		}
		.panel-header small {
			display: none;
		}
	}
</style>
