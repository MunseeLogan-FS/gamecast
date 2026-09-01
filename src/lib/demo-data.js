// Recorded MLB telemetry from game 823350, bundled only for the /demo showcase.
const RECORDED_PITCHES = [
	{
		description: 'Ball',
		code: 'B',
		type: 'Sinker',
		isBall: true,
		pitchData: {
			startSpeed: 97.6,
			endSpeed: 89.2,
			plateTime: 0.3858435520978629,
			extension: 6.619942676237709,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			coordinates: {
				aX: -20.341016408856753,
				aY: 32.68391538869408,
				aZ: -21.25848530268876,
				pfxX: -9.969497290631711,
				pfxZ: 5.3494236920080205,
				pX: -0.9084120989574774,
				pZ: 2.7102422230700514,
				vX0: 7.566936771227401,
				vY0: -141.98209480350846,
				vZ0: -3.2463657821582386,
				x0: -2.3136159542175987,
				y0: 50.001496859471104,
				z0: 5.222106224674454
			},
			breaks: { spinRate: 2252, spinDirection: 228 }
		}
	},
	{
		description: 'Called Strike',
		code: 'C',
		type: 'Cutter',
		isBall: false,
		pitchData: {
			startSpeed: 92.5,
			endSpeed: 85.8,
			plateTime: 0.40437741179595577,
			extension: 6.602808997271803,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			coordinates: {
				aX: -0.4536335163863557,
				aY: 25.798925453009954,
				aZ: -26.35759473583725,
				pfxX: -0.2432270738441824,
				pfxZ: 3.1215242963959877,
				pX: -0.5218533363827904,
				pZ: 2.5050988959175524,
				vX0: 5.137609718027386,
				vY0: -134.79194805426116,
				vZ0: -2.145945340336743,
				x0: -2.4107393350536364,
				y0: 50.002862640469,
				z0: 5.1487993553523586
			},
			breaks: { spinRate: 2466, spinDirection: 166 }
		}
	},
	{
		description: 'Called Strike',
		code: 'C',
		type: 'Sinker',
		isBall: false,
		pitchData: {
			startSpeed: 96.5,
			endSpeed: 88.5,
			plateTime: 0.3903262084536041,
			extension: 6.577468086803403,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			coordinates: {
				aX: -22.109648033066993,
				aY: 30.18944093122758,
				aZ: -24.704679804026444,
				pfxX: -11.07458680888162,
				pfxZ: 3.7406229686795687,
				pX: 0.6584683899730703,
				pZ: 2.122138326059218,
				vX0: 11.225651081850367,
				vY0: -140.061486794324,
				vZ0: -3.9964487196558793,
				x0: -1.953186523847177,
				y0: 50.00193137005443,
				z0: 5.173549709297023
			},
			breaks: { spinRate: 2252, spinDirection: 223 }
		}
	},
	{
		description: 'Foul',
		code: 'F',
		type: 'Splitter',
		isBall: false,
		pitchData: {
			startSpeed: 85.5,
			endSpeed: 77.7,
			plateTime: 0.4424390474558413,
			extension: 6.802974878547608,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			coordinates: {
				aX: -7.566316700333985,
				aY: 27.070253177360907,
				aZ: -28.91920653477123,
				pfxX: -4.88559103282718,
				pfxZ: 2.099636162582268,
				pX: 0.6001475127912006,
				pZ: 2.452036357537432,
				vX0: 8.112521141103155,
				vY0: -124.2445906071538,
				vZ0: -0.9359041198666405,
				x0: -2.086497835030299,
				y0: 50.000987704411735,
				z0: 5.257234511153395
			},
			breaks: { spinRate: 763, spinDirection: 294 }
		}
	},
	{
		description: 'Ball',
		code: 'B',
		type: 'Four-Seam Fastball',
		isBall: true,
		pitchData: {
			startSpeed: 96.9,
			endSpeed: 89.0,
			plateTime: 0.3875370160540581,
			extension: 6.518129519459319,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			coordinates: {
				aX: -11.590628237698306,
				aY: 29.86435782547953,
				aZ: -17.62878001906189,
				pfxX: -5.7186517731838995,
				pfxZ: 7.178743811070966,
				pX: 0.015118135992107143,
				pZ: 4.376622060560983,
				vX0: 8.902648420755831,
				vY0: -140.94441043564467,
				vZ0: 0.37507605368303976,
				x0: -2.431010031045087,
				y0: 50.00439201378427,
				z0: 5.373837005333306
			},
			breaks: { spinRate: 2267, spinDirection: 222 }
		}
	},
	{
		description: 'Ball',
		code: 'B',
		type: 'Splitter',
		isBall: true,
		pitchData: {
			startSpeed: 83.4,
			endSpeed: 75.8,
			plateTime: 0.45308590705717977,
			extension: 6.684320732521136,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			coordinates: {
				aX: -10.263459247157721,
				aY: 25.94175487061797,
				aZ: -28.677117263696623,
				pfxX: -6.949630400900935,
				pfxZ: 2.3726995913625952,
				pX: -1.7738538811303164,
				pZ: 2.2780582380702388,
				vX0: 3.877500158203427,
				vY0: -121.34854407882838,
				vZ0: -0.9086116750839709,
				x0: -2.4977124439966127,
				y0: 50.00553892814921,
				z0: 5.177912745203284
			},
			breaks: { spinRate: 867, spinDirection: 279 }
		}
	},
	{
		description: 'Swinging Strike',
		code: 'S',
		type: 'Cutter',
		isBall: false,
		pitchData: {
			startSpeed: 92.9,
			endSpeed: 85.9,
			plateTime: 0.4034105253870006,
			extension: 6.743086417688401,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			coordinates: {
				aX: 0.46439853792828706,
				aY: 26.795127237200152,
				aZ: -26.100617372333236,
				pfxX: 0.24905193024291072,
				pfxZ: 3.244664800928579,
				pX: -0.19943536596862796,
				pZ: 2.8938568230663404,
				vX0: 5.982505758298146,
				vY0: -135.2719738404831,
				vZ0: -1.3219827366730104,
				x0: -2.462968859569437,
				y0: 50.00297702783079,
				z0: 5.2019820766412055
			},
			breaks: { spinRate: 2654, spinDirection: 139 }
		}
	}
];

