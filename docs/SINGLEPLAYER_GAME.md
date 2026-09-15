# Single-player delivery game

This product checkpoint connects the approved Lake Garden Street environment
and courier movement into a complete delivery shift. The scope is one local
player in the authored 190 m neighborhood, with three parcel jobs and ambient
traffic. The environment received positive human feedback on 15 September 2026.

## Player experience

The player starts a shift beside a parked bicycle, accepts a job, reaches the
pickup shop, collects the parcel on foot and delivers it to a residential
address. Completing a job earns a reward once. Three jobs lead to a shift
summary; another shift can be started afterwards. Local save data supports
continuing play in the same browser.

Open [Play](http://127.0.0.1:5175/play.html) after `npm run study:dev`, or use
the current [production playtest](http://127.0.0.1:4176/play.html). The latter
is served with `npm --prefix studies/colombo-road/viewer run preview -- --port 4176`.

| Control | Action |
| --- | --- |
| WASD / arrow keys | Walk, steer and pedal |
| S / down | Brake; release and press again to roll backward |
| E | Approach and mount the bicycle, or settle and dismount after stopping |
| F | Collect or deliver while stopped on foot inside the active stop |
| Escape | Pause or resume active gameplay |
| Onscreen arrows and action buttons | Pointer/touch equivalents |

The three offers award 80, 110 and 130 credits, for 320 per completed shift.
Their deadlines are 105, 90 and 140 seconds respectively. Restarting a delivery
returns the courier and bicycle to spawn, clears the parcel and restores that
job's deadline. It preserves rewards from earlier completed jobs. Ending the
shift from Pause returns to the menu and preserves earned wallet credits.

The game screen shows the objective, remaining time, earnings, a small map and
contextual action prompts. Asset counts, render statistics, camera studies and
weather experiments belong to the separate review pages. Controls must explain
why a pickup, delivery or mounting action is unavailable rather than silently
ignoring it.

The four existing addresses are fictional exterior approaches attached to
specific building IDs. They are useful gameplay locations within this scene;
they do not identify real businesses or surveyed Colombo entrances.

## Simulation boundaries

Player commands update a local simulation, and the renderer displays its state.
Movement, jobs, rewards, traffic and simulation time should not be independently
reconstructed by UI components. Commands, fixed simulation ticks and versioned
snapshots keep these responsibilities explicit.

Player, vehicle, job and session identifiers remain distinct. Jobs belong
to a player, and a reward can be granted only once for a completed job. Pause
freezes deadlines and traffic as well as the courier. Recovery must reset or
cancel the active job consistently; moving back to spawn must not carry an
undelivered parcel or preserve an unfair deadline advantage.

Ambient vehicles follow the two left-hand lanes, maintain separation and yield
to the courier. This bounded traffic model supports gameplay; it is not a full
road-network simulation. Functional junction signals, traffic-law scoring,
emergency behavior and district-wide pathfinding remain later work.

## Future multiplayer

This checkpoint implements no login, WebSocket service or shared online world.
The local simulation owns decisions for the single-player game. Its boundaries
prepare a later server implementation:

- Authenticate each connection and associate it with a player ID.
- Send sequenced player input and interaction commands to the server.
- Let the server own shared traffic, job assignments, rewards and world time.
- Replicate authoritative entity snapshots and interpolate remote movement.
- Add client prediction/reconciliation, disconnect recovery and server-side
  persistence before treating client progress as trusted online state.

Adding a WebSocket connection alone would not provide those guarantees. Local
save data is convenient browser progress and is not an anti-cheat system or
an online account balance.

## Development reference

The [Paper Route devlog](https://www.paperroute.lol/devlog/) remains the workflow
reference. The saved [14 September audit](CHARACTER_ART_PIPELINE.md#paper-route-pipeline-audit--2026-09-14)
records evidence about a fitted cycling pose, restored rest transforms and
runtime hand/pedal contacts. Earlier project notes also record isolated asset
studies and repeated in-game review under consistent lighting.

For this checkpoint, those lessons mean preserving approved asset/animation
contracts, connecting one complete playable loop, and obtaining human feedback
before multiplying world content. No Paper Route assets or source code are
copied. Fresh retrieval of the devlog failed with a gateway error and DNS
resolution failure on 15 September, so this checkpoint relies on the dated
audit rather than claiming a new inspection of its latest implementation.

## Handoff criteria

The playable path must cover start, acceptance, pickup, delivery, reward, next
job, shift completion and another shift. Verification also covers pause,
reload/continue, expired jobs, recovery, duplicate reward rejection and traffic
separation. Existing animation tests continue to protect the approved courier.
Human playtesting remains responsible for appearance, atmosphere and handling
feedback; structural tests do not certify those qualities.

## Verified checkpoint

All 114 viewer tests pass, including a route test that uses movement inputs and
interaction commands rather than placing the courier at destinations. It covers
mounting, riding, braking, a low-speed turn, dismounting, live traffic and both
curbs. With its fixed traffic seed the jobs take approximately 32.2, 67.0 and
112.9 seconds. These establish reachability, not ideal deadlines for every
player. The longest deadline increased from 115 to 140 seconds after this test.

The route test also exposed a pedestrian crossing deadlock. Vehicles now yield
early enough for the courier to enter the crossing corridor, while collision
still prevents overlapping physical footprints. Traffic remains an assisted
two-lane corridor model with looping vehicles; there is no overtaking, junction
controller, crash physics, live road traffic or traffic-law scoring yet.

Production browser checks cover initial loading, movement and bicycle actions,
parcel collection and delivery, the 80-credit result, reload/continue without
duplicate payment, pause/help/settings and narrow-screen control bounds. Night
mode activates eight path lights. No automated screenshots or appearance
scoring were used. The asset validators pass and approved courier, bicycle and
geographic asset hashes remain unchanged.
