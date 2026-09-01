import { PIRATES_TEAM_ID, isFinal, isLive, isPreview, type ScheduleGame } from './mlb';

export type GameLifecycleGroup = 'live' | 'preview' | 'final' | 'other';

export function isPiratesGame(game: ScheduleGame) {
	return game.teams.home.team.id === PIRATES_TEAM_ID || game.teams.away.team.id === PIRATES_TEAM_ID;
}

export function gameLifecycleGroup(game: ScheduleGame): GameLifecycleGroup {
	if (/delayed|postponed|suspended|cancelled/i.test(game.status.detailedState ?? ''))
		return 'other';
	if (isLive(game.status)) return 'live';
	if (isPreview(game.status)) return 'preview';
	if (isFinal(game.status)) return 'final';
	return 'other';
}

const lifecycleRank: Record<GameLifecycleGroup, number> = {
	live: 0,
	preview: 1,
	final: 2,
	other: 3
};

function timeValue(game: ScheduleGame) {
	const value = new Date(game.gameDate).getTime();
	return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function orderTodayGames(games: ScheduleGame[]) {
	return [...games].sort((left, right) => {
		const leftPirates = isPiratesGame(left);
		const rightPirates = isPiratesGame(right);
		if (leftPirates !== rightPirates) return leftPirates ? -1 : 1;
		if (leftPirates && rightPirates) return timeValue(left) - timeValue(right);
		const rankDifference =
			lifecycleRank[gameLifecycleGroup(left)] - lifecycleRank[gameLifecycleGroup(right)];
		return rankDifference || timeValue(left) - timeValue(right);
	});
}

export function activeSlateDate(
	currentDate: string,
	games: Array<ScheduleGame & { scheduleDate?: string }>
) {
	const priorLiveDates = games
		.filter((game) => game.scheduleDate && game.scheduleDate < currentDate && isLive(game.status))
		.map((game) => game.scheduleDate as string)
		.sort();
	return priorLiveDates.at(-1) ?? currentDate;
}

function preferredGame(games: ScheduleGame[]) {
	const ordered = orderTodayGames(games);
	const pirates = ordered.filter(isPiratesGame);
	for (const group of ['live', 'preview', 'final', 'other'] as const) {
		const match = pirates.find((game) => gameLifecycleGroup(game) === group);
		if (match) return match;
	}
	for (const group of ['live', 'preview'] as const) {
		const match = ordered.find((game) => gameLifecycleGroup(game) === group);
		if (match) return match;
	}
	const finals = ordered
		.filter((game) => gameLifecycleGroup(game) === 'final')
		.sort((left, right) => timeValue(right) - timeValue(left));
	return finals[0] ?? ordered[0] ?? null;
}

export function chooseInitialGame(games: ScheduleGame[], requestedGamePk?: number | null) {
	if (requestedGamePk) {
		const requested = games.find((game) => game.gamePk === requestedGamePk);
		if (requested) return requested;
	}
	return preferredGame(games);
}

export function preserveOrChooseGame(games: ScheduleGame[], selectedGamePk?: number | null) {
	if (selectedGamePk) {
		const current = games.find((game) => game.gamePk === selectedGamePk);
		if (current) return current;
	}
	return preferredGame(games);
}
