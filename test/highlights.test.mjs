import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
	HIGHLIGHT_REFRESH_MS,
	buildGameContentUrl,
	matchHighlightsToPlays,
	normalizeGameContent
} from '../src/lib/highlights.ts';

function item(overrides = {}) {
	return {
		type: 'video',
		state: 'A',
		id: 'pitcher-in-play-run-s-to-batter',
		slug: 'pitcher-in-play-run-s-to-batter',
		title: 'Batter homers to left',
		date: '2026-08-09T18:57:16.391Z',
		mediaPlaybackId: 'media-home-run',
		guid: 'play-home-run',
		duration: '00:00:33',
		keywordsAll: [
			{ type: 'taxonomy', value: 'in-game-highlight' },
			{ type: 'taxonomy', value: 'home-run' },
			{ type: 'player_id', value: '123' }
		],
		image: {
			cuts: [
				{
					aspectRatio: '16:9',
					width: 320,
					height: 180,
					src: 'https://img.mlbstatic.com/small.jpg'
				},
				{
					aspectRatio: '16:9',
					width: 640,
					height: 360,
					src: 'https://img.mlbstatic.com/poster.jpg'
				}
			]
		},
		playbacks: [
			{ name: 'highBit', url: 'https://mlb-cuts-diamond.mlb.com/high.mp4' },
			{ name: 'mp4Avc', url: 'https://mlb-cuts-diamond.mlb.com/clip.mp4' }
		],
		...overrides
	};
}

const homeRun = item();
const absChallenge = item({
	id: 'pirates-challenged-pitch-result-batter-called-out',
	slug: 'pirates-challenged-pitch-result-batter-called-out',
	title: 'Batter strikes out after ABS challenge',
	mediaPlaybackId: 'media-abs',
	guid: undefined,
	keywordsAll: [
		{ type: 'taxonomy', value: 'in-game-highlight' },
		{ type: 'taxonomy', value: 'challenge' },
		{ type: 'taxonomy', value: 'abs' }
	]
});
const stolenBase = item({
	id: 'runner-steals-second',
	slug: 'runner-steals-second',
	title: 'Runner steals second base',
	mediaPlaybackId: 'media-steal',
	guid: 'play-steal',
	keywordsAll: [
		{ type: 'taxonomy', value: 'in-game-highlight' },
		{ type: 'taxonomy', value: 'stolen-base' }
	]
});

const payload = {
	highlights: {
		gameCenter: { items: [homeRun, absChallenge, stolenBase] },
		highlights: { items: [homeRun] },
		editorial: {
			items: [
				item({
					id: 'postgame-interview',
					slug: 'postgame-interview',
					mediaPlaybackId: 'interview',
					keywordsAll: [{ type: 'taxonomy', value: 'interview' }]
				})
			]
		}
	}
};

test('builds the selected-game content URL and keeps media cadence independent', () => {
	assert.equal(
		buildGameContentUrl('https://statsapi.mlb.com/api', 823345),
		'https://statsapi.mlb.com/api/v1/game/823345/content'
	);
	assert.equal(HIGHLIGHT_REFRESH_MS, 60_000);
	assert.throws(() => buildGameContentUrl('https://statsapi.mlb.com/api', 0), /gamePk/);
});

test('selected-game feed retains play IDs needed for exact highlight matching', () => {
	const source = readFileSync(new URL('../src/lib/mlb.ts', import.meta.url), 'utf8');
	assert.match(source, /'playEvents'/);
	assert.match(source, /'playId'/);
	assert.match(source, /playId\?: string/);
});

