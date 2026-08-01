<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { isFiniteNumber, samplePitchTrajectory } from '$lib/pitch-trajectory.js';
	import { classifyPitch } from '$lib/visualization.js';
	import type { PitchEvent } from '$lib/mlb';

	// Mirrors the SVG panel's outcome palette so both views read identically.
	const OUTCOME_COLORS: Record<string, { fill: number; rim: number }> = {
		ball: { fill: 0x52c786, rim: 0x111111 },
		strike: { fill: 0xef625c, rim: 0x111111 },
		foul: { fill: 0xef625c, rim: 0x3b82f6 },
		inplay: { fill: 0xf9a825, rim: 0x111111 },
		neutral: { fill: 0xaaaaaa, rim: 0x111111 }
	};

	let {
		pitch,
		pitchNumber = 1,
		contextPitches = [],
		compact = false,
		strikeZoneTop = 3.5,
		strikeZoneBottom = 1.5
	}: {
		pitch: PitchEvent;
		pitchNumber?: number;
		contextPitches?: PitchEvent[];
		compact?: boolean;
		strikeZoneTop?: number;
		strikeZoneBottom?: number;
	} = $props();

	let canvas: HTMLCanvasElement;
	let fallback = $state('');
	let replayKey = $state(0);
	let flightState = $state<'playing' | 'settled'>('playing');
	let restartAnimation: (() => void) | undefined;
	const sampled = $derived(samplePitchTrajectory(pitch.pitchData));
	const outcome = $derived(classifyPitch(pitch) as keyof typeof OUTCOME_COLORS);
	const pitchName = $derived(pitch.details?.type?.description ?? 'Pitch');
	const pitchCall = $derived(
		pitch.details?.call?.description ?? pitch.details?.description ?? 'Recorded pitch'
	);
	const isBallInDirt = $derived(/\b(?:ball )?in (?:the )?dirt\b|blocked/i.test(pitchCall));
	const speed = $derived(
		isFiniteNumber(pitch.pitchData?.startSpeed)
			? `${pitch.pitchData.startSpeed.toFixed(1)} MPH`
			: ''
	);

	function replay() {
		replayKey += 1;
		flightState = 'playing';
		restartAnimation?.();
	}

	onMount(() => {
		if (sampled.kind !== 'trajectory') {
			fallback = 'Complete flight telemetry is unavailable for this pitch.';
			return;
		}

		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
		} catch {
			fallback = 'WebGL is unavailable in this browser.';
			return;
		}

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x11120f);
		scene.fog = new THREE.FogExp2(0x11120f, 0.0105);
		const palette = OUTCOME_COLORS[outcome] ?? OUTCOME_COLORS.neutral;

		const physicalPoints = sampled.points.map(
			(point) => new THREE.Vector3(point.x, point.z, -point.y)
		);
		const curve = new THREE.CatmullRomCurve3(physicalPoints, false, 'centripetal');

		const zoneTop = isFiniteNumber(strikeZoneTop) ? strikeZoneTop : 3.5;
		const zoneBottom = isFiniteNumber(strikeZoneBottom) ? strikeZoneBottom : 1.5;
		const plateDepth = -17 / 12;
		const zoneCenter = new THREE.Vector3(0, (zoneTop + zoneBottom) / 2, plateDepth);

		// A low catcher-facing camera keeps the zone seated over the plate while
		// preserving enough perspective to read the pitch's release-to-plate depth.
		const camera = new THREE.PerspectiveCamera(compact ? 24 : 27, 1, 0.1, 120);
		camera.position.set(0, zoneCenter.y + 1.6, 14.5);
		camera.lookAt(0, zoneCenter.y - 1, plateDepth - 4.5);

		// Matches the SVG's trajectory-glow gradient: faint at release, hot at the plate.
		const pathGeometry = new THREE.TubeGeometry(curve, 120, 0.055, 8, false);
		const pathColors = new Float32Array(pathGeometry.attributes.position.count * 3);
		const releaseTint = new THREE.Color(0xf6e5ad);
		const flightTint = new THREE.Color(0xfdb827);
		const plateTint = new THREE.Color(0xffffff);
		const tint = new THREE.Color();
		for (let index = 0; index < pathGeometry.attributes.position.count; index += 1) {
			// Tube vertices advance along the curve in rings of (radialSegments + 1).
			const along = Math.min(1, Math.floor(index / 9) / 120);
			if (along < 0.68) {
				tint.copy(releaseTint).lerp(flightTint, along / 0.68);
			} else {
				tint.copy(flightTint).lerp(plateTint, (along - 0.68) / 0.32);
			}
			tint.toArray(pathColors, index * 3);
		}
		pathGeometry.setAttribute('color', new THREE.BufferAttribute(pathColors, 3));
		const fullPath = new THREE.Mesh(
			pathGeometry,
			new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.5 })
		);
		scene.add(fullPath);

		const trailCapacity = 30;
		const trailPositions = new Float32Array(trailCapacity * 3);
		const trailGeometry = new THREE.BufferGeometry();
		trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
		trailGeometry.setDrawRange(0, 0);
		const trail = new THREE.Line(
			trailGeometry,
			new THREE.LineBasicMaterial({ color: 0xfdb827, transparent: true, opacity: 0.95 })
		);
		scene.add(trail);

		const ball = new THREE.Mesh(
			new THREE.SphereGeometry(0.135, 24, 16),
			new THREE.MeshStandardMaterial({
				color: palette.fill,
				roughness: 0.55,
				emissive: palette.fill,
				emissiveIntensity: 0.32
			})
		);
		scene.add(ball);

		// The SVG marks fouls with a blue rim rather than a distinct fill.
		const ballRim = new THREE.Mesh(
			new THREE.SphereGeometry(0.163, 24, 16),
			new THREE.MeshBasicMaterial({
				color: palette.rim,
				side: THREE.BackSide,
				transparent: true,
				opacity: palette.rim === 0x111111 ? 0.85 : 1
			})
		);
		scene.add(ballRim);

		const endpoint = physicalPoints.at(-1)!;
		const markerCanvas = document.createElement('canvas');
		markerCanvas.width = 128;
		markerCanvas.height = 128;
		const markerContext = markerCanvas.getContext('2d');
		if (!markerContext) {
			fallback = 'Three.js could not create the pitch marker.';
			renderer.dispose();
			return;
		}
		const colorHex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;
		markerContext.beginPath();
		markerContext.arc(64, 64, 52, 0, Math.PI * 2);
		markerContext.strokeStyle = 'rgba(245, 245, 241, 0.64)';
		markerContext.lineWidth = 7;
		markerContext.stroke();
		markerContext.beginPath();
		markerContext.arc(64, 64, 38, 0, Math.PI * 2);
		markerContext.fillStyle = colorHex(palette.fill);
		markerContext.fill();
		markerContext.strokeStyle = colorHex(palette.rim);
		markerContext.lineWidth = palette.rim === 0x111111 ? 7 : 10;
		markerContext.stroke();
		markerContext.fillStyle = '#111111';
		markerContext.font = '900 43px Arial, sans-serif';
		markerContext.textAlign = 'center';
		markerContext.textBaseline = 'middle';
		markerContext.fillText(String(pitchNumber), 64, 67);
		const markerTexture = new THREE.CanvasTexture(markerCanvas);
		markerTexture.colorSpace = THREE.SRGBColorSpace;
		const endpointMarker = new THREE.Sprite(
			new THREE.SpriteMaterial({
				map: markerTexture,
				transparent: true,
				depthTest: false,
				depthWrite: false
			})
		);
		endpointMarker.position.copy(endpoint);
		endpointMarker.position.z += 0.025;
		endpointMarker.scale.setScalar(0.62);
		endpointMarker.renderOrder = 3;
		scene.add(endpointMarker);

		for (const [index, contextPitch] of contextPitches.entries()) {
			if (index + 1 === pitchNumber) continue;
			const contextResult = samplePitchTrajectory(contextPitch.pitchData);
			if (contextResult.kind === 'unavailable') continue;
			const contextPalette =
				OUTCOME_COLORS[classifyPitch(contextPitch) as keyof typeof OUTCOME_COLORS] ??
				OUTCOME_COLORS.neutral;
			const contextPosition = new THREE.Vector3(
				contextResult.endpoint.x,
				contextResult.endpoint.z,
				-contextResult.endpoint.y + 0.02
			);
			const contextRim = new THREE.Mesh(
				new THREE.RingGeometry(0.09, 0.125, 28),
				new THREE.MeshBasicMaterial({
					color: contextPalette.rim,
					transparent: true,
					opacity: 0.44,
					depthTest: false
				})
			);
			contextRim.position.copy(contextPosition);
			contextRim.quaternion.copy(camera.quaternion);
			contextRim.renderOrder = 1;
			scene.add(contextRim);
			const contextDot = new THREE.Mesh(
				new THREE.CircleGeometry(0.09, 28),
				new THREE.MeshBasicMaterial({
					color: contextPalette.fill,
					transparent: true,
					opacity: 0.44,
					depthTest: false
				})
			);
			contextDot.position.copy(contextPosition);
			contextDot.position.z += 0.005;
			contextDot.quaternion.copy(camera.quaternion);
			contextDot.renderOrder = 2;
			scene.add(contextDot);
		}

		const release = new THREE.Mesh(
			new THREE.SphereGeometry(0.12, 16, 12),
			new THREE.MeshBasicMaterial({ color: 0x5cba82 })
		);
		release.position.copy(physicalPoints[0]);
		scene.add(release);

		// Zone face mirrors the SVG: faint fill, bright border, thirds both ways.
		const halfPlate = 17 / 24;
		const zoneHeight = zoneTop - zoneBottom;
		const zoneFace = new THREE.Mesh(
			new THREE.PlaneGeometry(halfPlate * 2, zoneHeight),
			new THREE.MeshBasicMaterial({
				color: 0xffffff,
				transparent: true,
				opacity: 0.035,
				side: THREE.DoubleSide,
				depthWrite: false
			})
		);
		zoneFace.position.copy(zoneCenter);
		scene.add(zoneFace);

		scene.add(
			new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(-halfPlate, zoneBottom, plateDepth),
					new THREE.Vector3(halfPlate, zoneBottom, plateDepth),
					new THREE.Vector3(halfPlate, zoneTop, plateDepth),
					new THREE.Vector3(-halfPlate, zoneTop, plateDepth),
					new THREE.Vector3(-halfPlate, zoneBottom, plateDepth)
				]),
				new THREE.LineBasicMaterial({ color: 0xd8d5c9 })
			)
		);

		const thirdMaterial = new THREE.LineBasicMaterial({
			color: 0xddd9cb,
			transparent: true,
			opacity: 0.42
		});
		for (const fraction of [1 / 3, 2 / 3]) {
			const y = zoneBottom + zoneHeight * fraction;
			const x = -halfPlate + halfPlate * 2 * fraction;
			scene.add(
				new THREE.Line(
					new THREE.BufferGeometry().setFromPoints([
						new THREE.Vector3(-halfPlate, y, plateDepth),
						new THREE.Vector3(halfPlate, y, plateDepth)
					]),
					thirdMaterial
				),
				new THREE.Line(
					new THREE.BufferGeometry().setFromPoints([
						new THREE.Vector3(x, zoneBottom, plateDepth),
						new THREE.Vector3(x, zoneTop, plateDepth)
					]),
					thirdMaterial
				)
			);
		}

		// Home plate in MLB feet: back tip at y=0, 17in front edge at y=17/12 —
		// the same plane the zone sits on. Shape y maps to world -z once laid flat.
		const plateShape = new THREE.Shape();
		plateShape.moveTo(0, 0);
		plateShape.lineTo(halfPlate, 0.71);
		plateShape.lineTo(halfPlate, 17 / 12);
		plateShape.lineTo(-halfPlate, 17 / 12);
		plateShape.lineTo(-halfPlate, 0.71);
		plateShape.closePath();
		const plate = new THREE.Mesh(
			new THREE.ShapeGeometry(plateShape),
			new THREE.MeshBasicMaterial({ color: 0xd9d6cc })
		);
		plate.rotation.x = -Math.PI / 2;
		plate.position.set(0, 0.015, 0);
		scene.add(plate);

		const dirtSpot = isBallInDirt
			? new THREE.Mesh(
					new THREE.CircleGeometry(0.16, 32),
					new THREE.MeshBasicMaterial({
						color: 0x8b7651,
						transparent: true,
						opacity: 0.12,
						side: THREE.DoubleSide,
						depthWrite: false
					})
				)
			: null;
		const dirtImpact = isBallInDirt
			? new THREE.Mesh(
					new THREE.RingGeometry(0.14, 0.21, 40),
					new THREE.MeshBasicMaterial({
						color: palette.fill,
						transparent: true,
						opacity: 0,
						side: THREE.DoubleSide,
						depthWrite: false
					})
				)
			: null;
		for (const impactElement of [dirtSpot, dirtImpact]) {
			if (!impactElement) continue;
			impactElement.rotation.x = -Math.PI / 2;
			impactElement.position.set(endpoint.x, 0.028, endpoint.z);
			impactElement.renderOrder = 2;
			scene.add(impactElement);
		}

		// Dark rim on the plate, matching the SVG's 2px stroke.
		scene.add(
			new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(0, 0.02, 0),
					new THREE.Vector3(halfPlate, 0.02, -0.71),
					new THREE.Vector3(halfPlate, 0.02, plateDepth),
					new THREE.Vector3(-halfPlate, 0.02, plateDepth),
					new THREE.Vector3(-halfPlate, 0.02, -0.71),
					new THREE.Vector3(0, 0.02, 0)
				]),
				new THREE.LineBasicMaterial({ color: 0x111111 })
			)
		);

		// Depth lane: the SVG's converging rails, rebuilt as real receding geometry.
		const laneMaterial = new THREE.LineDashedMaterial({
			color: 0x62625b,
			transparent: true,
			opacity: 0.3,
			dashSize: 0.28,
			gapSize: 0.55
		});
		const releaseDepth = -physicalPoints[0].z;
		const releaseHeight = physicalPoints[0].y;
		for (const side of [-1, 1]) {
			const lane = new THREE.Line(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(side * halfPlate * 1.65, 0.01, plateDepth),
					new THREE.Vector3(side * halfPlate * 4.2, releaseHeight, -releaseDepth)
				]),
				laneMaterial
			);
			lane.computeLineDistances();
			scene.add(lane);
		}

		scene.add(new THREE.HemisphereLight(0xfff3d2, 0x15231a, 1.6));
		const plateLight = new THREE.PointLight(0xfdb827, 14, 18, 2);
		plateLight.position.set(0, 5, 4);
		scene.add(plateLight);

		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		let animationFrame = 0;
		let animationStart = performance.now();
		let activeReplayKey = replayKey;
		let width = 0;
		let height = 0;

		function resize() {
			const nextWidth = Math.max(1, canvas.clientWidth);
			const nextHeight = Math.max(1, canvas.clientHeight);
			if (nextWidth === width && nextHeight === height) return false;
			width = nextWidth;
			height = nextHeight;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			camera.updateProjectionMatrix();
			return true;
		}

		function updateTrail(progress: number) {
			const start = Math.max(0, progress - 0.18);
			const count = Math.max(2, Math.round(trailCapacity * Math.min(1, progress / 0.18)));
			for (let index = 0; index < count; index += 1) {
				const fraction =
					count === 1 ? progress : start + ((progress - start) * index) / (count - 1);
				const point = curve.getPoint(Math.max(0, Math.min(1, fraction)));
				trailPositions[index * 3] = point.x;
				trailPositions[index * 3 + 1] = point.y;
				trailPositions[index * 3 + 2] = point.z;
			}
			trailGeometry.attributes.position.needsUpdate = true;
			trailGeometry.setDrawRange(0, count);
		}

		function render(now: number) {
			let shouldContinue: boolean;
			try {
				resize();
				if (activeReplayKey !== replayKey) {
					activeReplayKey = replayKey;
					animationStart = now;
				}
				const elapsed = Math.min(1, Math.max(0, now - animationStart) / 1450);
				const progress = media.matches ? 1 : 1 - Math.pow(1 - elapsed, 2);
				ball.position.copy(curve.getPoint(progress));
				ballRim.position.copy(ball.position);
				updateTrail(progress);
				endpointMarker.material.opacity = progress >= 0.98 ? 1 : 0.42;
				if (dirtSpot && dirtImpact) {
					const impactProgress = Math.max(0, Math.min(1, (progress - 0.86) / 0.14));
					dirtSpot.material.opacity = 0.12 + impactProgress * 0.28;
					dirtImpact.material.opacity = impactProgress > 0 ? 0.64 - impactProgress * 0.22 : 0;
					dirtImpact.scale.setScalar(0.7 + impactProgress * 1.5);
				}
				renderer.render(scene, camera);
				shouldContinue = !media.matches && elapsed < 1;
				if (!shouldContinue) flightState = 'settled';
			} catch (error) {
				fallback = error instanceof Error ? error.message : 'Three.js could not render this pitch.';
				console.error('Three.js trajectory frame failed', error);
				return;
			}
			animationFrame = shouldContinue ? requestAnimationFrame(render) : 0;
		}

		restartAnimation = () => {
			cancelAnimationFrame(animationFrame);
			activeReplayKey = replayKey;
			animationStart = performance.now();
			animationFrame = requestAnimationFrame(render);
		};
		const resizeObserver = new ResizeObserver(() => {
			if (resize()) renderer.render(scene, camera);
		});
		resizeObserver.observe(canvas);
		animationFrame = requestAnimationFrame(render);
		canvas.dataset.ready = 'true';

		return () => {
			cancelAnimationFrame(animationFrame);
			restartAnimation = undefined;
			resizeObserver.disconnect();
			scene.traverse((object) => {
				if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
					object.geometry.dispose();
					const materials = Array.isArray(object.material) ? object.material : [object.material];
					for (const material of materials) material.dispose();
				}
			});
			markerTexture.dispose();
			endpointMarker.material.dispose();
			renderer.dispose();
		};
	});
