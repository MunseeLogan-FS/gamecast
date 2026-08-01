import { BALLPARK_PROFILES, PNC_PARK } from './ballpark-profiles.js';

export { BALLPARK_PROFILES, PNC_PARK };

const DEG_TO_RAD = Math.PI / 180;
const MLB_CHART_HOME = Object.freeze({ x: 125.42, y: 198.27 });
const MLB_CHART_FEET_PER_PIXEL = 2.5;

/** @param {number} angle @param {number} distance */
function polarPoint(angle, distance) {
	const radians = angle * DEG_TO_RAD;
	return {
		x: Math.sin(radians) * distance,
		y: Math.cos(radians) * distance
	};
}

/** @param {number | undefined} venueId */
export function fieldProfileForVenue(venueId) {
	return BALLPARK_PROFILES.find((profile) => profile.venueId === venueId) ?? null;
}

/**
 * @param {typeof PNC_PARK} profile
 * @param {{x: number, y: number}} point Coordinates in feet from home plate.
 */
export function fieldPointToSvg(profile, point) {
	return {
		x: Number((profile.viewBox.home.x + point.x * profile.viewBox.scale).toFixed(2)),
		y: Number((profile.viewBox.home.y - point.y * profile.viewBox.scale).toFixed(2))
	};
}

/** @param {typeof PNC_PARK} profile */
export function wallSvgPoints(profile) {
	return profile.wall.map((landmark) => ({
		...landmark,
		point: polarPoint(landmark.angle, landmark.distance),
		svg: fieldPointToSvg(profile, polarPoint(landmark.angle, landmark.distance))
	}));
}

/**
 * Return the reconstructed wall distance along a spray angle.
 * @param {typeof PNC_PARK} profile
 * @param {number} angle
 */
export function wallDistanceAtAngle(profile, angle) {
	const bounded = Math.max(-45, Math.min(45, angle));
	const exact = profile.wall.find((point) => point.angle === bounded);
	if (exact) return exact.distance;
	for (let index = 0; index < profile.wall.length - 1; index += 1) {
		const start = profile.wall[index];
		const end = profile.wall[index + 1];
		if (bounded < start.angle || bounded > end.angle) continue;
		const startPoint = polarPoint(start.angle, start.distance);
		const endPoint = polarPoint(end.angle, end.distance);
		const segment = { x: endPoint.x - startPoint.x, y: endPoint.y - startPoint.y };
		const ray = polarPoint(bounded, 1);
		const denominator = ray.x * segment.y - ray.y * segment.x;
		if (Math.abs(denominator) < Number.EPSILON) continue;
		const distance = (startPoint.x * segment.y - startPoint.y * segment.x) / denominator;
		return Number(distance.toFixed(2));
	}
	return profile.dimensions.center;
}

/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp(value, minimum, maximum) {
	return Math.min(maximum, Math.max(minimum, value));
}

/** @param {number} coordX @param {number} coordY */
export function mlbHitCoordinatesToFeet(coordX, coordY) {
	return {
		x: (coordX - MLB_CHART_HOME.x) * MLB_CHART_FEET_PER_PIXEL,
		y: (MLB_CHART_HOME.y - coordY) * MLB_CHART_FEET_PER_PIXEL
	};
}

/** @param {{coordX?: number, coordY?: number} | undefined} coordinates @param {number} [maxAngle] */
function chartVector(coordinates, maxAngle = 45) {
	if (
		coordinates?.coordX === undefined ||
		coordinates.coordY === undefined ||
		!Number.isFinite(coordinates.coordX) ||
		!Number.isFinite(coordinates.coordY)
	) {
		return null;
	}
	const feet = mlbHitCoordinatesToFeet(coordinates.coordX, coordinates.coordY);
	if (Math.hypot(feet.x, feet.y) < 0.1) return null;
	return {
		angle: clamp(Math.atan2(feet.x, feet.y) / DEG_TO_RAD, -maxAngle, maxAngle),
		distance: clamp(Math.hypot(feet.x, feet.y), 5, 475)
	};
}

/** @type {Readonly<Record<string, {angle: number, distance: number}>>} */
const LOCATION_FALLBACKS = Object.freeze({
	1: { angle: 0, distance: 60.5 },
	2: { angle: 0, distance: 8 },
	3: { angle: 25, distance: 105 },
	4: { angle: 12, distance: 145 },
	5: { angle: -25, distance: 105 },
	6: { angle: -12, distance: 150 },
	7: { angle: -25, distance: 280 },
	8: { angle: 0, distance: 305 },
	9: { angle: 25, distance: 280 }
});

