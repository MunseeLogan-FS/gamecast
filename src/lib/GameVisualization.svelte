<script lang="ts">
	import { untrack } from 'svelte';
	import BallparkField from '$lib/components/BallparkField.svelte';
	import PitchTrajectory from '$lib/components/PitchTrajectory.svelte';
	import { fieldProfileForVenue } from '$lib/field-geometry.js';
	import type { Play } from '$lib/mlb';
	import {
		advanceVisualizationState,
		latestBattedBall,
		mapHitToField,
		visualizationStateForGame
	} from '$lib/visualization.js';

	let {
		currentPlay,
		hitHistory = [],
		live = false,
		venueId,
		gamePk,
		initialMode = 'zone'
	}: {
		currentPlay?: Play;
		hitHistory?: Play[];
		live?: boolean;
		venueId?: number;
		gamePk?: number;
		initialMode?: 'zone' | 'field';
	} = $props();
	let selectedMode = $state<'zone' | 'field'>(untrack(() => initialMode));
	let handledContactAtBat = $state<number | null>(null);
	let handledPitchKey = $state('');
	let handledGamePk = $state(untrack(() => gamePk));
	let selectedPitchKey = $state('');

	const pitchEvents = $derived(
		(currentPlay?.playEvents ?? []).filter(
			(event) =>
				typeof event.pitchData?.coordinates?.pX === 'number' &&
				Number.isFinite(event.pitchData.coordinates.pX) &&
				typeof event.pitchData?.coordinates?.pZ === 'number' &&
				Number.isFinite(event.pitchData.coordinates.pZ)
		)
	);
	const newestPitch = $derived(pitchEvents.at(-1));
	const newestPitchKey = $derived(
		newestPitch ? `${currentPlay?.about?.atBatIndex ?? 'unknown'}:${pitchEvents.length}` : ''
	);
	const currentContact = $derived(latestBattedBall(currentPlay ? [currentPlay] : []));
	const lastContact = $derived(currentContact ?? latestBattedBall(hitHistory));
	const fieldProfile = $derived(fieldProfileForVenue(venueId));
	const hitPoint = $derived.by(() => {
		const coordinates = lastContact?.hitData?.coordinates;
		const coordX = coordinates?.coordX;
		const coordY = coordinates?.coordY;
		return typeof coordX === 'number' &&
			Number.isFinite(coordX) &&
			typeof coordY === 'number' &&
			Number.isFinite(coordY)
			? mapHitToField(coordX, coordY)
			: null;
	});

	$effect(() => {
		const mode = untrack(() => selectedMode);
		const gameState = visualizationStateForGame(
			{ mode, handledContactAtBat, handledPitchKey, gamePk: handledGamePk },
			gamePk
		);
		const next = advanceVisualizationState(
			gameState,
			currentContact?.play?.about?.atBatIndex,
			newestPitchKey
		);
		if (next.mode !== mode) selectedMode = next.mode;
		if (next.handledContactAtBat !== handledContactAtBat) {
			handledContactAtBat = next.handledContactAtBat;
		}
		if (next.handledPitchKey !== handledPitchKey) handledPitchKey = next.handledPitchKey;
		if (gameState.gamePk !== handledGamePk) handledGamePk = gameState.gamePk;
	});

	function trajectoryLabel(value?: string) {
		if (!value) return 'Ball in play';
		return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
	}
</script>

