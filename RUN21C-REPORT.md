# RUN21C — "Build Dissolved" · report

Branch `run21c`, from main @ `6f50a46` (RUN21A + RUN21D + RUN21F F1–F3 merged). Eight items,
all built and verified on screen. **Not merged** — pushed for the gate.

Ships under `BUILD_STAMP = 'run21c-20260803'` with a five-entry What's New block.
SAVE VERSION is **still 23** — nothing in this run needed a migration.

---

## Per-item status

| # | Item | Status | How the ACCEPT was verified |
|---|---|---|---|
| 1 | The hammer goes; the drawer carries the intent | **DONE** | `_evidence/run21c/smoke1.mjs` — 6 frames over 3s show wanderers moving; opening the drawer freezes them (1/6 distinct frames) and `.building` goes on; closing resumes within 1s. `i1-drawer-open-frozen.png`, `i1-drawer-closed-alive.png` |
| 2 | The Path Pot | **DONE** | `smoke2.mjs` — the full paint / repaint / scrub / auto-commit / put-away cycle through the Pot, with the saved cells proven to be exactly `{cx,cy,style}`; a pre-existing save's paths render byte-identically with nothing in hand. `i2-preexisting-paths.png`, `i2-painted-stone.png`, `i2-pot-away.png` |
| 3 | Strokes, not tiles | **DONE** | `smoke3.mjs` — a 10-cell L in all three styles draws 7 row strokes + 1 column run instead of 10 tiles, caps at 45% of cell height; a lone cell is a rounded pebble; painting one cell rebuilds only its own row/column; **60.7fps** over a 40-step painting drag. Before/after: `i3-before-L-*.png` vs `i3-after-L-*.png`, and `i3-before-corner-zoom.png` vs `i3-after-corner-zoom.png` |
| 4 | Three new path styles in the shop | **DONE** | `smoke4.mjs` — the Paths group on the Town shelf at 6/6/10 maths stars with the authored blurb verbatim; buying writes one `inventory` entry and VERSION stays 23; the handoff lands her in the town with the Pot held and brick picked; it paints; locked styles show `🔒 6★` and route to the shop with the card ringed and Back returning to the Meadow; a bought style never becomes a drawer chip. `i4-shop-paths-group.png`, `i4-pot-row-locked.png`, `i4-six-styles.png`, `i4-brick-painted.png` |
| 5 | Boos use her paths | **DONE** | `smoke5.mjs` — two 90-second observations of the same Meadow, one with a path laid to the Boos' right and one with none. Mean drift **+0.382 with vs −0.072 without**; **37.8% vs 20.3%** of Boo-samples standing on the path line; 57–58/60 distinct frames in both, so both towns were alive throughout. REDUCED unchanged. `i5-with-path.png`, `i5-no-path.png` |
| 6 | Resize handle without the mode | **DONE** | `smoke67.mjs` — with the drawer shut, drag a bench then drag its handle straight after: 1.0 → 1.6. The handle lets go after exactly 4s and the item's menu brings it back. `i6-handle-after-drag.png` |
| 7 | Session undo (5 steps) | **DONE** | `smoke67.mjs` — place → move → resize → undo ×3 restores the save byte-identically; put-away then undo returns the bench with `scale` and `plane` intact; paint then undo restores the prior cells; seven edits keep five steps; leaving the area empties the stack; the chip is labelled exactly `Undo`, bottom-left. `i7-undo-chip.png` |
| 8 | Drawer polish | **DONE** | `smoke8.mjs` — six headed rows in the authored order holding every word each list names, all 60 wishes reachable exactly once; every listed tile's line checked against `data/sockets.js`, `SMALL_ITEMS` and `wishNeedsSky` rather than a hand-typed list. `i8-wishes-grouped-1024x768.png`, `i8-wishes-grouped-390x844.png`, `i8-info-lines-rides.png`, `i8-info-lines-furniture.png` |

---

## What happened to EVERY `buildMode` reference

23 hits at the start of the run. `buildMode` no longer exists; `softened` replaced it.
`worldSoftened()` — `drawerApi.isOpen() || !!holding || potHeld` — is the single definition,
and `updateSoftened()` is the only writer.

