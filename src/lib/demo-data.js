// Recorded MLB telemetry from game 823350, bundled only for the /demo showcase.
/**
 * @param {string} description
 * @param {string} code
 * @param {string} type
 * @param {number} speed
 * @param {number} pX
 * @param {number} pZ
 * @param {boolean} isBall
 * @returns {import('./mlb').PitchEvent}
 */
const pitch = (description, code, type, speed, pX, pZ, isBall = false) => ({
	details: {
		call: { code, description },
		description,
		code,
		isInPlay: false,
		isStrike: !isBall,
		isBall,
		type: { description: type }
	},
	pitchData: {
		startSpeed: speed,
		strikeZoneTop: 3.168,
		strikeZoneBottom: 1.599,
		coordinates: { pX, pZ }
	},
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
	playEvents: [
		pitch('Ball', 'B', 'Sinker', 97.6, -0.9084, 2.7102, true),
		pitch('Called Strike', 'C', 'Cutter', 92.5, -0.5219, 2.5051),
		pitch('Called Strike', 'C', 'Sinker', 96.5, 0.6585, 2.1221),
		pitch('Foul', 'F', 'Splitter', 85.5, 0.6001, 2.452),
		pitch('Ball', 'B', 'Four-Seam Fastball', 96.9, 0.0151, 4.3766, true),
		pitch('Ball', 'B', 'Splitter', 83.4, -1.7739, 2.2781, true),
		pitch('Swinging Strike', 'S', 'Cutter', 92.9, -0.1994, 2.8939)
	],
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
	}
];
