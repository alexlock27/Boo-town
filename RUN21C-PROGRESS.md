# RUN21C — "Build Dissolved" progress ledger

Branch `run21c`, from main @ 6f50a46 (RUN21A + RUN21D + RUN21F F1–F3 merged).

- [x] 1 — The hammer goes; the drawer carries the intent
- [x] 2 — The Path Pot
- [x] 3 — Strokes, not tiles
- [x] 4 — Three new path styles in the shop
- [~] 5 — Boos use her paths (mechanism built to spec and proven; ACCEPT not demonstrable — BLOCK B1)
- [x] 6 — Resize handle without the mode
- [x] 7 — Session undo (5 steps)
- [x] 8 — Drawer polish
- [x] gate — suites re-pointed, hint audit re-run, stamp + What's New, PROJECT_STATE

## Deviations

**Item 3 — the vertical join.** Pack: "vertical neighbours get a quarter-round join patch so
corners read curved." True: a quarter-round patch cannot fill the notch between two rounded
strokes without exposing its own rounding on the far side — it trades one notch for another.
Did: draw a VERTICAL run at the same 45%-of-cell-height radius. The corner cell belongs to
both the horizontal and the vertical span, so the two overlap and their rounded corners
coincide; the turn reads as one stroke bending. Same intent, correct geometry, and the
ACCEPT ("one smooth path with a curved corner in all three styles") is met — see
`_evidence/run21c/i3-before-corner-zoom.png` vs `i3-after-corner-zoom.png`.

**Item 4 — the post-purchase verb.** The pack fixes the shop CARD blurb exactly and is silent
on the confirmation card. Rather than invent child-facing copy, a path style reuses the place
verb's existing line and label verbatim ("… is yours! Where shall it go?" / "Take me there")
and only changes the DOOR: it lands her in the town with the Path Pot in her hand and the new
style picked, which is where that question can be answered.

**Item 2 — one action per cell per stroke (a FIX, not a spec change).** `paintCell` is a
toggle, and `pointermove` fires many times inside a single cell, so a slow drag laid a cell
and swept it away again in the same gesture. Invisible while a separate Erase tool existed;
fatal once scrubbing IS the eraser. Strokes now remember the cells they have already touched.

## Blocks

**B1 — item 5's ACCEPT.** The specced mechanism is built and proven directly, but the
"90s observation shows Boos visibly favouring the path line" could not be produced: a lone
Boo is inside a RUN6 C1 goal 56-62% of the time (those goals drive the actor, so the
micro-wander branch never runs), and the pull is small against the wander's own +/-1.0
variance. Meeting it needs the GOAL engine biased toward paths, which is outside this
pack's WHERE. Full measurements, and the three discarded measurement designs, are in
RUN21C-REPORT.md. The SAVE VERSION question posed in the dispatch resolved without a bump: owning a path
style is one `inventory` entry, which is an existing free-form map, so item 4 needed no
migration and VERSION stays 23. Path DATA (`paths:[{cx,cy,style}]`, `PATH_CAP`) is untouched.

## Note on commit granularity

Items 6 and 7 were written before the item-5 observation finished, so most of their code
landed inside the `RUN21C-5` commit rather than their own. The work is complete and pushed;
only the commit boundary is untidy.
