# RUN21D — "Alive on Arrival" · report

Branch `run21d`, cut from `main` @ `fec9641` (post-RUN21A, post-RUN21F F3).
BUILD_STAMP `run21d-20260803` · SAVE VERSION **23, unchanged** (no save changes in this pack).

All five items shipped. No BLOCKs. Four DEVIATIONs, each logged below with its evidence.

---

## What a child gets

Before this pack, walking into an area was a still photograph that slowly came to life
if you waited long enough and the dice were kind. Six changes:

1. Every area mount takes **one guaranteed opening breath** within a second, then invites
   her to touch something at nine seconds.
2. The world map now says **where somebody is wondering something**, and once she is in the
   area, the request card will **take her to the thing** it is talking about.
3. Every outdoor area says **it is four screens wide**, names those screens, and slides to
   any of them in one tap.
4. The funfair's **band and disco are signposted at the gate** — the Disco is two taps from
   the map instead of a hunt across three viewports.
5. A hider parked at the far end of an area gets **a nudge in its direction** and a line, so
   hide-and-seek is a game rather than a lottery.

---

## Item 1 — The Pulse Director · DONE

`js/town.js`, new module-scope section `// RUN21D: pulse`, one call per mount.

- `PULSE_DELAY_MS = 900` after first paint: **exactly one** beat, first eligible wins, from
  the pack's five-rung ladder — an active request's bubble (breathes 3×, pans to it if
  off-screen) · the newest placed item's own verb (<24h, via requests.js's own
  `TRY_FRESH_MS`) · this place's zone behaviour started directly instead of by dice · the
  nearest Boo's species idle + one hop · the area's ambient signature.
- **Prefers a beat this area has not shown today.** Per-day, per-area seen-set at module
  scope — session only, never the save (same stance as `js/ack.js` and `js/encouragement.js`).
- `PULSE_HINT_MS = 9000`: one hint-bar invitation, per area, verbatim.
- **REDUCED**: no movement beat at all; the invitation is the whole pulse.
- **Reveals win.** At the 900ms mark the pulse reads RUN21A-8's queue (`revealShowing` /
  `revealQueue.length`) and, if a ceremony is up or waiting, skips the mount entirely —
  beat and invitation both. `__townLife.pulse().beat === 'skipped:reveal'` records it.
- **No beat touches the ack budget.** No beat calls `acknowledge()`; asserted by sampling
  `window.__acks.said()` either side of every one of the eleven mounts.

**ACCEPT verified** — `tests/r21d-alive.mjs`, eleven scripted mounts across meadow,
riverside, hilltop, beach, playground, funfair, Boo House lounge + kitchen, a meadow with a
live request, a meadow with a five-minute-old wish, and an empty riverside. Each asserts:
exactly one beat; that beat **visibly** on screen inside 3s (polled in-page, per-kind DOM
proof — `.rq-pulse3`, a wish verb class or an approach goal, a kite/stone/splash/castle/towel
or a live zone goal, an `idle-*` class or `.t-seat-hop`, a petal/skip/footprint/train/kernel);
the ack counter unmoved; the invitation at ~9s reading exactly the authored line. Between
them the eleven mounts exercised **all five** beats. Screenshots
`_evidence/run21d/item1-beat-*.png` (taken the instant the beat proved itself) and
`item1-invitation-*.png`.

Also asserted: REDUCED shows hint-only and nothing moves; a reveal fixture produces zero
beats and no invitation (`item1-reveal-wins.png`); a second visit to the same area in the
same session picks a different beat.

> **DEVIATION 1 — "rotating daily per area".** The pack asks the invitation to rotate daily
> per area and then authors **exactly one string per area**. Copy ships as written and I may
> not invent more, so there is nothing to rotate. → One authored line per area, verbatim;
> the Playground uses the pack's own stated stand-in `Try the swings…` until RUN21E lands
> tag. A later pack wanting rotation must author the extra lines.

---

