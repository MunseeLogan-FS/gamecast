import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const componentUrl = new URL('../src/lib/components/PlayHighlight.svelte', import.meta.url);

test('highlight player lazy-loads the direct MLB-hosted MP4', () => {
	const source = readFileSync(componentUrl, 'utf8');
	assert.match(source, /\{#if open && highlight\.mlbHostedUrl\}/);
	assert.match(source, /<video\s+controls\s+playsinline\s+preload="metadata"/);
	assert.match(source, /<source src=\{highlight\.mlbHostedUrl\} type="video\/mp4"/);
	assert.doesNotMatch(source, /autoplay/i);
	assert.doesNotMatch(source, /\/api\/.*highlight|proxy/i);
});

test('highlight player preserves captions and the official MLB fallback', () => {
	const source = readFileSync(componentUrl, 'utf8');
	assert.match(source, /<track\s+kind="captions"/);
	assert.match(source, /href=\{highlight\.canonicalUrl\}/);
	assert.match(source, /target="_blank"[\s\S]*rel="external noreferrer"/);
	assert.match(source, /Watch on MLB/);
});

test('highlight player exposes accessible open and close controls', () => {
	const source = readFileSync(componentUrl, 'utf8');
	assert.match(source, /aria-label=\{`Watch \$\{highlight\.title\}`\}/);
	assert.match(source, /aria-label="Close highlight video"/);
	assert.match(source, /alt=\{`\$\{highlight\.title\} video thumbnail`\}/);
	for (const label of ['HR', 'ABS', 'Review', 'Steal', 'Run', 'Hit', 'Highlight']) {
		assert.match(source, new RegExp(`'${label}'`));
	}
});

test('live dashboard attaches clips and offers a highlights-only filter', () => {
	const source = readFileSync(
		new URL('../src/lib/components/LiveDashboard.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /import PlayHighlight from '\$lib\/components\/PlayHighlight\.svelte'/);
	assert.match(source, /matchHighlightsToPlays\(highlights, plays\)/);
	assert.match(source, /let playFilter = \$state<'all' \| 'scoring' \| 'highlights'>\('all'\)/);
	assert.match(source, />Highlights<\/button\s*>/);
	assert.match(source, /matchedHighlights\.byAtBatIndex\[play\.about\.atBatIndex\]/);
	assert.match(source, /<PlayHighlight\s+\{highlight\}/);
	assert.match(source, /More game highlights/);
	assert.match(source, /matchedHighlights\.standalone/);
});

test('live dashboard owns a single open highlight key', () => {
	const source = readFileSync(
		new URL('../src/lib/components/LiveDashboard.svelte', import.meta.url),
		'utf8'
	);
	assert.match(source, /let openHighlightKey = \$state<string \| null>\(null\)/);
	assert.match(source, /open=\{openHighlightKey === highlight\.key\}/);
	assert.equal(source.match(/onToggle=\{\(\) =>/g)?.length, 2);
	assert.match(
		source,
		/openHighlightKey\s*=\s*openHighlightKey === highlight\.key \? null : highlight\.key/
	);
});
