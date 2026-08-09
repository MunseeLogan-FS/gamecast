import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let render;
let GamePicker;

before(async () => {
	vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
	({ render } = await vite.ssrLoadModule('svelte/server'));
	({ default: GamePicker } = await vite.ssrLoadModule('/src/lib/components/GamePicker.svelte'));
});

after(async () => {
	await vite?.close();
});

const status = (abstractGameState, detailedState = abstractGameState) => ({
	abstractGameState,
	detailedState
});

function game(gamePk, away, home, state, gameDate, scores = {}) {
	return {
		gamePk,
		gameDate,
		status: status(state),
		teams: {
			away: { team: away, score: scores.away },
			home: { team: home, score: scores.home }
		}
	};
}

const pit = { id: 134, name: 'Pittsburgh Pirates', abbreviation: 'PIT' };
const nyy = { id: 147, name: 'New York Yankees', abbreviation: 'NYY' };
const bos = { id: 111, name: 'Boston Red Sox', abbreviation: 'BOS' };
const tor = { id: 141, name: 'Toronto Blue Jays', abbreviation: 'TOR' };
const games = [
	game(1, nyy, pit, 'Preview', '2026-08-08T23:05:00Z'),
	game(2, bos, tor, 'Live', '2026-08-08T18:05:00Z', { away: 2, home: 4 }),
	game(3, tor, nyy, 'Final', '2026-08-08T16:05:00Z', { away: 3, home: 5 })
];

test('renders Pittsburgh first and groups remaining live and final games', () => {
	const body = render(GamePicker, { props: { games, selectedGamePk: 2, onSelect() {} } }).body;
	assert.ok(body.indexOf('Pirates') < body.indexOf('Live now'));
	assert.ok(body.indexOf('Live now') < body.indexOf('Final'));
	assert.equal((body.match(/team-logos\/134\.svg/g) ?? []).length, 1);
});

test('marks the selected game and keeps finals selectable', () => {
	const body = render(GamePicker, { props: { games, selectedGamePk: 2, onSelect() {} } }).body;
	assert.match(body, /aria-pressed="true"[^>]*>[^]*Boston Red Sox/);
	assert.match(body, /<button[^>]*aria-label="Toronto Blue Jays at New York Yankees, Final[^>]*>/);
});

test('shows schedule scores for live and final cards', () => {
	const body = render(GamePicker, { props: { games, selectedGamePk: 1, onSelect() {} } }).body;
	assert.match(body, /BOS[^]*2[^]*TOR[^]*4/);
	assert.match(body, /TOR[^]*3[^]*NYY[^]*5/);
});

test('renders a useful label for delayed or unusual states', () => {
	const delayed = {
		...games[0],
		gamePk: 4,
		teams: {
			away: { team: bos },
			home: { team: nyy }
		},
		status: status('Preview', 'Delayed Start')
	};
	const body = render(GamePicker, {
		props: { games: [delayed], selectedGamePk: null, onSelect() {} }
	}).body;
	assert.match(body, /Other/);
	assert.match(body, /Delayed Start/);
});