## Item 2 — Requests you can find · DONE

**A.** `js/worldmap.js`: an unlocked badge whose placed Boos include an active requester
gains a `💭` chip (top-left, so it never collides with the `👀` hide chip). Its `title` and
`aria-label` are exactly `«Name» is wondering something…`; the badge repeats the sentence in
its own label, because a button's `aria-label` wins over its children — the same shape the
hide chip already uses. The Boo House's three room storage keys fold into the one `boohouse`
badge. Tapping the badge opens the area exactly as before.

**B.** `js/town.js`: the request card gains **`Show me`** whenever `requestTargetFrac(r)`
resolves — i.e. the named item, friend or disco door is in **this** area. It closes the card,
eases the camera onto the target in 600ms and rings it for 2s (`.rq-ring`). Cross-area
targets are untouched and gain no routing.

**C.** `css/styles.css`: an in-area bubble breathes `1 → 1.06` once every 6s, riding the
individual `scale` property so the existing 2s bob keeps its own transform. REDUCED: neither.

**ACCEPT verified** — the chip appears on the right badge and nowhere else, with the exact
sentence (`item2-map-wonder-chip.png`); a save with **no** request that visits the Meadow
once has a chip on the Meadow badge on the very next map open. `Show me` moves a bench from
view-fraction **2.88** (nearly three screens right) to **0.500** — centred, well inside
±20% — with the ring on it and the card closed (`item2-showme-card.png`,
`item2-showme-landed.png`); the ring lets go at ~2s. A `wear` request offers `Open the
wardrobe` and no `Show me`. The 6s breathe is proven by **29 samples over 7s** peaking at
`1.0585`, sampled after the Pulse's own 3× breathe has finished so the two are not confused.

> **Bug found and fixed while proving this ACCEPT.** The Pulse's pan could yank the camera
> back off a target the child had just asked to see — both wrote `scrollX` and the later one
> won. `js/town.js` now carries `cameraClaimed`, set by every deliberate camera move she
> makes (a drag, `Show me`, a landmark dot, a fair sign); the Pulse never pans once it is
> set. Asserted with the hard case: pressing `Show me` **inside** the pulse's 900ms window
> still lands the bench.

---

## Item 3 — Landmark dots · DONE

Four dots per outdoor area, above the hint bar. 12px pip inside a 44px button (the house
tap-target floor); pink and `aria-current="true"` for the screen she is on; the filled dot is
derived from `scrollX`, so it tracks a drag as readily as a tap. Tapping pans (600ms, the
shared RUN21D primitive) rather than jumping. Aria labels exactly as authored, all six areas.
Indoors there are no dots — a room is 1.5 viewports and the room tabs already say what else
there is. Once per visit, whichever edge has town beyond it gets one soft shimmer
(`.t-edge-shim`, the rarity-shimmer gradient language, `display:none` under REDUCED).

**ACCEPT verified** — all 24 labels exact, every dot ≥44px, exactly one `aria-current` per
area; manual scrolling to screens 2/3/4/1 fills the matching dot every time; a tap **pans**
(mid-flight 1287px → landed 2016px) and lands screen 3 to within 8px. In the funfair, dot 4
puts the bandstand in view, centred to **0.000**, and `zoneMusic()` flips to `band`. No dots
and no shimmer indoors; the shimmer fires once and does not return within the visit.
`item3-dots-meadow.png`, `item3-funfair-bandstand-dot.png`, `item3-edge-shimmer.png`,
`item3-layout-{1024x768,768x1024,390x844}.png`.

> **DEVIATION 2 — the funfair's fourth dot.** The pack asks for dots at the four screen
> centres (12.5/37.5/62.5/87.5%) **and** for dot 4 to land the bandstand. `BANDSTAND_X` is
> **0.68**, which is inside screen 3 (0.50–0.75): a dot panning to 0.875 shows the
> helter-skelter and never hands the music over. The two halves of the spec cannot both hold
> with the fair as built, and moving the bandstand would break band/funfair contracts far
> outside this pack. → Kept the four screen centres for all 23 other dots and gave the
> funfair's fourth a **single documented target override** to `BANDSTAND_X`. Its label is
> then true, the ACCEPT passes, and the filled-dot rule (nearest dot target to the view
> centre, from `scrollX`) is asserted coherent on all four funfair screens.

