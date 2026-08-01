# Catcher-Facing Pitch Trajectory Replay Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Replace the flat Zone plot with a lightweight catcher-facing 2.5D replay that reconstructs each completed pitch from MLB telemetry, preserves every pitch in the active at-bat, and safely falls back to the authoritative plate endpoint when full kinematics are unavailable.

**Architecture:** Keep the existing top-level Zone/Contact state machine. Extract pitch rendering into a dedicated `PitchTrajectory.svelte` component and put validation, physical trajectory sampling, and SVG projection in a pure `pitch-trajectory.js` module. MLB coordinates remain in feet until projection; the latest pitch auto-selects after feed arrival, prior numbered endpoints remain selectable, and no UI implies that this is real-time tracking.

**Tech Stack:** SvelteKit 5 runes, JavaScript geometry helpers with JSDoc checking, TypeScript feed interfaces, SVG/CSS animation, Node test runner, Vite SSR component tests, MLB StatsAPI telemetry.

---

## Product Contract

### User experience

- Keep only the existing **Zone** and **Contact** controls; do not add a third top-level mode.
- Zone becomes a catcher-facing 2.5D pitch-flight view.
- Show all pitches from the active at-bat as numbered plate endpoints.
- Emphasize only the selected pitch's full path to avoid visual clutter; render prior complete paths as faint context or hide their curves while retaining endpoints after browser comparison.
- Automatically select and replay the newest genuinely reported pitch.
- Let a user click or keyboard-focus any numbered endpoint to select and replay that pitch.
- Preserve a manual historical-pitch selection until a genuinely new pitch arrives. Unrelated reactive changes must not force selection back to the latest pitch.
- Keep the batter-side badge and existing pitch summary/call classification.
- Treat each trajectory as a replay after MLB reports the completed pitch. Never imply low-latency ball tracking.
- Under `prefers-reduced-motion: reduce`, render the completed path immediately with no travel animation.

### Truth and fallback rules

1. MLB's `pX` and `pZ` are the authoritative plate endpoint.
2. When all finite kinematic values are present, reconstruct the flight with:
   - `x(t) = x0 + vX0*t + 0.5*aX*t²`
   - `y(t) = y0 + vY0*t + 0.5*aY*t²`
   - `z(t) = z0 + vZ0*t + 0.5*aZ*t²`
3. Find the plate-crossing time from the smallest valid positive root of `y(t) = 0`; use bounded `plateTime` only as a fallback when the root cannot be solved safely.
4. Sample 18–24 physical points from release to plate. Append/snap only the final sample to authoritative `pX/pZ`; do not distort the entire physical path to conceal provider-model drift.
5. If full kinematics are missing or malformed but finite `pX/pZ` exists, render the existing endpoint-only representation for that pitch.
6. If `pX/pZ` is missing or malformed, omit that pitch from geometry while retaining any safe textual pitch information.
7. Never coerce `null`, strings, `Infinity`, or `NaN` into geometry.

### MVP boundary

Included:

- Completed-pitch replay
- Physical trajectory reconstruction
- Catcher-facing SVG projection
- All active-at-bat endpoints
- Select/replay prior pitches
- Endpoint fallback
- Accessible labels
- Mobile/reduced-motion support
- Real recorded demo telemetry

Deferred:

- Real-time in-flight animation before the pitch is complete
- WebGL, Three.js, or free-camera 3D
- Batter/catcher silhouettes
- Spin-axis animation or seam rendering
- Predicted pitch paths
- Cross-game trajectory archive
- User-controlled camera angles
- Historical Statcast search

---

## Validated Feed Facts

Reference feed: MLB game `823350`, at-bat index `108` (the existing recorded demo).

- 7 pitches are present.
- All 7 include `x0/y0/z0`, `vX0/vY0/vZ0`, `aX/aY/aZ`, `pX/pZ`, and `plateTime`.
- MLB also supplies `endSpeed`, `extension`, `pfxX/pfxZ`, and `breaks` (`spinRate`, `spinDirection`, break measurements).
- A separate 334-pitch reference game (`776879`) used the same complete 15-coordinate key set for every pitch.
- `plateTime` is not guaranteed to be the exact root of `y(t)=0`; the physical root should be preferred and the recorded `pX/pZ` endpoint preserved.

---

### Task 1: Expand the projected MLB feed contract

**Objective:** Request and type only the additional telemetry needed for replay without bloating hit-history requests.

**Files:**

