# Bounded Practice Delivery Loop

## Purpose and status

This prototype adds a small, repeatable delivery exercise to the existing
controllable-bicycle scene. A player can accept one of three timed practice
jobs, stop at its pickup marker, collect the parcel, stop at its drop-off
marker, and earn a locally saved reward. The jobs repeat in a fixed sequence so
the interaction, timer, reset, and storage rules can be tested before routing,
traffic, or a larger economy are introduced.

Every stop in this prototype is a generated practice point on saved road
geometry. The points have **not** been verified as real entrances or as safe or
legal stopping locations. The straight-line direction display is not a route,
and the prototype makes no claim about current access, traffic conditions,
one-way compliance, or a lawful bicycle journey between its markers.

This is a bounded part of Stage 3, not completion of the complete delivery-loop
stage. It has three practice jobs rather than 10–20 manually validated stops,
and it has no routable network, minimap, missed-turn recalculation, traffic,
garage, upgrade purchase, or broader economy progression.

## Production preview

![Production view of the bounded practice delivery loop](milestones/2026-09-13-delivery-prototype.jpg)

*The 1280 × 800 production Ride view shows the first practice job completed
after a 67 m ride, with LKR 240, one completion, the next-job action, and the
verification caveat visible.*

## Reproduce the prototype

Use Node.js 24 or newer and npm 11 or newer:

