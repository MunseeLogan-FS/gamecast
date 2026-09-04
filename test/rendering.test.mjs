import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let render;
let GameVisualization;
let LiveDashboard;
let PitchTrajectory;
let ThreePitchTrajectory;
let ThreeHitFlight;
let PNC_PARK;
let DEMO_CURRENT_PLAY;
let DEMO_HIT_HISTORY;

before(async () => {
	vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
	({ render } = await vite.ssrLoadModule('svelte/server'));
	({ default: GameVisualization } = await vite.ssrLoadModule('/src/lib/GameVisualization.svelte'));
	({ default: LiveDashboard } = await vite.ssrLoadModule(
		'/src/lib/components/LiveDashboard.svelte'
	));
	({ default: PitchTrajectory } = await vite.ssrLoadModule(
		'/src/lib/components/PitchTrajectory.svelte'
	));
	({ default: ThreePitchTrajectory } = await vite.ssrLoadModule(
		'/src/lib/components/ThreePitchTrajectory.svelte'
	));
	({ default: ThreeHitFlight } = await vite.ssrLoadModule(
		'/src/lib/components/ThreeHitFlight.svelte'
	));
	({ PNC_PARK } = await vite.ssrLoadModule('/src/lib/field-geometry.js'));
	({ DEMO_CURRENT_PLAY, DEMO_HIT_HISTORY } = await vite.ssrLoadModule('/src/lib/demo-data.js'));
});

after(async () => {
	await vite?.close();
});

function renderContact(venueId, hitHistory = DEMO_HIT_HISTORY) {
	return render(GameVisualization, {
		props: {
			currentPlay: DEMO_CURRENT_PLAY,
			hitHistory,
			venueId,
			initialMode: 'field'
		}
	}).body;
}

test('renders a current ballpark profile and the unknown-venue fallback', () => {
	const pnc = renderContact(31);
	const fallback = renderContact(9999);
	assert.match(pnc, /PNC Park/);
	assert.match(pnc, /Current field dimensions/);
	assert.match(fallback, /aria-label="Batted-ball location"/);
	assert.doesNotMatch(fallback, /Current field dimensions/);
});

