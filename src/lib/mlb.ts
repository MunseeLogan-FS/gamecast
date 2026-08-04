import { buildCurrentVisualizationUrl, buildHitHistoryUrl } from './visualization.js';

export const PIRATES_TEAM_ID = 134;
export const EASTERN_TIME_ZONE = 'America/New_York';
export const SCHEDULE_REFRESH_MS = 60_000;
export const AT_BAT_REFRESH_MS = 1_000;
export const BETWEEN_AT_BATS_REFRESH_MS = 10_000;
export const BETWEEN_INNINGS_REFRESH_MS = 15_000;
export const PREVIEW_REFRESH_MS = 60_000;

const API_ROOT = 'https://statsapi.mlb.com/api';

const LIVE_FIELDS = [
	'gamePk',
	'gameData',
	'status',
	'abstractGameState',
	'detailedState',
	'teams',
	'away',
	'home',
	'id',
	'name',
	'abbreviation',
	'venue',
	'dateTime',
	'weather',
	'temp',
	'condition',
	'wind',
	'gameInfo',
	'attendance',
	'firstPitch',
	'probablePitchers',
	'fullName',
	'liveData',
	'linescore',
	'currentInning',
	'currentInningOrdinal',
	'inningState',
	'inningHalf',
	'isTopInning',
	'scheduledInnings',
	'innings',
	'num',
	'ordinalNum',
	'runs',
	'hits',
	'errors',
	'leftOnBase',
	'offense',
	'defense',
	'batter',
	'onDeck',
	'inHole',
	'pitcher',
	'first',
	'second',
	'third',
	'balls',
	'strikes',
	'outs',
	'plays',
	'allPlays',
	'currentPlay',
	'result',
	'type',
	'event',
	'eventType',
	'description',
	'rbi',
	'awayScore',
	'homeScore',
	'about',
	'atBatIndex',
	'halfInning',
	'inning',
	'isComplete',
	'isScoringPlay',
	'matchup',
	'count'
].join(',');

export interface TeamRef {
	id: number;
	name: string;
	abbreviation?: string;
}

export interface ScheduleTeam {
	team: TeamRef;
	probablePitcher?: PersonRef;
	score?: number;
	isWinner?: boolean;
	leagueRecord?: { wins: number; losses: number; pct: string };
}

export interface GameStatus {
	abstractGameState: 'Preview' | 'Live' | 'Final' | string;
	detailedState: string;
	codedGameState?: string;
	statusCode?: string;
}

export interface ScheduleGame {
	gamePk: number;
	gameDate: string;
	gameNumber?: number;
	doubleHeader?: string;
	status: GameStatus;
	teams: { away: ScheduleTeam; home: ScheduleTeam };
	venue?: { id?: number; name: string };
	description?: string;
	seriesDescription?: string;
	seriesGameNumber?: number;
	gamesInSeries?: number;
	broadcasts?: Array<{
		name: string;
		type: string;
		homeAway?: 'home' | 'away';
		language?: string;
	}>;
}

export interface ScheduleResponse {
	dates: Array<{ date: string; games: ScheduleGame[] }>;
}

export interface PersonRef {
	id: number;
	fullName: string;
}

export interface BatSide {
	code: 'L' | 'R' | 'S' | string;
	description?: string;
}

export interface HitData {
	launchSpeed?: number;
	launchAngle?: number;
	totalDistance?: number;
	trajectory?: string;
	hardness?: string;
	location?: string;
	coordinates?: { coordX?: number; coordY?: number };
}

export interface PitchEvent {
	details?: {
		description?: string;
		code?: string;
		isBall?: boolean;
		isStrike?: boolean;
		isInPlay?: boolean;
		call?: { code?: string; description?: string };
		type?: { code?: string; description?: string };
	};
	count?: { balls?: number; strikes?: number; outs?: number };
	pitchData?: {
		startSpeed?: number;
		strikeZoneTop?: number;
		strikeZoneBottom?: number;
		coordinates?: {
			pX?: number;
			pZ?: number;
			x0?: number;
			y0?: number;
			z0?: number;
			vX0?: number;
			vY0?: number;
			vZ0?: number;
			aX?: number;
			aY?: number;
			aZ?: number;
		};
	};
	hitData?: HitData;
	isPitch?: boolean;
	type?: string;
}

