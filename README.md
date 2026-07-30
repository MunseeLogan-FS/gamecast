# Pirates Gamecast

A Pittsburgh Pirates game-day tracker built with SvelteKit and MLB's public Stats API.

**Live site:** [pirates.munsee.dev](https://pirates.munsee.dev/)

**Recorded tracking showcase:** [pirates.munsee.dev/demo/](https://pirates.munsee.dev/demo/)

The site checks the Pirates schedule automatically, shows a pregame preview, and switches to live coverage when the game begins. Completed games stay available for postgame review. It does not need an API key, account, database, or custom backend.

## Game states

The main route handles schedule discovery, polling, request cancellation, and game selection. It chooses the page layout from the current MLB game state:

```text
Loading          → compact loading state
No game today    → OffDayView
Preview          → GamePreview
Live/final       → GameScoreboard + LiveDashboard
```

### Off day

- Shows when there is no Pirates game today
- Includes the next matchup, opponent logo, local start time, and venue when available
- Checks the schedule every minute and moves to the preview on game day

### Pregame preview

- Away-at-home matchup without showing a pregame `0–0`
- Team records, local first pitch, venue, series context, broadcasts, and weather when MLB supplies them
- Probable starters with season statistics
- Starting lineups with confirmed or pending states
- Both lineups on desktop and team tabs on mobile
- Player profiles with season statistics inside the lineup panel
- No empty live tracker, play log, base state, or balls/strikes/outs

### Live and final

- Score, inning line, game status, count, outs, and occupied bases when applicable
- Current batter/pitcher context and latest play
- Estimated MLB pitch-location and batted-ball visualizations
- Interactive team lineups, pitchers used, and game-stat player profiles
- Reverse-chronological play-by-play with all-play and scoring-play filters
- Polling that slows between plays and stops once the game is final

### Tracking demo

The `/demo` page uses recorded game data so the tracking views can be explored between games. Recorded data stays out of the main gamecast.

## Data source

The app reads keyless, CORS-enabled MLB Stats API endpoints, including:

```text
GET https://statsapi.mlb.com/api/v1/schedule
GET https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live?fields=...
GET https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore
GET https://statsapi.mlb.com/api/v1/game/{gamePk}/playByPlay?fields=...
GET https://statsapi.mlb.com/api/v1/people/{personId}/stats
```

Requests use MLB's `fields` option where practical to keep payloads small. The preview has fallback states for probable pitchers, lineups, weather, broadcasts, and player statistics that MLB has not posted yet.

Pitch and contact positions are **estimated MLB tracking visualizations**. They are not exact physical locations or an independent judgment of umpire accuracy.

This is an unofficial project and is not affiliated with or endorsed by Major League Baseball or the Pittsburgh Pirates. MLB controls API availability and response shape.

## Technology

- Svelte 5 with runes
- SvelteKit
- TypeScript
- Native CSS and SVG
- Vite
- `@sveltejs/adapter-static`
- Node's built-in test runner
- ESLint and Prettier with Svelte support

## Development

```sh
npm install
npm run dev
```

Development server port and Host rules are configured in `vite.config.ts`.

## Quality gates

Before deploying, run:

```sh
npm run format
npm run lint
npm run check
npm test
npm run build
```

The static production output is written to `build/`.

## Project structure

```text
src/lib/components/GamePreview.svelte     Pregame matchup, starters, details, and lineups
src/lib/components/GameScoreboard.svelte  Live/final score and innings table
src/lib/components/LiveDashboard.svelte   Matchup, tracking, lineup, and play-by-play layout
src/lib/components/OffDayView.svelte      No-game-today and Next Up presentation
src/lib/components/LineupPanel.svelte     Live/final lineup and game-stat player profiles
src/lib/GameVisualization.svelte          Pitch zone and batted-ball visualization
src/lib/mlb.ts                            MLB types, projections, normalization, and requests
src/lib/visualization.js                  Tested geometry, classification, and URL helpers
src/lib/demo-data.js                      Recorded telemetry used only by /demo
src/routes/+page.svelte                   Schedule lifecycle, polling, and state routing
src/routes/demo/+page.svelte              Standalone recorded tracking showcase
test/visualization.test.mjs               Data, state, architecture, and visualization regressions
```

## Deployment notes

The app is prerendered with `@sveltejs/adapter-static`. Production files are written to `build/` and can be served by a static host. SvelteKit's immutable assets can use long cache times, while route documents should be revalidated so a deployment does not mix old pages with new chunks.
