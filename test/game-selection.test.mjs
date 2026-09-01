import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let selection;
let mlb;

before(async () => {
	vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
	selection = await vite.ssrLoadModule('/src/lib/game-selection.ts');
	mlb = await vite.ssrLoadModule('/src/lib/mlb.ts');
});

after(async () => {
	await vite?.close();
});

const status = (abstractGameState, detailedState = abstractGameState) => ({
	abstractGameState,
	detailedState
});

function game(gamePk, homeId, awayId, state, gameDate, overrides = {}) {
	return {
		gamePk,
		gameDate,
		status: status(state),
		teams: {
			home: { team: { id: homeId, name: `Home ${homeId}` } },
			away: { team: { id: awayId, name: `Away ${awayId}` } }
		},
		...overrides
	};
}

const previewPirates = game(10, 134, 147, 'Preview', '2026-08-08T23:05:00Z');
const finalPirates = game(11, 147, 134, 'Final', '2026-08-08T17:05:00Z');
const liveOther = game(20, 121, 112, 'Live', '2026-08-08T18:10:00Z');
const previewOther = game(21, 119, 120, 'Preview', '2026-08-09T01:10:00Z');
const finalOther = game(22, 110, 111, 'Final', '2026-08-08T16:10:00Z');
const delayedOther = game(23, 113, 114, 'Preview', '2026-08-08T20:10:00Z', {
	status: status('Preview', 'Delayed Start')
});

test('orders every Pirates game first and preserves doubleheader time order', () => {
	const ordered = selection.orderTodayGames([
		previewOther,
		previewPirates,
		liveOther,
		finalPirates,
		finalOther
	]);
	assert.deepEqual(
		ordered.map((entry) => entry.gamePk),
		[11, 10, 20, 21, 22]
	);
});

test('groups non-Pirates games live, preview, final, then other', () => {
	assert.equal(selection.gameLifecycleGroup(liveOther), 'live');
	assert.equal(selection.gameLifecycleGroup(previewOther), 'preview');
	assert.equal(selection.gameLifecycleGroup(finalOther), 'final');
	assert.equal(selection.gameLifecycleGroup(delayedOther), 'other');
});

test('honors a valid requested game before the Pirates default', () => {
	assert.equal(
		selection.chooseInitialGame([previewPirates, liveOther, finalOther], liveOther.gamePk)?.gamePk,
		liveOther.gamePk
	);
});

test('ignores an invalid requested game and prefers a live Pirates game', () => {
	const livePirates = { ...previewPirates, gamePk: 12, status: status('Live') };
	assert.equal(
		selection.chooseInitialGame([finalPirates, previewPirates, livePirates, liveOther], 999)
			?.gamePk,
		livePirates.gamePk
	);
});

test('Pirates default prefers preview over final when no Pirates game is live', () => {
	assert.equal(
		selection.chooseInitialGame([finalPirates, previewPirates, liveOther])?.gamePk,
		previewPirates.gamePk
	);
});

test('without Pittsburgh, default priority is live, preview, then latest final', () => {
	assert.equal(selection.chooseInitialGame([finalOther, previewOther, liveOther])?.gamePk, 20);
	assert.equal(selection.chooseInitialGame([finalOther, previewOther])?.gamePk, 21);
	const laterFinal = { ...finalOther, gamePk: 24, gameDate: '2026-08-08T22:00:00Z' };
	assert.equal(selection.chooseInitialGame([finalOther, laterFinal])?.gamePk, 24);
});

test('preserves a valid manual selection across schedule refreshes', () => {
	assert.equal(
		selection.preserveOrChooseGame([previewPirates, liveOther], liveOther.gamePk)?.gamePk,
		liveOther.gamePk
	);
});

test('keeps delayed and unusual states on the card', () => {
	const ordered = selection.orderTodayGames([delayedOther, previewPirates]);
	assert.deepEqual(
		ordered.map((entry) => entry.gamePk),
		[10, 23]
	);
});

test('builds an all-MLB today schedule URL without a team filter', () => {
	const url = new URL(mlb.buildTodayScheduleUrl('https://example.test/api', '2026-08-08'));
	assert.equal(url.pathname, '/api/v1/schedule');
	assert.equal(url.searchParams.get('sportId'), '1');
	assert.equal(url.searchParams.get('startDate'), '2026-08-08');
	assert.equal(url.searchParams.get('endDate'), '2026-08-08');
	assert.equal(url.searchParams.has('teamId'), false);
	assert.match(url.searchParams.get('hydrate') ?? '', /probablePitcher/);
});

test('keeps the Pirates next-game URL constrained to team 134 and seven days', () => {
	const url = new URL(mlb.buildPiratesNextScheduleUrl('https://example.test/api', '2026-08-08'));
	assert.equal(url.searchParams.get('teamId'), '134');
	assert.equal(url.searchParams.get('startDate'), '2026-08-08');
	assert.equal(url.searchParams.get('endDate'), '2026-08-15');
});

test('requests the prior date as part of the active slate rollover window', () => {
	const url = new URL(mlb.buildActiveSlateScheduleUrl('https://example.test/api', '2026-08-09'));
	assert.equal(url.searchParams.get('startDate'), '2026-08-08');
	assert.equal(url.searchParams.get('endDate'), '2026-08-09');
});

test('keeps the prior slate while a late game is still live after midnight Eastern', () => {
	const lateLive = { ...liveOther, scheduleDate: '2026-08-08' };
	const tomorrowPreview = { ...previewOther, scheduleDate: '2026-08-09' };
	assert.equal(selection.activeSlateDate('2026-08-09', [lateLive, tomorrowPreview]), '2026-08-08');
	assert.equal(
		selection.activeSlateDate('2026-08-09', [
			{ ...lateLive, status: status('Final') },
			tomorrowPreview
		]),
		'2026-08-09'
	);
});
