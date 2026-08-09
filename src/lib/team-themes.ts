import { PIRATES_TEAM_ID, type ScheduleGame } from './mlb';

export interface TeamTheme {
	primary: string;
	accent: string;
	onAccent: string;
	muted: string;
}

function theme(primary: string, accent: string, onAccent: '#ffffff' | '#111111', muted: string) {
	return { primary, accent, onAccent, muted } satisfies TeamTheme;
}

export const NEUTRAL_TEAM_THEME = theme('#292a27', '#5d625d', '#ffffff', '#e5e6e2');

export const MLB_TEAM_THEMES: Readonly<Record<number, TeamTheme>> = {
	108: theme('#ba0021', '#ba0021', '#ffffff', '#f5dce1'), // Angels
	109: theme('#a71930', '#a71930', '#ffffff', '#f1dce0'), // Diamondbacks
	110: theme('#27251f', '#df4601', '#111111', '#f7dfd2'), // Orioles
	111: theme('#0c2340', '#bd3039', '#ffffff', '#eedadd'), // Red Sox
	112: theme('#0e3386', '#0e3386', '#ffffff', '#dce3f2'), // Cubs
	113: theme('#c6011f', '#c6011f', '#ffffff', '#f4d9de'), // Reds
	114: theme('#00385d', '#e50022', '#ffffff', '#f5d7dc'), // Guardians
	115: theme('#33006f', '#33006f', '#ffffff', '#e4daee'), // Rockies
	116: theme('#0c2340', '#0c2340', '#ffffff', '#dbe0e5'), // Tigers
	117: theme('#002d62', '#eb6e1f', '#111111', '#fae2d3'), // Astros
	118: theme('#004687', '#004687', '#ffffff', '#d9e4ee'), // Royals
	119: theme('#005a9c', '#005a9c', '#ffffff', '#d9e7f1'), // Dodgers
	120: theme('#ab0003', '#ab0003', '#ffffff', '#efd8d9'), // Nationals
	121: theme('#002d72', '#e95b1c', '#111111', '#f9e0d4'), // Mets
	133: theme('#003831', '#e8b721', '#111111', '#f8edca'), // Athletics
	134: theme('#111111', '#fdb827', '#111111', '#fff0c9'), // Pirates
	135: theme('#2f241d', '#ffc425', '#111111', '#fff0c5'), // Padres
	136: theme('#0c2c56', '#008c95', '#111111', '#d5ecee'), // Mariners
	137: theme('#27251f', '#fd5a1e', '#111111', '#fee0d5'), // Giants
	138: theme('#c41e3a', '#c41e3a', '#ffffff', '#f2dce1'), // Cardinals
	139: theme('#092c5c', '#8fbce6', '#111111', '#e6f0f8'), // Rays
	140: theme('#003278', '#c0111f', '#ffffff', '#f0dadd'), // Rangers
	141: theme('#134a8e', '#134a8e', '#ffffff', '#dde5f0'), // Blue Jays
	142: theme('#002b5c', '#d31145', '#ffffff', '#f3d9e1'), // Twins
	143: theme('#002d72', '#cf1124', '#ffffff', '#f9d8db'), // Phillies
	144: theme('#13274f', '#ce1141', '#ffffff', '#f2d9e0'), // Braves
	145: theme('#27251f', '#5c5d5f', '#ffffff', '#e5e5e5'), // White Sox
	146: theme('#00a3e0', '#00a3e0', '#111111', '#d4eff9'), // Marlins
	147: theme('#003087', '#003087', '#ffffff', '#dbe2ef'), // Yankees
	158: theme('#12284b', '#ffc52f', '#111111', '#fff2c9') // Brewers
};

function channel(value: string) {
	const normalized = Number.parseInt(value, 16) / 255;
	return normalized <= 0.04045 ? normalized / 12.92 : Math.pow((normalized + 0.055) / 1.055, 2.4);
}

function luminance(hex: string) {
	const value = hex.replace('#', '');
	return (
		0.2126 * channel(value.slice(0, 2)) +
		0.7152 * channel(value.slice(2, 4)) +
		0.0722 * channel(value.slice(4, 6))
	);
}

export function contrastRatio(left: string, right: string) {
	const first = luminance(left);
	const second = luminance(right);
	return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}

export function themeForGame(game?: ScheduleGame | null) {
	if (!game) return NEUTRAL_TEAM_THEME;
	const homeId = game.teams.home.team.id;
	const awayId = game.teams.away.team.id;
	if (homeId === PIRATES_TEAM_ID || awayId === PIRATES_TEAM_ID) {
		return MLB_TEAM_THEMES[PIRATES_TEAM_ID];
	}
	return MLB_TEAM_THEMES[homeId] ?? NEUTRAL_TEAM_THEME;
}