/** @param {(typeof RECORDED_PITCHES)[number]} recorded @returns {import('./mlb').PitchEvent} */
const pitch = ({ description, code, type, isBall, pitchData }) => ({
	details: {
		call: { code, description },
		description,
		code,
		isInPlay: false,
		isStrike: !isBall,
		isBall,
		type: { description: type }
	},
	pitchData,
	isPitch: true,
	type: 'pitch'
});

/** @type {import('./mlb').Play} */
export const DEMO_CURRENT_PLAY = {
	result: {
		type: 'atBat',
		event: 'Strikeout',
		description: 'Tyler Callihan strikes out swinging.'
	},
	about: { atBatIndex: 108, halfInning: 'bottom', inning: 12, isComplete: true },
	matchup: {
		batter: { id: 682997, fullName: 'Tyler Callihan' },
		pitcher: { id: 672629, fullName: 'Gerardo Carrillo' },
		batSide: { code: 'L', description: 'Left' }
	},
	playEvents: RECORDED_PITCHES.map(pitch),
	atBatIndex: 108
};

/** @type {import('./mlb').Play[]} */
export const DEMO_HIT_HISTORY = [
	{
		result: {
			event: 'Groundout',
			description: 'Nick Gonzales grounds out to third base.',
			awayScore: 8,
			homeScore: 7
		},
		about: { atBatIndex: 106, halfInning: 'bottom', inning: 12, isComplete: true },
		matchup: { batter: { id: 693304, fullName: 'Nick Gonzales' } },
		playEvents: [
			{
				details: { description: 'In play, out(s)', isInPlay: true },
				hitData: {
					launchSpeed: 80.5,
					launchAngle: -45,
					totalDistance: 3,
					trajectory: 'ground_ball',
					hardness: 'medium',
					location: '5',
					coordinates: { coordX: 112.28, coordY: 176.01 }
				}
			}
		],
		atBatIndex: 106
	},
	{
		result: {
			event: 'Double',
			description: "Ke'Bryan Hayes doubles on a line drive to center field."
		},
		about: { atBatIndex: 61, halfInning: 'bottom', inning: 7, isComplete: true },
		matchup: { batter: { id: 663647, fullName: "Ke'Bryan Hayes" } },
		playEvents: [
			{
				details: { description: 'In play, run(s)', isInPlay: true },
				hitData: {
					launchSpeed: 101.2,
					launchAngle: 23,
					totalDistance: 374,
					trajectory: 'line_drive',
					hardness: 'hard',
					location: '8',
					coordinates: { coordX: 125.05, coordY: 49.62 }
				}
			}
		],
		atBatIndex: 61
	}
];