test('normalizes relevant MLB-hosted clips and deduplicates repeated content groups', () => {
	const highlights = normalizeGameContent(payload);
	assert.equal(highlights.length, 3);
	assert.deepEqual(
		highlights.map((highlight) => highlight.key),
		['media-home-run', 'media-abs', 'media-steal']
	);
	assert.equal(highlights[0].mlbHostedUrl, 'https://mlb-cuts-diamond.mlb.com/clip.mp4');
	assert.equal(highlights[0].thumbnail, 'https://img.mlbstatic.com/poster.jpg');
	assert.equal(
		highlights[0].canonicalUrl,
		'https://www.mlb.com/video/pitcher-in-play-run-s-to-batter'
	);
	assert.deepEqual(highlights[0].playerIds, [123]);
});

test('rejects non-MLB media and poster URLs instead of rewriting them', () => {
	const hostile = item({
		mediaPlaybackId: 'foreign-media',
		image: {
			cuts: [
				{
					aspectRatio: '16:9',
					width: 640,
					height: 360,
					src: 'http://example.com/poster.jpg'
				}
			]
		},
		playbacks: [{ name: 'mp4Avc', url: 'https://example.com/clip.mp4' }]
	});
	const [highlight] = normalizeGameContent({ highlights: { live: { items: [hostile] } } });
	assert.equal(highlight.mlbHostedUrl, undefined);
	assert.equal(highlight.thumbnail, undefined);
	assert.equal(highlight.canonicalUrl, 'https://www.mlb.com/video/pitcher-in-play-run-s-to-batter');
});

test('matches exact play IDs and leaves unidentifiable ABS clips standalone', () => {
	const plays = [
		{
			result: { eventType: 'home_run' },
			about: {
				atBatIndex: 12,
				halfInning: 'top',
				inning: 5,
				isComplete: true,
				isScoringPlay: true
			},
			playEvents: [{ playId: 'play-home-run' }]
		},
		{
			result: { eventType: 'stolen_base' },
			about: { atBatIndex: 13, halfInning: 'top', inning: 5, isComplete: true },
			playEvents: [{ playId: 'play-steal' }]
		}
	];
	const matched = matchHighlightsToPlays(normalizeGameContent(payload), plays);
	assert.equal(matched.byAtBatIndex[12][0].category, 'home-run');
	assert.equal(matched.byAtBatIndex[12][0].matchKind, 'play-id');
	assert.equal(matched.byAtBatIndex[13][0].category, 'steal');
	assert.equal(matched.standalone.length, 1);
	assert.equal(matched.standalone[0].category, 'abs');
	assert.equal(matched.standalone[0].matchKind, 'standalone');
});

test('classifies matched hits and scoring hits from feed truth', () => {
	const hit = item({
		id: 'batter-doubles',
		slug: 'batter-doubles',
		mediaPlaybackId: 'double',
		guid: 'play-double',
		keywordsAll: [{ type: 'taxonomy', value: 'in-game-highlight' }]
	});
	const clip = normalizeGameContent({ highlights: { live: { items: [hit] } } });
	const ordinary = matchHighlightsToPlays(clip, [
		{
			result: { eventType: 'double' },
			about: { atBatIndex: 3, halfInning: 'bottom', inning: 2, isComplete: true },
			playEvents: [{ playId: 'play-double' }]
		}
	]);
	const scoring = matchHighlightsToPlays(clip, [
		{
			result: { eventType: 'double' },
			about: {
				atBatIndex: 4,
				halfInning: 'bottom',
				inning: 2,
				isComplete: true,
				isScoringPlay: true
			},
			playEvents: [{ playId: 'play-double' }]
		}
	]);
	assert.equal(ordinary.byAtBatIndex[3][0].category, 'hit');
	assert.equal(scoring.byAtBatIndex[4][0].category, 'run');
});

