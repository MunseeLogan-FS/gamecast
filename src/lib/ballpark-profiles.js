import { ballparkAppearance } from './ballpark-appearance.js';

const SHARED_VIEW_BOX = Object.freeze({
	width: 250,
	height: 220,
	home: Object.freeze({ x: 125, y: 210 }),
	scale: 0.48
});

/**
 * @param {{
 *  teamId: number,
 *  venueId: number,
 *  name: string,
 *  dimensions: {leftLine: number, left?: number, leftCenter: number, center: number, rightCenter: number, right?: number, rightLine: number},
 *  wall: Array<{angle: number, distance: number, label?: string, height?: number}>,
 *  sources: string[],
 *  wallHeights?: Record<string, number>,
 *  highlights?: Array<{fromAngle: number, toAngle: number, color: string}>
 * }} input
 */
export function defineBallpark(input) {
	return Object.freeze({
		teamId: input.teamId,
		venueId: input.venueId,
		name: input.name,
		appearance: ballparkAppearance(input.venueId),
		viewBox: SHARED_VIEW_BOX,
		dimensions: Object.freeze(input.dimensions),
		wallHeights: Object.freeze(input.wallHeights ?? {}),
		highlights: Object.freeze(
			(input.highlights ?? []).map((highlight) => Object.freeze(highlight))
		),
		wall: Object.freeze(
			input.wall.map((point) => Object.freeze({ ...point, label: point.label ?? '' }))
		),
		sources: Object.freeze([...input.sources])
	});
}

const STANDARD_WALL_ANGLES = Object.freeze({
	leftLine: -45,
	left: -31,
	leftCenter: -17,
	center: 0,
	rightCenter: 17,
	right: 31,
	rightLine: 45
});

/** @param {Record<string, number>} dimensions */
function standardWall(dimensions) {
	return Object.entries(STANDARD_WALL_ANGLES)
		.filter(([key]) => Number.isFinite(dimensions[key]))
		.map(([key, angle]) => ({ angle, distance: dimensions[key], label: `${dimensions[key]}` }));
}

/**
 * @param {Omit<Parameters<typeof defineBallpark>[0], 'wall' | 'sources'> & {
 *  wall?: Parameters<typeof defineBallpark>[0]['wall'],
 *  sources?: string[]
 * }} input
 */
function defineCurrentBallpark(input) {
	return defineBallpark({
		...input,
		wall: input.wall ?? standardWall(input.dimensions),
		sources: [
			`https://statsapi.mlb.com/api/v1/venues/${input.venueId}?hydrate=fieldInfo`,
			...(input.sources ?? [])
		]
	});
}

/**
 * Current PNC Park dimensions reported by MLB for venue 31. Exact wall bearings
 * are not published; intermediate bearings are rendering assumptions around
 * MLB's six markers and Seamheads' four secondary interpolation samples.
 */
export const PNC_PARK = defineBallpark({
	teamId: 134,
	venueId: 31,
	name: 'PNC Park',
	dimensions: {
		leftLine: 325,
		left: 389,
		leftCenter: 410,
		center: 399,
		rightCenter: 375,
		rightLine: 320
	},
	wallHeights: { left: 6, leftCenter: 10, right: 21 },
	highlights: [{ fromAngle: 22.5, toAngle: 45, color: '#fdb827' }],
	wall: [
		{ angle: -45, distance: 325, label: '325', height: 6 },
		{ angle: -36, distance: 362, height: 6 },
		{ angle: -27, distance: 389, label: '389', height: 6 },
		{ angle: -21, distance: 395, height: 10 },
		{ angle: -15, distance: 410, label: '410', height: 10 },
		{ angle: 0, distance: 399, label: '399', height: 8 },
		{ angle: 12, distance: 395, height: 8 },
		{ angle: 22.5, distance: 375, label: '375', height: 21 },
		{ angle: 34, distance: 350, height: 21 },
		{ angle: 45, distance: 320, label: '320', height: 21 }
	],
	sources: [
		'https://www.mlb.com/pirates/ballpark/facts',
		'https://www.mlb.com/pirates/ballpark/ground-rules',
		'https://www.seamheads.com/ballparks/ballpark.php?parkID=PIT08'
	]
});

