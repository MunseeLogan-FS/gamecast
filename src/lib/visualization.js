const PITCH_VIEW = Object.freeze({
	width: 220,
	height: 260,
	padding: 18,
	xMin: -2,
	xMax: 2,
	zMin: 0,
	zMax: 5
});

const CURRENT_VISUALIZATION_FIELDS = [
	'gamePk',
	'liveData',
	'plays',
	'currentPlay',
	'about',
	'atBatIndex',
	'halfInning',
	'inning',
	'matchup',
	'batter',
	'id',
	'fullName',
	'batSide',
	'pitcher',
	'result',
	'event',
	'description',
	'playEvents',
	'details',
	'call',
	'code',
	'type',
	'count',
	'balls',
	'strikes',
	'outs',
	'isBall',
	'isStrike',
	'isInPlay',
	'pitchData',
	'startSpeed',
	'endSpeed',
	'strikeZoneTop',
	'strikeZoneBottom',
	'coordinates',
	'pX',
	'pZ',
	'zone',
	'hitData',
	'launchSpeed',
	'launchAngle',
	'totalDistance',
	'trajectory',
	'hardness',
	'location',
	'coordX',
	'coordY',
	'isPitch'
].join(',');

const HIT_HISTORY_FIELDS = [
	'allPlays',
	'about',
	'atBatIndex',
	'halfInning',
	'inning',
	'matchup',
	'batter',
	'id',
	'fullName',
	'result',
	'event',
	'description',
	'awayScore',
	'homeScore',
	'playEvents',
	'details',
	'hitData',
	'launchSpeed',
	'launchAngle',
	'totalDistance',
	'trajectory',
	'hardness',
	'location',
	'coordinates',
	'coordX',
	'coordY'
].join(',');

/** @param {string} apiRoot @param {number} gamePk */
export function buildCurrentVisualizationUrl(apiRoot, gamePk) {
	const parameters = new URLSearchParams({ fields: CURRENT_VISUALIZATION_FIELDS });
	return `${apiRoot}/v1.1/game/${gamePk}/feed/live?${parameters}`;
}

/** @param {string} apiRoot @param {number} gamePk */
export function buildHitHistoryUrl(apiRoot, gamePk) {
	const parameters = new URLSearchParams({ fields: HIT_HISTORY_FIELDS });
	return `${apiRoot}/v1/game/${gamePk}/playByPlay?${parameters}`;
}

/** @param {number} value @param {number} minimum @param {number} maximum */
function clamp(value, minimum, maximum) {
	return Math.min(maximum, Math.max(minimum, value));
}

/**
 * Convert MLB plate coordinates (feet) into the strike-zone SVG viewbox.
 * pX is horizontal from plate center and pZ is height above the ground.
 * @param {number} pX
 * @param {number} pZ
 */
export function mapPitchToZone(pX, pZ) {
	const { width, height, padding, xMin, xMax, zMin, zMax } = PITCH_VIEW;
	const clippedX = clamp(pX, xMin, xMax);
	const clippedZ = clamp(pZ, zMin, zMax);
	const innerWidth = width - padding * 2;
	const innerHeight = height - padding * 2;
	const x = padding + ((clippedX - xMin) / (xMax - xMin)) * innerWidth;
	const y = padding + ((zMax - clippedZ) / (zMax - zMin)) * innerHeight;
	return {
		x: Number(x.toFixed(2)),
		y: Number(y.toFixed(2)),
		clipped: clippedX !== pX || clippedZ !== pZ
	};
}

/** Build the display rectangle for MLB's batter-specific top and bottom zone values. */
export function strikeZoneRect(top = 3.5, bottom = 1.5) {
	const plateHalfWidth = 17 / 24;
	const upperLeft = mapPitchToZone(-plateHalfWidth, top);
	const lowerRight = mapPitchToZone(plateHalfWidth, bottom);
	return {
		x: upperLeft.x,
		y: upperLeft.y,
		width: Number((lowerRight.x - upperLeft.x).toFixed(2)),
		height: Number((lowerRight.y - upperLeft.y).toFixed(2))
	};
}