- Modify: `src/lib/visualization.js`
- Modify: `src/lib/mlb.ts`
- Test: `test/visualization.test.mjs`

**Step 1: Write the failing field-projection test**

Extend the current-play URL test to require:

- `endSpeed`
- `plateTime`
- `extension`
- `x0`, `y0`, `z0`
- `vX0`, `vY0`, `vZ0`
- `aX`, `aY`, `aZ`
- `pfxX`, `pfxZ`
- `breaks`, `spinRate`, `spinDirection`

Also assert these fields are absent from `buildHitHistoryUrl`, because contact history does not need pitch-flight payloads.

**Step 2: Run the focused test and verify RED**

Run:

```bash
node --test --test-name-pattern='tiny current-play URL|hit-history URL' test/visualization.test.mjs
```

Expected: failure because the current visualization projection excludes the kinematic fields.

**Step 3: Update the feed projection and interfaces**

Expand `CURRENT_VISUALIZATION_FIELDS` only. Extend `PitchEvent.pitchData` with optional finite-at-runtime fields and a nested `breaks` interface. Keep every field optional because MLB telemetry can be absent.

**Step 4: Run focused and static checks**

```bash
node --test --test-name-pattern='tiny current-play URL|hit-history URL' test/visualization.test.mjs
npm run check
```

Expected: passing tests and zero Svelte diagnostics.

**Step 5: Commit**

```bash
git add src/lib/visualization.js src/lib/mlb.ts test/visualization.test.mjs
git commit -m "feat: project MLB pitch trajectory telemetry"
```

---

### Task 2: Build the validated physical trajectory sampler

**Objective:** Convert complete MLB kinematics into a small, deterministic path in physical feet.

**Files:**

- Create: `src/lib/pitch-trajectory.js`
- Test: `test/pitch-trajectory.test.mjs`

**Step 1: Add a real recorded fixture**

Place one complete pitch from game `823350` directly in the test file or a small test fixture module. Include a malformed variant and an endpoint-only variant. Do not perform network calls in tests.

**Step 2: Write failing tests for validation**

Cover:

- Complete finite telemetry is accepted.
- `null`, numeric strings, `NaN`, and infinities are rejected.
- Missing acceleration chooses endpoint fallback rather than fabricated motion.
- Finite `pX/pZ` remains usable when flight telemetry is absent.

**Step 3: Write failing tests for plate time**

Test `solvePlateCrossingTime` with:

- The real quadratic sample.
- Near-linear `aY ≈ 0`.
- No real root.
- Negative-only roots.
- Implausible roots outside a safe pitch-flight window.
- Bounded `plateTime` fallback.

Use a reasonable accepted range such as `0.2–0.8 s`; constants must be named and documented.

**Step 4: Write failing tests for sampled physics**

Test `samplePitchTrajectory`:

- Returns 18–24 ordered physical samples.
- First point equals release coordinates.
- `y` decreases monotonically toward the plate for valid telemetry.
- Intermediate points obey the kinematic equation within tolerance.
- Final point has `y = 0` and exact authoritative `x = pX`, `z = pZ`.
- Input telemetry is not mutated.

**Step 5: Implement minimal pure helpers**

Suggested exports:

```js
isFiniteNumber(value);
normalizePitchTelemetry(pitchData);
solvePlateCrossingTime(telemetry);
samplePitchTrajectory(pitchData, (sampleCount = 20));
```

Return a discriminated result:

```js
{
	kind: ('trajectory', points, endpoint, duration, endpointDrift);
}
{
	kind: ('endpoint', endpoint);
}
{
	kind: 'unavailable';
}
```

Keep `endpointDrift` internal for diagnostics/tests; do not expose confidence UI.

**Step 6: Run focused tests**

```bash
node --test test/pitch-trajectory.test.mjs
npm run check
```

Expected: all trajectory tests pass and static checking is clean.

**Step 7: Commit**

```bash
git add src/lib/pitch-trajectory.js test/pitch-trajectory.test.mjs
git commit -m "feat: reconstruct physical pitch trajectories"
```

---

### Task 3: Project physical flight into a catcher-facing 2.5D view

**Objective:** Convert physical `(x,y,z)` samples into an SVG perspective without changing source geometry.

**Files:**

- Modify: `src/lib/pitch-trajectory.js`
- Test: `test/pitch-trajectory.test.mjs`

**Step 1: Define a named projection contract**

Add a frozen view configuration for:

- SVG width/height
- Plate center and near-plane baseline
- Release/horizon center
- Horizontal feet-to-pixel scaling
- Vertical height scaling
- Near/far perspective scale
- Safe inset