| Was | Now |
|---|---|
| `let buildMode = false, buildTool = 'paths', …` (decl) | `let softened = false, potHeld = false` |
| `BUILD_TOOLS` array + `toolBtns` + `toolRow` | **deleted** (item 1) |
| `hammerBtn` + its 5 `updateBuildUI` lines | **deleted**; header is `[back, title]` |
| `params.build && !buildMode → toggleBuildMode()` | `params.build → drawerApi.open()` |
| `paintCell`: `if (buildTool === 'erase')` | **deleted** — scrubbing is the same-style toggle |
| `toggleBuildMode()` | **deleted**; the drawer's `onOpen` drives `updateSoftened()` |
| `selectBuildTool()` | **deleted** |
| `updateBuildUI()` | split: `updateSoftened()` (the freeze) + `updateDrawerTabs()` (which tabs an area shows) |
| `areaSignature`: `if (buildMode \|\| isInterior)` | `if (softened \|\| isInterior)` |
| `signaturePoint`: `if (buildMode \|\| isInterior)` | `if (softened \|\| isInterior)` |
| `showPulseInvitation`: `if (buildMode \|\| placeMode \|\| holding)` | `if (softened \|\| placeMode \|\| holding)` |
| `renderRequestBubble`: `if (!buildMode)` | `if (!softened)` — and `updateSoftened()` re-renders it on every transition, so bubbles vanish AND come back |
| viewport pointerdown: `if (buildMode && (buildTool === 'paths' \|\| 'erase'))` | `if (potHeld)` |
| long press: `if (!buildMode)` | `if (!softened)` |
| `onTap`: `if (!buildMode && wishTap(…))` | `if (!softened && wishTap(…))` |
| pinch capture: `if (buildMode && e.pointerType === 'touch')` | `if (e.pointerType === 'touch')` — the handle's own lifetime is the gate (item 6) |
| `openMenu`: `if (buildMode) attachResizeHandle(…)` | unconditional (item 6) |
| `updateHint`: the `buildMode` branch | the `drawerApi.isOpen()` branch — same words, see the hint audit |
| `startLoop`: `if (!document.hidden && !buildMode)` | `if (!document.hidden && !softened)` |
| QA `buildMode: () => buildMode` | `softened: () => softened`, plus `buildMode` kept as a documented alias |
| QA `toggleBuild` | kept as an alias that toggles the TRAY (what the suites calling it always meant) |
| QA `buildTool` / `setBuildTool` | **deleted** — `r10p3` now asserts they cannot come back |
| `RUN21A-REPORT.md` hint-table row | superseded by this report's table |

**Two gates that were NOT on `buildMode` before and are now**, because the pack asks for
"ambient speech suppressed": the 4s role sweep (`assignRoles` speaks "Best seat in the
Meadow!" when a socket is claimed) and the Pulse Director's opening beat.

### RUN21B collision — action required at merge

RUN21B merges before this branch and adds `pumpWishIdles`, gated
`!document.hidden && !buildMode`. **There is no `buildMode` to gate on.** That gate must
become `!document.hidden && !softened`, or the wish idles never pause while she arranges.
A block comment at the top of the softened-world section in `js/town.js` says so in place,
so a conflict resolver reads it without needing this report.

---

## Deviations

**D1 · Item 3 — the vertical join.** Pack: *"vertical neighbours get a quarter-round join
patch so corners read curved."* True: a quarter-round cannot fill the notch between two
rounded strokes without exposing its own rounding on the far side — it trades one notch for
another. Did: draw a VERTICAL run at the same 45%-of-cell-height radius. The corner cell
belongs to both spans, so the two overlap and their rounded corners coincide, and the turn
reads as one stroke bending. Same intent, correct geometry; the ACCEPT is met in all three
styles (see the corner zooms).

**D2 · Item 8 — "Seats 1 Boos".** The pack's template is `Seats <n> Boos`, which prints
"Seats 1 Boos" under the swings, the pond and the bumper car. One-seat items say
`Seats 1 Boo`; every other n is the template verbatim. In a reading app for a nine-year-old
a printed grammar error is not shippable. **One line to revert if the gate disagrees**
(`chipInfoLine` in `js/town.js`).

**D3 · Item 8 — the seat line follows the SOCKETS, not the `act` flag.** The pack says
"activity items". `deco_sandpit`, `deco_climbframe` and `deco_roundabout` carry `act` and
have no sockets at all, so the template would print "Seats 0 Boos" at a child; `deco_bench`
and `deco_pond` have sockets without an `act`, and for them the line is both true and the
useful thing to know. The ACCEPT says *"lines are true"*, so truth won.

**D4 · Item 8 — three lexicon words the groups do not name.** The six authored lists cover
57 of the 60 wish words; `bench`, `swing` and `slide` are in none of them. They fall into
`Out & About` at render time. The authored lists in `data/wishes.js` are transcribed
unchanged — the fallback is a render decision, not an edit to the content.

**D5 · Item 4 — the post-purchase verb.** The pack fixes the shop CARD blurb exactly and is
silent on the confirmation card. Rather than invent copy, a path style reuses the place
verb's line and label verbatim and changes only the DOOR: the town, with the Path Pot in her
hand and the new style picked — which is where "Where shall it go?" can be answered.

**D6 · Item 1 — one required copy correction.** `js/shop.js`'s dressing-purchase line said
*"…tap Build, then Decorate."* RUN21A's report flagged it forward as the one live string
that dies with the hammer. It now says *"…open the tray, then Decorate."* — "the tray" is
the app's own word (the town's resting hint is "Drag from the tray").