/**
 * Normalize an MLB pitch event into the five visual states used by the UI.
 * @param {{hitData?: object, details?: {description?: string, isInPlay?: boolean, isBall?: boolean, isStrike?: boolean, code?: string, call?: {code?: string, description?: string}}} | undefined} event
 */
export function classifyPitch(event) {
	if (event?.hitData || event?.details?.isInPlay || event?.details?.code === 'X') return 'inplay';
	const code = event?.details?.call?.code ?? event?.details?.code;
	const description = event?.details?.call?.description ?? event?.details?.description ?? '';
	if (code === 'F' || /^foul/i.test(description)) return 'foul';
	if (event?.details?.isBall) return 'ball';
	if (event?.details?.isStrike) return 'strike';
	if (code && ['B', '*B', 'I', 'P', 'V'].includes(code)) return 'ball';
	if (code && ['C', 'S', 'T', 'W', 'M', 'Q'].includes(code)) return 'strike';
	return 'neutral';
}

/**
 * Build the persistent pitch list shown for MLB's current at-bat.
 * Non-pitch events such as mound visits are ignored.
 * @param {{playEvents?: Array<any>} | undefined} play
 */
export function currentAtBatPitches(play) {
	return (play?.playEvents ?? [])
		.filter((event) => event?.isPitch || event?.pitchData)
		.map((event, index) => {
			const type = event.details?.type?.description ?? '';
			const speed =
				event.pitchData?.startSpeed !== undefined
					? `${event.pitchData.startSpeed.toFixed(1)} MPH`
					: '';
			return {
				number: index + 1,
				kind: classifyPitch(event),
				call: event.details?.call?.description ?? event.details?.description ?? 'Pitch',
				detail: [type, speed].filter(Boolean).join(' · ')
			};
		});
}

/** @param {Array<any>} plays Return the newest event carrying batted-ball telemetry. */
export function latestBattedBall(plays = []) {
	for (let playIndex = plays.length - 1; playIndex >= 0; playIndex -= 1) {
		const play = plays[playIndex];
		const events = play?.playEvents ?? [];
		for (let eventIndex = events.length - 1; eventIndex >= 0; eventIndex -= 1) {
			const event = events[eventIndex];
			if (event?.hitData) return { hitData: event.hitData, event, play };
		}
	}
	return null;
}

/**
 * Reset event bookkeeping when the dashboard moves to another game.
 * @param {{mode: 'zone' | 'field', handledContactAtBat: number | null, handledPitchKey: string, gamePk?: number}} state
 * @param {number | undefined} gamePk
 * @returns {{mode: 'zone' | 'field', handledContactAtBat: number | null, handledPitchKey: string, gamePk?: number}}
 */
export function visualizationStateForGame(state, gamePk) {
	if (state.gamePk === gamePk) return state;
	return {
		mode: 'zone',
		handledContactAtBat: null,
		handledPitchKey: '',
		gamePk
	};
}

/**
 * Advance the automatic tracker view without disturbing a manual selection when no new event exists.
 * @param {{mode: 'zone' | 'field', handledContactAtBat: number | null, handledPitchKey: string}} state
 * @param {number | undefined} contactAtBat
 * @param {string} newestPitchKey
 * @returns {{mode: 'zone' | 'field', handledContactAtBat: number | null, handledPitchKey: string}}
 */
export function advanceVisualizationState(state, contactAtBat, newestPitchKey) {
	if (contactAtBat !== undefined && contactAtBat !== state.handledContactAtBat) {
		return {
			mode: 'field',
			handledContactAtBat: contactAtBat,
			handledPitchKey: newestPitchKey
		};
	}
	if (newestPitchKey && newestPitchKey !== state.handledPitchKey) {
		return { ...state, mode: 'zone', handledPitchKey: newestPitchKey };
	}
	return state;
}

/**
 * MLB spray-chart coordinates fit a roughly 250×220 field canvas.
 * @param {number} coordX
 * @param {number} coordY
 */
export function mapHitToField(coordX, coordY) {
	const x = clamp(coordX, 5, 245);
	const y = clamp(coordY, 5, 215);
	return { x, y, clipped: x !== coordX || y !== coordY };
}

export { PITCH_VIEW };