The camera is fixed behind the catcher looking toward the mound. Avoid representing rendering coordinates as surveyed camera calibration.

**Step 2: Write failing projection tests**

Cover:

- Every finite physical sample projects to finite SVG coordinates.
- Release appears farther/smaller and above the plate plane.
- Plate endpoint projects to the same horizontal/vertical strike-zone coordinates used by the authoritative `pX/pZ` plot.
- Positive and negative `pX` map consistently with the existing catcher-facing orientation.
- Extreme but finite paths clamp only rendered points, never physical points.
- The projected path stays inside the viewBox safe inset.

**Step 3: Implement projection**

Suggested export:

```js
projectPitchTrajectory(result, zoneTop, zoneBottom);
```

Return physical data untouched alongside projected path data:

```js
{
	(physicalPoints, displayPoints, endpoint, endpointDisplay, clipped);
}
```

Use SVG path generation from projected samples. Do not add spline smoothing until the piecewise path is visually validated; a misleading spline can overshoot the authoritative endpoint.

**Step 4: Run focused tests**

```bash
node --test test/pitch-trajectory.test.mjs
```

**Step 5: Commit**

```bash
git add src/lib/pitch-trajectory.js test/pitch-trajectory.test.mjs
git commit -m "feat: project catcher-facing pitch flight"
```

---

### Task 4: Create the stateful trajectory component

**Objective:** Render, select, and replay pitch paths behind a clear component boundary.

**Files:**

- Create: `src/lib/components/PitchTrajectory.svelte`
- Modify: `test/rendering.test.mjs`
- Test: `test/pitch-trajectory.test.mjs`

**Step 1: Define component props**

The component should receive normalized display inputs, not fetch data:

```ts
{
  pitches: PitchEvent[];
  atBatIndex?: number;
  strikeZoneTop: number;
  strikeZoneBottom: number;
  batSide?: BatSide;
  live?: boolean;
}
```

Internally derive stable pitch keys as `atBatIndex:pitchNumber`.

**Step 2: Write failing SSR output tests**

Using the existing shared Vite/Svelte SSR harness, assert that:

- A complete pitch renders a trajectory path and numbered endpoint.
- Endpoint-only data renders a marker without a path.
- Malformed telemetry renders neither invalid SVG numbers nor a false path.
- The SVG accessible label includes pitch number, type, speed, call, and recorded plate location.
- The batter-side badge remains present.

**Step 3: Write the selection-state reducer tests**

Put selection logic in a pure helper if necessary. Cover:

- Initial mount selects newest pitch.
- A genuinely new pitch selects it automatically.
- Manual selection of an older pitch persists through unrelated prop updates.
- At-bat/game changes reset selection to the new newest pitch.
- Selecting an endpoint changes the emphasized path.

**Step 4: Implement the component**

Visual layers, back to front:

1. Dark catcher-view background and subtle depth guides.
2. Distant release window/horizon cue.
3. Batter-specific strike-zone frame at the plate plane.
4. Faint contextual paths or endpoint ledger for previous pitches.
5. Selected trajectory trail with depth-scaled dots or a stroked path.
6. Numbered endpoints using the existing ball/strike/foul/in-play colors.
7. Latest/selected emphasis ring.
8. Batter-side badge.

Use native `<button>` or keyboard-focusable SVG controls for endpoint selection. Preserve visible focus styling.

**Step 5: Add replay animation**

- Animate only when a pitch becomes selected.
- Use `stroke-dasharray/stroke-dashoffset` or a small sequence of depth-scaled circles.
- Target roughly `650–850 ms`; the animation is illustrative replay, not physical real-time duration.
- Set animation duration as a CSS custom property.
- Disable movement under `prefers-reduced-motion: reduce`.
- Do not start timers per path or introduce a canvas/WebGL loop.

**Step 6: Verify component tests and checks**

```bash
node --test test/pitch-trajectory.test.mjs test/rendering.test.mjs
npm run check
```

**Step 7: Commit**

```bash
git add src/lib/components/PitchTrajectory.svelte test/pitch-trajectory.test.mjs test/rendering.test.mjs
git commit -m "feat: render selectable pitch flight replays"
```

---

### Task 5: Integrate trajectory replay into Zone mode

**Objective:** Replace the inline flat pitch SVG without disturbing Contact transitions or manual mode selection.

**Files:**

