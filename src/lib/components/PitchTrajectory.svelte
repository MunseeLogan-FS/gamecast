<script lang="ts">
	import { untrack } from 'svelte';
	import {
		isFiniteNumber,
		projectPitchTrajectory,
		samplePitchTrajectory
	} from '$lib/pitch-trajectory.js';
	import ThreePitchTrajectory from '$lib/components/ThreePitchTrajectory.svelte';
	import { classifyPitch, strikeZoneRect } from '$lib/visualization.js';
	import type { BatSide, PitchEvent } from '$lib/mlb';

	let {
		pitches = [],
		gameKey,
		atBatIndex,
		strikeZoneTop = 3.5,
		strikeZoneBottom = 1.5,
		batSide,
		renderMode = 'svg',
		selectedKey = $bindable('')
	}: {
		pitches?: PitchEvent[];
		gameKey?: number | string;
		atBatIndex?: number;
		strikeZoneTop?: number;
		strikeZoneBottom?: number;
		batSide?: BatSide;
		renderMode?: 'svg' | 'three';
		selectedKey?: string;
	} = $props();

	function pitchKey(index: number) {
		return `${gameKey ?? 'game'}:${atBatIndex ?? 'unknown'}:${index + 1}`;
	}

	const initialNewestKey = untrack(() => (pitches.length ? pitchKey(pitches.length - 1) : ''));
	let handledNewestKey = $state(initialNewestKey);
	const finiteZoneTop = $derived(isFiniteNumber(strikeZoneTop) ? strikeZoneTop : 3.5);
	const finiteZoneBottom = $derived(isFiniteNumber(strikeZoneBottom) ? strikeZoneBottom : 1.5);
	const zone = $derived(strikeZoneRect(finiteZoneTop, finiteZoneBottom));
	const models = $derived(
		pitches.map((event, index) => {
			const physical = samplePitchTrajectory(
				event.pitchData as Parameters<typeof samplePitchTrajectory>[0]
			);
			return {
				event,
				index: index + 1,
				key: pitchKey(index),
				kind: classifyPitch(event),
				result: projectPitchTrajectory(physical)
			};
		})
	);
	const newestKey = $derived(models.at(-1)?.key ?? '');
	const selectedModel = $derived(
		models.find((model) => model.key === selectedKey) ?? models.at(-1)
	);
	const useThree = $derived(renderMode === 'three' && selectedModel?.result.kind === 'trajectory');
	const batSideLabel = $derived(
		batSide?.code?.toUpperCase() === 'L'
			? 'LHB'
			: batSide?.code?.toUpperCase() === 'R'
				? 'RHB'
				: batSide?.code?.toUpperCase() === 'S'
					? 'Switch'
					: ''
	);

	$effect(() => {
		if (newestKey && newestKey !== handledNewestKey) {
			selectedKey = newestKey;
			handledNewestKey = newestKey;
		}
	});

	function pathData(model: (typeof models)[number]) {
		if (model.result.kind !== 'trajectory') return '';
		return model.result.displayPoints
			.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
			.join(' ');
	}

	function pitchAriaLabel(model: (typeof models)[number] | undefined) {
		if (!model) return 'No recorded pitch trajectory available.';
		const type = model.event.details?.type?.description ?? 'Pitch';
		const speed = model.event.pitchData?.startSpeed;
		const call = model.event.details?.call?.description ?? model.event.details?.description ?? '';
		const endpoint = model.result.kind === 'unavailable' ? null : model.result.endpoint;
		const horizontalLocation = endpoint
			? Math.abs(endpoint.x) < 0.005
				? 'center'
				: endpoint.x < 0
					? 'left'
					: 'right'
			: '';
		return [
			`Pitch ${model.index}: ${type}`,
			isFiniteNumber(speed) ? `${speed.toFixed(1)} MPH` : '',
			call,
			endpoint
				? `${Math.abs(endpoint.x).toFixed(2)} feet ${horizontalLocation} and ${endpoint.z.toFixed(2)} feet high`
				: ''
		]
			.filter(Boolean)
			.join(', ');
	}

	function selectPitch(key: string) {
		selectedKey = key;
	}
</script>

