import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_CURRENT_PLAY, DEMO_HIT_HISTORY } from '../src/lib/demo-data.js';
import {
	BALLPARK_PROFILES,
	PNC_PARK,
	estimateHitLocation,
	fieldPointToSvg,
	fieldProfileForVenue,
	hitLocationAriaLabel,
	mlbHitCoordinatesToFeet,
	wallDistanceAtAngle
} from '../src/lib/field-geometry.js';

const CURRENT_MLB_VENUE_IDS = [
	1, 2, 3, 4, 5, 7, 12, 14, 15, 17, 19, 22, 31, 32, 680, 2392, 2394, 2395, 2529, 2602, 2680, 2681,
	2889, 3289, 3309, 3312, 3313, 4169, 4705, 5325
];
import {
	AT_BAT_REFRESH_MS,
	BETWEEN_AT_BATS_REFRESH_MS,
	BETWEEN_INNINGS_REFRESH_MS,
	liveRefreshDelay
} from '../src/lib/mlb.ts';
import {
	advanceVisualizationState,
	buildCurrentVisualizationUrl,
	buildHitHistoryUrl,
	classifyPitch,
	latestBattedBall,
	mapHitToField,
	mapPitchToZone,
	strikeZoneRect,
	visualizationStateForGame
} from '../src/lib/visualization.js';

test('mobile demo score keeps each team abbreviation grouped with its score', () => {
	const source = readFileSync(new URL('../src/routes/demo/+page.svelte', import.meta.url), 'utf8');
	assert.match(source, /class="score-team away"/);
	assert.match(source, /class="score-team home"/);
});