test('renders an inning break while preserving the completed at-bat', () => {
	const game = {
		gamePk: 123,
		gameDate: '2026-09-04T23:05:00Z',
		status: { abstractGameState: 'Live', detailedState: 'In Progress' },
		teams: {
			away: { team: { id: 112, name: 'Chicago Cubs', abbreviation: 'CHC' }, score: 2 },
			home: { team: { id: 134, name: 'Pittsburgh Pirates', abbreviation: 'PIT' }, score: 3 }
		}
	};
	const feed = {
		gamePk: 123,
		gameData: {
			status: game.status,
			teams: { away: game.teams.away.team, home: game.teams.home.team }
		},
		liveData: {
			linescore: {
				currentInning: 7,
				currentInningOrdinal: '7th',
				inningState: 'Middle',
				teams: { away: { runs: 2 }, home: { runs: 3 } }
			},
			plays: { allPlays: [DEMO_CURRENT_PLAY], currentPlay: DEMO_CURRENT_PLAY }
		}
	};
	const body = render(LiveDashboard, {
		props: {
			game,
			feed,
			boxscore: null,
			visualizationPlay: DEMO_CURRENT_PLAY,
			hitHistory: DEMO_HIT_HISTORY,
			highlights: [],
			feedLoading: false,
			onRefresh: () => {}
		}
	}).body;
	assert.match(body, /class="inning-break [^"]*"/);
	assert.match(body, /Middle of the 7th/);
	assert.match(body, /Pittsburgh Pirates coming to bat/);
	assert.match(body, /Last at bat/);
	assert.match(body, /At-bat pitches/);
	assert.doesNotMatch(body, /class="count-board/);
});

test('renders a projected Three.js flight over the selected custom ballpark', () => {
	const contact = DEMO_HIT_HISTORY.at(-1);
	const hitEvent = contact.playEvents.findLast((event) => event.hitData);
	const body = render(ThreeHitFlight, {
		props: {
			profile: PNC_PARK,
			hitData: hitEvent.hitData,
			description: contact.result.description,
			resultEvent: contact.result.event,
			resultEventType: contact.result.eventType
		}
	}).body;
	assert.match(body, /aria-label="Projected batted-ball flight at PNC Park/);
	assert.match(body, /data-flight-kind="flight"/);
	assert.match(body, />Projected flight</);
	assert.match(body, />Hit</);
	assert.match(body, />PNC Park</);
	assert.match(body, /Replay flight/);
});

test('keeps the custom field but draws no false route while destination data is pending', () => {
	const body = render(ThreeHitFlight, {
		props: { profile: PNC_PARK, hitData: { trajectory: 'fly_ball' }, description: '' }
	}).body;
	assert.match(body, /data-flight-kind="unavailable"/);
	assert.match(body, />PNC Park</);
	assert.match(body, /Tracking batted ball/);
	assert.doesNotMatch(body, /Replay flight/);
});

test('unknown-venue fallback rejects null batted-ball coordinates', () => {
	const malformedHistory = structuredClone(DEMO_HIT_HISTORY);
	const latestEvent = malformedHistory.at(-1).playEvents.findLast((event) => event.hitData);
	latestEvent.hitData.coordinates = { coordX: null, coordY: null };
	const fallback = renderContact(9999, malformedHistory);
	assert.match(fallback, /No tracked ball in play yet/);
	assert.doesNotMatch(fallback, /aria-label="Batted-ball location"/);
});

test('renders a catcher-facing recorded trajectory with an accessible numbered endpoint', () => {
	const pitch = {
		isPitch: true,
		details: {
			type: { description: 'Cutter' },
			call: { code: 'C', description: 'Called Strike' },
			isStrike: true
		},
		pitchData: {
			startSpeed: 92.5,
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
		}
	};
	const body = render(PitchTrajectory, {
		props: {
			pitches: [pitch],
			atBatIndex: 108,
			strikeZoneTop: 3.168,
			strikeZoneBottom: 1.599,
			batSide: { code: 'L', description: 'Left' }
		}
	}).body;
	assert.match(body, /aria-label="Pitch 1: Cutter, 92\.5 MPH, Called Strike/);
	assert.match(body, /class="trajectory-path selected/);
	assert.match(body, /data-trajectory-kind="trajectory"/);
	assert.match(body, /type="button" class="pitch-selector [^"]*selected/);
	assert.match(body, /aria-pressed="true"/);
	assert.match(body, /class="selected-pitch-detail [^"]*"/);
	assert.match(body, /role="group" aria-label="Select a pitch to replay"/);
	assert.match(body, />LHB</);
});

test('renders malformed optional pitch speed without throwing or inventing a velocity', () => {
	const body = render(PitchTrajectory, {
		props: {
			pitches: [
				{
					isPitch: true,
					details: { type: { description: 'Cutter' }, call: { description: 'Ball' } },
					pitchData: { startSpeed: null, coordinates: { pX: 0, pZ: 2.5 } }
				}
			]
		}
	}).body;
	assert.match(body, /Pitch 1: Cutter, Ball/);
	assert.match(body, /0\.00 feet center/);
	assert.doesNotMatch(body, /MPH/);
});

test('labels the Three.js catcher view with the selected pitch number', () => {
	const pitch = DEMO_CURRENT_PLAY.playEvents.at(-1);
	const body = render(ThreePitchTrajectory, {
		props: {
			pitch,
			pitchNumber: 7,
			strikeZoneTop: Number.NaN,
			strikeZoneBottom: Number.POSITIVE_INFINITY
		}
	}).body;
	assert.match(
		body,
		/aria-label="Pitch 7: Cutter trajectory from a three-dimensional catcher view/
	);
	assert.match(body, /data-flight-state="playing"/);
	assert.match(body, /Replay flight/);
	assert.doesNotMatch(body, /NaN|Infinity/);
});

test('runs each Three.js flight once and restarts only from Replay', () => {
	const source = readFileSync(
		new URL('../src/lib/components/ThreePitchTrajectory.svelte', import.meta.url),
		'utf8'
	);
	assert.doesNotMatch(source, /%\s*2250/);
	assert.match(source, /animationFrame = shouldContinue \? requestAnimationFrame\(render\) : 0/);
	assert.match(source, /restartAnimation\?\.\(\)/);
});

test('marks a recorded ball in dirt for the Three.js ground-impact treatment', () => {
	const pitch = structuredClone(DEMO_CURRENT_PLAY.playEvents.at(-1));
	pitch.details.call.description = 'Ball In Dirt';
	const body = render(ThreePitchTrajectory, { props: { pitch, pitchNumber: 7 } }).body;
	assert.match(body, /data-landing="dirt"/);
	assert.match(body, /92\.9 MPH · Ball In Dirt/);
});

test('uses finite strike-zone defaults when optional zone bounds are malformed', () => {
	const body = render(PitchTrajectory, {
		props: {
			pitches: [{ isPitch: true, pitchData: { coordinates: { pX: 0, pZ: 2.5 } } }],
			strikeZoneTop: Number.NaN,
			strikeZoneBottom: Number.POSITIVE_INFINITY
		}
	}).body;
	assert.doesNotMatch(body, /NaN|Infinity/);
});

test('uses the trajectory replay for all seven pitches in the recorded Zone showcase', () => {
	const body = render(GameVisualization, {
		props: {
			currentPlay: DEMO_CURRENT_PLAY,
			hitHistory: DEMO_HIT_HISTORY,
			gamePk: 823350,
			initialMode: 'zone'
		}
	}).body;
	assert.match(body, /data-trajectory-kind="trajectory"/);
	assert.match(body, /three-dimensional catcher view behind home plate/);
	assert.equal((body.match(/<button type="button" class="pitch-selector/g) ?? []).length, 7);
	assert.match(body, /Pitch 7: Cutter, 92\.9 MPH, Swinging Strike/);
});
