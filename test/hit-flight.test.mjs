import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
	hitFlightCamera,
	hitOutcome,
	reconstructHitFlight,
	renderHitFlightPoints,
	wallDistanceMarkers
} from '../src/lib/hit-flight.js';
import { PNC_PARK } from '../src/lib/field-geometry.js';

const FLY_BALL = {
	launchSpeed: 102.4,
	launchAngle: 31,
	totalDistance: 418,
	trajectory: 'fly_ball',
	location: '8',
	coordinates: { coordX: 137.2, coordY: 62.8 }
};

test('does not invent a flight or a second-base destination while hit tracking is unresolved', () => {
	for (const hitData of [
		{},
		{ trajectory: 'fly_ball' },
		{ coordinates: { coordX: null, coordY: null } },
		{ launchSpeed: 99, launchAngle: 28 }
	]) {
		assert.deepEqual(reconstructHitFlight(hitData, '', PNC_PARK), { kind: 'unavailable' });
	}
});

test('changes the Three.js scene key when delayed hit telemetry resolves the flight', async () => {
	const { hitFlightRenderKey } = await import('../src/lib/hit-flight.js');
	assert.equal(typeof hitFlightRenderKey, 'function');

	const pending = { trajectory: 'fly_ball' };
	const resolved = {
		...pending,
		launchSpeed: 102.4,
		launchAngle: 31,
		totalDistance: 418,
		location: '8',
		coordinates: { coordX: 137.2, coordY: 62.8 }
	};

	assert.notEqual(
		hitFlightRenderKey(pending, '', PNC_PARK),
		hitFlightRenderKey(resolved, 'Home run to center field.', PNC_PARK)
	);
});

test('remounts the Three.js contact scene when its reconstruction inputs change', () => {
	const source = readFileSync(
		new URL('../src/lib/GameVisualization.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /import \{ hitFlightRenderKey \} from '\$lib\/hit-flight\.js'/);
	assert.match(source, /const currentFlightKey = \$derived/);
	assert.match(source, /hitFlightRenderKey\(/);
	assert.match(source, /\{#key currentFlightKey\}/);
});

test('reconstructs an airborne arc from measured launch data to the resolved field destination', () => {
	const flight = reconstructHitFlight(FLY_BALL, 'Home run to center field.', PNC_PARK, 49);
	assert.equal(flight.kind, 'flight');
	assert.equal(flight.points.length, 49);
	assert.deepEqual(flight.points[0], { x: 0, y: 0, z: 3, t: 0 });
	assert.deepEqual(flight.points.at(-1), {
		x: flight.estimate.point.x,
		y: flight.estimate.point.y,
		z: 0,
		t: flight.duration
	});
	assert.equal(flight.measured.launchSpeed, 102.4);
	assert.equal(flight.measured.launchAngle, 31);
	assert.equal(flight.measured.distance, 418);
	assert.ok(flight.apex > 40);
	assert.ok(flight.apex < 180);
	assert.ok(flight.duration > 2 && flight.duration < 8);
	assert.ok(flight.points.every((point) => Object.values(point).every(Number.isFinite)));
});

test('uses a low bounce-and-roll path for a resolved ground ball', () => {
	const flight = reconstructHitFlight(
		{
			launchSpeed: 80.5,
			launchAngle: -45,
			totalDistance: 3,
			trajectory: 'ground_ball',
			location: '5',
			coordinates: { coordX: 112.28, coordY: 176.01 }
		},
		'Grounded to third.',
		PNC_PARK,
		41
	);
	assert.equal(flight.kind, 'flight');
	assert.equal(flight.motion, 'ground');
	assert.ok(flight.apex <= 3);
	assert.ok(flight.points.slice(5).every((point) => point.z <= 1));
	assert.deepEqual(flight.points.at(-1), {
		x: flight.estimate.point.x,
		y: flight.estimate.point.y,
		z: 0,
		t: flight.duration
	});
	assert.ok(renderHitFlightPoints(flight).every((point) => point.z >= 0.9));
});

test('falls back to a resolved endpoint curve when launch metrics are absent', () => {
	const flight = reconstructHitFlight(
		{ trajectory: 'fly_ball', location: '7', coordinates: { coordX: 88, coordY: 118 } },
		'Flies out to left fielder.',
		PNC_PARK
	);
	assert.equal(flight.kind, 'flight');
	assert.equal(flight.measured.launchSpeed, null);
	assert.equal(flight.measured.launchAngle, null);
	assert.ok(flight.apex > 15);
});

test('places labeled distance markers just inside the custom outfield wall', () => {
	const markers = wallDistanceMarkers(PNC_PARK);
	assert.deepEqual(
		markers.map(({ label }) => label),
		['325', '389', '410', '399', '375', '320']
	);
	for (const marker of markers) {
		assert.ok(Number.isFinite(marker.x));
		assert.ok(Number.isFinite(marker.y));
		assert.ok(marker.distanceFromWall >= 12 && marker.distanceFromWall <= 30);
	}
	assert.equal(markers[0].distanceFromWall, 30);
	assert.equal(markers.at(-1).distanceFromWall, 30);
});

test('uses a lower closer camera and turns toward the resolved hit direction', () => {
	const center = hitFlightCamera({ kind: 'flight', estimate: { point: { x: 0, y: 360 } } });
	const right = hitFlightCamera({ kind: 'flight', estimate: { point: { x: 180, y: 320 } } });
	const left = hitFlightCamera({ kind: 'flight', estimate: { point: { x: -180, y: 320 } } });
	const highFly = hitFlightCamera({
		kind: 'flight',
		apex: 145,
		estimate: { point: { x: 120, y: 278 } }
	});

	assert.ok(center.position.y >= 60 && center.position.y <= 76);
	assert.ok(center.position.z >= 96 && center.position.z <= 120);
	assert.ok(center.fov <= 50);
	assert.equal(center.position.x, 0);
	assert.equal(center.target.x, 0);
	assert.ok(right.position.x < 0);
	assert.ok(right.target.x > 0);
	assert.equal(left.position.x, -right.position.x);
	assert.equal(left.target.x, -right.target.x);
	assert.ok(highFly.target.y > center.target.y);
	assert.ok(highFly.target.y <= 46);
});

test('classifies explicit hit and out results without guessing ambiguous plays', () => {
	assert.equal(hitOutcome('Single', 'single'), 'hit');
	assert.equal(hitOutcome('Home Run', 'home_run'), 'hit');
	assert.equal(hitOutcome('Flyout', 'field_out'), 'out');
	assert.equal(hitOutcome('Grounded Into DP', 'grounded_into_double_play'), 'out');
	assert.equal(hitOutcome("Fielder's Choice", 'fielders_choice'), null);
	assert.equal(hitOutcome('Field Error', 'field_error'), null);
});
