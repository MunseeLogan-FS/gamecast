import assert from 'node:assert/strict';
import test from 'node:test';
import { projectPitchTrajectory, samplePitchTrajectory } from '../src/lib/pitch-trajectory.js';
import { mapPitchToZone } from '../src/lib/visualization.js';

const RECORDED_CUTTER = {
	plateTime: 0.40437741179595577,
	coordinates: {
		aX: -0.4536335163863557,
		aY: 25.798925453009954,
		aZ: -26.35759473583725,
		pX: -0.5218533363827904,
		pZ: 2.5050988959175524,
		vX0: 5.137609718027386,
		vY0: -134.79194805426116,
		vZ0: -2.145945340336743,
		x0: -2.4107393350536364,
		y0: 50.002862640469,
		z0: 5.1487993553523586
	}
};

test('uses the authoritative endpoint when full kinematics are unavailable', () => {
	assert.deepEqual(samplePitchTrajectory({ coordinates: { pX: -0.52, pZ: 2.51 } }), {
		kind: 'endpoint',
		endpoint: { x: -0.52, y: 17 / 12, z: 2.51 }
	});
});

test('rejects malformed endpoints and degrades malformed motion to the authoritative endpoint', () => {
	for (const coordinates of [
		{ pX: null, pZ: 2.51 },
		{ pX: '-0.52', pZ: 2.51 },
		{ pX: Number.POSITIVE_INFINITY, pZ: 2.51 },
		{ pX: -0.52, pZ: Number.NaN }
	]) {
		assert.deepEqual(samplePitchTrajectory({ coordinates }), { kind: 'unavailable' });
	}

	const malformedMotion = structuredClone(RECORDED_CUTTER);
	malformedMotion.coordinates.aX = Number.POSITIVE_INFINITY;
	assert.deepEqual(samplePitchTrajectory(malformedMotion), {
		kind: 'endpoint',
		endpoint: {
			x: RECORDED_CUTTER.coordinates.pX,
			y: 17 / 12,
			z: RECORDED_CUTTER.coordinates.pZ
		}
	});
});

test('does not invent a flight when finite telemetry never reaches the plate', () => {
	const recedingPitch = structuredClone(RECORDED_CUTTER);
	recedingPitch.coordinates.vY0 = 10;
	recedingPitch.coordinates.aY = 0;
	assert.equal(samplePitchTrajectory(recedingPitch).kind, 'endpoint');
});

test('rejects a mathematically crossing pitch that initially travels away from the plate', () => {
	const reversingPitch = structuredClone(RECORDED_CUTTER);
	reversingPitch.coordinates.y0 = 10;
	reversingPitch.coordinates.vY0 = 10;
	reversingPitch.coordinates.aY = -200;
	assert.equal(samplePitchTrajectory(reversingPitch).kind, 'endpoint');
});

test('degrades to the endpoint when finite telemetry overflows during integration', () => {
	const overflowingPitch = structuredClone(RECORDED_CUTTER);
	overflowingPitch.coordinates.x0 = Number.MAX_VALUE;
	overflowingPitch.coordinates.aX = Number.MAX_VALUE;
	assert.equal(samplePitchTrajectory(overflowingPitch).kind, 'endpoint');
});

test('uses the default sample count when a custom count is non-finite', () => {
	const result = samplePitchTrajectory(RECORDED_CUTTER, Number.NaN);
	assert.equal(result.kind, 'trajectory');
	assert.equal(result.kind === 'trajectory' ? result.points.length : 0, 20);
});

test('reconstructs complete recorded telemetry from release to the authoritative plate endpoint', () => {
	const result = samplePitchTrajectory(RECORDED_CUTTER, 20);
	assert.equal(result.kind, 'trajectory');
	assert.equal(result.points.length, 20);
	assert.deepEqual(result.points[0], {
		x: RECORDED_CUTTER.coordinates.x0,
		y: RECORDED_CUTTER.coordinates.y0,
		z: RECORDED_CUTTER.coordinates.z0,
		t: 0
	});
	assert.deepEqual(result.points.at(-1), {
		x: RECORDED_CUTTER.coordinates.pX,
		y: 17 / 12,
		z: RECORDED_CUTTER.coordinates.pZ,
		t: result.duration
	});
	for (let index = 1; index < result.points.length; index += 1) {
		assert.ok(result.points[index].y < result.points[index - 1].y);
	}
	assert.ok(Math.abs(result.duration - 0.3738268625690792) < 1e-12);
	assert.ok(result.endpointDrift < 0.001);
});

test('projects a complete path into a finite catcher view with the authoritative Zone endpoint', () => {
	const physical = samplePitchTrajectory(RECORDED_CUTTER, 20);
	const projected = projectPitchTrajectory(physical);
	assert.equal(projected.kind, 'trajectory');
	assert.equal(projected.displayPoints.length, physical.points.length);
	assert.deepEqual(
		projected.endpointDisplay,
		mapPitchToZone(physical.endpoint.x, physical.endpoint.z)
	);
	assert.ok(projected.displayPoints[0].y < projected.endpointDisplay.y);
	for (const point of projected.displayPoints) {
		assert.ok(Number.isFinite(point.x));
		assert.ok(Number.isFinite(point.y));
		assert.ok(point.x >= 8 && point.x <= 212);
		assert.ok(point.y >= 8 && point.y <= 252);
	}
});