test('preserves exact strikeout and field-out clips as generic highlights', () => {
	const clips = normalizeGameContent({
		highlights: {
			live: {
				items: [
					item({
						id: 'strikeout-clip',
						slug: 'strikeout-clip',
						mediaPlaybackId: 'strikeout-clip',
						guid: 'play-strikeout',
						keywordsAll: [{ type: 'taxonomy', value: 'in-game-highlight' }]
					}),
					item({
						id: 'field-out-clip',
						slug: 'field-out-clip',
						mediaPlaybackId: 'field-out-clip',
						guid: 'play-field-out',
						keywordsAll: [{ type: 'taxonomy', value: 'in-game-highlight' }]
					})
				]
			}
		}
	});
	const matched = matchHighlightsToPlays(clips, [
		{
			result: { eventType: 'strikeout' },
			about: { atBatIndex: 7, halfInning: 'top', inning: 4, isComplete: true },
			playEvents: [{ playId: 'play-strikeout' }]
		},
		{
			result: { eventType: 'field_out' },
			about: { atBatIndex: 8, halfInning: 'bottom', inning: 4, isComplete: true },
			playEvents: [{ playId: 'play-field-out' }]
		}
	]);

	assert.equal(matched.byAtBatIndex[7][0].category, 'highlight');
	assert.equal(matched.byAtBatIndex[8][0].category, 'highlight');
});

test('exact feed outcomes outrank replay taxonomy while ABS remains explicit', () => {
	const clips = normalizeGameContent({
		highlights: {
			live: {
				items: [
					item({
						id: 'reviewed-home-run',
						slug: 'reviewed-home-run',
						mediaPlaybackId: 'reviewed-home-run',
						guid: 'play-home-run',
						keywordsAll: [
							{ type: 'taxonomy', value: 'in-game-highlight' },
							{ type: 'taxonomy', value: 'challenge' },
							{ type: 'taxonomy', value: 'replay' }
						]
					}),
					item({
						id: 'abs-strikeout',
						slug: 'abs-strikeout',
						mediaPlaybackId: 'abs-strikeout',
						guid: 'play-abs',
						keywordsAll: [
							{ type: 'taxonomy', value: 'in-game-highlight' },
							{ type: 'taxonomy', value: 'abs' }
						]
					})
				]
			}
		}
	});
	const matched = matchHighlightsToPlays(clips, [
		{
			result: { eventType: 'home_run' },
			about: { atBatIndex: 5, halfInning: 'top', inning: 3, isComplete: true },
			playEvents: [{ playId: 'play-home-run' }]
		},
		{
			result: { eventType: 'strikeout' },
			about: { atBatIndex: 6, halfInning: 'bottom', inning: 3, isComplete: true },
			playEvents: [{ playId: 'play-abs' }]
		}
	]);

	assert.equal(matched.byAtBatIndex[5][0].category, 'home-run');
	assert.equal(matched.byAtBatIndex[6][0].category, 'abs');
});

test('route loads highlights only for the selected non-preview game on a separate cadence', () => {
	const source = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
	assert.match(source, /HIGHLIGHT_REFRESH_MS/);
	assert.match(source, /fetchGameHighlights/);
	assert.match(source, /let highlights = \$state<GameHighlight\[]>\(\[\]\)/);
	assert.match(source, /let highlightsController: AbortController \| undefined/);
	assert.match(source, /let highlightsTimer: ReturnType<typeof setTimeout> \| undefined/);
	assert.match(source, /if \(selectedGamePk === gamePk\) highlights = data/);
	assert.match(source, /if \(!isLive\(currentStatus\)\) return/);
	assert.match(source, /HIGHLIGHT_REFRESH_MS\);/);
	assert.match(source, /highlightsController\?\.abort\(\)/);
	assert.match(source, /<LiveDashboard[\s\S]*\{highlights\}/);
});

test('highlight requests remain outside the fast selected-game refresh bundle', () => {
	const source = readFileSync(new URL('../src/routes/+page.svelte', import.meta.url), 'utf8');
	const refreshBody = source.match(
		/async function refreshSelectedGameData[\s\S]*?\n\s*}\n\n\s*function queueFeedRefresh/
	)?.[0];
	assert.ok(refreshBody);
	assert.doesNotMatch(refreshBody, /loadHighlights|fetchGameHighlights/);
	assert.equal(source.match(/await loadHighlights/g)?.length, 1);
});