- Modify: `src/lib/GameVisualization.svelte`
- Modify: `test/visualization.test.mjs`
- Modify: `test/rendering.test.mjs`

**Step 1: Write failing integration assertions**

Require `GameVisualization.svelte` to import and render `PitchTrajectory.svelte` in Zone mode. Preserve tests for:

- Contact reported → Contact.
- Between batters → remain Contact.
- Next pitch → Zone trajectory.
- Manual Contact/Zone choice persists when no new event exists.
- `gamePk` reset behavior.

**Step 2: Replace only the Zone rendering branch**

Move the inline strike-zone SVG, pitch markers, legend, and batter-side rendering into `PitchTrajectory.svelte`. Keep in `GameVisualization.svelte`:

- Top-level Zone/Contact mode ownership
- Current-play and hit-history selection
- Contact field rendering
- Existing caption shell
- Automatic transition effect

This leaves a substantial stateful UI region behind a real component boundary without fragmenting labels or one-use atoms.

**Step 3: Preserve captions and classifications**

Keep type, speed, and call in the caption. Optionally add end speed or spin rate only if it remains legible; these are not required for MVP and should not crowd mobile.

**Step 4: Run integration and full tests**

```bash
node --test --test-name-pattern='tracking view|game changes|trajectory|renders' test/*.test.mjs
npm test
npm run check
```

**Step 5: Commit**

```bash
git add src/lib/GameVisualization.svelte test/visualization.test.mjs test/rendering.test.mjs
git commit -m "feat: show pitch trajectories in Zone view"
```

---

### Task 6: Replace demo endpoints with complete recorded telemetry

**Objective:** Make the showcase demonstrate real MLB trajectory data while remaining explicitly recorded and deterministic.

**Files:**

- Modify: `src/lib/demo-data.js`
- Modify: `test/visualization.test.mjs`
- Modify: `test/rendering.test.mjs`

**Step 1: Add a failing demo telemetry test**

Assert that all seven game `823350`, at-bat `108` pitch fixtures include complete finite kinematic data and authoritative `pX/pZ`.

**Step 2: Copy the seven recorded pitch payloads**

Extend the demo pitch factory or store a compact frozen telemetry object per pitch. Include only fields projected by the app. Keep the existing page label stating that the route uses recorded MLB telemetry.

**Step 3: Verify exact fixture identity**

Test pitch order, type, speed, call, and endpoint values for at least the first and last pitch so accidental fixture drift is caught.

**Step 4: Run tests and build**

```bash
npm test
npm run check
npm run build
```

**Step 5: Commit**

```bash
git add src/lib/demo-data.js test/visualization.test.mjs test/rendering.test.mjs
git commit -m "test: showcase recorded pitch trajectories"
```

---

### Task 7: Validate against real completed feeds

**Objective:** Prove the estimator handles real MLB variation rather than only curated fixtures.

**Files:**

- Modify as defects require: `src/lib/pitch-trajectory.js`
- Test: `test/pitch-trajectory.test.mjs`

**Step 1: Build a temporary validation script**

Fetch completed game `776879` and classify every pitch as:

- full trajectory
- endpoint-only fallback
- unavailable
- malformed

For full paths, collect:

- non-finite sample count
- non-monotonic `y` count
- plate-root failures
- endpoint drift before authoritative snap
- display clipping count

Do not commit the downloaded feed or temporary script unless it becomes a small reusable validator.

**Step 2: Run and inspect distributions**

Acceptance criteria:

- Zero non-finite physical or display points
- Zero full paths ending away from authoritative `pX/pZ`
- Zero uncaught exceptions
- Every malformed pitch falls to endpoint-only or unavailable
- Endpoint drift remains diagnostic only

**Step 3: Add regressions for any discovered class of failure**

Use the smallest anonymized/recorded telemetry object that reproduces each issue.

**Step 4: Rerun complete tests**

```bash
npm test
npm run check
```

---

### Task 8: Browser, accessibility, and responsive acceptance

**Objective:** Validate the actual replay interaction across desktop, phone, and reduced-motion environments.

**Files:**

- Modify as required: `src/lib/components/PitchTrajectory.svelte`
- Modify as required: `src/lib/GameVisualization.svelte`

**Step 1: Desktop browser pass**

On `/demo`:

- Confirm newest pitch path replays after Zone loads.
- Select pitches 1, 4, and 7; confirm each endpoint/path and caption correspond.
- Switch Contact → Zone; confirm state is stable.
- Change ballpark while in Contact, return to Zone, and confirm no phantom “new pitch” transition.
- Verify console has no errors.

