# Pirates Gamecast

A focused, responsive Pittsburgh Pirates game-day viewer built with SvelteKit and MLB's public Stats API.

**Live site:** [pirates.munsee.dev](https://pirates.munsee.dev/)

**Recorded tracking showcase:** [pirates.munsee.dev/demo/](https://pirates.munsee.dev/demo/)

The application discovers the Pirates schedule automatically, presents a purposeful pregame preview, transitions into live coverage without a reload, and preserves the completed game for postgame review. It uses no API key, account, database, or custom backend.

## Game states

The home route owns schedule discovery, request cancellation, polling, selected-game lifecycle, and top-level state routing. Substantial UI regions are served according to MLB state and available data:

```text
Loading          → compact loading state
No game today    → OffDayView
Preview          → GamePreview
Live/final       → GameScoreboard + LiveDashboard
```

### Off day

- Clearly states that there is no Pirates game today
- Shows the next scheduled matchup, opponent logo, local start time, and venue when available
- Refreshes the schedule every minute and advances automatically when the Eastern game date begins

### Pregame preview

- Away-at-home matchup without an artificial `0–0` score
- Team records, local first pitch, venue, series context, broadcasts, and weather when MLB supplies them
- Probable starters with season statistics
- Starting lineups with explicit confirmed or pending states
- Both lineups on desktop and team tabs on mobile
- Panel-contained player profiles with season statistics
- No empty live tracker, play log, base state, or balls/strikes/outs

### Live and final

- Score, inning line, game status, count, outs, and occupied bases when applicable
- Current batter/pitcher context and latest play
- Estimated MLB pitch-location and batted-ball visualizations
- Interactive team lineups, pitchers used, and game-stat player profiles
- Reverse-chronological play-by-play with all-play and scoring-play filters
- Phase-aware polling that stops once the game is final

### Tracking demo

Recorded game telemetry is isolated to `/demo`. The normal schedule-driven route never substitutes sample data when live MLB tracking is unavailable.

## Data source

The app reads keyless, CORS-enabled MLB Stats API endpoints, including:

```text
GET https://statsapi.mlb.com/api/v1/schedule
GET https://statsapi.mlb.com/api/v1.1/game/{gamePk}/feed/live?fields=...
GET https://statsapi.mlb.com/api/v1/game/{gamePk}/boxscore
GET https://statsapi.mlb.com/api/v1/game/{gamePk}/playByPlay?fields=...
GET https://statsapi.mlb.com/api/v1/people/{personId}/stats
```

Requests use MLB's `fields` projection where practical to reduce payload size. Missing probable pitchers, lineups, weather, broadcasts, or player statistics are handled explicitly rather than invented.

Pitch and contact positions are **estimated MLB tracking visualizations**. They are not exact GPS locations or an independent judgment of umpire accuracy.

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

The development server uses strict port and Host validation configured in `vite.config.ts`.

## Quality gates

Run the complete local verification sequence before deployment:

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

The application is fully prerendered with `@sveltejs/adapter-static`. Serve `build/` through a durable static process or hosting platform. Immutable SvelteKit assets can be cached long-term; route documents should be revalidated or served with conservative caching so deployments do not mix old route manifests with new chunks.