<section class="visualization" aria-label="Pitch and batted-ball visualization">
	<header>
		<div>
			<span class="kicker">Tracking</span>
			<strong>{selectedMode === 'zone' ? 'Pitch location' : 'Ball in play'}</strong>
		</div>
		<div class="view-switch" role="group" aria-label="Visualization type">
			<button class:active={selectedMode === 'zone'} onclick={() => (selectedMode = 'zone')}
				>Zone</button
			>
			<button
				class:active={selectedMode === 'field'}
				disabled={!lastContact}
				onclick={() => (selectedMode = 'field')}>Contact</button
			>
		</div>
	</header>

	<div class="viz-stage">
		{#key selectedMode}
			{#if selectedMode === 'zone'}
				<PitchTrajectory
					pitches={pitchEvents}
					gameKey={gamePk}
					atBatIndex={currentPlay?.about?.atBatIndex}
					renderMode="three"
					strikeZoneTop={newestPitch?.pitchData?.strikeZoneTop}
					strikeZoneBottom={newestPitch?.pitchData?.strikeZoneBottom}
					batSide={currentPlay?.matchup?.batSide}
					bind:selectedKey={selectedPitchKey}
				/>
			{:else if lastContact && fieldProfile}
				<div class="field-view ballpark-view">
					<BallparkField
						profile={fieldProfile}
						hitData={lastContact.hitData}
						description={lastContact.play?.result?.description ?? ''}
					/>
				</div>
			{:else if lastContact && hitPoint}
				<div class="field-view">
					<svg viewBox="0 0 250 220" role="img" aria-label="Batted-ball location">
						<defs
							><radialGradient id="grass" cx="50%" cy="85%" r="80%"
								><stop offset="0" stop-color="#315a3f" /><stop
									offset="1"
									stop-color="#173523"
								/></radialGradient
							></defs
						>
						<path class="outfield" d="M125 207 12 95Q125-10 238 95Z" fill="url(#grass)" />
						<path class="infield-dirt" d="M125 201 82 159 125 119 168 159Z" />
						<path class="infield-grass" d="M125 190 94 159 125 130 156 159Z" />
						<path class="foul-lines" d="M125 207 12 95M125 207 238 95" />
						<path class="outfield-arc" d="M27 99Q125 11 223 99" />
						<g class="bases"
							><rect x="121" y="116" width="8" height="8" /><rect
								x="78"
								y="155"
								width="8"
								height="8"
							/><rect x="164" y="155" width="8" height="8" /></g
						>
						<path
							class="hit-trail"
							style={`--trail-length:${Math.hypot(hitPoint.x - 125, hitPoint.y - 207)}`}
							d={`M125 207 L${hitPoint.x} ${hitPoint.y}`}
						/>
						<circle class="hit-ripple" cx={hitPoint.x} cy={hitPoint.y} r="16" />
						<circle class="hit-dot" cx={hitPoint.x} cy={hitPoint.y} r="6" />
						<path class="home-plate" d="M119 204H131L129 210L125 213L121 210Z" />
					</svg>
				</div>
			{:else}
				<div class="no-contact">No tracked ball in play yet.</div>
			{/if}
		{/key}
	</div>

	<div class="viz-caption">
		{#if selectedMode === 'zone'}
			<span class:live={live && !!newestPitch}
				>{live ? 'Current at-bat' : 'Last at-bat'} · {pitchEvents.length}
				{pitchEvents.length === 1 ? 'pitch' : 'pitches'}</span
			>
			<p>
				{newestPitch
					? 'Select a numbered pitch to replay its recorded path.'
					: 'Pitch locations appear after the first pitch.'}
			</p>
		{:else if lastContact}
			<span
				>{trajectoryLabel(lastContact.hitData?.trajectory)} · {lastContact.play?.matchup?.batter
					?.fullName ?? 'Batter'}</span
			>
			<p>
				{[
					lastContact.hitData?.launchSpeed !== undefined
						? `${lastContact.hitData.launchSpeed.toFixed(1)} MPH`
						: '',
					lastContact.hitData?.launchAngle !== undefined
						? `${lastContact.hitData.launchAngle.toFixed(0)}° launch`
						: '',
					lastContact.hitData?.totalDistance !== undefined
						? `${lastContact.hitData.totalDistance.toFixed(0)} ft`
						: ''
				]
					.filter(Boolean)
					.join(' · ') || lastContact.play?.result?.description}
			</p>
		{/if}
	</div>
</section>

<style>
	.visualization {
		margin: 20px -24px -24px;
		background: #111;
		color: #f5f5f1;
		border-top: 3px solid #fdb827;
	}
	.visualization > header {
		height: 54px;
		padding: 0 16px;
		display: flex;
		align-items: center;
		justify-content: space-between;
		border-bottom: 1px solid #32322f;
	}
	.visualization > header > div:first-child {
		display: flex;
		flex-direction: column;
	}
	.kicker {
		color: #b79a53;
		font-size: 7px;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-transform: uppercase;
	}
	.visualization header strong {
		margin-top: 4px;
		font:
			850 14px/1 'Arial Narrow',
			sans-serif;
		text-transform: uppercase;
		letter-spacing: 0.03em;
	}
	.view-switch {
		display: flex;
		padding: 2px;
		background: #292926;
	}
	.view-switch button {
		padding: 6px 8px;
		color: #91918c;
		background: transparent;
		border: 0;
		font-size: 7px;
		font-weight: 900;
		text-transform: uppercase;
		cursor: pointer;
	}
	.view-switch button.active {
		color: #111;
		background: #fdb827;
	}
	.view-switch button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.viz-stage {
		min-height: 286px;
		display: grid;
		place-items: center;
		overflow: hidden;
		background: radial-gradient(circle at 50% 50%, #21211e, #111 68%);
	}
	.field-view {
		position: relative;
		width: 100%;
		animation: view-in 0.35s ease-out;
	}
	.field-view svg {
		display: block;
		width: 250px;
		height: 220px;
		margin: 20px auto 8px;
		filter: drop-shadow(0 14px 18px rgba(0, 0, 0, 0.25));
	}
	.infield-dirt {
		fill: #9b7049;
	}
	.infield-grass {
		fill: #244a32;
	}
	.foul-lines,
	.outfield-arc {
		fill: none;
		stroke: #e7e1c9;
		stroke-width: 1;
		opacity: 0.55;
	}
	.bases rect {
		fill: #f5f0db;
		transform: rotate(45deg);
		transform-box: fill-box;
		transform-origin: center;
	}
	.home-plate {
		fill: #fff;
	}
	.hit-trail {
		fill: none;
		stroke: #fdb827;
		stroke-width: 2.5;
		stroke-linecap: round;
		stroke-dasharray: var(--trail-length);
		stroke-dashoffset: var(--trail-length);
		animation: draw-trail 0.7s 0.15s cubic-bezier(0.4, 0, 0.2, 1) forwards;
	}
	.hit-dot {
		fill: #fff;
		stroke: #fdb827;
		stroke-width: 3;
		opacity: 0;
		animation: impact 0.25s 0.82s cubic-bezier(0.2, 1.8, 0.5, 1) forwards;
	}
	.hit-ripple {
		fill: none;
		stroke: #fdb827;
		stroke-width: 2;
		opacity: 0;
		animation: hit-ring 1.6s 0.85s ease-out infinite;
	}

	.no-contact {
		color: #85857f;
		font-size: 10px;
	}
	.viz-caption {
		min-height: 72px;
		padding: 14px 17px;
		border-top: 1px solid #292926;
	}
	.viz-caption span {
		display: block;
		color: #a9a9a2;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.viz-caption span.live::before {
		content: '';
		display: inline-block;
		width: 6px;
		height: 6px;
		margin-right: 6px;
		border-radius: 50%;
		background: #e74d45;
		box-shadow: 0 0 0 4px rgba(231, 77, 69, 0.12);
	}
	.viz-caption p {
		margin: 7px 0 0;
		color: #f1f1eb;
		font-size: 11px;
		line-height: 1.45;
	}
	@keyframes view-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes draw-trail {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes impact {
		from {
			opacity: 0;
			transform: scale(0.25);
			transform-origin: center;
		}
		to {
			opacity: 1;
			transform: scale(1);
			transform-origin: center;
		}
	}
	@keyframes hit-ring {
		0% {
			opacity: 0.75;
			transform: scale(0.3);
			transform-origin: center;
		}
		75%,
		100% {
			opacity: 0;
			transform: scale(1.6);
			transform-origin: center;
		}
	}
	@media (min-width: 821px) {
		.viz-stage {
			min-height: 430px;
		}
		.field-view svg {
			width: min(440px, calc(100% - 48px));
			height: auto;
			aspect-ratio: 250 / 220;
		}
	}
	@media (max-width: 820px) {
		.visualization {
			margin: 20px -20px -20px;
		}
		.viz-stage {
			min-height: 270px;
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.field-view,
		.hit-trail,
		.hit-dot,
		.hit-ripple {
			animation: none !important;
			opacity: 1;
		}
		.hit-trail {
			stroke-dashoffset: 0;
		}
	}
</style>
