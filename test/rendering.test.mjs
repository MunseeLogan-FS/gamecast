import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { createServer } from 'vite';

let vite;
let render;
let GameVisualization;
let DEMO_CURRENT_PLAY;
let DEMO_HIT_HISTORY;

before(async () => {
	vite = await createServer({ appType: 'custom', server: { middlewareMode: true } });
	({ render } = await vite.ssrLoadModule('svelte/server'));
	({ default: GameVisualization } = await vite.ssrLoadModule('/src/lib/GameVisualization.svelte'));
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

test('unknown-venue fallback rejects null batted-ball coordinates', () => {
	const malformedHistory = structuredClone(DEMO_HIT_HISTORY);
	const latestEvent = malformedHistory.at(-1).playEvents.findLast((event) => event.hitData);
	latestEvent.hitData.coordinates = { coordX: null, coordY: null };
	const fallback = renderContact(9999, malformedHistory);
	assert.match(fallback, /No tracked ball in play yet/);
	assert.doesNotMatch(fallback, /aria-label="Batted-ball location"/);
});