**F1 · Item 2 — a FIX, not a spec change.** `paintCell` is a toggle and `pointermove` fires
many times inside one cell, so a slow drag laid a cell and swept it away again in the same
gesture. Invisible while a separate Erase tool existed; fatal once scrubbing IS the eraser.
A stroke now remembers the cells it has already touched: one action per cell per stroke.

**F2 · Item 7 — a FIX found while proving it.** An undo snapshot must be a COPY. The resize
path writes straight into the live save record, so a reference-valued `before` was the same
object as `after` and the resize step recorded no change at all.

## BLOCKS

None.

The dispatch asked me to BLOCK if item 4 needed a SAVE VERSION bump. It does not: owning a
path style is one `inventory` entry, and `inventory` is an existing free-form map. No
migration, no bump, VERSION stays 23. Path DATA (`paths:[{cx,cy,style}]`, `PATH_CAP = 300`)
is byte-for-byte untouched — proved directly in `smoke2.mjs`.

---

## The hint audit, re-run for the new world

Every `hint.textContent` in `js/town.js`, re-read against post-RUN21C behaviour.

| Site | Hint | Verdict |
|---|---|---|
| `updateHint`, potHeld **(new)** | `Drag along the ground to lay a path — paint over it to sweep it away.` | authored by the pack, exact |
| `updateHint`, holding | `Tap the ground — I'll find the nearest free spot!` | unchanged — true |
| `updateHint`, placeMode | `Tap the ground to place it!` | unchanged — true |
| `updateHint`, drawer open | `Drag to move. Tap an item for size controls.` | **same words, new condition.** It was the build-mode line; it now shows while the tray is open, which is exactly when build mode used to show it. Both halves are true — and truer than before, since the handle no longer needs a mode |
| `updateHint`, default | `Drag from the tray. Tap a Boo to say hi!` | unchanged — true |
| `pathCapWobble` | `L_PATH_FULL`: "That's a LOT of path! Erase some to lay more." | **still true, mechanism changed.** The Erase TOOL is gone; erasing is painting over. The sentence tells her to erase, not which control to use. Flagged for RUN21E as a candidate reword, not a defect |
| `skyChipNudge` | `<name> needs the big open sky — take it outside and I'll put it right up!` | unchanged |
| `INDOOR_TIP` on the hint bar | `needs the sky!` | unchanged. NOTE: the floating `sky only` CHIP tag is retired — the pack authors `Needs the sky` as the tile's info line and two labels saying one thing over each other is what item 8 exists to fix |
| riverside signature | `Plop, plop, plop!` | unchanged |
| `lightCone` | `It will glow when it gets dark!` | unchanged |
| climb | `Up we go!` / `Nothing to lean on — up two rungs and back down!` | unchanged |
| `wishFoodNoBoo` | guide line | unchanged |
| decorate swatch | `<name>!` | unchanged |
| hider nearby | `HIDER_NEARBY_LINE` | unchanged (RUN21D) |
| `spotWobble` | `That spot's taken — try a little further along!` | unchanged |
| area full | `L_AREA_FULL` | unchanged |
| not indoors / not outdoors | `L_NOT_INDOORS` / `L_NOT_OUTDOORS` | unchanged |
| surface drop ×2 | `On the <parent>!` | unchanged |
| nearest-spot ×2 | `Tucked into the nearest free spot!` | unchanged |
| ride hop-off | `<Name> hopped off the <Ride> to come here!` | unchanged (RUN21A-1) |
| sprinkle trio | sparkle/cost lines | unchanged |
| resize ×2 | `<name> size: NN%` | unchanged — reachable without a mode now, which is item 6 |
| `flashLocked` | `<Zone>: N / M ⭐` | unchanged (dead under the single-zone shim) |
| shooting star | `✨ You caught a shooting star! +1 ✨` / `✨ Pretty!` | unchanged |

**Gate grep — clean.** No `BUILD_TOOLS`, no `buildTool`, no `.town-hammer-btn`, no `🔨` in
any UI path. The only surviving "hammer" strings are the Boo Builders' construction-site SVG
(`cs-hammer`) and the Builder costume's idle — both unrelated, both pre-existing.

---

## Suites

Server on **:8031** from this worktree. Affected suites + the fixed core, per the Board Law.
No full board.