> **DEVIATION 3 — "ink at 35%".** The strip sits on the app's own dark chrome
> (`--sky-deep` #1E1550), where ink (#2A1B4E) at 35% is dark-on-dark and literally invisible
> — photographed at 390x844 before the fix. → Kept the pack's 35% dimness, moved the colour
> to the card (#FFF8F0) at 35%: 3.0:1 against `--sky-deep`, the non-text contrast floor,
> while still reading as "not this one". 12px, pink when filled, ≥44px target, all as
> specced.

---

## Item 4 — Signposting the fair's best rooms · DONE

Two hanging signs, `🎵 Band` and `🕺 Disco`, rope-and-plaque in the house sticker language,
at x 0.055 and 0.150 of the funfair zone — inside screen 1 at every viewport width. Band
claims the camera and pans to `BANDSTAND_X`; Disco opens the Disco Hall on the existing
route. Aria `Go to the bandstand` / `Enter the Disco Hall`. Added to the viewport's
interactive-scenery list so the pan-drag never swallows a tap.

**ACCEPT verified** — both signs fully on screen 1 with no scrolling at 1024x768 **and** at
390x844 (`item4-fair-signs.png`, `item4-fair-signs-390.png`); tapping Band lands the
bandstand and flips `zoneMusic()` to `band` (`item4-band-sign-landed.png`); a first-time
scripted visitor reaches the Disco Hall in **exactly 2 taps** from the world map — badge,
then sign (`item4-disco-in-two-taps.png`) — and Back still lands her at the fair.

> **DEVIATION 4 — "on the entrance arch".** The fair has no arch. Its entrance screen is
> bunting swags, string lights, a ticket booth and a popcorn cart (`fairSceneryFor`), and
> building an arch is scenery invention this pack does not authorise. → Hung both signs from
> the bunting that already crosses the entrance. Copy, aria and behaviour exactly as
> authored.
>
> A smaller correction inside the same item: the pack says "existing route, `from`
> preserved". I first passed `{ from, fromArea }` — `js/discohall.js` reads **no** params and
> its own Back control already returns to the funfair, so those two were dead weight, and
> `tests/r12s1-routes` rightly failed them as an undriven param contract. The sign now calls
> `ctx.go('discohall')`, identical to the door beside it, which is what "existing route"
> means here. **Not a stale pin — the guard caught real cruft I had added.**

---

## Item 5 — The hider gets a fair chance · DONE

At town mount, immediately after the opening beat, in the hider's area only, once per visit:
if the peek spot is off-screen, one 600ms pan **toward** it that stops half a screen short of
centring — so the peek is left at the far edge rather than delivered — then the hint bar
reads exactly `Someone's hiding nearby… 👀`. REDUCED skips the pan and keeps the line. It
never fights a camera she has already claimed, or one the beat is still moving.

**ACCEPT verified** — a hider on an oak at x 0.88 starts off-screen; after the nudge the peek
is **0.000 screens away** (within one screen, as asked) and **0.50 of a screen off centre**
(not handed to her), with the line exact (`item5-hider-fair-chance.png`). The pop-out is
unchanged: tapping the peek still sets `hideFound`, removes the peek and floats "Found you!".
Once per visit — scrolling back to the gate does not re-fire it. REDUCED: `panned === false`,
`scrollX === 0`, line still shown. An area nobody is hiding in says nothing.

---

## Final gate

**Fresh save** (nothing placed, nothing owned, 0 stars) in meadow / funfair / playground:
never more than one beat, the four dots present, the invitation still lands.
*Honest note:* a genuinely empty outdoor area shows **no** beat — the ladder's five rungs all
need something (a request, a fresh placement, a Boo, or an area anchor), and an empty Meadow
has none. Only the invitation fires. Riverside/hilltop/beach do show their signature even
when empty, because those signatures need no placed item.

**Rich save** (six areas furnished with four Boos, a bench, an oak and flowers each, painted
paths, a live request, the day's hider unfound on the beach, the whole fair standing) across
meadow / riverside / beach / funfair / Boo House: **exactly one beat every time**, still
exactly one after the invitation, and the hint bar always one of RUN21D's own lines.
`gate-rich-*.png`.

**The two rules the pack asks to be verified explicitly:**
- *The Pulse never fires twice per mount* — `pulse().beats.length === 1` asserted on all
  eleven item-1 mounts, all five rich-save mounts, and again after the 9s invitation.
- *The Pulse never speaks over a reveal* — a fixture that owes a funfair ceremony produces
  zero beats and no invitation, and the pulse does not sneak in after she dismisses it.

### Suites run

`tests/r21d-alive.mjs` (new, **@serial**, ~4m22s, **209 checks, PASS**) plus the affected
suites and the fixed core. Every one green:

| Suite | s | Suite | s | Suite | s |
|---|---:|---|---:|---|---:|
| r21d-alive | 262 | r12s1-routes | 119 | r8p1-migrations | 0 |
| m3-pwa | 3 | r12s4-contrast | 139 | r18a-copyguard | 14 |
| r18a-buildstamp | 1 | r17x4-whatsnew | 90 | r10p1-worldmap | 27 |
| r19z2-requests | 4 | r19z3-moments | 11 | r19z4-acknowledge | 10 |
| r10p5-personalities | 26 | r4p9-delights | 15 | r10p21-delights | 1 |
| r18d-funfair-scenery | 17 | r9p6-band | 15 | r13t3-house-rooms | 23 |
| r13bt8-town-dressing | 40 | r20-wishlife | 47 | r12s12-bubble-containment | 166 |
| r12s2-tricky-fair | 59 | r10p18-disco | 3 | r7p1-funfair | 18 |
| r4p10-phone | 4 | r4p10-tablet | 10 | r4p12-reach | 87 |
| r18d-layout | 23 | r12s13-a11y | 97 | p3-town | 36 |
| r4p5-town | 80 | r5p4-town | 18 | r10p3-buildmode | 28 |

**Stale pin re-pointed (one).** `tests/r19z2-requests` asserted the request bubble's
animation as an exact equality: `animationName === 'rq-bob' && duration === '2s'`. Item 2C
deliberately adds a **second** animation (the 6s breathe) alongside it. The assertion was
re-pointed, not weakened: it now parses the animation list and asserts the bob's own contract
**exactly as before** (`rq-bob`, 2s, infinite), **plus** the breathe (`rq-breathe`, 6s,
infinite), **plus** that the bubble carries exactly those two and nothing else. Strictly more
coverage than it had.

**One flake, diagnosed, not laundered.** `p3-town` failed three times in a row, each time at
a *different* line and always on `waitForSelector('.hub')` after opening a fresh browser
context. I did not accept that as a pass: I exported the baseline tree (`fec9641`) to a temp
directory, served it on its own port and ran `p3-town` against it — **PASS**, first try.
`netstat` on this box showed **2081 sockets in TIME_WAIT**, 848 of them on my test port, after
a long evening of suite runs; the earlier `net::ERR_NO_BUFFER_SPACE` console error in another
run is the same cause. `p3-town` then passed on the branch, unchanged, on the next attempt.
Recorded as environmental socket pressure, with the baseline comparison as the evidence.

### Deploy gate

- `BUILD_STAMP` → `run21d-20260803`, `sw.js` cache id follows it.
- **What's New**: a `run21d-20260803` block at the top of `data/whatsnew.js`, four entries
  written for a child (the map chip, the four dots, the fair's signs, the hider nudge). The
  Pulse itself is deliberately **not** sold to her — a town that says hello should feel like
  a town, not like a feature. Every `route` resolves (`r17x4-whatsnew` green).
- **OFFLINE LAW**: no new `js/` or `data/` file was created, so `ASSETS[]` is unchanged;
  verified all 158 listed assets exist on disk and that no `js/**` or `data/**` module is
  missing from the list.
- `PROJECT_STATE.md` regenerated (`node tools/gen-state.mjs`).
- **SAVE VERSION stays 23.** Nothing in this pack writes a new field: the pulse's seen-set,
  `cameraClaimed`, the per-visit hider flag and the dots' state are all session memory.

### Files changed

- `js/town.js` — the pulse director, the shared pan primitive + `cameraClaimed`, the landmark
  dots + edge shimmer, `Show me` + `.rq-ring`, the fair's two signs, the hider's fair chance,
  `data-boo` on request bubbles, and the RUN21D QA hooks on `__townLife`.
- `js/worldmap.js` — the 💭 chip and its QA hooks.
- `css/styles.css` — `.rq-pulse3`, `rq-breathe`, `.rq-ring`, `.mb-wonder-chip`, `.t-dots` /
  `.t-dot` / `.t-dot-pip`, `.t-edge-shim`, `.ff-sign` / `.ffs-plaque`, plus the
  reduced-motion path for each.
- `data/whatsnew.js`, `sw.js`, `PROJECT_STATE.md` — deploy gate.
- `tests/r21d-alive.mjs` — new, @serial.
- `tests/r19z2-requests.mjs` — the one re-pointed pin.
- `tests/board-serial-baseline.md` — the @serial + over-budget justification.
- `RUN21D-PROGRESS.md`, `RUN21D-REPORT.md`.

---

## For the next pack (C or E)

- **`cameraClaimed` is now the rule for ambient camera moves.** Anything that pans the town
  without the child asking must check it, or it will fight her. It is set by the drag
  handler, `showMeTarget`, the landmark dots and the fair signs.
- **`panToPx` / `panToFrac` / `fracOnScreen` is the one pan primitive** in town.js, with
  `panRaf` cancellation and a reduced-motion path. Do not grow a second easing loop.
- **The Pulse defers to two things and only two**: RUN21A-8's reveal queue, and
  `cameraClaimed`. If RUN21E adds another ceremony that owns the opening moment, it should
  join the reveal queue rather than add a third flag.
- **RUN21E owes the Playground its tag line.** `PULSE_INVITATIONS.playground` is currently
  the pack's stated stand-in `Try the swings…`; when tag lands it becomes
  `Someone fancies a game of tag…`. One constant, one test string in `tests/r21d-alive.mjs`.
- **The funfair signature is anchored to the middle of the whole fair**, not to the popcorn
  cart: `areaSignature('funfair')` measures against `.ff-scenery-wrap`'s bounding box, which
  spans all four viewports, so the tap only lands near x ≈ 0.5 of the area. The Pulse's
  `signaturePoint()` reads the same node so it can never fire a signature a finger could not
  have, but if a later pack wants the popcorn to answer a tap at the cart, that anchor is the
  thing to fix.
- **A completely empty outdoor area still has no opening beat** (see the fresh-save note
  above). If that matters, the ladder needs a sixth rung that needs nothing placed.
- **The hider line and the 9s invitation share the hint bar.** With a hider present the bar
  reads `Someone's hiding nearby… 👀` from ~1s and is replaced by the area invitation at 9s.
  Both are authored, both fire on their own schedule; if a later pack wants the hider line to
  hold the bar, that is a deliberate change to make there.
- **This machine runs out of sockets.** Long evenings of suite runs leave thousands of
  TIME_WAIT sockets and page loads start stalling at `waitForSelector('.hub')`. Before
  believing a `.hub` timeout, check `netstat -an | grep -c TIME_WAIT`.
