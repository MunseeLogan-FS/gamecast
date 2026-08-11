<script lang="ts">
	import type { MatchedHighlight } from '$lib/highlights';

	let {
		highlight,
		open,
		onToggle
	}: {
		highlight: MatchedHighlight;
		open: boolean;
		onToggle: () => void;
	} = $props();

	const categoryLabels = {
		'home-run': 'HR',
		abs: 'ABS',
		review: 'Review',
		steal: 'Steal',
		run: 'Run',
		hit: 'Hit',
		highlight: 'Highlight'
	} as const;
</script>

<article class="highlight-card" class:open>
	<div class="highlight-heading">
		<span class="category {highlight.category}">{categoryLabels[highlight.category]}</span>
		<div>
			<strong>{highlight.title}</strong>
			{#if highlight.duration}<small>{highlight.duration}</small>{/if}
		</div>
	</div>

	{#if open && highlight.mlbHostedUrl}
		<div class="player-shell">
			<video controls playsinline preload="metadata" poster={highlight.thumbnail}>
				<source src={highlight.mlbHostedUrl} type="video/mp4" />
				{#if highlight.captionUrl}
					<track kind="captions" src={highlight.captionUrl} srclang="en" label="English" default />
				{/if}
			</video>
			<button
				class="close-player"
				type="button"
				onclick={onToggle}
				aria-label="Close highlight video">Close</button
			>
		</div>
	{:else if highlight.mlbHostedUrl}
		<button
			class="poster-button"
			type="button"
			onclick={onToggle}
			aria-label={`Watch ${highlight.title}`}
		>
			{#if highlight.thumbnail}
				<img src={highlight.thumbnail} alt={`${highlight.title} video thumbnail`} loading="lazy" />
			{:else}
				<span class="poster-fallback">MLB highlight</span>
			{/if}
			<span class="play-mark" aria-hidden="true">▶</span>
			<span class="watch-label">Watch highlight</span>
		</button>
	{/if}

	<a
		class="mlb-link"
		href={highlight.canonicalUrl}
		target="_blank"
		rel="external noreferrer"
		data-sveltekit-reload>Watch on MLB ↗</a
	>
</article>

<style>
	.highlight-card {
		margin-top: 12px;
		padding: 12px;
		border: 1px solid #d8d8d3;
		border-left: 4px solid var(--game-accent, #fdb827);
		background: #f7f7f4;
	}
	.highlight-card.open {
		background: #111;
		color: #fff;
	}
	.highlight-heading {
		display: flex;
		align-items: flex-start;
		gap: 9px;
		margin-bottom: 10px;
	}
	.highlight-heading div {
		display: grid;
		gap: 2px;
		min-width: 0;
	}
	.highlight-heading strong {
		font-size: 13px;
		line-height: 1.3;
	}
	.highlight-heading small {
		color: #73736e;
		font-variant-numeric: tabular-nums;
	}
	.open .highlight-heading small {
		color: #bbb;
	}
	.category {
		flex: 0 0 auto;
		padding: 3px 6px;
		border-radius: 2px;
		background: #2c2c2c;
		color: #fff;
		font-size: 10px;
		font-weight: 900;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}
	.category.home-run {
		background: var(--game-accent, #fdb827);
		color: var(--game-on-accent, #111);
	}
	.category.abs,
	.category.review {
		background: #315a92;
	}
	.category.steal {
		background: #25724a;
	}
	.poster-button {
		position: relative;
		width: min(100%, 520px);
		padding: 0;
		overflow: hidden;
		border: 0;
		border-radius: 3px;
		background: #191919;
		color: #fff;
		cursor: pointer;
		aspect-ratio: 16 / 9;
	}
	.poster-button img {
		display: block;
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.poster-button::after {
		position: absolute;
		inset: 0;
		background: linear-gradient(transparent 50%, rgb(0 0 0 / 72%));
		content: '';
	}
	.poster-fallback {
		display: grid;
		width: 100%;
		height: 100%;
		place-items: center;
		color: #aaa;
	}
	.play-mark {
		position: absolute;
		top: 50%;
		left: 50%;
		z-index: 1;
		display: grid;
		width: 48px;
		height: 48px;
		border: 2px solid #fff;
		border-radius: 50%;
		background: rgb(0 0 0 / 72%);
		place-items: center;
		transform: translate(-50%, -50%);
	}
	.watch-label {
		position: absolute;
		z-index: 1;
		right: 12px;
		bottom: 10px;
		left: 12px;
		font-size: 12px;
		font-weight: 800;
		text-align: left;
		text-transform: uppercase;
	}
	.player-shell {
		position: relative;
		width: min(100%, 720px);
		background: #000;
	}
	video {
		display: block;
		width: 100%;
		aspect-ratio: 16 / 9;
		background: #000;
	}
	.close-player {
		position: absolute;
		top: 8px;
		right: 8px;
		min-width: 44px;
		min-height: 44px;
		border: 1px solid rgb(255 255 255 / 50%);
		border-radius: 2px;
		background: rgb(0 0 0 / 76%);
		color: #fff;
		font-size: 11px;
		font-weight: 800;
		cursor: pointer;
	}
	.mlb-link {
		display: inline-block;
		margin-top: 9px;
		color: inherit;
		font-size: 11px;
		font-weight: 800;
		text-underline-offset: 3px;
	}
	@media (max-width: 620px) {
		.highlight-card {
			margin-right: -12px;
			margin-left: -12px;
			padding: 10px;
		}
		.poster-button {
			width: 100%;
		}
	}
</style>