<div
	class="pitch-trajectory"
	class:three={useThree}
	data-trajectory-kind={selectedModel?.result.kind ?? 'unavailable'}
>
	{#if batSideLabel}
		<div
			class="bat-side"
			class:left={batSide?.code?.toUpperCase() === 'L'}
			class:right={batSide?.code?.toUpperCase() === 'R'}
		>
			<span>{batSideLabel}</span>
			<small>{batSide?.description ?? 'Batter side'}</small>
		</div>
	{/if}
	{#if useThree && selectedModel}
		{#key selectedModel.key}
			<ThreePitchTrajectory
				pitch={selectedModel.event}
				pitchNumber={selectedModel.index}
				contextPitches={pitches}
				compact
				strikeZoneTop={finiteZoneTop}
				strikeZoneBottom={finiteZoneBottom}
			/>
		{/key}
	{:else}
		<svg viewBox="0 0 220 260" role="img" aria-label={pitchAriaLabel(selectedModel)}>
			<defs>
				<linearGradient id="trajectory-glow" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0" stop-color="#f6e5ad" stop-opacity=".2" />
					<stop offset=".68" stop-color="#fdb827" stop-opacity=".72" />
					<stop offset="1" stop-color="#fff" />
				</linearGradient>
			</defs>
			<path class="depth-lane" d="M62 34L31 238M158 34L189 238" />
			<path class="release-plane" d="M62 34H158" />
			<text class="depth-label release-label" x="110" y="27">RELEASE</text>
			<text class="depth-label plate-label" x="110" y="229">PLATE</text>
			<path class="plate-plane" d="M32 218Q110 235 188 218" />
			<rect class="zone-shadow" x={zone.x} y={zone.y} width={zone.width} height={zone.height} />
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

			{#each models.filter((model) => model.key !== selectedModel?.key && model.result.kind === 'trajectory') as model (model.key)}
				<path class="trajectory-path context" d={pathData(model)} />
			{/each}
			{#key selectedModel?.key}
				{#if selectedModel?.result.kind === 'trajectory'}
					<path class="trajectory-path selected {selectedModel.kind}" d={pathData(selectedModel)} />
					<circle
						class="release-point"
						cx={selectedModel.result.displayPoints[0].x}
						cy={selectedModel.result.displayPoints[0].y}
						r="3.5"
					/>
					{#each selectedModel.result.displayPoints.slice(1, -1) as point, index (index)}
						{#if index % 3 === 0}
							<circle class="flight-sample" cx={point.x} cy={point.y} r={1.5 + point.scale * 1.6} />
						{/if}
					{/each}
				{/if}
			{/key}

			{#each models as model (model.key)}
				{#if model.result.kind !== 'unavailable'}
					<g class="pitch-endpoint {model.kind}" class:selected={model.key === selectedModel?.key}>
						{#if model.key === selectedModel?.key}<circle
								class="pitch-ring"
								cx={model.result.endpointDisplay.x}
								cy={model.result.endpointDisplay.y}
								r="14"
							/>{/if}
						<circle
							class="pitch-dot"
							cx={model.result.endpointDisplay.x}
							cy={model.result.endpointDisplay.y}
							r={model.key === selectedModel?.key ? 9 : 4.5}
						/>
						{#if model.key === selectedModel?.key}<text
								x={model.result.endpointDisplay.x}
								y={model.result.endpointDisplay.y + 3.3}>{model.index}</text
							>{/if}
					</g>
				{/if}
			{/each}
			<path class="plate" d="M79 234H141L134 244L110 252L86 244Z" />
		</svg>
	{/if}
	{#if selectedModel && !useThree}
		<div class="selected-pitch-detail" aria-live="polite">
			<span>Pitch {selectedModel.index} of {models.length}</span>
			<strong>{selectedModel.event.details?.type?.description ?? 'Pitch'}</strong>
			<small
				>{[
					isFiniteNumber(selectedModel.event.pitchData?.startSpeed)
						? `${selectedModel.event.pitchData.startSpeed.toFixed(1)} MPH`
						: '',
					selectedModel.event.details?.call?.description ?? ''
				]
					.filter(Boolean)
					.join(' · ')}</small
			>
		</div>
	{/if}
	<div class="legend">
		<span><i class="ball"></i>Ball</span><span><i class="strike"></i>Strike</span><span
			><i class="foul"></i>Foul</span
		><span><i class="inplay"></i>In play</span>
	</div>
	<div class="pitch-selectors" role="group" aria-label="Select a pitch to replay">
		{#each models as model (model.key)}
			<button
				type="button"
				class="pitch-selector"
				class:selected={model.key === selectedModel?.key}
				aria-label={pitchAriaLabel(model)}
				aria-pressed={model.key === selectedModel?.key}
				onclick={() => selectPitch(model.key)}
			>
				<span class="selector-number {model.kind}">{model.index}</span>
				<small>{model.event.details?.type?.description?.split(/[- ]/)[0] ?? 'Pitch'}</small>
			</button>
		{/each}
	</div>
</div>

<style>
	.pitch-trajectory {
		position: relative;
		width: min(440px, 100%);
		margin: 0 auto;
		animation: view-in 0.35s ease-out;
	}
	.pitch-trajectory.three {
		width: min(620px, 100%);
	}
	.pitch-trajectory.three .bat-side.left,
	.pitch-trajectory.three .bat-side.right {
		top: 72px;
		right: 14px;
		left: auto;
		border-right: 3px solid #fdb827;
		border-left: 1px solid #45453f;
		text-align: right;
	}
	.pitch-trajectory.three .legend {
		margin: 8px 0 10px;
	}
	svg {
		display: block;
		width: min(100%, 350px);
		margin: 0 auto;
		overflow: visible;
	}
	.depth-lane,
	.release-plane,
	.plate-plane {
		fill: none;
		stroke: #62625b;
		stroke-width: 0.8;
		stroke-dasharray: 2 5;
		opacity: 0.3;
	}
	.release-plane {
		stroke-dasharray: none;
		opacity: 0.42;
	}
	.depth-label {
		fill: #696961;
		font-size: 5px;
		font-weight: 900;
		letter-spacing: 0.18em;
		text-anchor: middle;
	}
	.plate-label {
		fill: #8c8c84;
	}
	.zone-shadow {
		fill: #000;
		opacity: 0.28;
	}
	.zone-box {
		fill: rgba(255, 255, 255, 0.035);
		stroke: #d8d5c9;
		stroke-width: 2;
	}
	.zone-third {
		stroke: #ddd9cb;
		stroke-width: 0.6;
		opacity: 0.2;
	}
	.trajectory-path {
		fill: none;
		stroke-linecap: round;
		stroke-linejoin: round;
	}
	.trajectory-path.context {
		stroke: #c8c4b8;
		stroke-width: 0.75;
		opacity: 0.055;
	}
	.trajectory-path.selected {
		stroke: url(#trajectory-glow);
		stroke-width: 4;
		filter: drop-shadow(0 0 7px rgba(253, 184, 39, 0.58));
		stroke-dasharray: 420;
		stroke-dashoffset: 420;
		animation: draw-flight 0.78s ease-out forwards;
	}
	.flight-sample {
		fill: #f8e4a4;
		opacity: 0;
		animation: samples-in 0.25s 0.55s ease-out forwards;
	}
	.release-point {
		fill: #f7e8b8;
		stroke: #111;
		stroke-width: 1.5;
	}
	.pitch-endpoint {
		opacity: 0.42;
	}
	.pitch-dot {
		stroke: #111;
		stroke-width: 1.5;
	}
	.pitch-endpoint.selected {
		opacity: 1;
	}
	.pitch-endpoint.selected .pitch-dot {
		stroke-width: 2.5;
	}
	.pitch-endpoint.ball .pitch-dot {
		fill: #52c786;
	}
	.pitch-endpoint.strike .pitch-dot {
		fill: #ef625c;
	}
	.pitch-endpoint.foul .pitch-dot {
		fill: #ef625c;
		stroke: #3b82f6;
		stroke-width: 3;
	}
	.pitch-endpoint.inplay .pitch-dot {
		fill: #f9a825;
	}
	.pitch-endpoint.neutral .pitch-dot {
		fill: #aaa;
	}
	.pitch-endpoint text {
		fill: #111;
		font-size: 8px;
		font-weight: 900;
		text-anchor: middle;
		pointer-events: none;
	}
	.pitch-ring {
		fill: none;
		stroke: #f5f5f1;
		stroke-width: 2;
		opacity: 0.58;
		animation: ring-in 0.5s ease-out both;
	}
	.selected-pitch-detail {
		position: absolute;
		top: 10px;
		left: 12px;
		display: flex;
		min-width: 104px;
		flex-direction: column;
		gap: 2px;
		padding: 7px 9px;
		border-left: 3px solid #fdb827;
		background: rgba(17, 17, 17, 0.9);
		box-shadow: 0 5px 18px rgba(0, 0, 0, 0.22);
	}
	.selected-pitch-detail span,
	.selected-pitch-detail small {
		color: #85857f;
		font-size: 6px;
		font-weight: 900;
		letter-spacing: 0.09em;
		text-transform: uppercase;
	}
	.selected-pitch-detail strong {
		color: #f5f5ef;
		font-size: 10px;
		font-weight: 900;
		text-transform: uppercase;
	}
	.plate {
		fill: #d9d6cc;
		stroke: #111;
		stroke-width: 2;
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
		background: rgba(17, 17, 17, 0.86);
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
	.legend {
		display: flex;
		justify-content: center;
		gap: 12px;
		margin: -12px 0 8px;
		color: #868681;
		font-size: 6px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.legend span {
		display: flex;
		align-items: center;
		gap: 4px;
	}
	.legend i {
		width: 6px;
		height: 6px;
		border-radius: 50%;
	}
	.legend i.ball {
		background: #52c786;
	}
	.legend i.strike {
		background: #ef625c;
	}
	.legend i.foul {
		border: 2px solid #3b82f6;
		background: #ef625c;
	}
	.legend i.inplay {
		background: #f9a825;
	}
	.pitch-selectors {
		display: grid;
		width: min(350px, calc(100% - 20px));
		grid-template-columns: repeat(7, minmax(0, 1fr));
		gap: 3px;
		margin: 0 auto 12px;
	}
	.pitch-selector {
		display: flex;
		min-width: 0;
		flex-direction: column;
		align-items: center;
		gap: 4px;
		padding: 5px 2px 4px;
		color: #777770;
		background: #1b1b19;
		border: 1px solid #30302c;
		cursor: pointer;
	}
	.pitch-selector:hover,
	.pitch-selector:focus-visible {
		color: #f4f4ee;
		border-color: #77776f;
		outline: none;
	}
	.pitch-selector.selected {
		color: #f5f5ef;
		background: #28251d;
		border-color: #fdb827;
		box-shadow: inset 0 -2px #fdb827;
	}
	.selector-number {
		display: grid;
		width: 18px;
		height: 18px;
		place-items: center;
		color: #111;
		border-radius: 50%;
		font-size: 8px;
		font-weight: 900;
	}
	.selector-number.ball {
		background: #52c786;
	}
	.selector-number.strike {
		background: #ef625c;
	}
	.selector-number.foul {
		background: #ef625c;
		box-shadow: inset 0 0 0 2px #3b82f6;
	}
	.selector-number.inplay {
		background: #f9a825;
	}
	.selector-number.neutral {
		background: #aaa;
	}
	.pitch-selector small {
		overflow: hidden;
		max-width: 100%;
		font-size: 5px;
		font-weight: 900;
		letter-spacing: 0.04em;
		text-overflow: ellipsis;
		text-transform: uppercase;
		white-space: nowrap;
	}
	@keyframes draw-flight {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes samples-in {
		to {
			opacity: 0.8;
		}
	}
	@keyframes ring-in {
		from {
			opacity: 0;
			transform: scale(0.55);
			transform-origin: center;
		}
	}
	@keyframes view-in {
		from {
			opacity: 0;
			transform: translateY(6px);
		}
	}
	@media (prefers-reduced-motion: reduce) {
		.pitch-trajectory,
		.trajectory-path.selected,
		.flight-sample,
		.pitch-ring {
			animation: none;
		}
		.trajectory-path.selected {
			stroke-dashoffset: 0;
		}
		.flight-sample {
			opacity: 0.8;
		}
	}
</style>
