<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import {
		hitFlightCamera,
		hitOutcome,
		reconstructHitFlight,
		renderHitFlightPoints,
		wallDistanceMarkers
	} from '$lib/hit-flight.js';
	import { wallHeightAt, wallSurfaceAt } from '$lib/ballpark-appearance.js';
	import { PNC_PARK } from '$lib/field-geometry.js';
	import type { HitData } from '$lib/mlb';

	let {
		profile,
		hitData,
		description = '',
		resultEvent,
		resultEventType
	}: {
		profile: typeof PNC_PARK;
		hitData: HitData;
		description?: string;
		resultEvent?: string;
		resultEventType?: string;
	} = $props();

	let canvas = $state<HTMLCanvasElement>();
	let fallback = $state('');
	let replayKey = $state(0);
	let flightState = $state<'tracking' | 'playing' | 'settled'>('playing');
	let restartAnimation: (() => void) | undefined;
	const flight = $derived(reconstructHitFlight(hitData, description, profile));
	const resolvedFlight = $derived(flight.kind === 'flight' ? flight : null);
	const hasFlight = $derived(resolvedFlight !== null);
	const outcome = $derived(hitOutcome(resultEvent, resultEventType));

	function polarPoint(angle: number, distance: number) {
		const radians = (angle * Math.PI) / 180;
		return { x: Math.sin(radians) * distance, y: Math.cos(radians) * distance };
	}

	function replay() {
		replayKey += 1;
		flightState = 'playing';
		restartAnimation?.();
	}

	onMount(() => {
		if (!canvas) return;
		let renderer: THREE.WebGLRenderer;
		try {
			renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false });
		} catch {
			fallback = 'WebGL is unavailable in this browser.';
			return;
		}

		const scene = new THREE.Scene();
		scene.background = new THREE.Color(0x10110f);
		const mountedFlight = resolvedFlight;
		const markerTextures: THREE.CanvasTexture[] = [];
		const appearance = profile.appearance;

		const fieldPoints = profile.wall.map(({ angle, distance }) => polarPoint(angle, distance));
		const fieldShape = new THREE.Shape();
		fieldShape.moveTo(0, 0);
		for (const point of fieldPoints) fieldShape.lineTo(point.x, point.y);
		fieldShape.closePath();

		const foulTerritoryColor = new THREE.Color(appearance.grass).multiplyScalar(0.68);
		for (const [point, side] of [
			[fieldPoints[0], -1],
			[fieldPoints.at(-1)!, 1]
		] as const) {
			const wing = new THREE.Shape();
			wing.moveTo(0, 0);
			wing.lineTo(point.x, point.y);
			wing.lineTo(point.x + side * 64, Math.max(115, point.y - 12));
			wing.lineTo(side * 118, 58);
			wing.lineTo(side * 42, -20);
			wing.closePath();
			const foulTerritory = new THREE.Mesh(
				new THREE.ShapeGeometry(wing),
				new THREE.MeshBasicMaterial({ color: foulTerritoryColor })
			);
			foulTerritory.rotation.x = -Math.PI / 2;
			foulTerritory.position.y = -0.1;
			scene.add(foulTerritory);
		}

		const grass = new THREE.Mesh(
			new THREE.ShapeGeometry(fieldShape),
			new THREE.MeshBasicMaterial({ color: appearance.grass })
		);
		grass.rotation.x = -Math.PI / 2;
		grass.position.y = -0.08;
		scene.add(grass);
		const mowing = new THREE.Mesh(
			new THREE.ShapeGeometry(fieldShape),
			new THREE.ShaderMaterial({
				transparent: true,
				depthWrite: false,
				polygonOffset: true,
				polygonOffsetFactor: -1,
				polygonOffsetUnits: -1,
				vertexShader: `
					varying vec2 vFieldPosition;
					void main() {
						vFieldPosition = position.xy;
						gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
					}
				`,
				fragmentShader: `
					varying vec2 vFieldPosition;
					void main() {
						float angle = ${((appearance.mowingAngle * Math.PI) / 180).toFixed(7)};
						float acrossBand = vFieldPosition.x * cos(angle) + vFieldPosition.y * sin(angle);
						float lightBand = step(0.5, fract(acrossBand / ${appearance.mowingWidth.toFixed(1)}));
						gl_FragColor = vec4(1.0, 1.0, 1.0, lightBand * 0.045);
					}
				`
			})
		);
		mowing.rotation.x = -Math.PI / 2;
		mowing.position.y = -0.06;
		scene.add(mowing);

		const shadowCanvas = document.createElement('canvas');
		shadowCanvas.width = 256;
		shadowCanvas.height = 256;
		const shadowContext = shadowCanvas.getContext('2d');
		if (shadowContext) {
			const shadowGradient = shadowContext.createRadialGradient(128, 142, 34, 128, 128, 178);
			shadowGradient.addColorStop(0, 'rgba(0, 0, 0, 0.01)');
			shadowGradient.addColorStop(0.62, 'rgba(0, 0, 0, 0.035)');
			shadowGradient.addColorStop(1, 'rgba(0, 0, 0, 0.14)');
			shadowContext.fillStyle = shadowGradient;
			shadowContext.fillRect(0, 0, 256, 256);
			const shadowTexture = new THREE.CanvasTexture(shadowCanvas);
			shadowTexture.colorSpace = THREE.SRGBColorSpace;
			markerTextures.push(shadowTexture);
			const fieldShadow = new THREE.Mesh(
				new THREE.PlaneGeometry(620, 520),
				new THREE.MeshBasicMaterial({
					map: shadowTexture,
					transparent: true,
					depthWrite: false
				})
			);
			fieldShadow.rotation.x = -Math.PI / 2;
			fieldShadow.position.set(0, -0.02, -250);
			scene.add(fieldShadow);
		}

		const trackVertices: number[] = [];
		for (let index = 0; index < profile.wall.length - 1; index += 1) {
			const startLandmark = profile.wall[index];
			const endLandmark = profile.wall[index + 1];
			const start = polarPoint(startLandmark.angle, startLandmark.distance);
			const end = polarPoint(endLandmark.angle, endLandmark.distance);
			const innerStart = polarPoint(startLandmark.angle, Math.max(0, startLandmark.distance - 11));
			const innerEnd = polarPoint(endLandmark.angle, Math.max(0, endLandmark.distance - 11));
			trackVertices.push(
				start.x,
				0.015,
				-start.y,
				end.x,
				0.015,
				-end.y,
				innerEnd.x,
				0.015,
				-innerEnd.y,
				start.x,
				0.015,
				-start.y,
				innerEnd.x,
				0.015,
				-innerEnd.y,
				innerStart.x,
				0.015,
				-innerStart.y
			);
		}
		const trackGeometry = new THREE.BufferGeometry();
		trackGeometry.setAttribute('position', new THREE.Float32BufferAttribute(trackVertices, 3));
		trackGeometry.computeVertexNormals();
		const warningTrack = new THREE.Mesh(
			trackGeometry,
			new THREE.MeshStandardMaterial({ color: appearance.warningTrack, roughness: 1 })
		);
		scene.add(warningTrack);

		function makeWallTexture(material: string, color: string) {
			const textureCanvas = document.createElement('canvas');
			textureCanvas.width = 128;
			textureCanvas.height = 128;
			const context = textureCanvas.getContext('2d');
			if (!context) return null;
			context.fillStyle = color;
			context.fillRect(0, 0, 128, 128);
			context.globalAlpha = 0.24;
			if (material === 'brick') {
				context.strokeStyle = '#e0c6a2';
				context.lineWidth = 2;
				for (let y = 0; y <= 128; y += 20) {
					context.beginPath();
					context.moveTo(0, y);
					context.lineTo(128, y);
					context.stroke();
					for (let x = (y / 20) % 2 === 0 ? 0 : 16; x <= 128; x += 32) {
						context.beginPath();
						context.moveTo(x, y);
						context.lineTo(x, y + 20);
						context.stroke();
					}
				}
			} else if (material === 'ivy') {
				for (let index = 0; index < 90; index += 1) {
					const x = (index * 47) % 128;
					const y = (index * 83) % 128;
					context.fillStyle = index % 3 === 0 ? '#8fa64a' : index % 2 ? '#173f28' : '#4f792f';
					context.beginPath();
					context.arc(x, y, 3 + (index % 4), 0, Math.PI * 2);
					context.fill();
				}
			} else if (material === 'stone') {
				context.strokeStyle = '#d6d0c2';
				context.lineWidth = 2;
				for (let y = 8; y < 128; y += 24) {
					context.beginPath();
					context.moveTo(0, y);
					context.lineTo(128, y + 5);
					context.stroke();
				}
			} else {
				context.strokeStyle = material === 'metal' ? '#d5ded8' : '#e4e7df';
				context.lineWidth = material === 'metal' ? 2 : 1;
				for (let x = 0; x <= 128; x += material === 'metal' ? 18 : 32) {
					context.beginPath();
					context.moveTo(x, 0);
					context.lineTo(x, 128);
					context.stroke();
				}
			}
			context.globalAlpha = 1;
			const texture = new THREE.CanvasTexture(textureCanvas);
			texture.colorSpace = THREE.SRGBColorSpace;
			texture.wrapS = THREE.RepeatWrapping;
			texture.wrapT = THREE.RepeatWrapping;
			texture.repeat.set(2.5, 1);
			markerTextures.push(texture);
			return texture;
		}

		for (let index = 0; index < profile.wall.length - 1; index += 1) {
			const startLandmark = profile.wall[index];
			const endLandmark = profile.wall[index + 1];
			const start = polarPoint(startLandmark.angle, startLandmark.distance);
			const end = polarPoint(endLandmark.angle, endLandmark.distance);
			const averageAngle = (startLandmark.angle + endLandmark.angle) / 2;
			const surface = wallSurfaceAt(averageAngle, appearance);
			const startHeight = wallHeightAt(startLandmark, appearance);
			const endHeight = wallHeightAt(endLandmark, appearance);
			const wallVertices = [
				start.x,
				0,
				-start.y,
				end.x,
				0,
				-end.y,
				end.x,
				endHeight,
				-end.y,
				start.x,
				0,
				-start.y,
				end.x,
				endHeight,
				-end.y,
				start.x,
				startHeight,
				-start.y
			];
			const wallGeometry = new THREE.BufferGeometry();
			wallGeometry.setAttribute('position', new THREE.Float32BufferAttribute(wallVertices, 3));
			wallGeometry.setAttribute(
				'uv',
				new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2)
			);
			wallGeometry.computeVertexNormals();
			const wallSegment = new THREE.Mesh(
				wallGeometry,
				new THREE.MeshStandardMaterial({
					map: makeWallTexture(surface.material, surface.color),
					roughness: surface.material === 'metal' ? 0.6 : 0.9,
					side: THREE.DoubleSide
				})
			);
			scene.add(wallSegment);

			const capCurve = new THREE.LineCurve3(
				new THREE.Vector3(start.x, startHeight + 0.35, -start.y),
				new THREE.Vector3(end.x, endHeight + 0.35, -end.y)
			);
			const wallCap = new THREE.Mesh(
				new THREE.TubeGeometry(capCurve, 1, 0.65, 5, false),
				new THREE.MeshBasicMaterial({ color: appearance.wallCap })
			);
			scene.add(wallCap);
		}

		const foulPoleMaterial = new THREE.MeshBasicMaterial({
			color: 0xffd21f,
			depthTest: false
		});
		for (const [screenDirection, landmark] of [
			[1, profile.wall[0]],
			[-1, profile.wall.at(-1)!]
		] as const) {
			const point = polarPoint(landmark.angle, landmark.distance);
			const adjacentWallHeight = wallHeightAt(landmark, appearance);
			const poleHeight = Math.min(68, Math.max(48, adjacentWallHeight + 34));
			const pole = new THREE.Mesh(
				new THREE.CylinderGeometry(1.75, 2, poleHeight, 10),
				foulPoleMaterial
			);
			pole.position.set(point.x, poleHeight / 2, -point.y);
			pole.renderOrder = 5;
			scene.add(pole);

			const screenWidth = 10;
			const screenBottom = adjacentWallHeight + 1.5;
			const screenTop = Math.min(poleHeight - 3, screenBottom + 24);
			const screenMaterial = new THREE.LineBasicMaterial({ color: 0xffd21f });
			const screenEndX = point.x + screenDirection * screenWidth;
			const screenFill = new THREE.Mesh(
				new THREE.PlaneGeometry(screenWidth, screenTop - screenBottom),
				new THREE.MeshBasicMaterial({
					color: 0xffd21f,
					transparent: true,
					opacity: 0.2,
					side: THREE.DoubleSide,
					depthTest: false
				})
			);
			screenFill.position.set((point.x + screenEndX) / 2, (screenBottom + screenTop) / 2, -point.y);
			screenFill.renderOrder = 4;
			scene.add(screenFill);
			const screen = new THREE.LineLoop(
				new THREE.BufferGeometry().setFromPoints([
					new THREE.Vector3(point.x, screenBottom, -point.y),
					new THREE.Vector3(screenEndX, screenBottom, -point.y),
					new THREE.Vector3(screenEndX, screenTop, -point.y),
					new THREE.Vector3(point.x, screenTop, -point.y)
				]),
				screenMaterial
			);
			screen.renderOrder = 5;
			scene.add(screen);
			for (let rung = screenBottom + 4; rung < screenTop; rung += 4) {
				scene.add(
					new THREE.Line(
						new THREE.BufferGeometry().setFromPoints([
							new THREE.Vector3(point.x, rung, -point.y),
							new THREE.Vector3(screenEndX, rung, -point.y)
						]),
						screenMaterial
					)
				);
			}
		}

		for (const marker of wallDistanceMarkers(profile)) {
			const markerCanvas = document.createElement('canvas');
			markerCanvas.width = 128;
			markerCanvas.height = 64;
			const context = markerCanvas.getContext('2d');
			if (!context) continue;
			context.fillStyle = 'rgba(12, 14, 12, 0.72)';
			context.fillRect(9, 10, 110, 44);
			context.fillStyle = '#f2eedc';
			context.font = '900 34px Arial, sans-serif';
			context.textAlign = 'center';
			context.textBaseline = 'middle';
			context.fillText(marker.label, 64, 34);
			const texture = new THREE.CanvasTexture(markerCanvas);
			texture.colorSpace = THREE.SRGBColorSpace;
			markerTextures.push(texture);
			const sprite = new THREE.Sprite(
				new THREE.SpriteMaterial({
					map: texture,
					transparent: true,
					depthTest: false,
					depthWrite: false
				})
			);
			sprite.position.set(marker.x, 5, -marker.y);
			sprite.scale.set(48, 24, 1);
			sprite.renderOrder = 4;
			scene.add(sprite);
		}

		const foulMaterial = new THREE.LineBasicMaterial({
			color: 0xf1ecd8,
			transparent: true,
			opacity: 0.78
		});
		for (const point of [fieldPoints[0], fieldPoints.at(-1)!]) {
			scene.add(
				new THREE.Line(
					new THREE.BufferGeometry().setFromPoints([
						new THREE.Vector3(0, 0.12, 0),
						new THREE.Vector3(point.x, 0.12, -point.y)
					]),
					foulMaterial
				)
			);
		}

		const diamondShape = new THREE.Shape();
		diamondShape.moveTo(0, 0);
		diamondShape.lineTo(78, 78);
		diamondShape.bezierCurveTo(78, 108, 48, 130, 0, 145);
		diamondShape.bezierCurveTo(-48, 130, -78, 108, -78, 78);
		diamondShape.closePath();
		const dirtMaterial = new THREE.MeshBasicMaterial({
			color: appearance.dirt,
			polygonOffset: true,
			polygonOffsetFactor: -1,
			polygonOffsetUnits: -1
		});
		const dirt = new THREE.Mesh(new THREE.ShapeGeometry(diamondShape), dirtMaterial);
		dirt.rotation.x = -Math.PI / 2;
		dirt.position.y = 0.08;
		scene.add(dirt);

		const infieldShape = new THREE.Shape();
		infieldShape.moveTo(0, 10);
		infieldShape.lineTo(54, 63.64);
		infieldShape.lineTo(0, 116);
		infieldShape.lineTo(-54, 63.64);
		infieldShape.closePath();
		const infieldGrass = new THREE.Mesh(
			new THREE.ShapeGeometry(infieldShape),
			new THREE.MeshBasicMaterial({
				color: appearance.infieldGrass,
				polygonOffset: true,
				polygonOffsetFactor: -2,
				polygonOffsetUnits: -2
			})
		);
		infieldGrass.rotation.x = -Math.PI / 2;
		infieldGrass.position.y = 0.16;
		scene.add(infieldGrass);

		const baseGeometry = new THREE.BoxGeometry(8, 0.8, 8);
		const baseMaterial = new THREE.MeshBasicMaterial({ color: 0xfffdf0 });
		for (const [x, y] of [
			[63.64, 63.64],
			[0, 127.28],
			[-63.64, 63.64]
		]) {
			const base = new THREE.Mesh(baseGeometry, baseMaterial);
			base.position.set(x, 0.65, -y);
			base.rotation.y = Math.PI / 4;
			scene.add(base);
		}
		const plateShape = new THREE.Shape();
		plateShape.moveTo(-3.4, 2.2);
		plateShape.lineTo(3.4, 2.2);
		plateShape.lineTo(3.4, -0.8);
		plateShape.lineTo(0, -3.5);
		plateShape.lineTo(-3.4, -0.8);
		plateShape.closePath();
		const homePlate = new THREE.Mesh(
			new THREE.ShapeGeometry(plateShape),
			new THREE.MeshBasicMaterial({ color: 0xfffdf0 })
		);
		homePlate.rotation.x = -Math.PI / 2;
		homePlate.position.y = 0.72;
		scene.add(homePlate);
		const mound = new THREE.Mesh(
			new THREE.CylinderGeometry(8, 9, 0.8, 36),
			new THREE.MeshStandardMaterial({ color: 0xb7895d, roughness: 1 })
		);
		mound.position.set(0, 0.35, -60.5);
		scene.add(mound);

		const cameraView = hitFlightCamera(mountedFlight);
		const camera = new THREE.PerspectiveCamera(cameraView.fov, 1, 0.1, 1200);
		camera.position.set(cameraView.position.x, cameraView.position.y, cameraView.position.z);
		camera.lookAt(cameraView.target.x, cameraView.target.y, cameraView.target.z);

		scene.add(new THREE.HemisphereLight(0xfff3d2, 0x183b28, 2.35));
		const fieldLight = new THREE.DirectionalLight(0xffffff, 1.35);
		fieldLight.position.set(-120, 300, 160);
		scene.add(fieldLight);

		let curve: THREE.CatmullRomCurve3 | null = null;
		let ball: THREE.Mesh | null = null;
		let trailGeometry: THREE.BufferGeometry | null = null;
		let trailPositions: Float32Array | null = null;
		const framingPoints = profile.wall.flatMap((landmark) => {
			const point = polarPoint(landmark.angle, landmark.distance);
			return [
				new THREE.Vector3(point.x, 0, -point.y),
				new THREE.Vector3(point.x, wallHeightAt(landmark, appearance) + 1, -point.y)
			];
		});
		framingPoints.push(
			new THREE.Vector3(0, 0, 0),
			new THREE.Vector3(-63.64, 1, -63.64),
			new THREE.Vector3(63.64, 1, -63.64)
		);
		const trailCapacity = 34;
		if (mountedFlight) {
			const points = renderHitFlightPoints(mountedFlight).map(
				(point) => new THREE.Vector3(point.x, point.z, -point.y)
			);
			framingPoints.push(...points);
			curve = new THREE.CatmullRomCurve3(points, false, 'centripetal');
			const pathGeometry = new THREE.TubeGeometry(curve, 150, 0.72, 7, false);
			const completePath = new THREE.Mesh(
				pathGeometry,
				new THREE.MeshBasicMaterial({
					color: 0xfdb827,
					transparent: true,
					opacity: 0.42,
					depthTest: false,
					depthWrite: false
				})
			);
			completePath.renderOrder = 6;
			scene.add(completePath);

			trailPositions = new Float32Array(trailCapacity * 3);
			trailGeometry = new THREE.BufferGeometry();
			trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
			trailGeometry.setDrawRange(0, 0);
			const trail = new THREE.Line(
				trailGeometry,
				new THREE.LineBasicMaterial({
					color: 0xffffff,
					transparent: true,
					opacity: 0.95,
					depthTest: false,
					depthWrite: false
				})
			);
			trail.renderOrder = 7;
			scene.add(trail);

			ball = new THREE.Mesh(
				new THREE.SphereGeometry(3.2, 22, 16),
				new THREE.MeshStandardMaterial({
					color: 0xffffff,
					emissive: 0xfdb827,
					emissiveIntensity: 0.48,
					roughness: 0.4
				})
			);
			ball.renderOrder = 8;
			scene.add(ball);
		}

		const media = window.matchMedia('(prefers-reduced-motion: reduce)');
		flightState = flight.kind === 'flight' ? 'playing' : 'tracking';
		let animationFrame = 0;
		let animationStart = performance.now();
		let activeReplayKey = replayKey;
		let width = 0;
		let height = 0;

		function fitCameraToFlight() {
			camera.fov = cameraView.fov;
			camera.updateMatrixWorld();
			camera.updateProjectionMatrix();
			while (camera.fov < 62) {
				const outsideFrame = framingPoints.some((point) => {
					const projected = point.clone().project(camera);
					return Math.abs(projected.x) > 0.94 || projected.y > 0.88 || projected.y < -0.92;
				});
				if (!outsideFrame) break;
				camera.fov += 1;
				camera.updateProjectionMatrix();
			}
		}

		function resize() {
			if (!canvas) return false;
			const nextWidth = Math.max(1, canvas.clientWidth);
			const nextHeight = Math.max(1, canvas.clientHeight);
			if (nextWidth === width && nextHeight === height) return false;
			width = nextWidth;
			height = nextHeight;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
			renderer.setSize(width, height, false);
			camera.aspect = width / height;
			fitCameraToFlight();
			return true;
		}

		function updateTrail(progress: number) {
			if (!curve || !trailGeometry || !trailPositions) return;
			const start = Math.max(0, progress - 0.16);
			const count = Math.max(2, Math.round(trailCapacity * Math.min(1, progress / 0.16)));
			for (let index = 0; index < count; index += 1) {
				const fraction = start + ((progress - start) * index) / Math.max(1, count - 1);
				curve.getPoint(clamp(fraction, 0, 1)).toArray(trailPositions, index * 3);
			}
			trailGeometry.attributes.position.needsUpdate = true;
			trailGeometry.setDrawRange(0, count);
		}

		function clamp(value: number, minimum: number, maximum: number) {
			return Math.min(maximum, Math.max(minimum, value));
		}

		function render(now: number) {
			let shouldContinue = false;
			try {
				resize();
				if (activeReplayKey !== replayKey) {
					activeReplayKey = replayKey;
					animationStart = now;
				}
				if (curve && ball) {
					const elapsed = clamp(
						(now - animationStart) / (mountedFlight?.motion === 'ground' ? 1900 : 2600),
						0,
						1
					);
					const progress = media.matches ? 1 : 1 - Math.pow(1 - elapsed, 2);
					ball.position.copy(curve.getPoint(progress));
					updateTrail(progress);
					shouldContinue = !media.matches && elapsed < 1;
					if (!shouldContinue) flightState = 'settled';
				}
				renderer.render(scene, camera);
			} catch (error) {
				fallback = error instanceof Error ? error.message : 'Three.js could not render this hit.';
				console.error('Three.js hit-flight frame failed', error);
				return;
			}
			animationFrame = shouldContinue ? requestAnimationFrame(render) : 0;
		}

		restartAnimation = () => {
			if (!curve) return;
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
				if (
					object instanceof THREE.Mesh ||
					object instanceof THREE.Line ||
					object instanceof THREE.Sprite
				) {
					object.geometry.dispose();
					const materials = Array.isArray(object.material) ? object.material : [object.material];
					for (const material of materials) material.dispose();
				}
			});
			for (const texture of markerTextures) texture.dispose();
			renderer.dispose();
		};
	});