export interface Play {
	result: {
		type?: string;
		event?: string;
		eventType?: string;
		description?: string;
		rbi?: number;
		awayScore?: number;
		homeScore?: number;
	};
	about: {
		atBatIndex: number;
		halfInning: 'top' | 'bottom';
		inning: number;
		isComplete: boolean;
		isScoringPlay?: boolean;
	};
	count?: { balls?: number; strikes?: number; outs?: number };
	matchup?: { batter?: PersonRef; pitcher?: PersonRef; batSide?: BatSide };
	playEvents?: PitchEvent[];
	atBatIndex?: number;
}

export interface InningLine {
	num: number;
	ordinalNum?: string;
	away?: { runs?: number };
	home?: { runs?: number };
}

export interface LineScore {
	currentInning?: number;
	currentInningOrdinal?: string;
	inningState?: string;
	inningHalf?: string;
	isTopInning?: boolean;
	scheduledInnings?: number;
	innings?: InningLine[];
	teams?: {
		away?: { runs?: number; hits?: number; errors?: number; leftOnBase?: number };
		home?: { runs?: number; hits?: number; errors?: number; leftOnBase?: number };
	};
	offense?: {
		batter?: PersonRef;
		onDeck?: PersonRef;
		inHole?: PersonRef;
		first?: PersonRef;
		second?: PersonRef;
		third?: PersonRef;
	};
	defense?: { pitcher?: PersonRef };
	balls?: number;
	strikes?: number;
	outs?: number;
}

export interface GameFeed {
	gamePk: number;
	gameData: {
		status: GameStatus;
		teams: { away: TeamRef; home: TeamRef };
		venue?: { id?: number; name: string; location?: { city?: string; stateAbbrev?: string } };
		probablePitchers?: { away?: PersonRef; home?: PersonRef };
		weather?: { temp?: number; condition?: string; wind?: string };
		gameInfo?: { attendance?: number; firstPitch?: string };
	};
	liveData: {
		plays: { allPlays: Play[]; currentPlay?: Play };
		linescore: LineScore;
	};
}

export interface GameBoxscorePlayer {
	person: PersonRef;
	jerseyNumber?: string;
	position?: { abbreviation?: string; name?: string };
	battingOrder?: string;
	gameStatus?: {
		isCurrentBatter?: boolean;
		isCurrentPitcher?: boolean;
		isOnBench?: boolean;
		isSubstitute?: boolean;
	};
	stats?: {
		batting?: Record<string, number | string>;
		pitching?: Record<string, number | string>;
	};
}

export interface GameBoxscoreTeam {
	team: TeamRef;
	players: Record<string, GameBoxscorePlayer>;
	batters: number[];
	pitchers: number[];
}

export interface GameBoxscore {
	teams: { away: GameBoxscoreTeam; home: GameBoxscoreTeam };
}

export interface LineupEntry {
	kind: 'batter' | 'pitcher';
	order: number | null;
	player: GameBoxscorePlayer;
}

export function lineupForTeam(team?: GameBoxscoreTeam): LineupEntry[] {
	if (!team) return [];
	const batters = team.batters
		.map((id) => team.players[`ID${id}`])
		.filter((player): player is GameBoxscorePlayer => !!player?.battingOrder)
		.sort((a, b) => Number(a.battingOrder) - Number(b.battingOrder))
		.map((player) => ({
			kind: 'batter' as const,
			order: Math.floor(Number(player.battingOrder) / 100),
			player
		}));
	const pitchers = team.pitchers
		.map((id) => team.players[`ID${id}`])
		.filter((player): player is GameBoxscorePlayer => !!player)
		.map((player) => ({ kind: 'pitcher' as const, order: null, player }));
	return [...batters, ...pitchers];
}

export interface PlayerStatRow {
	label: string;
	value: string;
}

export interface SeasonStatGroup {
	group: { displayName: 'hitting' | 'pitching' | string };
	splits: Array<{ stat: Record<string, number | string> }>;
}

export interface SeasonPlayerProfile {
	id: number;
	fullName: string;
	pitchHand?: { code?: string; description?: string };
	stats?: SeasonStatGroup[];
}

function seasonStat(
	player: SeasonPlayerProfile | undefined,
	group: 'hitting' | 'pitching'
): Record<string, number | string> {
	return player?.stats?.find((entry) => entry.group.displayName === group)?.splits[0]?.stat ?? {};
}

