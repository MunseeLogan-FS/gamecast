<script lang="ts">
	import type { HitData } from '$lib/mlb';
	import {
		PNC_PARK,
		estimateHitLocation,
		fieldPointToSvg,
		hitLocationAriaLabel,
		wallSvgPoints
	} from '$lib/field-geometry.js';

	let {
		profile,
		hitData,
		description = ''
	}: { profile: typeof PNC_PARK; hitData: HitData; description?: string } = $props();

	const wall = $derived(wallSvgPoints(profile));
	const home = $derived(profile.viewBox.home);
	const first = $derived(fieldPointToSvg(profile, { x: 63.64, y: 63.64 }));
	const second = $derived(fieldPointToSvg(profile, { x: 0, y: 127.28 }));
	const third = $derived(fieldPointToSvg(profile, { x: -63.64, y: 63.64 }));
	const mound = $derived(fieldPointToSvg(profile, { x: 0, y: 60.5 }));
	const estimate = $derived(estimateHitLocation(hitData, description, profile));
	const accessibleLabel = $derived(hitLocationAriaLabel(estimate, description, profile));
	const outfieldPath = $derived(
		`M ${home.x} ${home.y} L ${wall.map(({ svg }) => `${svg.x} ${svg.y}`).join(' L ')} Z`
	);
	const wallPath = $derived(`M ${wall.map(({ svg }) => `${svg.x} ${svg.y}`).join(' L ')}`);
	const leftFoulPath = $derived(
		`M ${home.x} ${home.y} L ${wall[0].svg.x} ${wall[0].svg.y} L 6 114 L 6 158 L 58 196 Z`
	);
	const rightFoulPath = $derived(
		`M ${home.x} ${home.y} L ${wall.at(-1)?.svg.x} ${wall.at(-1)?.svg.y} L 244 114 L 244 158 L 192 196 Z`
	);
	const highlightPaths = $derived(
		profile.highlights.map((highlight) => ({
			...highlight,
			path: `M ${wall
				.filter(({ angle }) => angle >= highlight.fromAngle && angle <= highlight.toAngle)
				.map(({ svg }) => `${svg.x} ${svg.y}`)
				.join(' L ')}`
		}))
	);
	const trailLength = $derived(Math.hypot(estimate.svg.x - home.x, estimate.svg.y - home.y));
</script>

