# Three.js pitch trajectory spike

## Question

Given the same recorded MLB pitch telemetry and authoritative plate endpoint, does a restrained Three.js view communicate release-to-plate depth more clearly than the current SVG 2.5D replay?

## Approach

- Kept the production `PitchTrajectory.svelte` unchanged.
- Added a temporary `/demo/trajectory-lab` comparison route.
- Rendered the existing SVG and Three.js view side by side with synchronized pitch selection.
- Used physical feet directly: MLB x, z height, and y depth.
- Used a fixed center-field broadcast camera, real strike-zone dimensions, a plate plane, a ground grid, a moving baseball, a short wake, and a faint complete path.
- Disabled camera controls and respected `prefers-reduced-motion` by showing the completed pitch.

## Evidence

- All seven recorded pitches initialize as full finite trajectories.
- Selecting pitch 3 updates the Three.js canvas to `Sinker trajectory in three-dimensional catcher view` with no fallback error.
- The center-field broadcast camera presents the pitch from the familiar television direction, traveling away from the viewer into the catcher’s zone. Earlier centered and catcher-shoulder views either compressed depth or felt unlike watching a game.
- Desktop and 390px phone layouts render without visible horizontal overflow; panels stack on mobile.
- Production build succeeds.
- Three.js is route-split in the lab, but the lab route chunk is approximately 558 kB minified / 142 kB gzip.
- Production dependency audit reports zero vulnerabilities.

## What worked

- True perspective and the ground grid communicate depth more convincingly than the SVG lane.
- The moving ball plus short wake reads more naturally than a thick permanent highlighted curve.
- A fixed camera preserves a controlled broadcast composition.
- Three.js significantly reduces custom WebGL lifecycle and geometry code compared with raw WebGL.

## What did not work

- A perfectly centered catcher camera still flattens the trajectory; perspective alone is not enough.
- At the authoritative endpoint, the path compresses visually and the endpoint can dominate unless ball and ring sizes remain restrained.
- The dependency cost is large for a single visualization.
- The temporary lab page currently has seven non-blocking Svelte scoped-CSS warnings for its top header selectors because the approved mechanical cleanup could not obtain tool-level execution approval. The renderer itself has no type errors.

## Verdict: PARTIAL

Three.js validates the core visual idea: real perspective can make release-to-plate depth substantially clearer than the current SVG. It does not automatically solve the design; the improvement depends on a familiar broadcast camera, restrained ball scale, repeated slow-motion movement, and spatial references.

## Recommendation for the real build

Do not replace the production Zone yet. Let the user judge the open comparison first. If the Three.js motion clearly wins, integrate the fixed center-field version behind client-only loading and preserve the existing endpoint-only SVG as a WebGL/reduced-capability fallback. Before production integration, remove the temporary lab, dynamically import Three.js, add component tests for fallback state, and rerun the complete quality pipeline.