export function playerSeasonSummary(
	player: SeasonPlayerProfile | undefined,
	kind: LineupEntry['kind']
) {
	const stats = seasonStat(player, kind === 'pitcher' ? 'pitching' : 'hitting');
	if (kind === 'pitcher') {
		if (stats.era === undefined && stats.whip === undefined && stats.strikeOuts === undefined)
			return '';
		return `${statValue(stats.era)} ERA · ${statValue(stats.whip)} WHIP · ${statValue(stats.strikeOuts)} K`;
	}
	if (stats.avg === undefined && stats.ops === undefined && stats.homeRuns === undefined) return '';
	return `${statValue(stats.avg)} AVG · ${statValue(stats.ops)} OPS · ${statValue(stats.homeRuns)} HR`;
}

export function playerSeasonStats(
	player: SeasonPlayerProfile | undefined,
	kind: LineupEntry['kind']
): PlayerStatRow[] {
	if (kind === 'pitcher') {
		const stats = seasonStat(player, 'pitching');
		const record =
			stats.wins === undefined && stats.losses === undefined
				? '—'
				: `${statValue(stats.wins)}–${statValue(stats.losses)}`;
		return [
			{ label: 'Record', value: record },
			{ label: 'ERA', value: statValue(stats.era) },
			{ label: 'WHIP', value: statValue(stats.whip) },
			{ label: 'IP', value: statValue(stats.inningsPitched) },
			{ label: 'K', value: statValue(stats.strikeOuts) },
			{ label: 'BB', value: statValue(stats.baseOnBalls) },
			{ label: 'Starts', value: statValue(stats.gamesStarted) }
		];
	}
	const stats = seasonStat(player, 'hitting');
	return [
		{ label: 'AVG', value: statValue(stats.avg) },
		{ label: 'OBP', value: statValue(stats.obp) },
		{ label: 'SLG', value: statValue(stats.slg) },
		{ label: 'OPS', value: statValue(stats.ops) },
		{ label: 'HR', value: statValue(stats.homeRuns) },
		{ label: 'RBI', value: statValue(stats.rbi) },
		{ label: 'SB', value: statValue(stats.stolenBases) },
		{ label: 'PA', value: statValue(stats.plateAppearances) }
	];
}

function statValue(value: number | string | undefined) {
	return value === undefined || value === '' ? '—' : String(value);
}

export function playerGameStats(
	player: GameBoxscorePlayer,
	kind: LineupEntry['kind']
): PlayerStatRow[] {
	if (kind === 'pitcher') {
		const stats = player.stats?.pitching ?? {};
		return [
			{ label: 'IP', value: statValue(stats.inningsPitched) },
			{ label: 'H', value: statValue(stats.hits) },
			{ label: 'ER', value: statValue(stats.earnedRuns) },
			{ label: 'BB', value: statValue(stats.baseOnBalls) },
			{ label: 'K', value: statValue(stats.strikeOuts) },
			{ label: 'Pitches', value: statValue(stats.numberOfPitches ?? stats.pitchesThrown) }
		];
	}
	const stats = player.stats?.batting ?? {};
	const hitLine =
		stats.hits === undefined || stats.atBats === undefined
			? '—'
			: `${statValue(stats.hits)}–${statValue(stats.atBats)}`;
	return [
		{ label: 'H–AB', value: hitLine },
		{ label: 'R', value: statValue(stats.runs) },
		{ label: 'RBI', value: statValue(stats.rbi) },
		{ label: 'BB', value: statValue(stats.baseOnBalls) },
		{ label: 'K', value: statValue(stats.strikeOuts) },
		{ label: 'TB', value: statValue(stats.totalBases) }
	];
}

export interface VisualizationFeed {
	gamePk: number;
	liveData: { plays: { currentPlay?: Play } };
}

export interface HitHistory {
	allPlays: Play[];
}

function pad(value: number) {
	return String(value).padStart(2, '0');
}

export function easternDateKey(date = new Date()) {
	const parts = new Intl.DateTimeFormat('en-US', {
		timeZone: EASTERN_TIME_ZONE,
		year: 'numeric',
		month: '2-digit',
		day: '2-digit'
	}).formatToParts(date);
	const get = (type: Intl.DateTimeFormatPartTypes) =>
		parts.find((part) => part.type === type)?.value ?? '';
	return `${get('year')}-${get('month')}-${get('day')}`;
}