</script>

<div class="hit-flight-stage" data-flight-kind={flight.kind} data-flight-state={flightState}>
	<canvas bind:this={canvas} aria-label={`Projected batted-ball flight at ${profile.name}`}
	></canvas>
	{#if fallback}
		<div class="fallback" role="status">{fallback}</div>
	{/if}
	<div class="field-id">
		<strong>{profile.name}</strong>
		<span>Current field dimensions</span>
	</div>
	<div class="flight-note">
		{#if hasFlight}
			<span>Projected flight</span>
		{:else}
			<span role="status">Tracking batted ball</span>
		{/if}
	</div>
	{#if outcome}
		<div class:hit={outcome === 'hit'} class:out={outcome === 'out'} class="result-indicator">
			{outcome === 'hit' ? 'Hit' : 'Out'}
		</div>
	{/if}
	{#if hasFlight}
		<button class="replay" type="button" onclick={replay}>Replay flight</button>
	{/if}
</div>

<style>
	.hit-flight-stage {
		position: relative;
		width: 100%;
		min-height: 430px;
		overflow: hidden;
		background: #10110f;
		animation: view-in 0.35s ease-out;
	}
	canvas {
		display: block;
		width: 100%;
		height: 430px;
	}
	.field-id,
	.flight-note {
		position: absolute;
		z-index: 2;
		display: flex;
		flex-direction: column;
		gap: 2px;
		text-transform: uppercase;
		pointer-events: none;
	}
	.field-id {
		left: 14px;
		bottom: 12px;
	}
	.field-id strong {
		color: #f5f5ef;
		font-size: 8px;
		letter-spacing: 0.12em;
	}
	.field-id span,
	.flight-note span {
		color: #96978f;
		font-size: 6px;
		font-weight: 800;
		letter-spacing: 0.1em;
	}
	.flight-note {
		top: 13px;
		left: 14px;
		padding-left: 8px;
		border-left: 2px solid #fdb827;
	}
	.flight-note span {
		color: #d8d4c6;
	}
	.result-indicator {
		position: absolute;
		top: 11px;
		left: 50%;
		z-index: 3;
		min-width: 42px;
		padding: 5px 9px;
		transform: translateX(-50%);
		border: 1px solid currentColor;
		font-size: 8px;
		font-weight: 950;
		letter-spacing: 0.14em;
		line-height: 1;
		text-align: center;
		text-transform: uppercase;
		pointer-events: none;
	}
	.result-indicator.hit {
		color: #d8f5df;
		background: rgba(32, 111, 60, 0.9);
	}
	.result-indicator.out {
		color: #ffe1d8;
		background: rgba(132, 43, 31, 0.9);
	}
	.replay {
		position: absolute;
		top: 10px;
		right: 12px;
		z-index: 2;
		padding: 7px 9px;
		color: #111;
		background: #fdb827;
		border: 0;
		font-size: 7px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
		cursor: pointer;
	}
	.replay:focus-visible {
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
		font-size: 12px;
		text-align: center;
	}
	@keyframes view-in {
		from {
			opacity: 0;
			transform: translateY(8px);
		}
	}
	@media (max-width: 700px) {
		.hit-flight-stage {
			min-height: 270px;
		}
		canvas {
			height: 270px;
		}
	}
</style>