**Step 2: Mobile pass at 390×844**

Verify:

- No horizontal overflow.
- Zone frame and release point remain legible.
- All numbered endpoints are selectable without overlap making the latest unreachable.
- Batter-side badge does not cover trajectory controls.
- Caption and legend remain readable.

**Step 3: Wide-layout ownership**

Read `getBoundingClientRect()` for visualization stage, trajectory wrapper, and SVG. Apply any max-width to the component wrapper itself, not through a parent scoped selector.

**Step 4: Reduced-motion pass**

Emulate `prefers-reduced-motion: reduce`. Confirm the completed selected path appears immediately and no ball/trail travel animation runs.

**Step 5: Accessibility pass**

Confirm:

- SVG has a data-bearing accessible name.
- Endpoint controls are keyboard reachable.
- Selected state is exposed (`aria-pressed`, `aria-current`, or equivalent).
- Focus is visible.
- Visual animation is not required to understand pitch result or endpoint.

---

### Task 9: Final release gate

**Objective:** Prepare a reviewed change that can be released without weakening the current Gamecast.

**Files:** All changed files.

**Step 1: Complete quality pipeline**

```bash
npm run format
npm test
npm run check
npm run lint
npm run build
git diff --check
```

Expected: all pass, with zero Svelte warnings.

**Step 2: Independent review**

Review:

- Physics/root solving
- Provider coordinate assumptions
- Endpoint authority
- Null/non-finite fallback
- Svelte selection reactivity
- Automatic Zone/Contact transitions
- Accessibility
- Reduced motion
- Payload growth from the current-play field projection
- Security and dependency impact

**Step 3: Release only after explicit approval**

Commit/push/PR/merge/deploy follow the repository's established verified release workflow. Do not merge or restart production merely because local checks pass.

---

## Acceptance Criteria

- Zone presents a catcher-facing 2.5D completed-pitch replay with no heavy graphics dependency.
- Every pitch endpoint in the active at-bat remains visible and numbered.
- The newest pitch auto-selects only when a genuinely new pitch arrives.
- A manually selected prior pitch persists through unrelated reactive updates.
- Full finite telemetry produces a deterministic physical path.
- Missing/malformed kinematics falls back to endpoint-only rendering.
- MLB `pX/pZ` is always the final displayed endpoint.
- Contact/Zone automatic transitions and `gamePk` resets remain unchanged.
- Demo trajectories use real recorded game `823350` telemetry.
- No visible confidence labels or fake “live flight” claim appears.
- Desktop, 390×844 mobile, keyboard, and reduced-motion validation pass.
- Full local quality pipeline and independent review pass before release.

## Risks and Mitigations

| Risk                                                        | Mitigation                                                                                                                        |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| MLB StatsAPI is public but not a versioned product contract | Keep every trajectory field optional and preserve endpoint-only rendering.                                                        |
| `plateTime` and physical `y=0` crossing differ              | Prefer a validated physical root; use `plateTime` only as bounded fallback; snap final point to official `pX/pZ`.                 |
| Catcher-facing sign conventions are easy to mirror          | Lock orientation with real endpoint fixtures and compare against the current accepted Zone plot.                                  |
| Multiple full paths become visual noise                     | Emphasize one selected path while retaining every numbered endpoint and only subtle context paths.                                |
| New pitch effects override manual selection                 | Use stable event keys and a pure reducer; react only to genuinely new pitch keys or at-bat/game changes.                          |
| Animation looks like real-time telemetry                    | Label and implement it as a post-report replay; do not synchronize to polling or claim live flight.                               |
| Mobile endpoint overlap                                     | Maintain keyboard/list affordances and validate crowded seven-plus-pitch at-bats at 390px.                                        |
| Payload size grows                                          | Add fields only to the current-play request, never the historical hit request; measure representative response size before/after. |

## Chosen Decisions

- **Catcher-facing fixed camera**, not pitcher-facing and not rotatable.
- **Zone is upgraded in place**, not expanded into a third top-level mode.
- **SVG 2.5D**, no WebGL/Three.js dependency.
- **Completed-pitch replay**, never pseudo-live prediction.
- **All current-at-bat endpoints retained**, one selected full path emphasized.
- **Newest pitch auto-selects; prior pitches are manually selectable.**
- **Physical feet remain authoritative internally; projection happens only at render time.**
- **Official `pX/pZ` wins over reconstructed endpoint drift.**
- **Real seven-pitch demo telemetry from game `823350`.**
