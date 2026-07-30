<script lang="ts">
	import type { Play } from '$lib/mlb';
	import {
		advanceVisualizationState,
		classifyPitch,
		latestBattedBall,
		mapHitToField,
		mapPitchToZone,
		strikeZoneRect
	} from '$lib/visualization.js';

	let {
		currentPlay,
		hitHistory = [],
		live = false
	}: { currentPlay?: Play; hitHistory?: Play[]; live?: boolean } = $props();
	let selectedMode = $state<'zone' | 'field'>('zone');
	let handledContactAtBat = $state<number | null>(null);
	let handledPitchKey = $state('');

	const pitchEvents = $derived(
		(currentPlay?.playEvents ?? []).filter(
			(event) =>
				event.pitchData?.coordinates?.pX !== undefined &&
				event.pitchData?.coordinates?.pZ !== undefined
		)
	);
	const plottedPitches = $derived(
		pitchEvents.map((event, index) => ({
			event,
			index: index + 1,
			point: mapPitchToZone(
				event.pitchData?.coordinates?.pX ?? 0,
				event.pitchData?.coordinates?.pZ ?? 0
			),
			kind: classifyPitch(event)
		}))
	);
	const newestPitch = $derived(plottedPitches.at(-1));
	const newestPitchKey = $derived(
		newestPitch ? `${currentPlay?.about?.atBatIndex ?? 'unknown'}:${plottedPitches.length}` : ''
	);
	const batSide = $derived(currentPlay?.matchup?.batSide?.code?.toUpperCase());
	const batSideLabel = $derived(
		batSide === 'L' ? 'LHB' : batSide === 'R' ? 'RHB' : batSide === 'S' ? 'Switch' : ''
	);
	const zone = $derived(
		strikeZoneRect(
			newestPitch?.event.pitchData?.strikeZoneTop ?? 3.5,
			newestPitch?.event.pitchData?.strikeZoneBottom ?? 1.5
		)
	);
	const currentContact = $derived(latestBattedBall(currentPlay ? [currentPlay] : []));
	const lastContact = $derived(currentContact ?? latestBattedBall(hitHistory));
	const hitPoint = $derived.by(() => {
		const coordinates = lastContact?.hitData?.coordinates;
		return coordinates?.coordX !== undefined && coordinates?.coordY !== undefined
			? mapHitToField(coordinates.coordX, coordinates.coordY)
			: null;
	});

	$effect(() => {
		const next = advanceVisualizationState(
			{ mode: selectedMode, handledContactAtBat, handledPitchKey },
			currentContact?.play?.about?.atBatIndex,
			newestPitchKey
		);
		if (next.mode !== selectedMode) selectedMode = next.mode;
		if (next.handledContactAtBat !== handledContactAtBat) {
			handledContactAtBat = next.handledContactAtBat;
		}
		if (next.handledPitchKey !== handledPitchKey) handledPitchKey = next.handledPitchKey;
	});

	function pitchSummary() {
		if (!newestPitch) return 'Pitch locations appear after first pitch.';
		const pitch = newestPitch.event;
		const type = pitch.details?.type?.description ?? 'Pitch';
		const speed = pitch.pitchData?.startSpeed ? `${pitch.pitchData.startSpeed.toFixed(1)} MPH` : '';
		const call = pitch.details?.call?.description ?? pitch.details?.description ?? '';
		return [type, speed, call].filter(Boolean).join(' · ');
	}

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
				<div class="zone-view">
					{#if batSideLabel}
						<div class="bat-side" class:left={batSide === 'L'} class:right={batSide === 'R'}>
							<span>{batSideLabel}</span>
							<small>{currentPlay?.matchup?.batSide?.description ?? 'Batter side'}</small>
						</div>
					{/if}
					<svg
						viewBox="0 0 220 260"
						role="img"
						aria-label={`${plottedPitches.length} pitches plotted around the strike zone`}
					>
						<defs>
							<pattern id="zone-grid" width="20" height="20" patternUnits="userSpaceOnUse"
								><path
									d="M20 0H0V20"
									fill="none"
									stroke="currentColor"
									stroke-opacity=".07"
									stroke-width="1"
								/></pattern
							>
						</defs>
						<rect class="grid" x="0" y="0" width="220" height="260" fill="url(#zone-grid)" />
						<rect
							class="zone-shadow"
							x={zone.x}
							y={zone.y}
							width={zone.width}
							height={zone.height}
						/>
						<rect class="zone-box" x={zone.x} y={zone.y} width={zone.width} height={zone.height} />
						<line
							class="zone-third"
							x1={zone.x}
							x2={zone.x + zone.width}
							y1={zone.y + zone.height / 3}
							y2={zone.y + zone.height / 3}
						/>
						<line
							class="zone-third"
							x1={zone.x}
							x2={zone.x + zone.width}
							y1={zone.y + (zone.height * 2) / 3}
							y2={zone.y + (zone.height * 2) / 3}
						/>
						<line
							class="zone-third vertical"
							x1={zone.x + zone.width / 3}
							x2={zone.x + zone.width / 3}
							y1={zone.y}
							y2={zone.y + zone.height}
						/>
						<line
							class="zone-third vertical"
							x1={zone.x + (zone.width * 2) / 3}
							x2={zone.x + (zone.width * 2) / 3}
							y1={zone.y}
							y2={zone.y + zone.height}
						/>
						<path class="plate" d="M79 234H141L134 244L110 252L86 244Z" />
						{#each plottedPitches as pitch, index (pitch.index)}
							<g
								class="pitch-point {pitch.kind}"
								class:latest={index === plottedPitches.length - 1}
								style={`--delay:${index * 55}ms`}
							>
								<title
									>{pitch.index}. {pitch.event.details?.type?.description ?? 'Pitch'}
									{pitch.event.pitchData?.startSpeed ?? ''} MPH — {pitch.event.details?.call
										?.description ??
										pitch.event.details?.description ??
										''}</title
								>
								{#if index === plottedPitches.length - 1}<circle
										class="pitch-ring"
										cx={pitch.point.x}
										cy={pitch.point.y}
										r="14"
									/>{/if}
								<circle class="pitch-dot" cx={pitch.point.x} cy={pitch.point.y} r="9" />
								<text x={pitch.point.x} y={pitch.point.y + 3.3}>{pitch.index}</text>
							</g>
						{/each}
					</svg>
					<div class="legend">
						<span><i class="ball"></i>Ball</span><span><i class="strike"></i>Strike</span><span
							><i class="foul"></i>Foul</span
						><span><i class="inplay"></i>In play</span>
					</div>
				</div>
			{:else if lastContact && hitPoint}
				<div class="field-view">
					<svg viewBox="0 0 250 220" role="img" aria-label="Estimated batted-ball location">
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
					<span class="estimate-note">Estimated location</span>
				</div>
			{:else}
				<div class="no-contact">No tracked ball in play yet.</div>
			{/if}
		{/key}
	</div>

	<div class="viz-caption">
		{#if selectedMode === 'zone'}
			<span class:live={live && !!newestPitch}
				>{live ? 'Current at-bat' : 'Last at-bat'} · {plottedPitches.length}
				{plottedPitches.length === 1 ? 'pitch' : 'pitches'}</span
			>
			<p>{pitchSummary()}</p>
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
	.zone-view {
		position: relative;
		width: 100%;
		animation: view-in 0.35s ease-out;
	}
	.bat-side {
		position: absolute;
		top: 12px;
		z-index: 1;
		display: flex;
		flex-direction: column;
		gap: 2px;
		padding: 6px 8px;
		border: 1px solid #45453f;
		background: rgba(17, 17, 17, 0.82);
		text-align: left;
	}
	.bat-side.left {
		right: 12px;
		border-right: 3px solid #fdb827;
		text-align: right;
	}
	.bat-side.right {
		left: 12px;
		border-left: 3px solid #fdb827;
	}
	.bat-side span {
		color: #fdb827;
		font-size: 8px;
		font-weight: 900;
		letter-spacing: 0.08em;
	}
	.bat-side small {
		color: #85857f;
		font-size: 6px;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.zone-view svg {
		display: block;
		width: 220px;
		height: 260px;
		margin: auto;
		color: #fff;
	}
	.grid {
		color: #fff;
	}
	.zone-shadow {
		fill: #fdb827;
		opacity: 0.035;
	}
	.zone-box {
		fill: none;
		stroke: #d7d7cf;
		stroke-width: 2;
		animation: zone-in 0.5s ease-out;
	}
	.zone-third {
		stroke: #fff;
		stroke-width: 0.75;
		opacity: 0.14;
	}
	.plate {
		fill: #e9e9df;
		opacity: 0.75;
	}
	.pitch-point {
		opacity: 0;
		animation: pitch-pop 0.38s cubic-bezier(0.2, 1.5, 0.5, 1) forwards;
		animation-delay: var(--delay);
	}
	.pitch-dot {
		stroke: #111;
		stroke-width: 2.5;
	}
	.pitch-point text {
		fill: #111;
		font: 900 8px Arial;
		text-anchor: middle;
		pointer-events: none;
	}
	.pitch-point.ball .pitch-dot {
		fill: #5bc982;
	}
	.pitch-point.strike .pitch-dot {
		fill: #ee645c;
	}
	.pitch-point.inplay .pitch-dot {
		fill: #fdb827;
	}
	.pitch-point.neutral .pitch-dot {
		fill: #c8c8c0;
	}
	.pitch-point.latest .pitch-dot {
		stroke: #fff;
		stroke-width: 2;
	}
	.pitch-point.foul .pitch-dot {
		fill: #ee645c;
		stroke: #3b82f6;
		stroke-width: 3.5;
	}
	.pitch-ring {
		fill: none;
		stroke: #fff;
		stroke-width: 1.5;
		opacity: 0;
		animation: ring 1.8s ease-out infinite;
	}
	.legend {
		display: flex;
		justify-content: center;
		gap: 16px;
		margin-top: -3px;
		color: #898984;
		font-size: 7px;
		font-weight: 800;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: 5px;
	}
	.legend i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.legend .ball {
		background: #5bc982;
	}
	.legend .strike {
		background: #ee645c;
	}
	.legend .foul {
		background: #ee645c;
		border: 2px solid #3b82f6;
	}
	.legend .inplay {
		background: #fdb827;
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
	.estimate-note {
		display: block;
		margin-top: -6px;
		color: #7f7f79;
		text-align: center;
		font-size: 7px;
		font-weight: 800;
		letter-spacing: 0.14em;
		text-transform: uppercase;
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
	@keyframes pitch-pop {
		0% {
			opacity: 0;
			transform: scale(0.2);
			transform-origin: center;
		}
		100% {
			opacity: 1;
			transform: scale(1);
		}
	}
	@keyframes ring {
		0% {
			opacity: 0.75;
			transform: scale(0.55);
			transform-origin: center;
		}
		75%,
		100% {
			opacity: 0;
			transform: scale(1.7);
			transform-origin: center;
		}
	}
	@keyframes zone-in {
		from {
			stroke-dasharray: 300;
			stroke-dashoffset: 300;
		}
		to {
			stroke-dasharray: 300;
			stroke-dashoffset: 0;
		}
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
		.zone-view svg {
			width: 280px;
			height: 331px;
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
		.zone-view,
		.field-view,
		.zone-box,
		.pitch-point,
		.pitch-ring,
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