/** @param {string} description */
function descriptionFallback(description) {
	const value = description.toLowerCase();
	if (/left field|third base|shortstop/.test(value)) {
		return { angle: -25, distance: /field/.test(value) ? 260 : 135 };
	}
	if (/right field|first base|second base/.test(value)) {
		return { angle: 25, distance: /field/.test(value) ? 260 : 135 };
	}
	if (/center field/.test(value)) return { angle: 0, distance: 285 };
	return null;
}

/** @param {string} description @param {string | undefined} location */
function foulTerritorySide(description, location) {
	const value = description.toLowerCase();
	if (!/in foul territory|fouls? out|foul out/.test(value)) return null;
	if (/left field|third base|shortstop/.test(value) || location === '5' || location === '7')
		return 'left';
	if (/right field|first base|second base/.test(value) || location === '3' || location === '9') {
		return 'right';
	}
	return 'home';
}

/**
 * Resolve the best available physical hit point. `source` is internal fallback
 * metadata and is intentionally not exposed as confidence UI.
 * @param {{totalDistance?: number, trajectory?: string, location?: string, coordinates?: {coordX?: number, coordY?: number}}} hitData
 * @param {string} description
 * @param {typeof PNC_PARK} profile
 */
export function estimateHitLocation(hitData, description, profile) {
	const foulTerritory = foulTerritorySide(description, hitData.location);
	const chart = chartVector(hitData.coordinates, foulTerritory ? 70 : 45);
	const trajectory = hitData.trajectory?.toLowerCase();
	const trackedDistance = hitData.totalDistance;
	const hasTrackedDistance =
		trackedDistance !== undefined &&
		Number.isFinite(trackedDistance) &&
		trackedDistance >= 20 &&
		trajectory !== 'ground_ball';
	const location = hitData.location ? LOCATION_FALLBACKS[hitData.location] : undefined;
	const described = descriptionFallback(description);
	let source = 'fallback';
	let vector = { angle: 0, distance: 120 };

	if (foulTerritory) {
		source = 'foul-territory';
		vector =
			chart ??
			(foulTerritory === 'left'
				? { angle: -55, distance: 145 }
				: foulTerritory === 'right'
					? { angle: 55, distance: 145 }
					: { angle: 180, distance: 25 });
	} else if (chart && hasTrackedDistance) {
		source = 'tracked-distance';
		vector = { angle: chart.angle, distance: clamp(trackedDistance, 5, 475) };
	} else if (chart) {
		source = 'chart-distance';
		vector = chart;
	} else if (location && hasTrackedDistance) {
		source = 'tracked-distance-location';
		vector = { angle: location.angle, distance: clamp(trackedDistance, 5, 475) };
	} else if (location) {
		source = 'defensive-location';
		vector = location;
	} else if (described && hasTrackedDistance) {
		source = 'tracked-distance-description';
		vector = { angle: described.angle, distance: clamp(trackedDistance, 5, 475) };
	} else if (described) {
		source = 'description';
		vector = described;
	}

	const point = polarPoint(vector.angle, vector.distance);
	const projectedSvg = fieldPointToSvg(profile, point);
	const svg = {
		x: clamp(projectedSvg.x, 6, profile.viewBox.width - 6),
		y: clamp(projectedSvg.y, 6, profile.viewBox.height - 6)
	};
	return {
		source,
		angle: Number(vector.angle.toFixed(2)),
		distance: Number(vector.distance.toFixed(2)),
		point,
		svg,
		foulTerritory,
		clipped: svg.x !== projectedSvg.x || svg.y !== projectedSvg.y,
		wallDistance: wallDistanceAtAngle(profile, vector.angle)
	};
}

/**
 * @param {{angle: number, distance: number, foulTerritory?: string | null}} estimate
 * @param {string} description
 * @param {typeof PNC_PARK} profile
 */
export function hitLocationAriaLabel(estimate, description, profile) {
	if (estimate.foulTerritory) {
		const result = description.trim() || 'Batted ball caught in foul territory';
		const punctuatedResult = /[.!?]$/.test(result) ? result : `${result}.`;
		const region =
			estimate.foulTerritory === 'home'
				? 'foul territory behind home plate'
				: `${estimate.foulTerritory}-field foul territory`;
		return `${punctuatedResult} Caught in ${region} at ${profile.name}.`;
	}
	const direction =
		estimate.angle < -8 ? 'left field' : estimate.angle > 8 ? 'right field' : 'center field';
	const result = description.trim() || 'Batted ball';
	const punctuatedResult = /[.!?]$/.test(result) ? result : `${result}.`;
	return `${punctuatedResult} ${Math.round(estimate.distance)} feet toward ${direction} at ${profile.name}.`;
}