const CURRENT_PARK_DATA = [
	{
		teamId: 108,
		venueId: 1,
		name: 'Angel Stadium',
		dimensions: {
			leftLine: 330,
			left: 347,
			leftCenter: 390,
			center: 396,
			rightCenter: 365,
			right: 350,
			rightLine: 330
		},
		wall: [
			{ angle: -45, distance: 330, label: '330' },
			{ angle: -39, distance: 347, label: '347' },
			{ angle: -21, distance: 390, label: '390' },
			{ angle: 0, distance: 396, label: '396' },
			{ angle: 20, distance: 370, label: '370' },
			{ angle: 29, distance: 365, label: '365' },
			{ angle: 39, distance: 350, label: '350' },
			{ angle: 45, distance: 330, label: '330' }
		],
		sources: ['https://en.wikipedia.org/wiki/Angel_Stadium']
	},
	{
		teamId: 110,
		venueId: 2,
		name: 'Oriole Park at Camden Yards',
		dimensions: {
			leftLine: 333,
			left: 363,
			leftCenter: 376,
			center: 410,
			rightCenter: 373,
			rightLine: 318
		},
		highlights: [{ fromAngle: 17, toAngle: 45, color: '#f58220' }],
		sources: ['https://www.mlb.com/news/camden-yards-left-field-wall-dimensions-changing-in-2025']
	},
	{
		teamId: 111,
		venueId: 3,
		name: 'Fenway Park',
		dimensions: {
			leftLine: 310,
			left: 379,
			leftCenter: 390,
			center: 420,
			rightCenter: 380,
			rightLine: 302
		},
		wall: [
			{ angle: -45, distance: 310, label: '310' },
			{ angle: -29, distance: 379, label: '379' },
			{ angle: -14, distance: 390, label: '390' },
			{ angle: -5, distance: 420, label: '420' },
			{ angle: 18, distance: 380, label: '380' },
			{ angle: 32, distance: 350 },
			{ angle: 45, distance: 302, label: '302' }
		],
		highlights: [{ fromAngle: -45, toAngle: -17, color: '#4b9b55' }]
	},
	{
		teamId: 145,
		venueId: 4,
		name: 'Rate Field',
		dimensions: { leftLine: 330, leftCenter: 377, center: 400, rightCenter: 372, rightLine: 335 }
	},
	{
		teamId: 114,
		venueId: 5,
		name: 'Progressive Field',
		dimensions: {
			leftLine: 325,
			left: 370,
			leftCenter: 410,
			center: 405,
			rightCenter: 375,
			rightLine: 325
		},
		wall: [
			{ angle: -45, distance: 325, label: '325' },
			{ angle: -31, distance: 370, label: '370' },
			{ angle: -16, distance: 410, label: '410' },
			{ angle: 0, distance: 405, label: '405' },
			{ angle: 20, distance: 375, label: '375' },
			{ angle: 40, distance: 330 },
			{ angle: 45, distance: 325, label: '325' }
		]
	},
	{
		teamId: 118,
		venueId: 7,
		name: 'Kauffman Stadium',
		dimensions: { leftLine: 330, leftCenter: 379, center: 410, rightCenter: 379, rightLine: 330 },
		sources: ['https://en.wikipedia.org/wiki/Kauffman_Stadium']
	},
	{
		teamId: 139,
		venueId: 12,
		name: 'Tropicana Field',
		dimensions: {
			leftLine: 315,
			left: 370,
			leftCenter: 410,
			center: 404,
			rightCenter: 404,
			right: 370,
			rightLine: 322
		}
	},
	{
		teamId: 141,
		venueId: 14,
		name: 'Rogers Centre',
		dimensions: {
			leftLine: 328,
			left: 368,
			leftCenter: 381,
			center: 400,
			rightCenter: 372,
			right: 359,
			rightLine: 328
		},
		sources: ['https://www.mlb.com/news/rogers-centre-s-new-outfield-dimensions-announced']
	},
	{
		teamId: 109,
		venueId: 15,
		name: 'Chase Field',
		dimensions: {
			leftLine: 330,
			left: 376,
			leftCenter: 412,
			center: 407,
			rightCenter: 414,
			right: 376,
			rightLine: 335
		},
		sources: ['https://www.mlb.com/dbacks/ballpark/information/facts-figures']
	},
	{
		teamId: 112,
		venueId: 17,
		name: 'Wrigley Field',
		dimensions: { leftLine: 355, leftCenter: 368, center: 400, rightCenter: 368, rightLine: 353 }
	},
	{
		teamId: 115,
		venueId: 19,
		name: 'Coors Field',
		dimensions: {
			leftLine: 347,
			left: 390,
			leftCenter: 420,
			center: 415,
			rightCenter: 424,
			right: 375,
			rightLine: 350
		}
	},
	{
		teamId: 119,
		venueId: 22,
		name: 'UNIQLO Field at Dodger Stadium',
		dimensions: { leftLine: 330, leftCenter: 375, center: 400, rightCenter: 375, rightLine: 330 },
		wall: [
			{ angle: -45, distance: 330, label: '330' },
			{ angle: -32, distance: 360 },
			{ angle: -21, distance: 375, label: '375' },
			{ angle: -3, distance: 395, label: '395' },
			{ angle: 0, distance: 400, label: '400' },
			{ angle: 3, distance: 395 },
			{ angle: 21, distance: 375, label: '375' },
			{ angle: 32, distance: 360 },
			{ angle: 45, distance: 330, label: '330' }
		],
		sources: ['https://en.wikipedia.org/wiki/Dodger_Stadium']
	},
	{
		teamId: 158,
		venueId: 32,
		name: 'American Family Field',
		dimensions: { leftLine: 344, leftCenter: 371, center: 400, rightCenter: 374, rightLine: 345 }
	},
	{
		teamId: 136,
		venueId: 680,
		name: 'T-Mobile Park',
		dimensions: { leftLine: 331, leftCenter: 378, center: 401, rightCenter: 381, rightLine: 326 },
		sources: ['https://www.mlb.com/news/mariners-moving-in-fences-at-safeco-field/c-39287602']
	},
	{
		teamId: 117,
		venueId: 2392,
		name: 'Daikin Park',
		dimensions: { leftLine: 315, leftCenter: 399, center: 409, rightCenter: 408, rightLine: 326 },
		wall: [
			{ angle: -45, distance: 315, label: '315' },
			{ angle: -29, distance: 366, label: '366' },
			{ angle: -15, distance: 399, label: '399' },
			{ angle: 0, distance: 409, label: '409' },
			{ angle: 15, distance: 408, label: '408' },
			{ angle: 29, distance: 370, label: '370' },
			{ angle: 45, distance: 326, label: '326' }
		],
		highlights: [{ fromAngle: -45, toAngle: -17, color: '#c4512c' }]
	},
	{
		teamId: 116,
		venueId: 2394,
		name: 'Comerica Park',
		dimensions: { leftLine: 342, leftCenter: 370, center: 412, rightCenter: 365, rightLine: 330 },
		sources: ['https://www.mlb.com/news/tigers-changing-outfield-dimensions-at-comerica-park']
	},
	{
		teamId: 137,
		venueId: 2395,
		name: 'Oracle Park',
		dimensions: { leftLine: 339, leftCenter: 399, center: 391, rightCenter: 415, rightLine: 309 },
		wall: [
			{ angle: -45, distance: 339, label: '339' },
			{ angle: -34, distance: 354 },
			{ angle: -20, distance: 399, label: '399' },
			{ angle: 0, distance: 391, label: '391' },
			{ angle: 5, distance: 391 },
			{ angle: 18, distance: 415, label: '415' },
			{ angle: 31, distance: 365 },
			{ angle: 45, distance: 309, label: '309' }
		],
		highlights: [{ fromAngle: 17, toAngle: 45, color: '#d46a33' }]
	},
	{
		teamId: 133,
		venueId: 2529,
		name: 'Sutter Health Park',
		dimensions: { leftLine: 330, leftCenter: 380, center: 403, rightCenter: 380, rightLine: 325 },
		sources: [
			'https://www.mlb.com/athletics/news/how-sutter-health-park-might-play-for-a-s-mlb-hitters'
		]
	},
	{
		teamId: 113,
		venueId: 2602,
		name: 'Great American Ball Park',
		dimensions: { leftLine: 328, leftCenter: 379, center: 404, rightCenter: 370, rightLine: 325 }
	},
	{
		teamId: 135,
		venueId: 2680,
		name: 'Petco Park',
		dimensions: {
			leftLine: 336,
			left: 357,
			leftCenter: 386,
			center: 396,
			rightCenter: 391,
			right: 382,
			rightLine: 322
		},
		wall: [
			{ angle: -45, distance: 336, label: '336' },
			{ angle: -36, distance: 343 },
			{ angle: -27, distance: 357, label: '357' },
			{ angle: -18, distance: 386, label: '386' },
			{ angle: 0, distance: 396, label: '396' },
			{ angle: 19, distance: 391, label: '391' },
			{ angle: 34, distance: 382 },
			{ angle: 45, distance: 322, label: '322' }
		],
		sources: ['https://en.wikipedia.org/wiki/Petco_Park']
	},
	{
		teamId: 143,
		venueId: 2681,
		name: 'Citizens Bank Park',
		dimensions: {
			leftLine: 329,
			left: 369,
			leftCenter: 381,
			center: 401,
			rightCenter: 398,
			right: 369,
			rightLine: 330
		},
		wall: [
			{ angle: -45, distance: 329, label: '329' },
			{ angle: -32, distance: 369, label: '369' },
			{ angle: -24, distance: 374, label: '374' },
			{ angle: -14, distance: 387, label: '387' },
			{ angle: -10, distance: 381, label: '381' },
			{ angle: -6, distance: 409, label: '409' },
			{ angle: 0, distance: 401, label: '401' },
			{ angle: 13, distance: 398, label: '398' },
			{ angle: 24, distance: 369, label: '369' },
			{ angle: 45, distance: 330, label: '330' }
		],
		sources: ['https://www.mlb.com/phillies/ballpark/information/facts-and-figures']
	},
	{
		teamId: 138,
		venueId: 2889,
		name: 'Busch Stadium',
		dimensions: { leftLine: 336, leftCenter: 375, center: 400, rightCenter: 375, rightLine: 335 }
	},
	{
		teamId: 121,
		venueId: 3289,
		name: 'Citi Field',
		dimensions: {
			leftLine: 335,
			left: 358,
			leftCenter: 385,
			center: 408,
			rightCenter: 375,
			right: 370,
			rightLine: 330
		},
		wall: [
			{ angle: -45, distance: 335, label: '335' },
			{ angle: -33, distance: 358, label: '358' },
			{ angle: -20, distance: 385, label: '385' },
			{ angle: 0, distance: 408, label: '408' },
			{ angle: 14, distance: 398, label: '398' },
			{ angle: 27, distance: 375, label: '375' },
			{ angle: 45, distance: 330, label: '330' }
		],
		sources: ['https://en.wikipedia.org/wiki/Citi_Field']
	},
	{
		teamId: 120,
		venueId: 3309,
		name: 'Nationals Park',
		dimensions: { leftLine: 336, leftCenter: 377, center: 402, rightCenter: 370, rightLine: 335 }
	},
	{
		teamId: 142,
		venueId: 3312,
		name: 'Target Field',
		dimensions: { leftLine: 339, leftCenter: 377, center: 404, rightCenter: 367, rightLine: 328 },
		wall: [
			{ angle: -45, distance: 339, label: '339' },
			{ angle: -22, distance: 377, label: '377' },
			{ angle: -8, distance: 411, label: '411' },
			{ angle: 7, distance: 403, label: '403' },
			{ angle: 22, distance: 367, label: '367' },
			{ angle: 45, distance: 328, label: '328' }
		],
		sources: ['https://en.wikipedia.org/wiki/Target_Field']
	},
	{
		teamId: 147,
		venueId: 3313,
		name: 'Yankee Stadium',
		dimensions: { leftLine: 318, leftCenter: 399, center: 408, rightCenter: 385, rightLine: 314 }
	},
	{
		teamId: 146,
		venueId: 4169,
		name: 'loanDepot park',
		dimensions: { leftLine: 344, leftCenter: 386, center: 400, rightCenter: 387, rightLine: 335 },
		sources: [
			'https://ballparkdigest.com/2019/12/04/2020-marlins-park-changes-shorter-dimensions-synthetic-turf/'
		]
	},
	{
		teamId: 144,
		venueId: 4705,
		name: 'Truist Park',
		dimensions: {
			leftLine: 335,
			left: 375,
			leftCenter: 385,
			center: 400,
			rightCenter: 375,
			rightLine: 325
		}
	},
	{
		teamId: 140,
		venueId: 5325,
		name: 'Globe Life Field',
		dimensions: {
			leftLine: 329,
			left: 334,
			leftCenter: 372,
			center: 407,
			rightCenter: 374,
			rightLine: 326
		},
		wall: [
			{ angle: -45, distance: 329, label: '329' },
			{ angle: -38, distance: 334, label: '334' },
			{ angle: -22, distance: 372, label: '372' },
			{ angle: -7, distance: 410, label: '410' },
			{ angle: 0, distance: 407, label: '407' },
			{ angle: 7, distance: 410, label: '410' },
			{ angle: 22, distance: 374, label: '374' },
			{ angle: 45, distance: 326, label: '326' }
		],
		sources: ['https://www.mlb.com/rangers/ballpark/facts-figures']
	}
];

export const BALLPARK_PROFILES = Object.freeze(
	[PNC_PARK, ...CURRENT_PARK_DATA.map(defineCurrentBallpark)].sort(
		(left, right) => left.venueId - right.venueId
	)
);
