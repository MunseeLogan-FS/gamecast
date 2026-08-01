import { mapPitchToZone, PITCH_VIEW } from './visualization.js';

const MIN_FLIGHT_SECONDS = 0.2;
const MAX_FLIGHT_SECONDS = 0.8;
const DEFAULT_SAMPLE_COUNT = 20;
const MIN_SAMPLE_COUNT = 2;
const MAX_SAMPLE_COUNT = 64;
const LINEAR_ACCELERATION_EPSILON = 1e-8;
const MLB_PLATE_PLANE_Y = 17 / 12;

const KINEMATIC_KEYS = Object.freeze(['x0', 'y0', 'z0', 'vX0', 'vY0', 'vZ0', 'aX', 'aY', 'aZ']);

/** @typedef {{x:number, y:number, z:number}} PitchEndpoint */
/** @typedef {{x:number, y:number, z:number, t:number}} PhysicalPitchPoint */
/** @typedef {{kind:'unavailable'}} UnavailablePitchResult */
/** @typedef {{kind:'endpoint', endpoint:PitchEndpoint}} EndpointPitchResult */
/** @typedef {{kind:'trajectory', points:PhysicalPitchPoint[], endpoint:PitchEndpoint, duration:number, endpointDrift:number}} TrajectoryPitchResult */
/** @typedef {UnavailablePitchResult | EndpointPitchResult | TrajectoryPitchResult} PitchTrajectoryResult */