**First pass: 22/26, wall time 742s on 2 lanes** (parallel 475s + serial 267s). The four
failures were all stale pins describing a world that no longer exists (or, in two cases, my
own test queries being wrong about scope) — see below. After re-pointing, every one was
re-verified directly, and a second full batch of the fourteen most exposed suites plus the
core was run again after the deploy-gate edits (stamp, What's New, the shop copy fix).

`r12s1-routes` (120s) · `r8p1-migrations` (0s) · `m3-pwa` (3s) · `r12s4-contrast` (141s) ·
`r18a-copyguard` (14s) · `r10p3-buildmode` (48s) · `r10p1-worldmap` (32s) ·
`r10p2-sockets` (27s) · `r10p4-interiors` · `r10p20-wishwell` (5s) · `r19z6-objectmodel` ·
`r21a-reach-truth` (84s) · `r21d-alive` · `r4p6-growth` (12s) · `r19z2-requests` ·
`r15v-economy` (17s) · `r18a-shop-chrome` (30s) · `r18b-shop-handoff` · `r18b-buy-confirm` (7s) ·
`m2-collection` (4s) · `r17x4-whatsnew` (94s) · `r20-wishlife` (50s) · `r19z4-acknowledge` (11s) ·
`r13t4-furniture` (20s) · `r18d-art-law` (6s) · `r12s13-a11y` (94s) · `r18a-buildstamp`

### Stale pins re-pointed (five suites) — never weakened, never deleted

1. **`r10p3-buildmode`** pinned a MODE that no longer exists. It now pins what replaced it:
   the drawer opening — and a chip on her finger — softens the world and shutting it wakes
   the world; the paint grid belongs to the Path Pot, not to an open tray; three adjacent
   cells draw as ONE stroke while `paths()` still reports three cells; scrubbing is the
   eraser and neither the tool row nor a `buildTool` hook survives; the Pot is the first
   Landscape chip, its style row docks above the drawer with all six styles and the authored
   hint. The 300-cell cap, the z-order pixel test, landscape being outdoor-only and never
   dropping from a box, and the whole fishing state machine are untouched. It gained
   assertions; it lost none.
2. **`r10p1-worldmap`** asserted the header carries a hammer. It now asserts the opposite —
   no hammer, and the strip is exactly back + name — so the button cannot creep back. The
   56px-height pin, which is what the block was really about, is unchanged.
3. **`r19z2-requests`** clicked a Build button to prove bubbles hide while she arranges.
   There is none. It now proves it for BOTH softeners (tray open, and something held) and
   additionally proves the bubble comes back when she is done — which the old block never
   checked at all.
4. **`r19z6-objectmodel`** asserted the shop's room chips were `['Lounge','Kitchen','Bedroom']`
   by reading every `.sd-room-chip` in the document. `.sd-room-chip` is now the shared
   heading for any shelf GROUP (the Town shelf's "Paths" borrows it) and every shelf panel
   stays mounted, so the query is scoped to the House shelf. Same assertion, correct scope.
5. **`r10p4-interiors`** clicked a row-1 bed with the tray open. Item 8 made the tray taller
   (every chip carries a name and a line now) and an open bottom sheet covers the front of a
   room — a child cannot tap what she cannot see either, so testing it with the tray open was
   testing a fiction. The block now shuts the tray first, which is also item 6's contract:
   the handle needs no mode.
6. **`r18b-shop-handoff`** walks every purchasable id and checks the verb its kind deserves.
   `kind:'path'` is new, so the walk gained a case for it: the place verb's own words, the
   `town-path` door. The "no indoor-only item is ever sent outdoors" guard is untouched.

Two of the failures found this way were real (`r19z2` and `r10p4` were describing a world
that no longer exists); two were my own tests being wrong about scope. All four are
documented above rather than papered over.

---

## What RUN21E needs to know

1. **`worldSoftened()` is the gate now.** Anything new that should pause while she arranges
   reads `!softened`, not a mode. If E adds an ambient behaviour or a scheduler, gate it there.
2. **RUN21B's `pumpWishIdles` still needs re-pointing at merge** — see the section above.
   This is the one thing that must not be missed.
3. **`L_PATH_FULL` says "Erase some to lay more."** True, but it names a verb whose control
   is gone. If E is touching guide lines, that is a one-line candidate.
4. **The tray is ~26px taller** (108px chips at desktop, 94px at phone) because every chip
   now carries a name and a line. Anything that measures the drawer, or places something in
   the bottom band of the world expecting to tap it with the tray open, should be re-checked.
5. **The Undo chip lives in the viewport, bottom-left, z-index 66.** The Path Pot's style row
   is bottom-centre at the same z. Anything else that wants the bottom of the play area has
   two neighbours.
6. **Path styles are `kind:'path'` catalogue items stored in `inventory`.** Three exist. Any
   new one needs: a `CATALOGUE` entry, a price in `data/shop.js`'s Town shelf, a `PATH_SWATCH`
   entry in `js/art.js`, a `.t-path-run.path-<id>` rule in `styles.css`, and a `PATH_STYLES`
   entry in `js/town.js`. No save change.
7. **`sw.js` ASSETS[] was not touched** — this run created no new `js/` or `data/` file.