</script>

<div
	class="trajectory-stage"
	class:compact
	data-flight-state={flightState}
	data-landing={isBallInDirt ? 'dirt' : 'plate'}
>
	<canvas
		bind:this={canvas}
		aria-label={`Pitch ${pitchNumber}: ${pitchName} trajectory from a three-dimensional catcher view behind home plate`}
	></canvas>
	{#if fallback}
		<div class="fallback" role="status">{fallback}</div>
	{/if}
	<div class="hud">
		<div>
			<span>Selected pitch</span>
			<strong>{pitchName}</strong>
			<small>{[speed, pitchCall].filter(Boolean).join(' · ')}</small>
		</div>
		<button type="button" onclick={replay}>Replay flight</button>
	</div>
</div>

<style>
	.trajectory-stage {
		position: relative;
		min-height: 520px;
		background: #0b0c0b;
		overflow: hidden;
	}
	canvas {
		display: block;
		width: 100%;
		height: 520px;
	}
	.trajectory-stage.compact {
		min-height: 460px;
	}
	.trajectory-stage.compact canvas {
		height: 460px;
	}
	.hud {
		position: absolute;
		inset: 18px 18px auto;
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 16px;
		pointer-events: none;
	}
	.hud > div {
		display: flex;
		min-width: 0;
		max-width: calc(100% - 132px);
		flex-direction: column;
		padding-left: 11px;
		border-left: 3px solid #fdb827;
	}
	.hud span,
	.hud small {
		color: #989991;
		font-size: 9px;
		font-weight: 800;
		letter-spacing: 0.1em;
		text-transform: uppercase;
	}
	.hud strong {
		margin: 4px 0;
		color: #fff;
		font-size: 18px;
		text-transform: uppercase;
	}
	.hud button {
		padding: 9px 11px;
		color: #111;
		background: #fdb827;
		border: 0;
		font-size: 9px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
		pointer-events: auto;
	}
	.hud button:focus-visible {
		outline: 3px solid #fff;
		outline-offset: 3px;
	}
	.fallback {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 30px;
		color: #ccc;
		font-size: 13px;
		text-align: center;
	}
	@media (max-width: 700px) {
		.trajectory-stage {
			min-height: 420px;
		}
		canvas {
			height: 420px;
		}
		.trajectory-stage.compact {
			min-height: 400px;
		}
		.trajectory-stage.compact canvas {
			height: 400px;
		}
		.hud {
			inset: 14px 14px auto;
		}
		.hud strong {
			font-size: 15px;
		}
	}
</style>
