/**
 * @typedef {{fromAngle:number, toAngle:number, height:number}} HeightZone
 * @typedef {{fromAngle:number, toAngle:number, material:string, color:string}} MaterialZone
 * @typedef {{
 *  grass:string, infieldGrass:string, dirt:string, warningTrack:string,
 *  wall:string, wallCap:string, wallMaterial:string, mowingAngle:number,
 *  mowingWidth:number, defaultWallHeight:number, heightZones:ReadonlyArray<HeightZone>,
 *  materialZones:ReadonlyArray<MaterialZone>, batterEye:Readonly<{fromAngle:number,toAngle:number,color:string}>
 * }} BallparkAppearance
 */

/** @type {Readonly<BallparkAppearance>} */
const DEFAULT_APPEARANCE = Object.freeze({
	grass: '#28613f',
	infieldGrass: '#326b49',
	dirt: '#a97b51',
	warningTrack: '#9a7048',
	wall: '#294c3b',
	wallCap: '#e4d9b8',
	wallMaterial: 'padded',
	mowingAngle: 38,
	mowingWidth: 64,
	defaultWallHeight: 8,
	heightZones: Object.freeze([]),
	materialZones: Object.freeze([]),
	batterEye: Object.freeze({ fromAngle: -5, toAngle: 5, color: '#152c22' })
});

/**
 * Compact rendering palettes and material cues. Colors are sampled/approximated
 * from current park photography; geometry and published heights remain separate.
 */
