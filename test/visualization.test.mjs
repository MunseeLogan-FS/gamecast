import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DEMO_CURRENT_PLAY, DEMO_HIT_HISTORY } from '../src/lib/demo-data.js';
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
	strikeZoneRect
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

test('cross-route links force a document reload across deployments', () => {
	const home = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
	const demo = readFileSync(new URL('../src/routes/demo/+page.svelte', import.meta.url), 'utf8');
	assert.match(home, /href=\{resolve\('\/demo'\)\} data-sveltekit-reload/);
	assert.equal((demo.match(/href=\{resolve\('\/'\)\} data-sveltekit-reload/g) ?? []).length, 3);
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
	assert.equal(latestBattedBall(DEMO_HIT_HISTORY)?.hitData.coordinates.coordX, 112.28);
	assert.equal(DEMO_CURRENT_PLAY.matchup.batSide.code, 'L');
});

test('paces live refreshes around the natural game rhythm', () => {
	const activePlay = { about: { isComplete: false } };
	const completePlay = { about: { isComplete: true } };
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
		new URL('../src/lib/GameVisualization.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /class="bat-side"/);
});

test('builds a tiny current-play URL without historical plays', () => {
	const url = new URL(buildCurrentVisualizationUrl('https://example.test/api', 123));
	const fields = url.searchParams.get('fields') ?? '';
	assert.equal(url.pathname, '/api/v1.1/game/123/feed/live');
	assert.match(fields, /currentPlay/);
	assert.match(fields, /pitchData/);
	assert.doesNotMatch(fields, /allPlays/);
});

test('builds a hit-history URL without historical pitch telemetry', () => {
	const url = new URL(buildHitHistoryUrl('https://example.test/api', 123));
	const fields = url.searchParams.get('fields') ?? '';
	assert.equal(url.pathname, '/api/v1/game/123/playByPlay');
	assert.match(fields, /allPlays/);
	assert.match(fields, /hitData/);
	assert.doesNotMatch(fields, /pitchData/);
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
		new URL('../src/lib/GameVisualization.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /<i class="foul"><\/i>Foul/);
	assert.match(source, /\.pitch-point\.foul \.pitch-dot\s*\{[^}]*stroke:\s*#3b82f6/s);
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