export function addDays(dateKey: string, days: number) {
	const [year, month, day] = dateKey.split('-').map(Number);
	const date = new Date(Date.UTC(year, month - 1, day + days));
	return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export async function fetchPiratesSchedule(dateKey: string, signal?: AbortSignal) {
	const params = new URLSearchParams({
		sportId: '1',
		teamId: String(PIRATES_TEAM_ID),
		startDate: dateKey,
		endDate: addDays(dateKey, 7),
		hydrate: 'team,linescore,probablePitcher,venue,weather,seriesStatus,broadcasts'
	});
	const response = await fetch(`${API_ROOT}/v1/schedule?${params}`, { signal });
	if (!response.ok) throw new Error(`MLB schedule request failed (${response.status})`);
	return (await response.json()) as ScheduleResponse;
}

export async function fetchGameFeed(gamePk: number, signal?: AbortSignal) {
	const params = new URLSearchParams({ fields: LIVE_FIELDS });
	const response = await fetch(`${API_ROOT}/v1.1/game/${gamePk}/feed/live?${params}`, { signal });
	if (!response.ok) throw new Error(`MLB game request failed (${response.status})`);
	return (await response.json()) as GameFeed;
}

export async function fetchGameBoxscore(gamePk: number, signal?: AbortSignal) {
	const response = await fetch(`${API_ROOT}/v1/game/${gamePk}/boxscore`, { signal });
	if (!response.ok) throw new Error(`MLB boxscore request failed (${response.status})`);
	return (await response.json()) as GameBoxscore;
}

export function previewProfileIds(
	feed?: { gameData?: { probablePitchers?: { away?: PersonRef; home?: PersonRef } } },
	boxscore?: {
		teams?: {
			away?: { batters?: number[] };
			home?: { batters?: number[] };
		};
	}
) {
	const ids = new Set<number>();
	const probable = feed?.gameData?.probablePitchers;
	if (probable?.away?.id) ids.add(probable.away.id);
	if (probable?.home?.id) ids.add(probable.home.id);
	for (const id of boxscore?.teams?.away?.batters ?? []) ids.add(id);
	for (const id of boxscore?.teams?.home?.batters ?? []) ids.add(id);
	return [...ids];
}

export function buildSeasonProfilesUrl(root: string, ids: number[], season: number) {
	const params = new URLSearchParams({
		personIds: [...new Set(ids)].join(','),
		hydrate: `stats(group=[hitting,pitching],type=[season],season=${season}),currentTeam`
	});
	return `${root}/v1/people?${params}`;
}

export async function fetchSeasonProfiles(ids: number[], season: number, signal?: AbortSignal) {
	if (!ids.length) return [];
	const response = await fetch(buildSeasonProfilesUrl(API_ROOT, ids, season), { signal });
	if (!response.ok) throw new Error(`MLB player stats request failed (${response.status})`);
	const data = (await response.json()) as { people?: SeasonPlayerProfile[] };
	return data.people ?? [];
}

export async function fetchCurrentVisualization(gamePk: number, signal?: AbortSignal) {
	const response = await fetch(buildCurrentVisualizationUrl(API_ROOT, gamePk), { signal });
	if (!response.ok) throw new Error(`MLB pitch visualization request failed (${response.status})`);
	return (await response.json()) as VisualizationFeed;
}

export async function fetchHitHistory(gamePk: number, signal?: AbortSignal) {
	const response = await fetch(buildHitHistoryUrl(API_ROOT, gamePk), { signal });
	if (!response.ok) throw new Error(`MLB batted-ball request failed (${response.status})`);
	return (await response.json()) as HitHistory;
}

export function isLive(status?: GameStatus) {
	return status?.abstractGameState === 'Live';
}

export function isFinal(status?: GameStatus) {
	return status?.abstractGameState === 'Final';
}

export function isPreview(status?: GameStatus) {
	return status?.abstractGameState === 'Preview';
}

export function liveRefreshDelay(linescore?: LineScore, currentPlay?: Play) {
	if (/^(middle|end)/i.test(linescore?.inningState?.trim() ?? '')) {
		return BETWEEN_INNINGS_REFRESH_MS;
	}
	if (currentPlay && !currentPlay.about.isComplete) return AT_BAT_REFRESH_MS;
	return BETWEEN_AT_BATS_REFRESH_MS;
}

export function teamLogo(teamId?: number) {
	return teamId ? `https://www.mlbstatic.com/team-logos/${teamId}.svg` : '';
}
