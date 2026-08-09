import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let themes;

before(async () => {
	vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
	themes = await vite.ssrLoadModule('/src/lib/team-themes.ts');
});

after(async () => {
	await vite?.close();
});

function game(homeId, awayId) {
	return {
		gamePk: 1,
		gameDate: '2026-08-08T23:05:00Z',
		status: { abstractGameState: 'Preview', detailedState: 'Scheduled' },
		teams: {
			home: { team: { id: homeId, name: 'Home' } },
			away: { team: { id: awayId, name: 'Away' } }
		}
	};
}

test('contains a theme for every current MLB team', () => {
	const expectedIds = [
		108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 133, 134, 135, 136, 137,
		138, 139, 140, 141, 142, 143, 144, 145, 146, 147, 158
	];
	assert.deepEqual(
		Object.keys(themes.MLB_TEAM_THEMES)
			.map(Number)
			.sort((a, b) => a - b),
		expectedIds
	);
});

test('all theme colors are valid hex values with accessible accent text', () => {
	for (const [teamId, theme] of Object.entries(themes.MLB_TEAM_THEMES)) {
		for (const key of ['primary', 'accent', 'onAccent', 'muted']) {
			assert.match(theme[key], /^#[0-9a-f]{6}$/i, `${teamId} ${key}`);
		}
		assert.ok(
			themes.contrastRatio(theme.accent, theme.onAccent) >= 4.5,
			`${teamId} accent contrast`
		);
	}
});

test('non-Pirates games use the home team theme', () => {
	assert.equal(themes.themeForGame(game(121, 147)), themes.MLB_TEAM_THEMES[121]);
});

test('Pirates colors override home and away position', () => {
	assert.equal(themes.themeForGame(game(134, 147)), themes.MLB_TEAM_THEMES[134]);
	assert.equal(themes.themeForGame(game(147, 134)), themes.MLB_TEAM_THEMES[134]);
});

test('unknown and absent games receive the neutral fallback', () => {
	assert.equal(themes.themeForGame(game(999, 998)), themes.NEUTRAL_TEAM_THEME);
	assert.equal(themes.themeForGame(null), themes.NEUTRAL_TEAM_THEME);
});