test('main gamecast exposes B/S/O only during live play', () => {
	const source = readFileSync(
		new URL('../src/lib/components/LiveDashboard.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /\{#if isLive\(status\)\}\s*<div\s+class="count-board"/);
	assert.match(source, /Math\.min\(linescore\?\.outs \?\? 0, 2\)/);
});

test('live lineup follows and highlights the active batter', () => {
	const dashboard = readFileSync(
		new URL('../src/lib/components/LiveDashboard.svelte', import.meta.url),
		'utf8'
	);
	const lineup = readFileSync(
		new URL('../src/lib/components/LineupPanel.svelte', import.meta.url),
		'utf8'
	);

	assert.match(dashboard, /const activeBatterId = \$derived/);
	assert.match(dashboard, /<LineupPanel \{boxscore\} \{away\} \{home\} \{activeBatterId\} \/>/);
	assert.match(lineup, /activeBatterId\?: number/);
	assert.match(lineup, /class:at-bat=\{entry\.player\.person\.id === activeBatterId\}/);
	assert.match(lineup, /aria-current=\{entry\.player\.person\.id === activeBatterId/);
	assert.match(lineup, /activeBatterId !== followedBatterId/);
});

test('cross-route links force a document reload across deployments', () => {
	const home = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
	const demo = readFileSync(new URL('../src/routes/demo/+page.svelte', import.meta.url), 'utf8');
	assert.match(home, /href=\{resolve\('\/demo'\)\} data-sveltekit-reload/);
	assert.equal((demo.match(/href=\{resolve\('\/'\)\} data-sveltekit-reload/g) ?? []).length, 3);
});

test('both footers list Gage Asing as the first fan', () => {
	const routes = [
		readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8'),
		readFileSync(new URL('../src/routes/demo/+page.svelte', import.meta.url), 'utf8')
	];

	for (const source of routes) {
		assert.match(source, /<section class="fan-section" aria-label="Fans">/);
		assert.match(source, /<li><span>01<\/span><strong>Gage Asing<\/strong><\/li>/);
		assert.equal((source.match(/Gage Asing/g) ?? []).length, 1);
	}
});

test('game times render in the viewer local timezone', () => {
	const source = [
		readFileSync(new URL('../src/lib/components/GameScoreboard.svelte', import.meta.url), 'utf8'),
		readFileSync(new URL('../src/lib/components/OffDayView.svelte', import.meta.url), 'utf8')
	].join('\n');
	assert.doesNotMatch(source, /timeZone:\s*'America\/New_York'/);
	assert.match(source, /Intl\.DateTimeFormat\(\)\.resolvedOptions\(\)\.timeZone/);
	assert.match(source, /timeZoneName:\s*'short'/);
});

test('turns a boxscore team into ordered hitters followed by pitchers', async () => {
	const mlb = await import('../src/lib/mlb.ts');
	assert.equal(typeof mlb.lineupForTeam, 'function');

	const team = {
		batters: [2, 1, 3],
		pitchers: [9],
		players: {
			ID1: {
				person: { id: 1, fullName: 'Second Hitter' },
				position: { abbreviation: '2B' },
				battingOrder: '200',
				stats: { batting: { hits: 1, atBats: 4 } }
			},
			ID2: {
				person: { id: 2, fullName: 'First Hitter' },
				position: { abbreviation: 'CF' },
				battingOrder: '100',
				stats: { batting: { hits: 2, atBats: 4 } }
			},
			ID3: {
				person: { id: 3, fullName: 'Bench Player' },
				position: { abbreviation: 'LF' },
				stats: { batting: {} }
			},
			ID9: {
				person: { id: 9, fullName: 'Starting Pitcher' },
				position: { abbreviation: 'P' },
				stats: { pitching: { inningsPitched: '6.0', strikeOuts: 7 } }
			}
		}
	};

	const entries = mlb.lineupForTeam(team);
	assert.deepEqual(
		entries.map((entry) => [entry.kind, entry.order, entry.player.person.fullName]),
		[
			['batter', 1, 'First Hitter'],
			['batter', 2, 'Second Hitter'],
			['pitcher', null, 'Starting Pitcher']
		]
	);
});

test('builds role-specific game stat rows for the player modal', async () => {
	const mlb = await import('../src/lib/mlb.ts');
	assert.equal(typeof mlb.playerGameStats, 'function');
	const hitter = {
		person: { id: 1, fullName: 'Hitter' },
		stats: { batting: { hits: 2, atBats: 4, runs: 1, rbi: 3, baseOnBalls: 1, strikeOuts: 0 } }
	};
	const pitcher = {
		person: { id: 2, fullName: 'Pitcher' },
		stats: {
			pitching: {
				inningsPitched: '6.0',
				hits: 4,
				earnedRuns: 1,
				baseOnBalls: 2,
				strikeOuts: 8,
				numberOfPitches: 92
			}
		}
	};
	assert.deepEqual(mlb.playerGameStats(hitter, 'batter').slice(0, 3), [
		{ label: 'H–AB', value: '2–4' },
		{ label: 'R', value: '1' },
		{ label: 'RBI', value: '3' }
	]);
	assert.deepEqual(mlb.playerGameStats(pitcher, 'pitcher').slice(0, 3), [
		{ label: 'IP', value: '6.0' },
		{ label: 'H', value: '4' },
		{ label: 'ER', value: '1' }
	]);
});

test('builds preview season stat rows and compact lineup summaries', async () => {
	const mlb = await import('../src/lib/mlb.ts');
	assert.equal(typeof mlb.playerSeasonStats, 'function');
	assert.equal(typeof mlb.playerSeasonSummary, 'function');

	const hitter = {
		id: 1,
		fullName: 'Preview Hitter',
		stats: [
			{
				group: { displayName: 'hitting' },
				splits: [
					{
						stat: {
							avg: '.281',
							obp: '.360',
							slg: '.462',
							ops: '.822',
							homeRuns: 17,
							rbi: 58,
							stolenBases: 8,
							plateAppearances: 402
						}
					}
				]
			}
		]
	};
	const pitcher = {
		id: 2,
		fullName: 'Preview Pitcher',
		pitchHand: { code: 'R', description: 'Right' },
		stats: [
			{
				group: { displayName: 'pitching' },
				splits: [
					{
						stat: {
							wins: 7,
							losses: 5,
							era: '3.42',
							whip: '1.19',
							inningsPitched: '108.0',
							strikeOuts: 108,
							baseOnBalls: 31,
							gamesStarted: 19
						}
					}
				]
			}
		]
	};

	assert.equal(mlb.playerSeasonSummary(hitter, 'batter'), '.281 AVG · .822 OPS · 17 HR');
	assert.equal(mlb.playerSeasonSummary(pitcher, 'pitcher'), '3.42 ERA · 1.19 WHIP · 108 K');
	assert.deepEqual(mlb.playerSeasonStats(pitcher, 'pitcher').slice(0, 4), [
		{ label: 'Record', value: '7–5' },
		{ label: 'ERA', value: '3.42' },
		{ label: 'WHIP', value: '1.19' },
		{ label: 'IP', value: '108.0' }
	]);
});

test('requests preview profiles only for probable starters and posted lineups', async () => {
	const mlb = await import('../src/lib/mlb.ts');
	assert.equal(typeof mlb.previewProfileIds, 'function');
	assert.equal(typeof mlb.buildSeasonProfilesUrl, 'function');

	const feed = {
		gameData: {
			probablePitchers: {
				away: { id: 9, fullName: 'Away Starter' },
				home: { id: 10, fullName: 'Home Starter' }
			}
		}
	};
	const boxscore = {
		teams: {
			away: { batters: [1, 2, 9] },
			home: { batters: [3, 4, 10] }
		}
	};
	assert.deepEqual(mlb.previewProfileIds(feed, boxscore), [9, 10, 1, 2, 3, 4]);

	const url = new URL(mlb.buildSeasonProfilesUrl('https://example.test/api', [9, 10, 9], 2026));
	assert.equal(url.pathname, '/api/v1/people');
	assert.equal(url.searchParams.get('personIds'), '9,10');
	assert.match(url.searchParams.get('hydrate') ?? '', /group=\[hitting,pitching\]/);
	assert.match(url.searchParams.get('hydrate') ?? '', /season=2026/);
});

test('preview replaces rather than empties the live dashboard', () => {
	const home = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
	assert.match(home, /import GamePreview from '\$lib\/components\/GamePreview\.svelte'/);
	assert.match(home, /\{#if isPreview\(status\)\}\s*<GamePreview/);

	const preview = readFileSync(
		new URL('../src/lib/components/GamePreview.svelte', import.meta.url),
		'utf8'
	);
	assert.match(preview, /Probable starters/i);
	assert.match(preview, /Game details/i);
	assert.match(preview, /Starting lineups/i);
	assert.match(preview, /Live tracking and play-by-play begin at first pitch/i);
	assert.doesNotMatch(preview, /GameVisualization|class="play-panel"/);
});

test('route delegates large live regions to state-driven components', () => {
	const home = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
	assert.match(home, /import GameScoreboard from '\$lib\/components\/GameScoreboard\.svelte'/);
	assert.match(home, /import LiveDashboard from '\$lib\/components\/LiveDashboard\.svelte'/);
	assert.match(home, /import OffDayView from '\$lib\/components\/OffDayView\.svelte'/);
	assert.match(home, /<GameScoreboard/);
	assert.match(home, /<LiveDashboard/);
	assert.match(home, /<OffDayView/);
	assert.doesNotMatch(home, /class="scoreboard"|class="game-dashboard"|class="play-panel"/);

	const scoreboard = readFileSync(
		new URL('../src/lib/components/GameScoreboard.svelte', import.meta.url),
		'utf8'
	);
	const dashboard = readFileSync(
		new URL('../src/lib/components/LiveDashboard.svelte', import.meta.url),
		'utf8'
	);
	assert.match(scoreboard, /aria-label="Game score"/);
	assert.match(dashboard, /GameVisualization/);
	assert.match(dashboard, /LineupPanel/);
	assert.match(dashboard, /Play-by-play/);
});

test('showcase fixture contains recorded pitch and contact tracking', () => {
	const locatedPitches = DEMO_CURRENT_PLAY.playEvents.filter(
		(event) =>
			event.pitchData?.coordinates?.pX !== undefined &&
			event.pitchData?.coordinates?.pZ !== undefined
	);
	assert.equal(locatedPitches.length, 7);
	assert.equal(DEMO_HIT_HISTORY[0].playEvents[0].hitData.coordinates.coordX, 112.28);
	assert.equal(latestBattedBall(DEMO_HIT_HISTORY)?.hitData.coordinates.coordX, 209.18);
	assert.match(latestBattedBall(DEMO_HIT_HISTORY)?.play.result.description, /foul territory/);
	assert.equal(DEMO_CURRENT_PLAY.matchup.batSide.code, 'L');
});

test('paces live refreshes around the natural game rhythm', () => {
	const activePlay = { about: { isComplete: false } };
	const completePlay = { about: { isComplete: true } };
	assert.equal(AT_BAT_REFRESH_MS, 15_000);
	assert.equal(BETWEEN_AT_BATS_REFRESH_MS, 30_000);
	assert.equal(BETWEEN_INNINGS_REFRESH_MS, 60_000);
	assert.equal(liveRefreshDelay({ inningState: 'Top' }, activePlay), AT_BAT_REFRESH_MS);
	assert.equal(liveRefreshDelay({ inningState: 'Top' }, completePlay), BETWEEN_AT_BATS_REFRESH_MS);
	assert.equal(liveRefreshDelay({ inningState: 'Middle' }, activePlay), BETWEEN_INNINGS_REFRESH_MS);
	assert.equal(liveRefreshDelay({ inningState: 'End' }, completePlay), BETWEEN_INNINGS_REFRESH_MS);
});

test('tracking view follows contact, waits between batters, then returns for the next pitch', () => {
	let state = { mode: 'zone', handledContactAtBat: null, handledPitchKey: '41:3' };
	state = advanceVisualizationState(state, 41, '41:3');
	assert.deepEqual(state, {
		mode: 'field',
		handledContactAtBat: 41,
		handledPitchKey: '41:3'
	});
	assert.equal(advanceVisualizationState(state, undefined, ''), state);
	state = advanceVisualizationState(state, undefined, '42:1');
	assert.equal(state.mode, 'zone');
	assert.equal(state.handledPitchKey, '42:1');

	const source = readFileSync(
		new URL('../src/lib/components/PitchTrajectory.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /class="bat-side"/);
});

test('tracking state resets when the selected game changes', () => {
	const state = {
		mode: 'field',
		handledContactAtBat: 41,
		handledPitchKey: '41:3',
		gamePk: 100
	};
	assert.equal(visualizationStateForGame(state, 100), state);
	assert.deepEqual(visualizationStateForGame(state, 101), {
		mode: 'zone',
		handledContactAtBat: null,
		handledPitchKey: '',
		gamePk: 101
	});
});

test('builds a persistent pitch ledger for the current at-bat', async () => {
	const visualization = await import('../src/lib/visualization.js');
	assert.equal(typeof visualization.currentAtBatPitches, 'function');

	const pitches = visualization.currentAtBatPitches({
		playEvents: [
			{ type: 'action', details: { description: 'Mound Visit' } },
			{
				isPitch: true,
				details: {
					isStrike: true,
					call: { code: 'C', description: 'Called Strike' },
					type: { description: 'Four-Seam Fastball' }
				},
				pitchData: { startSpeed: 96.27 }
			},
			{
				isPitch: true,
				details: {
					isStrike: true,
					call: { code: 'S', description: 'Swinging Strike' },
					type: { description: 'Slider' }
				},
				pitchData: { startSpeed: 87.04 }
			},
			{
				isPitch: true,
				details: {
					isBall: true,
					call: { code: 'B', description: 'Ball In Dirt' },
					type: { description: 'Sweeper' }
				},
				pitchData: { startSpeed: 84.94 }
			},
			{
				isPitch: true,
				details: {
					isStrike: true,
					call: { code: 'F', description: 'Foul' },
					type: { description: 'Cutter' }
				},
				pitchData: { startSpeed: 91 }
			}
		]
	});

	assert.deepEqual(pitches, [
		{ number: 1, kind: 'strike', call: 'Called Strike', detail: 'Four-Seam Fastball · 96.3 MPH' },
		{ number: 2, kind: 'strike', call: 'Swinging Strike', detail: 'Slider · 87.0 MPH' },
		{ number: 3, kind: 'ball', call: 'Ball In Dirt', detail: 'Sweeper · 84.9 MPH' },
		{ number: 4, kind: 'foul', call: 'Foul', detail: 'Cutter · 91.0 MPH' }
	]);

	const dashboard = readFileSync(
		new URL('../src/lib/components/LiveDashboard.svelte', import.meta.url),
		'utf8'
	);
	assert.match(dashboard, /currentAtBatPitches\(visualizationPlay\)/);
	assert.match(dashboard, /class="at-bat-pitches"/);
	assert.match(dashboard, /class="pitch-symbol \{pitch\.kind\}"/);
	assert.match(dashboard, /bind:this=\{pitchLedger\}/);
	assert.match(dashboard, /pitchLedger\.scrollTop = pitchLedger\.scrollHeight/);
});

test('builds a tiny current-play URL without historical plays', () => {
	const url = new URL(buildCurrentVisualizationUrl('https://example.test/api', 123));
	const fields = url.searchParams.get('fields') ?? '';
	assert.equal(url.pathname, '/api/v1.1/game/123/feed/live');
	assert.match(fields, /currentPlay/);
	assert.match(fields, /pitchData/);
	for (const field of [
		'startSpeed',
		'pX',
		'pZ',
		'x0',
		'y0',
		'z0',
		'vX0',
		'vY0',
		'vZ0',
		'aX',
		'aY',
		'aZ'
	]) {
		assert.ok(fields.split(',').includes(field), `current-play fields should include ${field}`);
	}
	assert.doesNotMatch(
		fields,
		/endSpeed|plateTime|extension|pfxX|pfxZ|breaks|spinRate|spinDirection/
	);
	assert.doesNotMatch(fields, /allPlays/);
});

test('builds a hit-history URL without historical pitch telemetry', () => {
	const url = new URL(buildHitHistoryUrl('https://example.test/api', 123));
	const fields = url.searchParams.get('fields') ?? '';
	assert.equal(url.pathname, '/api/v1/game/123/playByPlay');
	assert.match(fields, /allPlays/);
	assert.match(fields, /hitData/);
	assert.doesNotMatch(fields, /pitchData/);
	assert.doesNotMatch(fields, /plateTime|vX0|aX|spinRate/);
});

test('maps the center of the pitch coordinate range to the canvas center', () => {
	assert.deepEqual(mapPitchToZone(0, 2.5), { x: 110, y: 130, clipped: false });
});

test('maps higher pitches upward and clamps pitches outside the display', () => {
	const high = mapPitchToZone(0, 4);
	const low = mapPitchToZone(0, 1);
	assert.ok(high.y < low.y);
	assert.deepEqual(mapPitchToZone(5, 8), { x: 202, y: 18, clipped: true });
});

test('builds a batter-specific strike-zone rectangle', () => {
	const rectangle = strikeZoneRect(3.5, 1.5);
	assert.ok(rectangle.width > 0);
	assert.ok(rectangle.height > 0);
	assert.ok(rectangle.y < 130);
	assert.equal(rectangle.x + rectangle.width / 2, 110);
});

test('classifies balls, strikes, fouls, and balls put in play', () => {
	assert.equal(classifyPitch({ details: { isBall: true } }), 'ball');
	assert.equal(classifyPitch({ details: { isStrike: true, call: { code: 'C' } } }), 'strike');
	assert.equal(classifyPitch({ details: { isStrike: true, call: { code: 'F' } } }), 'foul');
	assert.equal(classifyPitch({ details: { isInPlay: true }, hitData: {} }), 'inplay');
	assert.equal(classifyPitch({ details: {} }), 'neutral');
});

test('pitch tracker gives foul balls a blue outlined legend and marker', () => {
	const source = readFileSync(
		new URL('../src/lib/components/PitchTrajectory.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /<i class="foul"><\/i>Foul/);
	assert.match(source, /\.pitch-endpoint\.foul \.pitch-dot\s*\{[^}]*stroke:\s*#3b82f6/s);
});

test('pitch selection recreates the selected path so its replay animation restarts', () => {
	const source = readFileSync(
		new URL('../src/lib/components/PitchTrajectory.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /\{#key selectedModel\?\.key\}/);
});

test('manual pitch selection survives Zone and Contact view remounts', () => {
	const parentSource = readFileSync(
		new URL('../src/lib/GameVisualization.svelte', import.meta.url),
		'utf8'
	);
	const trajectorySource = readFileSync(
		new URL('../src/lib/components/PitchTrajectory.svelte', import.meta.url),
		'utf8'
	);
	assert.match(parentSource, /bind:selectedKey=\{selectedPitchKey\}/);
	assert.match(parentSource, /renderMode="three"/);
	assert.match(trajectorySource, /selectedKey\s*=\s*\$bindable/);
	assert.match(trajectorySource, /contextPitches=\{pitches\}/);
});

test('finds the newest batted ball in a play history', () => {
	const oldHit = { coordinates: { coordX: 90, coordY: 80 } };
	const newHit = { coordinates: { coordX: 120, coordY: 60 } };
	const plays = [
		{ playEvents: [{ hitData: oldHit }] },
		{ playEvents: [{ details: { description: 'Ball' } }] },
		{ playEvents: [{ hitData: newHit }] }
	];
	assert.equal(latestBattedBall(plays)?.hitData, newHit);
});

test('maps and clamps MLB field coordinates', () => {
	assert.deepEqual(mapHitToField(112.28, 176.01), { x: 112.28, y: 176.01, clipped: false });
	assert.deepEqual(mapHitToField(-10, 300), { x: 5, y: 215, clipped: true });
});

test('both footers carry the single tracking reconstruction note', () => {
	const routes = [
		readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8'),
		readFileSync(new URL('../src/routes/demo/+page.svelte', import.meta.url), 'utf8')
	];
	for (const source of routes) {
		assert.equal(
			(source.match(/Locations reconstructed from available MLB tracking data\./g) ?? []).length,
			1
		);
	}
});

test('selects the current official PNC Park profile by MLB venue id', () => {
	assert.equal(fieldProfileForVenue(31), PNC_PARK);
	assert.equal(fieldProfileForVenue(9999), null);
	assert.deepEqual(PNC_PARK.dimensions, {
		leftLine: 325,
		left: 389,
		leftCenter: 410,
		center: 399,
		rightCenter: 375,
		rightLine: 320
	});
	assert.deepEqual(PNC_PARK.wallHeights, { left: 6, leftCenter: 10, right: 21 });
	assert.equal(PNC_PARK.wall.length, 10);
});

test('covers every current MLB home venue with valid physical wall geometry', () => {
	assert.deepEqual(
		BALLPARK_PROFILES.map((profile) => profile.venueId).sort((a, b) => a - b),
		CURRENT_MLB_VENUE_IDS
	);
	for (const profile of BALLPARK_PROFILES) {
		assert.equal(fieldProfileForVenue(profile.venueId), profile);
		assert.ok(profile.name.length > 2);
		assert.ok(profile.sources.length > 0);
		assert.ok(profile.wall.length >= 5);
		assert.ok(profile.wall[0].angle <= -40);
		assert.ok(profile.wall.at(-1).angle >= 40);
		for (let index = 0; index < profile.wall.length; index += 1) {
			const point = profile.wall[index];
			assert.ok(point.distance >= 250 && point.distance <= 450);
			if (index > 0) assert.ok(point.angle > profile.wall[index - 1].angle);
		}
	}
	assert.equal(fieldProfileForVenue(9999), null);
});

test('preserves current renovations where MLB fieldInfo still exposes legacy values', () => {
	assert.equal(fieldProfileForVenue(7)?.dimensions.leftLine, 330);
	assert.equal(fieldProfileForVenue(2394)?.dimensions.center, 412);
	assert.equal(fieldProfileForVenue(4169)?.dimensions.rightCenter, 387);
	assert.deepEqual(
		fieldProfileForVenue(680)?.wall.map(({ distance }) => distance),
		[331, 378, 401, 381, 326]
	);
	assert.deepEqual(
		fieldProfileForVenue(14)?.wall.map(({ distance }) => distance),
		[328, 368, 381, 400, 372, 359, 328]
	);
});

test('converts MLB spray-chart coordinates to physical feet', () => {
	assert.deepEqual(mlbHitCoordinatesToFeet(125.42, 198.27), { x: 0, y: 0 });
	const center = mlbHitCoordinatesToFeet(125.05, 38.69);
	assert.ok(Math.abs(center.x - -0.925) < 0.001);
	assert.ok(Math.abs(center.y - 398.95) < 0.001);
	assert.ok(mlbHitCoordinatesToFeet(90, 100).x < 0);
	assert.ok(mlbHitCoordinatesToFeet(160, 100).x > 0);
});

test('projects physical field coordinates into the PNC SVG from home plate', () => {
	assert.deepEqual(fieldPointToSvg(PNC_PARK, { x: 0, y: 0 }), { x: 125, y: 210 });
	const center = fieldPointToSvg(PNC_PARK, { x: 0, y: 399 });
	assert.equal(center.x, 125);
	assert.ok(center.y >= 8 && center.y <= 20);
});

test('PNC wall intersections preserve the official line and center distances', () => {
	assert.ok(Math.abs(wallDistanceAtAngle(PNC_PARK, -45) - 325) < 0.01);
	assert.ok(Math.abs(wallDistanceAtAngle(PNC_PARK, 0) - 399) < 0.01);
	assert.ok(Math.abs(wallDistanceAtAngle(PNC_PARK, 45) - 320) < 0.01);
	const leftFieldMidpoint = wallDistanceAtAngle(PNC_PARK, -40.5);
	assert.ok(leftFieldMidpoint > 325 && leftFieldMidpoint < 362);
});

test('hit estimation prioritizes usable tracked distance with MLB spray direction', () => {
	const estimate = estimateHitLocation(
		{
			totalDistance: 405,
			trajectory: 'fly_ball',
			coordinates: { coordX: 102, coordY: 80 }
		},
		'',
		PNC_PARK
	);
	assert.equal(estimate.source, 'tracked-distance');
	assert.equal(estimate.distance, 405);
	assert.ok(estimate.point.x < 0);
	assert.equal(
		hitLocationAriaLabel(estimate, 'Home run to left field.', PNC_PARK),
		'Home run to left field. 405 feet toward left field at PNC Park.'
	);
});

test('ground-ball estimation prefers chart position over airborne distance', () => {
	const estimate = estimateHitLocation(
		{
			totalDistance: 3,
			trajectory: 'ground_ball',
			coordinates: { coordX: 112.28, coordY: 176.01 }
		},
		'Grounded to third.',
		PNC_PARK
	);
	assert.equal(estimate.source, 'chart-distance');
	assert.ok(estimate.distance > 40);
	assert.ok(estimate.point.x < 0);
});

test('tracked fly-ball distance combines with defensive direction when coordinates are absent', () => {
	const estimate = estimateHitLocation(
		{ totalDistance: 289, trajectory: 'fly_ball', location: '8', coordinates: {} },
		'Flies out to center fielder.',
		PNC_PARK
	);
	assert.equal(estimate.source, 'tracked-distance-location');
	assert.equal(estimate.distance, 289);
	assert.equal(estimate.angle, 0);
});

test('caught foul balls use a coarse foul-territory section outside the fair-field line', () => {
	const estimate = estimateHitLocation(
		{
			totalDistance: 278,
			trajectory: 'fly_ball',
			location: '9',
			coordinates: { coordX: 209.18, coordY: 123.58 }
		},
		"Ke'Bryan Hayes flies out to right fielder Cam Smith in foul territory.",
		PNC_PARK
	);
	assert.equal(estimate.source, 'foul-territory');
	assert.equal(estimate.foulTerritory, 'right');
	assert.ok(estimate.angle > 45);
	assert.match(
		hitLocationAriaLabel(
			estimate,
			"Ke'Bryan Hayes flies out to right fielder Cam Smith in foul territory.",
			PNC_PARK
		),
		/Caught in right-field foul territory at PNC Park\.$/
	);

	const ordinaryFoul = estimateHitLocation({}, 'Foul', PNC_PARK);
	assert.equal(ordinaryFoul.foulTerritory, null);
});

test('long projected contact remains visible without changing its physical distance', () => {
	const estimate = estimateHitLocation(
		{
			totalDistance: 475,
			trajectory: 'fly_ball',
			coordinates: { coordX: 125.42, coordY: 80 }
		},
		'Home run to center field.',
		PNC_PARK
	);
	assert.equal(estimate.distance, 475);
	assert.equal(Math.hypot(estimate.point.x, estimate.point.y), 475);
	assert.equal(estimate.svg.y, 6);
	assert.equal(estimate.clipped, true);
});

test('hit estimation falls through defensive location, description, then generic placement', () => {
	assert.equal(estimateHitLocation({ location: '9' }, '', PNC_PARK).source, 'defensive-location');
	assert.equal(
		estimateHitLocation(
			{ location: '9', coordinates: { coordX: null, coordY: null } },
			'',
			PNC_PARK
		).source,
		'defensive-location'
	);
	assert.equal(estimateHitLocation({}, 'Fly ball to left field.', PNC_PARK).source, 'description');
	assert.equal(estimateHitLocation({}, '', PNC_PARK).source, 'fallback');
});

test('live and demo trackers select a reusable current-ballpark field by venue id', () => {
	const tracker = readFileSync(
		new URL('../src/lib/GameVisualization.svelte', import.meta.url),
		'utf8'
	);
	const dashboard = readFileSync(
		new URL('../src/lib/components/LiveDashboard.svelte', import.meta.url),
		'utf8'
	);
	const demo = readFileSync(new URL('../src/routes/demo/+page.svelte', import.meta.url), 'utf8');
	assert.match(tracker, /import BallparkField from '\$lib\/components\/BallparkField\.svelte'/);
	assert.match(tracker, /fieldProfileForVenue\(venueId\)/);
	assert.match(tracker, /untrack\(\(\) => selectedMode\)/);
	assert.match(tracker, /<BallparkField/);
	assert.match(dashboard, /venueId=\{feed\?\.gameData\.venue\?\.id \?\? game\.venue\?\.id\}/);
	assert.match(demo, /import \{ BALLPARK_PROFILES \} from '\$lib\/field-geometry\.js'/);
	assert.match(demo, /bind:value=\{selectedVenueId\}/);
	assert.match(demo, /venueId=\{selectedVenueId\}/);
	assert.doesNotMatch(`${tracker}\n${dashboard}\n${demo}`, /estimated/i);
});