/** @type {Record<number, Partial<BallparkAppearance>>} */
const PARK_APPEARANCES = {
	1: {
		grass: '#2f7d3b',
		wall: '#184a3b',
		wallCap: '#d8bb35',
		defaultWallHeight: 8,
		heightZones: [
			{ fromAngle: -45, toAngle: -38, height: 5 },
			{ fromAngle: 38, toAngle: 45, height: 5 }
		],
		batterEye: { fromAngle: -7, toAngle: 7, color: '#17332a' }
	},
	2: {
		grass: '#347d3e',
		wall: '#174735',
		wallCap: '#d8bb35',
		warningTrack: '#9a6844',
		heightZones: [
			{ fromAngle: -45, toAngle: -30, height: 8 },
			{ fromAngle: -30, toAngle: -15, height: 6.9167 }
		],
		materialZones: [{ fromAngle: -45, toAngle: -15, material: 'padded', color: '#214d3b' }]
	},
	3: {
		grass: '#2f6b43',
		wall: '#2d633f',
		wallCap: '#f1e5c3',
		defaultWallHeight: 5,
		heightZones: [
			{ fromAngle: -45, toAngle: -17, height: 37 },
			{ fromAngle: -17, toAngle: 8, height: 17 },
			{ fromAngle: 8, toAngle: 45, height: 5 }
		],
		materialZones: [
			{ fromAngle: -45, toAngle: -17, material: 'metal', color: '#356d48' },
			{ fromAngle: 15, toAngle: 45, material: 'padded', color: '#245b3b' }
		],
		batterEye: { fromAngle: -4, toAngle: 4, color: '#183825' }
	},
	4: { wall: '#173b31', wallCap: '#d5d2bf', grass: '#2c6742', defaultWallHeight: 8 },
	5: {
		wall: '#173e31',
		wallCap: '#d9d2b6',
		grass: '#2d6843',
		warningTrack: '#936a47',
		defaultWallHeight: 9,
		heightZones: [{ fromAngle: -45, toAngle: -18, height: 19 }]
	},
	7: {
		wall: '#174b3b',
		wallCap: '#d8bb35',
		grass: '#2d6840',
		warningTrack: '#a9754b',
		defaultWallHeight: 8.5,
		batterEye: { fromAngle: -6, toAngle: 6, color: '#1a3d33' }
	},
	12: {
		grass: '#315f40',
		infieldGrass: '#356448',
		wall: '#173c5a',
		wallCap: '#d8dbe0',
		warningTrack: '#8a705b',
		defaultWallHeight: 11,
		heightZones: [
			{ fromAngle: -45, toAngle: -38, height: 5 },
			{ fromAngle: -7, toAngle: 7, height: 9 }
		],
		mowingWidth: 52
	},
	14: {
		grass: '#2f6742',
		wall: '#174a72',
		wallCap: '#dce4e8',
		warningTrack: '#9a744e',
		heightZones: [
			{ fromAngle: -45, toAngle: -38, height: 14.33 },
			{ fromAngle: -38, toAngle: -23, height: 11.17 },
			{ fromAngle: -23, toAngle: -10, height: 12.75 },
			{ fromAngle: -10, toAngle: 10, height: 8 },
			{ fromAngle: 10, toAngle: 24, height: 10.75 },
			{ fromAngle: 24, toAngle: 38, height: 14.33 },
			{ fromAngle: 38, toAngle: 45, height: 12.58 }
		]
	},
	15: {
		grass: '#2d6944',
		wall: '#214b3b',
		wallCap: '#d6c49a',
		warningTrack: '#9b6846',
		defaultWallHeight: 7.5,
		heightZones: [{ fromAngle: -8, toAngle: 8, height: 25 }]
	},
	17: {
		grass: '#2f6740',
		wall: '#315e3b',
		wallCap: '#e5d6aa',
		warningTrack: '#9d724b',
		wallMaterial: 'ivy',
		defaultWallHeight: 11.5,
		heightZones: [
			{ fromAngle: -45, toAngle: -39, height: 15 },
			{ fromAngle: 39, toAngle: 45, height: 15 }
		],
		materialZones: [{ fromAngle: -45, toAngle: 45, material: 'ivy', color: '#315e3b' }]
	},
	19: {
		grass: '#2f6841',
		wall: '#214c3a',
		wallCap: '#d8bb35',
		warningTrack: '#9a6b47',
		defaultWallHeight: 8,
		heightZones: [{ fromAngle: 28, toAngle: 45, height: 14 }]
	},
	22: {
		grass: '#2f6c46',
		wall: '#1456a0',
		wallCap: '#d8bb35',
		warningTrack: '#9c704d',
		defaultWallHeight: 8,
		batterEye: { fromAngle: -6, toAngle: 6, color: '#183a2d' }
	},
	31: {
		grass: '#2e6842',
		wall: '#1f4a37',
		wallCap: '#f4d35e',
		warningTrack: '#9d7048',
		defaultWallHeight: 8,
		materialZones: [{ fromAngle: 22.5, toAngle: 45, material: 'padded', color: '#234e39' }],
		batterEye: { fromAngle: -5, toAngle: 6, color: '#173526' }
	},
	32: {
		grass: '#2f6842',
		wall: '#173b59',
		wallCap: '#d8bb35',
		warningTrack: '#9a714d',
		defaultWallHeight: 8
	},
	680: {
		grass: '#2b6641',
		wall: '#17483d',
		wallCap: '#d8bb35',
		warningTrack: '#9a704a',
		defaultWallHeight: 8
	},
	2392: {
		grass: '#2f6742',
		wall: '#214b3a',
		wallCap: '#d8c898',
		warningTrack: '#a16c44',
		defaultWallHeight: 8,
		heightZones: [{ fromAngle: -45, toAngle: -17, height: 19 }],
		materialZones: [{ fromAngle: -45, toAngle: -17, material: 'padded', color: '#1e4937' }]
	},
	2394: {
		grass: '#2e6742',
		wall: '#1e4938',
		wallCap: '#d7c99d',
		warningTrack: '#986c48',
		defaultWallHeight: 7
	},
	2395: {
		grass: '#2e6741',
		wall: '#204d3a',
		wallCap: '#e2d2a4',
		warningTrack: '#9a6a46',
		defaultWallHeight: 8,
		heightZones: [
			{ fromAngle: 12, toAngle: 28, height: 20 },
			{ fromAngle: 28, toAngle: 45, height: 24 }
		],
		materialZones: [{ fromAngle: 12, toAngle: 45, material: 'brick', color: '#8a4b38' }]
	},
	2529: {
		grass: '#2d6842',
		wall: '#244c3a',
		wallCap: '#dfd1a8',
		warningTrack: '#9a704b',
		defaultWallHeight: 8
	},
	2602: {
		grass: '#306b43',
		wall: '#1d4937',
		wallCap: '#d8bb35',
		warningTrack: '#a06e48',
		defaultWallHeight: 8,
		heightZones: [{ fromAngle: -45, toAngle: -18, height: 12 }],
		materialZones: [{ fromAngle: -10, toAngle: 10, material: 'padded', color: '#182f29' }]
	},
	2680: {
		grass: '#2d6841',
		wall: '#173f67',
		wallCap: '#d8bb35',
		warningTrack: '#9b714c',
		defaultWallHeight: 8,
		materialZones: [{ fromAngle: -45, toAngle: -24, material: 'brick', color: '#795447' }]
	},
	2681: {
		grass: '#2f7d3a',
		wall: '#0b5b4d',
		wallCap: '#d8bb35',
		warningTrack: '#b86f45',
		defaultWallHeight: 8,
		heightZones: [
			{ fromAngle: -45, toAngle: -16, height: 10.5 },
			{ fromAngle: -16, toAngle: -9, height: 19 },
			{ fromAngle: -9, toAngle: -4, height: 12.67 },
			{ fromAngle: -4, toAngle: 4, height: 6 },
			{ fromAngle: 4, toAngle: 45, height: 13.25 }
		],
		materialZones: [{ fromAngle: -8, toAngle: 8, material: 'padded', color: '#18332c' }]
	},
	2889: {
		grass: '#31813d',
		wall: '#164f3d',
		wallCap: '#d8bb35',
		warningTrack: '#b76a43',
		defaultWallHeight: 8
	},
	3289: {
		grass: '#2d7d3a',
		wall: '#145aa3',
		wallCap: '#e18a2d',
		warningTrack: '#9c704a',
		defaultWallHeight: 8
	},
	3309: {
		grass: '#31813f',
		wall: '#075c4b',
		wallCap: '#d8bb35',
		warningTrack: '#b36b47',
		defaultWallHeight: 8,
		heightZones: [{ fromAngle: 16, toAngle: 45, height: 16 }]
	},
	3312: {
		grass: '#347e3d',
		wall: '#164f3b',
		wallCap: '#d1c9ac',
		warningTrack: '#9a704a',
		defaultWallHeight: 8,
		heightZones: [{ fromAngle: 0, toAngle: 45, height: 23 }],
		materialZones: [{ fromAngle: -45, toAngle: -36, material: 'stone', color: '#b9ad91' }]
	},
	3313: {
		grass: '#2f6740',
		wall: '#16364a',
		wallCap: '#d4d7d6',
		warningTrack: '#9a714c',
		defaultWallHeight: 8.5
	},
	4169: {
		grass: '#2e8545',
		wall: '#173a5b',
		wallCap: '#dde4e1',
		warningTrack: '#947257',
		defaultWallHeight: 11,
		heightZones: [
			{ fromAngle: -45, toAngle: -31, height: 12 },
			{ fromAngle: -31, toAngle: -17, height: 7 },
			{ fromAngle: -17, toAngle: 0, height: 12 },
			{ fromAngle: 0, toAngle: 17, height: 9 },
			{ fromAngle: 17, toAngle: 31, height: 12 },
			{ fromAngle: 31, toAngle: 45, height: 7 }
		],
		mowingAngle: 34,
		mowingWidth: 54
	},
	4705: {
		grass: '#317c3b',
		wall: '#1c3037',
		wallCap: '#d5d7d5',
		warningTrack: '#9d7149',
		defaultWallHeight: 8,
		heightZones: [
			{ fromAngle: -45, toAngle: -28, height: 6 },
			{ fromAngle: 28, toAngle: 45, height: 16 }
		],
		materialZones: [{ fromAngle: 28, toAngle: 45, material: 'brick', color: '#7d493a' }]
	},
	5325: {
		grass: '#2c7f40',
		wall: '#075748',
		wallCap: '#d8bb35',
		warningTrack: '#b46943',
		defaultWallHeight: 8
	}
};