```sh
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/). Verify the production
build with:

```sh
npm run typecheck
npm test
npm run build
npm run preview -- --host 127.0.0.1 --port 5174
```

The scene continues to read the committed road artifact and makes no live
OpenStreetMap request.

## Practice flow and controls

The delivery card appears in Ride mode. Select **Accept job** or press `E` to
start the current job. A pickup ring and beacon then mark the first target.
Ride inside the marked 7 m radius, stop at or below 0.15 m/s, and select
**Collect parcel** or press `E`. The marker changes to the drop-off target;
repeat the stopped action there to complete the job and add its reward once.

After completion, **Next job** advances to the next job in the fixed sequence.
When the third job is complete, the sequence returns to the first job. If time
expires, **Retry job** restarts the same job at its full time allowance. The
deadline begins when a job is accepted and covers both pickup and drop-off.

The card reports the current task, remaining time, reward, aggregate earnings,
completed-job count, and straight-line distance and relative direction to the
active marker. Direction and distance are guidance to the visible practice
point only; they do not describe a legal or traversable route.

The delivery timer advances from the bicycle simulation delta, which the scene
caps at 0.1 s per rendered frame. A stall or very low frame rate therefore
slows simulated movement and the practice timer together rather than consuming
wall-clock time. The timer stops while
the ride simulation is paused, including Inspect map mode and browser states
that pause the scene. Held ride inputs are cleared when focus moves to an
editable control. Resetting the bicycle with `R` or **Reset bicycle** cancels an
active pickup or delivery and returns that job to the available state with its
full allowance. This prevents reset from teleporting the bicycle while keeping
an active timed job. Reset does not erase saved aggregate progress.

## Deterministic jobs and stop construction

All six markers are sampled by distance along the longest ground-level render
piece for saved source feature `way/13884292`, D. R. Wijewardene Mawatha. The
source selection excludes steps, bridges, tunnels, and nonzero display
elevations. The first pickup shares the bicycle spawn's 70 m distance along the
source direction; the bicycle itself retains its documented 1.5 m left offset,
which starts inside the 7 m pickup radius. Later markers continue along the same
saved piece.

| Job | Pickup / drop-off distance | Limit | Reward |
| --- | ---: | ---: | ---: |
| Canal-side warm-up | 70 m / 140 m | 75 s | LKR 240 |
| Westbound parcel run | 165 m / 245 m | 80 s | LKR 280 |
| Lake-road practice | 270 m / 355 m | 85 s | LKR 320 |

| Marker | Local east `x` | Local south `z` | Longitude | Latitude |
| --- | ---: | ---: | ---: | ---: |
| Job 1 pickup | 275.702247 m | −14.873044 m | 79.860812579 | 6.927160250 |
| Job 1 drop-off | 209.375351 m | −36.871176 m | 79.860211702 | 6.927358086 |
| Job 2 pickup | 186.345865 m | −46.599628 m | 79.860003070 | 6.927445577 |
| Job 2 drop-off | 113.274841 m | −79.146320 m | 79.859341096 | 6.927738278 |
| Job 3 pickup | 90.891838 m | −90.270342 m | 79.859138321 | 6.927838319 |
| Job 3 drop-off | 15.258467 m | −129.056925 m | 79.858453132 | 6.928187135 |

Source longitude and latitude are retained for every generated marker by
inverse-projecting its local `x` east and `z` south coordinates with the saved
road-slice origin. These coordinates make the experiment deterministic and
inspectable. They are not field validation of an entrance, stopping place, or
route.

## State and browser storage

The controller moves through `available` → `pickup` → `delivery` → `completed`.
Expiry changes an active job to `failed`; retry returns it to `pickup`. Reset
cancels either active phase and returns to `available`. Pickup and completion
require an explicit action, so merely crossing a marker does not change state
or award money.

Only aggregate earnings and the completed-job count persist. Active job phase,
position, parcel state, and remaining time do not survive a reload. The storage
key is `colombo-delivery.practice-progress.v1`, with this versioned value:

```json
{
  "version": 1,
  "earningsLkr": 240,
  "completedJobs": 1
}
```

Both counters must be non-negative safe integers. Missing, corrupt,
wrong-version, or invalid data falls back to zero progress. If browser storage
is unavailable, blocked, or full, the delivery remains playable for the current
session; a failed read starts from zero and a failed write does not undo the
completed delivery in memory.

The interface labels this fallback as `session only`. Repeated rewards and
completions saturate at JavaScript's maximum safe integer rather than producing
an invalid persisted value.

## Validation and limits

Four focused controller tests cover deterministic job generation from the
saved road artifact, the first leg's expected length, accept and explicit-stop
transitions, speed and radius rejection, one-time rewards, timeout, zero-delta
pause, retry, reset cancellation, storage validation, blocked reads, full
storage, and in-session completion after a failed write.

All 19 TypeScript tests and all 12 Python audit tests pass, along with strict
TypeScript checking and the production build. The build emits a 607.99 KB
minified JavaScript chunk that is
158.22 KB gzip and triggers Vite's default 500 KB advisory. Its CSS is 13.65 KB
minified and 3.83 KB gzip; the unchanged saved GeoJSON remains a separate
2.88 MB asset. A performance budget and code-splitting plan remain open.

The production build was reviewed in Chromium at 1280 × 800. A full real-key
flow accepted the first job, collected its parcel, pedalled and briefly steered,
braked to 0.0 km/h after 67 m, and completed the handoff from within 3 m of the
target. Completion added LKR 240 exactly once and raised the count to one.
Reload preserved both totals and offered the second job. A focused Accept
button still responded to its native space-key action. Inspect map, top view,
and zoom left the second job's `1:20` timer unchanged; returning to Ride and
resetting cancelled that active job while retaining the saved reward.

At 390 × 844, the canvas and page remained 390 px wide without horizontal
overflow. The delivery card, ride controls, and attribution remained within the
viewport. Pointer-held Pedal reached 5.1 km/h, pointer-held Brake
returned to 0.0 km/h, and reset worked. The scoped browser console and page
error capture remained empty after reload and these interactions. The saved
production screenshot is a native 1280 × 800 JPEG.

Timeout and retry, corrupt or unavailable storage, and storage-write failure
are controller-tested rather than browser-tested end to end. Physical-device
multi-touch, longer riding sessions, and marked-obstacle contact remain
hands-on checks.

This prototype has no route computation, turn instructions, minimap,
recalculation, live traffic, traffic rules, legal-route deadline model, parcel
capacity, job selection menu, spending, upgrades, or unlocks. Earnings are an
isolated practice counter. Completing these jobs does not establish Stage 3 or
Stage 5 progression acceptance criteria.
