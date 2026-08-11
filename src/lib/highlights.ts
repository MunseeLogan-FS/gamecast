import type { Play } from './mlb.js';

export const HIGHLIGHT_REFRESH_MS = 60_000;
const API_ROOT = 'https://statsapi.mlb.com/api';

export type HighlightCategory =
	'home-run' | 'abs' | 'review' | 'steal' | 'run' | 'hit' | 'highlight';

export interface GameHighlight {
	key: string;
	id: string;
	slug: string;
	guid?: string;
	title: string;
	publishedAt: string;
	duration?: string;
	thumbnail?: string;
	mlbHostedUrl?: string;
	captionUrl?: string;
	canonicalUrl: string;
	taxonomy: string[];
	playerIds: number[];
}

export interface MatchedHighlight extends GameHighlight {
	category: HighlightCategory;
	atBatIndex?: number;
	matchKind: 'play-id' | 'standalone';
}

interface RawKeyword {
	type?: string;
	value?: string;
}

interface RawPlayback {
	name?: string;
	url?: string;
}

interface RawImageCut {
	aspectRatio?: string;
	width?: number;
	height?: number;
	src?: string;
}

interface RawHighlightItem {
	type?: string;
	state?: string;
	id?: string;
	slug?: string;
	title?: string;
	headline?: string;
	blurb?: string;
	date?: string;
	mediaPlaybackId?: string;
	guid?: string;
	duration?: string;
	cclocationVtt?: string;
	keywordsAll?: RawKeyword[];
	image?: { cuts?: RawImageCut[] };
	playbacks?: RawPlayback[];
}

interface RawGameContent {
	highlights?: Record<string, { items?: RawHighlightItem[] }>;
}

export function buildGameContentUrl(root: string, gamePk: number) {
	if (!Number.isSafeInteger(gamePk) || gamePk <= 0) throw new Error('Invalid gamePk');
	return `${root}/v1/game/${gamePk}/content`;
}

function officialHighlightUrl(slug: string) {
	return /^[a-z0-9-]+$/.test(slug) ? `https://www.mlb.com/video/${slug}` : '';
}

function trustedMlbMediaUrl(value?: string) {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' && url.hostname.endsWith('.mlb.com') ? value : undefined;
	} catch {
		return undefined;
	}
}

function trustedCaptionUrl(value?: string) {
	if (!value) return undefined;
	try {
		const url = new URL(value);
		return url.protocol === 'https:' &&
			(url.hostname.endsWith('.mlb.com') || url.hostname.endsWith('.mlbstatic.com'))
			? value
			: undefined;
	} catch {
		return undefined;
	}
}

function selectThumbnail(cuts: RawImageCut[] = []) {
	const landscape = cuts.filter((cut) => cut.aspectRatio === '16:9' && trustedCaptionUrl(cut.src));
	const selected =
		landscape.find((cut) => cut.width === 640 && cut.height === 360)?.src ??
		landscape.sort((a, b) => Math.abs((a.width ?? 0) - 640) - Math.abs((b.width ?? 0) - 640))[0]
			?.src;
	return trustedCaptionUrl(selected);
}

export function normalizeGameContent(payload: unknown): GameHighlight[] {
	const content = payload as RawGameContent;
	const groups =
		content?.highlights && typeof content.highlights === 'object'
			? Object.values(content.highlights)
			: [];
	const seen = new Set<string>();
	const highlights: GameHighlight[] = [];

	for (const group of groups) {
		for (const item of group?.items ?? []) {
			if (item.type !== 'video' || item.state !== 'A') continue;
			const taxonomy = (item.keywordsAll ?? [])
				.filter((keyword) => keyword.type === 'taxonomy' && keyword.value)
				.map((keyword) => keyword.value as string);
			if (!taxonomy.includes('in-game-highlight')) continue;

			const id = item.id ?? '';
			const slug = item.slug ?? id;
			const key = item.mediaPlaybackId ?? id;
			const canonicalUrl = officialHighlightUrl(slug);
			if (!key || !canonicalUrl || seen.has(key)) continue;

			seen.add(key);
			const playback = item.playbacks?.find((candidate) => candidate.name === 'mp4Avc');
			const playerIds = (item.keywordsAll ?? [])
				.filter((keyword) => keyword.type === 'player_id')
				.map((keyword) => Number(keyword.value))
				.filter((id) => Number.isSafeInteger(id) && id > 0);
			highlights.push({
				key,
				id,
				slug,
				guid: item.guid || undefined,
				title: item.title ?? item.headline ?? item.blurb ?? 'MLB highlight',
				publishedAt: item.date ?? '',
				duration: item.duration,
				thumbnail: selectThumbnail(item.image?.cuts),
				mlbHostedUrl: trustedMlbMediaUrl(playback?.url),
				captionUrl: trustedCaptionUrl(item.cclocationVtt),
				canonicalUrl,
				taxonomy,
				playerIds
			});
		}
	}

	return highlights;
}

function categoryFromTaxonomy(highlight: GameHighlight): HighlightCategory | undefined {
	if (highlight.taxonomy.includes('abs')) return 'abs';
	if (highlight.taxonomy.includes('challenge') || highlight.taxonomy.includes('replay')) {
		return 'review';
	}
	if (highlight.taxonomy.includes('home-run')) return 'home-run';
	if (highlight.taxonomy.includes('stolen-base')) return 'steal';
	return undefined;
}

function categoryForPlay(highlight: GameHighlight, play: Play): HighlightCategory | undefined {
	const taxonomyCategory = categoryFromTaxonomy(highlight);
	if (taxonomyCategory === 'abs') return taxonomyCategory;
	const eventType = play.result.eventType;
	if (eventType === 'home_run') return 'home-run';
	if (eventType === 'stolen_base') return 'steal';
	if (play.about.isScoringPlay) return 'run';
	if (eventType === 'single' || eventType === 'double' || eventType === 'triple') return 'hit';
	return taxonomyCategory ?? 'highlight';
}

export function matchHighlightsToPlays(highlights: GameHighlight[], plays: Play[]) {
	const byPlayId = new Map<string, Play>();
	for (const play of plays) {
		for (const event of play.playEvents ?? []) {
			if (event.playId) byPlayId.set(event.playId, play);
		}
	}

	const byAtBatIndex: Record<number, MatchedHighlight[]> = {};
	const standalone: MatchedHighlight[] = [];
	for (const highlight of highlights) {
		const play = highlight.guid ? byPlayId.get(highlight.guid) : undefined;
		if (play) {
			const category = categoryForPlay(highlight, play);
			if (!category) continue;
			const matched = {
				...highlight,
				category,
				atBatIndex: play.about.atBatIndex,
				matchKind: 'play-id' as const
			};
			(byAtBatIndex[play.about.atBatIndex] ??= []).push(matched);
			continue;
		}

		const category = categoryFromTaxonomy(highlight);
		if (category) standalone.push({ ...highlight, category, matchKind: 'standalone' });
	}

	return { byAtBatIndex, standalone };
}

export async function fetchGameHighlights(gamePk: number, signal?: AbortSignal) {
	const response = await fetch(buildGameContentUrl(API_ROOT, gamePk), { signal });
	if (!response.ok) throw new Error(`MLB highlights request failed (${response.status})`);
	return normalizeGameContent(await response.json());
}