<div class="ballpark-field">
	<svg viewBox="0 0 250 220" role="img" aria-label={accessibleLabel}>
		<defs>
			<radialGradient id="ballpark-grass" cx="50%" cy="84%" r="84%">
				<stop offset="0" stop-color="#315c40" />
				<stop offset="1" stop-color="#15321f" />
			</radialGradient>
			<pattern
				id="ballpark-mow"
				width="18"
				height="18"
				patternUnits="userSpaceOnUse"
				patternTransform="rotate(38)"
			>
				<rect width="9" height="18" fill="#fff" fill-opacity=".018" />
			</pattern>
		</defs>

		<path class="foul-territory" d={leftFoulPath} />
		<path class="foul-territory" d={rightFoulPath} />
		<path class="outfield" d={outfieldPath} fill="url(#ballpark-grass)" />
		<path class="mowing" d={outfieldPath} fill="url(#ballpark-mow)" />
		<path class="warning-track" d={wallPath} />
		<path class="wall" d={wallPath} />
		{#each highlightPaths as highlight (`${highlight.fromAngle}:${highlight.toAngle}`)}
			<path class="special-wall" d={highlight.path} style={`stroke:${highlight.color}`} />
		{/each}
		<path
			class="foul-lines"
			d={`M ${home.x} ${home.y} L ${wall[0].svg.x} ${wall[0].svg.y} M ${home.x} ${home.y} L ${wall.at(-1)?.svg.x} ${wall.at(-1)?.svg.y}`}
		/>

		<path
			class="infield-dirt"
			d={`M ${home.x} ${home.y - 2} L ${first.x + 5} ${first.y} L ${second.x} ${second.y - 6} L ${third.x - 5} ${third.y} Z`}
		/>
		<path
			class="infield-grass"
			d={`M ${home.x} ${home.y - 8} L ${first.x - 3} ${first.y} L ${second.x} ${second.y + 5} L ${third.x + 3} ${third.y} Z`}
		/>
		<circle class="mound" cx={mound.x} cy={mound.y} r="4" />
		<g class="bases" aria-hidden="true">
			<rect x={first.x - 2.5} y={first.y - 2.5} width="5" height="5" />
			<rect x={second.x - 2.5} y={second.y - 2.5} width="5" height="5" />
			<rect x={third.x - 2.5} y={third.y - 2.5} width="5" height="5" />
		</g>
		<path
			class="home-plate"
			d={`M ${home.x - 4} ${home.y - 4} H ${home.x + 4} L ${home.x + 3} ${home.y} L ${home.x} ${home.y + 3} L ${home.x - 3} ${home.y} Z`}
		/>

		{#each wall as landmark (landmark.angle)}
			{#if landmark.label}
				<text
					class="distance-label"
					x={landmark.svg.x + (landmark.angle < 0 ? 5 : landmark.angle > 0 ? -5 : 0)}
					y={landmark.svg.y + 10}
					text-anchor={landmark.angle < 0 ? 'start' : landmark.angle > 0 ? 'end' : 'middle'}
					>{landmark.label}</text
				>
			{/if}
		{/each}

		<path
			class="hit-trail"
			style={`--trail-length:${trailLength}`}
			d={`M ${home.x} ${home.y} L ${estimate.svg.x} ${estimate.svg.y}`}
		/>
		<circle class="hit-ripple" cx={estimate.svg.x} cy={estimate.svg.y} r="12" />
		<circle class="hit-dot" cx={estimate.svg.x} cy={estimate.svg.y} r="5" />
		{#if estimate.foulTerritory}
			<text
				class="foul-out-label"
				x={estimate.svg.x + (estimate.foulTerritory === 'right' ? -8 : 8)}
				y={estimate.svg.y - 9}
				text-anchor={estimate.foulTerritory === 'right' ? 'end' : 'start'}>Foul out</text
			>
		{/if}
	</svg>
	<div class="field-name"><strong>{profile.name}</strong><span>Current field dimensions</span></div>
</div>

<style>
	.ballpark-field {
		position: relative;
		width: min(440px, 100%);
		margin: 0 auto;
	}
	svg {
		display: block;
		width: 100%;
		height: auto;
		filter: drop-shadow(0 14px 18px rgba(0, 0, 0, 0.25));
	}
	.outfield {
		stroke: #315b3e;
		stroke-width: 0.8;
	}
	.foul-territory {
		fill: #514331;
		fill-opacity: 0.42;
		stroke: #8b7556;
		stroke-width: 0.7;
	}
	.mowing {
		pointer-events: none;
	}
	.warning-track {
		fill: none;
		stroke: #9a7148;
		stroke-width: 8;
		stroke-linejoin: round;
	}
	.wall {
		fill: none;
		stroke: #d8d3b8;
		stroke-width: 1.5;
		stroke-linejoin: round;
	}
	.special-wall {
		fill: none;
		stroke-width: 2.5;
	}
	.foul-lines {
		fill: none;
		stroke: #f1ecd8;
		stroke-width: 0.8;
		opacity: 0.75;
	}
	.infield-dirt {
		fill: #a4774e;
	}
	.infield-grass {
		fill: #244b32;
	}
	.mound {
		fill: #b7895d;
	}
	.bases rect {
		fill: #fffceb;
		transform: rotate(45deg);
		transform-box: fill-box;
		transform-origin: center;
	}
	.home-plate {
		fill: #fff;
	}
	.distance-label {
		fill: #d8d3c4;
		font:
			700 5px Arial,
			sans-serif;
		letter-spacing: 0.04em;
		paint-order: stroke;
		stroke: #173523;
		stroke-width: 2px;
	}
	.foul-out-label {
		fill: #fdb827;
		font:
			800 5px Arial,
			sans-serif;
		letter-spacing: 0.08em;
		paint-order: stroke;
		stroke: #111;
		stroke-width: 2px;
		text-transform: uppercase;
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
	.field-name {
		position: absolute;
		left: 12px;
		bottom: 8px;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-transform: uppercase;
	}
	.field-name strong {
		color: #f5f5ef;
		font-size: 7px;
		letter-spacing: 0.12em;
	}
	.field-name span {
		color: #85857f;
		font-size: 5px;
		font-weight: 800;
		letter-spacing: 0.1em;
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
	@media (prefers-reduced-motion: reduce) {
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
