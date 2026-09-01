import { estimateHitLocation } from './field-geometry.js';

const DEFAULT_SAMPLE_COUNT = 65;
const MIN_SAMPLE_COUNT = 16;
const MAX_SAMPLE_COUNT = 121;
const FEET_PER_SECOND_PER_MPH = 1.4666666667;
const GRAVITY_FEET_PER_SECOND_SQUARED = 32.174;

/** @typedef {{x:number, y:number, z:number, t:number}} HitFlightPoint */
/** @typedef {{kind:'unavailable'}} UnavailableHitFlight */
/** @typedef {{kind:'flight', motion:'ground'|'air', points:HitFlightPoint[], estimate:any, apex:number, duration:number, measured:{launchSpeed:number|null, launchAngle:number|null, distance:number|null}}} ReconstructedHitFlight */
/** @typedef {UnavailableHitFlight | ReconstructedHitFlight} HitFlightResult */

/** @param {unknown} value @returns {value is number} */
function finite(value) {
	return typeof value === 'number' && Number.isFinite(value);
}

/** @param {string} description */
function hasDescribedDirection(description) {
	return /left field|right field|center field|shortstop|second base|first base|third base|pitcher|catcher|foul territory/i.test(
		description
	);
}

/**
 * A hit is renderable only after MLB supplies a destination-bearing field.
 * This deliberately excludes the generic center-field fallback used by the old SVG.
 * @param {Record<string, any>} hitData
 * @param {string} description
 */
export function hasResolvedHitDestination(hitData, description = '') {
	const coordinates = hitData?.coordinates;
	if (finite(coordinates?.coordX) && finite(coordinates?.coordY)) return true;
	if (typeof hitData?.location === 'string' && hitData.location.length > 0) return true;
	return (
		finite(hitData?.totalDistance) &&
		hitData.totalDistance >= 20 &&
		hasDescribedDirection(description)
	);
}

/**
 * Key the mounted Three.js scene to every input used to reconstruct its path.
 * The component builds its geometry on mount, so late MLB telemetry must remount it.
 * @param {Record<string, any>} hitData
 * @param {string} description
 * @param {typeof import('./ballpark-profiles.js').PNC_PARK} profile
 */
export function hitFlightRenderKey(hitData, description = '', profile) {
	return JSON.stringify([
		profile?.venueId ?? profile?.name ?? null,
		hitData?.coordinates?.coordX ?? null,
		hitData?.coordinates?.coordY ?? null,
		hitData?.location ?? null,
		hitData?.totalDistance ?? null,
		hitData?.launchSpeed ?? null,
		hitData?.launchAngle ?? null,
		hitData?.trajectory ?? null,
		description
	]);
}

/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp(value, minimum, maximum) {
	return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Place published wall-distance labels slightly inside the playing surface.
 * @param {typeof import('./ballpark-profiles.js').PNC_PARK} profile
 */
export function wallDistanceMarkers(profile) {
	return profile.wall
		.filter((landmark) => landmark.label)
		.map((landmark) => {
			const distanceFromWall = Math.abs(landmark.angle) >= 40 ? 30 : 15;
			const distance = Math.max(0, landmark.distance - distanceFromWall);
			const radians = (landmark.angle * Math.PI) / 180;
			const inwardNudge = landmark.angle < 0 ? 10 : landmark.angle > 0 ? -10 : 0;
			return {
				label: landmark.label,
				x: Math.sin(radians) * distance + inwardNudge,
				y: Math.cos(radians) * distance,
				distanceFromWall
			};
		});
}

/**
 * Lift ground-ball presentation geometry above the field meshes so its path
 * remains visible without changing the reconstructed physical samples.
 * @param {HitFlightResult} flight
 */
export function renderHitFlightPoints(flight) {
	if (flight.kind !== 'flight') return [];
	const lift = flight.motion === 'ground' ? 0.9 : 0;
	return flight.points.map((point) => ({ ...point, z: point.z + lift }));
}

/**
 * Classify only explicit official hit and out results for the field badge.
 * @param {string | undefined} event
 * @param {string | undefined} eventType
 * @returns {'hit' | 'out' | null}
 */
export function hitOutcome(event, eventType) {
	/** @param {unknown} value */
	const normalize = (value) =>
		String(value ?? '')
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '_')
			.replace(/^_|_$/g, '');
	const values = [normalize(event), normalize(eventType)];
	const hits = new Set(['single', 'double', 'triple', 'home_run', 'homerun']);
	const outs = new Set([
		'flyout',
		'fly_out',
		'groundout',
		'ground_out',
		'lineout',
		'line_out',
		'pop_out',
		'field_out',
		'forceout',
		'force_out',
		'grounded_into_dp',
		'grounded_into_double_play',
		'double_play',
		'triple_play'
	]);
	if (values.some((value) => hits.has(value))) return 'hit';
	if (values.some((value) => outs.has(value))) return 'out';
	return null;
}

/**
 * Derive a restrained field camera from the resolved hit direction.
 * @param {{kind?:string, apex?:number, estimate?:{point?:{x?:number, y?:number}}} | null} flight
 */