/** @param {unknown} value @returns {value is number} */
export function isFiniteNumber(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

/** @param {unknown} value @returns {value is number} */
function isPlausibleDuration(value) {
	return isFiniteNumber(value) && value >= MIN_FLIGHT_SECONDS && value <= MAX_FLIGHT_SECONDS;
}

/**
 * Find the first plausible positive time when the pitch reaches MLB's front edge of home plate.
 * @param {{y0:number, vY0:number, aY:number}} telemetry
 */
export function solvePlateCrossingTime(telemetry) {
	const { y0, vY0, aY } = telemetry;
	const distanceToPlane = y0 - MLB_PLATE_PLANE_Y;
	/** @type {number[]} */
	let roots = [];
	const quadratic = aY / 2;
	if (Math.abs(quadratic) < LINEAR_ACCELERATION_EPSILON) {
		if (Math.abs(vY0) >= LINEAR_ACCELERATION_EPSILON) roots = [-distanceToPlane / vY0];
	} else {
		const discriminant = vY0 * vY0 - 4 * quadratic * distanceToPlane;
		if (discriminant >= 0) {
			const squareRoot = Math.sqrt(discriminant);
			roots = [(-vY0 - squareRoot) / (2 * quadratic), (-vY0 + squareRoot) / (2 * quadratic)];
		}
	}
	const crossing = roots.filter(isPlausibleDuration).sort((left, right) => left - right)[0];
	return crossing ?? null;
}

/**
 * @param {{coordinates?: Record<string, unknown>} | undefined} pitchData
 * @param {number} [sampleCount]
 * @returns {PitchTrajectoryResult}
 */
export function samplePitchTrajectory(pitchData, sampleCount = DEFAULT_SAMPLE_COUNT) {
	const coordinates = pitchData?.coordinates;
	const pX = coordinates?.pX;
	const pZ = coordinates?.pZ;
	if (!isFiniteNumber(pX) || !isFiniteNumber(pZ)) return { kind: 'unavailable' };
	const endpoint = { x: pX, y: MLB_PLATE_PLANE_Y, z: pZ };
	if (!coordinates || !KINEMATIC_KEYS.every((key) => isFiniteNumber(coordinates[key]))) {
		return { kind: 'endpoint', endpoint };
	}

	const telemetry =
		/** @type {{x0:number, y0:number, z0:number, vX0:number, vY0:number, vZ0:number, aX:number, aY:number, aZ:number}} */ (
			coordinates
		);
	if (telemetry.y0 <= MLB_PLATE_PLANE_Y || telemetry.vY0 >= 0) {
		return { kind: 'endpoint', endpoint };
	}
	const duration = solvePlateCrossingTime(telemetry);
	if (duration === null) return { kind: 'endpoint', endpoint };
	const count = Math.min(
		MAX_SAMPLE_COUNT,
		Math.max(
			MIN_SAMPLE_COUNT,
			Math.round(isFiniteNumber(sampleCount) ? sampleCount : DEFAULT_SAMPLE_COUNT)
		)
	);
	/** @param {number} t */
	function pointAt(t) {
		return {
			x: telemetry.x0 + telemetry.vX0 * t + 0.5 * telemetry.aX * t * t,
			y: telemetry.y0 + telemetry.vY0 * t + 0.5 * telemetry.aY * t * t,
			z: telemetry.z0 + telemetry.vZ0 * t + 0.5 * telemetry.aZ * t * t,
			t
		};
	}
	const points = Array.from({ length: count }, (_, index) =>
		pointAt((duration * index) / (count - 1))
	);
	if (
		!points.every(
			(point) =>
				isFiniteNumber(point.x) &&
				isFiniteNumber(point.y) &&
				isFiniteNumber(point.z) &&
				isFiniteNumber(point.t)
		)
	) {
		return { kind: 'endpoint', endpoint };
	}
	const rawEndpoint = points[count - 1];
	points[count - 1] = { ...endpoint, t: duration };
	return {
		kind: 'trajectory',
		points,
		endpoint,
		duration,
		endpointDrift: Math.hypot(rawEndpoint.x - endpoint.x, rawEndpoint.z - endpoint.z)
	};
}

const DISPLAY_INSET = 8;
const RELEASE_Y = 42;
const PLATE_HORIZONTAL_SCALE = (PITCH_VIEW.width - PITCH_VIEW.padding * 2) / 4;

/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp(value, minimum, maximum) {
	return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Project physical pitch samples into a fixed catcher-facing SVG view.
 * @param {PitchTrajectoryResult} result
 */
export function projectPitchTrajectory(result) {
	if (result.kind === 'unavailable') return result;
	const endpointDisplay = mapPitchToZone(result.endpoint.x, result.endpoint.z);
	if (result.kind === 'endpoint') return { ...result, endpointDisplay };

	const releaseDistance = result.points[0]?.y || 50;
	let clipped = endpointDisplay.clipped;
	const displayPoints = result.points.map((point) => {
		const progress = clamp(1 - point.y / releaseDistance, 0, 1);
		const perspective = 0.35 + progress * 0.65;
		const zonePoint = mapPitchToZone(point.x, point.z);
		const rawX = PITCH_VIEW.width / 2 + point.x * PLATE_HORIZONTAL_SCALE * perspective;
		const rawY = RELEASE_Y + progress * (zonePoint.y - RELEASE_Y);
		const x = clamp(rawX, DISPLAY_INSET, PITCH_VIEW.width - DISPLAY_INSET);
		const y = clamp(rawY, DISPLAY_INSET, PITCH_VIEW.height - DISPLAY_INSET);
		clipped ||= x !== rawX || y !== rawY || zonePoint.clipped;
		return { x, y, scale: perspective };
	});
	displayPoints[displayPoints.length - 1] = {
		x: endpointDisplay.x,
		y: endpointDisplay.y,
		scale: 1
	};
	return {
		...result,
		displayPoints,
		endpointDisplay,
		clipped
	};
}

export const PITCH_FLIGHT_LIMITS = Object.freeze({
	minimumSeconds: MIN_FLIGHT_SECONDS,
	maximumSeconds: MAX_FLIGHT_SECONDS,
	defaultSampleCount: DEFAULT_SAMPLE_COUNT,
	platePlaneY: MLB_PLATE_PLANE_Y
});