/** @param {Partial<BallparkAppearance> | undefined} value @returns {Readonly<BallparkAppearance>} */
function deepFreezeAppearance(value) {
	const appearance = {
		...DEFAULT_APPEARANCE,
		...value,
		heightZones: Object.freeze([...(value?.heightZones ?? DEFAULT_APPEARANCE.heightZones)]),
		materialZones: Object.freeze([...(value?.materialZones ?? DEFAULT_APPEARANCE.materialZones)]),
		batterEye: Object.freeze({ ...DEFAULT_APPEARANCE.batterEye, ...(value?.batterEye ?? {}) })
	};
	return Object.freeze(appearance);
}

/** @param {number} venueId */
export function ballparkAppearance(venueId) {
	return deepFreezeAppearance(PARK_APPEARANCES[venueId]);
}

/**
 * Published anchor heights win; a supported park zone wins next; the park's
 * restrained fallback is used only where segment-specific data is unavailable.
 * @param {{angle:number, height?:number}} landmark
 * @param {Readonly<BallparkAppearance>} appearance
 * @returns {number}
 */
export function wallHeightAt(landmark, appearance) {
	if (Number.isFinite(landmark.height)) return Number(landmark.height);
	const zone = appearance.heightZones.find(
		(candidate) => landmark.angle >= candidate.fromAngle && landmark.angle <= candidate.toAngle
	);
	return Number(zone?.height ?? appearance.defaultWallHeight);
}

/**
 * @param {number} angle
 * @param {Readonly<BallparkAppearance>} appearance
 * @returns {{material:string, color:string}}
 */
export function wallSurfaceAt(angle, appearance) {
	if (angle >= appearance.batterEye.fromAngle && angle <= appearance.batterEye.toAngle) {
		return { material: 'padded', color: appearance.batterEye.color };
	}
	const zone = appearance.materialZones.find(
		(candidate) => angle >= candidate.fromAngle && angle <= candidate.toAngle
	);
	return {
		material: zone?.material ?? appearance.wallMaterial,
		color: zone?.color ?? appearance.wall
	};
}