export function hitFlightCamera(flight) {
	const x = finite(flight?.estimate?.point?.x) ? flight.estimate.point.x : 0;
	const y = finite(flight?.estimate?.point?.y) ? flight.estimate.point.y : 320;
	const apex = finite(flight?.apex) ? flight.apex : 3;
	const spray = clamp(x / 220, -1, 1);
	return {
		fov: 47,
		position: { x: Number((-spray * 12).toFixed(2)), y: 68, z: 108 },
		target: {
			x: Number(clamp(x * 0.18, -38, 38).toFixed(2)),
			y: Number(clamp(apex * 0.28, 18, 46).toFixed(2)),
			z: -Number(clamp(y * 0.5, 165, 215).toFixed(2))
		}
	};
}

/**
 * Reconstruct a presentation curve from measured launch constraints and a resolved destination.
 * Intermediate points are projected; the source feed does not expose public sampled XYZ positions.
 * Coordinates use feet from home plate: x across the field, y toward center, z above the field.
 * @param {Record<string, any>} hitData
 * @param {string} description
 * @param {typeof import('./ballpark-profiles.js').PNC_PARK} profile
 * @param {number} [sampleCount]
 * @returns {HitFlightResult}
 */
export function reconstructHitFlight(
	hitData,
	description,
	profile,
	sampleCount = DEFAULT_SAMPLE_COUNT
) {
	if (!hitData || !profile || !hasResolvedHitDestination(hitData, description)) {
		return { kind: 'unavailable' };
	}

	const estimate = estimateHitLocation(hitData, description, profile);
	if (!finite(estimate?.point?.x) || !finite(estimate?.point?.y) || !finite(estimate?.distance)) {
		return { kind: 'unavailable' };
	}

	const trajectory = String(hitData.trajectory ?? '').toLowerCase();
	const motion =
		trajectory === 'ground_ball' || (finite(hitData.launchAngle) && hitData.launchAngle < 0)
			? 'ground'
			: 'air';
	const launchSpeed = finite(hitData.launchSpeed) ? hitData.launchSpeed : null;
	const launchAngle = finite(hitData.launchAngle) ? hitData.launchAngle : null;
	const count = clamp(
		Math.round(finite(sampleCount) ? sampleCount : DEFAULT_SAMPLE_COUNT),
		MIN_SAMPLE_COUNT,
		MAX_SAMPLE_COUNT
	);
	const distance = Math.max(1, estimate.distance);

	let apex;
	let duration;
	if (motion === 'ground') {
		apex = 3;
		const rollSpeed = launchSpeed ? launchSpeed * FEET_PER_SECOND_PER_MPH * 0.45 : 48;
		duration = clamp(distance / Math.max(35, rollSpeed), 0.9, 3.5);
	} else {
		const angleRadians = ((launchAngle ?? 24) * Math.PI) / 180;
		const verticalSpeed = launchSpeed
			? Math.max(0, launchSpeed * FEET_PER_SECOND_PER_MPH * Math.sin(angleRadians))
			: 0;
		const ballisticApex = verticalSpeed
			? 3 + (verticalSpeed * verticalSpeed) / (2 * GRAVITY_FEET_PER_SECOND_SQUARED)
			: 0;
		const fallbackApex =
			trajectory === 'popup'
				? clamp(distance * 0.7, 45, 145)
				: trajectory === 'line_drive'
					? clamp(distance * 0.12, 12, 42)
					: clamp(distance * 0.24, 24, 120);
		apex = clamp(ballisticApex || fallbackApex, 10, 175);
		const horizontalSpeed = launchSpeed
			? Math.max(
					35,
					launchSpeed * FEET_PER_SECOND_PER_MPH * Math.max(0.18, Math.cos(angleRadians)) * 0.72
				)
			: Math.max(42, distance / 4.2);
		duration = clamp(distance / horizontalSpeed, 1.1, 7.5);
	}

	const startHeight = 3;
	const points = Array.from({ length: count }, (_, index) => {
		const progress = index / (count - 1);
		let z;
		if (motion === 'ground') {
			if (progress <= 0.08) {
				z = startHeight * (1 - progress / 0.08);
			} else {
				const bounceProgress = progress - 0.08;
				const decay = Math.max(0, 1 - bounceProgress / 0.45);
				z = Math.max(0, Math.sin(bounceProgress * Math.PI * 8) * decay * 0.45);
			}
		} else {
			z = startHeight * (1 - progress) + 4 * (apex - startHeight / 2) * progress * (1 - progress);
		}
		return {
			x: estimate.point.x * progress,
			y: estimate.point.y * progress,
			z,
			t: duration * progress
		};
	});
	points[0] = { x: 0, y: 0, z: startHeight, t: 0 };
	points[count - 1] = { x: estimate.point.x, y: estimate.point.y, z: 0, t: duration };

	if (points.some((point) => Object.values(point).some((value) => !finite(value)))) {
		return { kind: 'unavailable' };
	}

	return {
		kind: 'flight',
		motion,
		points,
		estimate,
		apex,
		duration,
		measured: {
			launchSpeed,
			launchAngle,
			distance: finite(hitData.totalDistance) ? hitData.totalDistance : null
		}
	};
}
