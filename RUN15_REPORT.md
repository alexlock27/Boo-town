# RUN15 — THE ECONOMY

Five star types, honest difficulty rewards, lessons as first-class earners, and the Boo
Shop. Evidence: `tests/run15_balance.md` (30 simulated days × three profiles against the
real award machinery and the real prices) and `tests/r15v-economy.mjs`.

---

## The end gate

Closed under the **amended Board Law** (2026-07-27, recorded in CLAUDE.md): a run's end
gate is the affected suites, verified directly — not a full board.

Two full boards did run before the amendment landed (130 suites, 23m 06s and 23m 33s), and
they were worth their time: between them they found **three real regressions from V4**,
every one of them mine.

1. `r12s6-intro-pause` — `js/shop.js` ran an intro without being pause-aware, so its
   ceremonies could fire behind the overlay. It now takes `createRoundTimers()`.
2. `r4p12-reach` — the shop's fourth collection tab pushed that row past 360px.
3. `r11audit` — **my fix for (2) broke a different law.** Shrinking the tabs' padding left
   them 37px tall against the 44px touch-target rule. The correct fix is *wrapping*, not
   shrinking: `flex-wrap` plus `min-height: 44px`, verified against both suites together.

Three further failures did not reproduce serially and were treated as parallel-load flakes:
`m2-full` and `r3p1-spellboo` (4s/5s waits on rAF-paced ceremony animations, now given
load-proof ceilings — no assertion weakened), and `r14u2-beat`, where my own sweep judged
the verdict against the *aimed* offset rather than the *measured* error. Under load a tap
aimed at 300ms landed inside the window and was correctly graded `good`; the assertion was
testing the scheduler, not the judge. It now checks the grade against the measured error,
which is the real contract and is timing-independent.

All six suites verified green directly.

## G11 — stars never shrink, and this is structural

The law is not a convention here; it is the shape of the data:

| field | meaning | ever reduced? |
|---|---|---|
| `stars.total` | LIFETIME. Zone unlocks, the meter, every card. | **never** |
| `stars.byType` | LIFETIME per type. | **never** |
| `stars.spent` | the shop's ledger, per type. | grows only |
| `stars.legacy` | the pre-shop pool; spends as any type. | grows only |

Spendable = `byType − spent`. `js/shop.js`'s `buyItem()` writes **only** `spent` and
`inventory`; there is no code path in the app that decrements `total` or `byType`.

Proved live: after buying a rug, `stars.total` and lifetime `creative` are byte-identical,
`spent.creative` is exactly 8, and the spendable purse fell by exactly 8. And after a
four-item spending spree on a 200-star save, **the Beach is still unlocked** — the unlock
reads the lifetime total, which spending cannot touch.

## V1 — the five star types

The authored mapping is implemented exactly (`data/startypes.js`), including both
content-dependent games: Feed the Boos pays **Word** on an English round and **Maths**
otherwise; Boo Blocks' puzzle scoring pays **Puzzle** and its question content **Maths**.

**Migration (VERSION 17) is lossless and honest about what it cannot know.** Existing
totals cannot be attributed retrospectively — nobody recorded which game paid for what —
so the whole lifetime total migrates into the **Legacy pool**, which spends like any type
and which the shop labels "Stars you earned before the shop opened". Verified on a seeded
v16 save: total 372 unchanged, legacy 372 granted, every type still 0, nothing marked
spent, and migrating twice changes nothing.

## V2 — honest difficulty rewards

The displayed round stars stay 1-3, because that number means "how well did I do". The
multiplier lands on the **spendable** award:

| | 1★ | 2★ | 3★ |
|---|---:|---:|---:|
| Level 1 (×1) | 1 | 2 | 3 |
| Level 2 (×1.5) | 2 | 3 | 5 |
| Level 3 (×2) | 2 | 4 | 6 |
| Level 4+ (×2.5) | 3 | 5 | 8 |

All twelve combinations are asserted. The results screen shows the award, its type, and
the authored bonus line ("Level 3 bonus — double stars!"), plus a Brave chip when the
round was above her comfort level.

**The floor that makes stretching safe:** an above-comfort round always pays at least 2
spendable stars, so a one-star round at a harder level (2) is never worse than not trying.
An easy three-star round still pays its full three — nothing was taken from anyone to fund
this.

**G12, audited not asserted:** a copy audit over `js/results.js`, `js/comfort.js`,
`data/guideLines.js` and `js/shop.js` finds none of "too easy", "try harder", "you
should", "only N stars", "not enough", "again?", "boring" or "wasted". Cosy rounds still
pay, still fill the meter, and are never labelled.

## V3 — lessons as first-class earners

- Lessons pay **Lesson Stars**, the scarcest type, and the Special shelf is priced in them
  alone. Scarcity plus desirability — never obligation.
- A finished lesson gets a real ceremony (badge, name, stars, a Journal stamp) with the
  weight of a game's celebration, then the results screen. Frame evidence:
  `screenshots/run15/lesson-ceremony-1024x768.png`.
- **A lesson replayed after mastery is a "quick recap"** — welcome, warm, and un-farmable:
  it routes through the existing cosy-round machinery, so it still pays but cannot mint
  Lesson Stars on repeat.

## V4 — the Boo Shop

Two doors: a **market stall in the Meadow** (fixed scenery, tappable, never in the way)
and a link on the collection screen. Five shelves via the shared drawer, each taking its
authored currency: House=Creative, Town=Maths, Playground=Puzzle, Wearables=Word,
Special=Lesson.

**Boxes keep their whole meaning.** The unlock-only rule is a single gate that every
purchase route asks first, so the refusal carries the true reason:

- every Boo (41), every costume set (6), every feet accessory — **unpurchasable**, proved
  by attempting each through the direct API and finding `reason: 'unlockOnly'` and an
  empty inventory afterwards;
- and the mirror rule: the nine authored shop-only items (lamp post, signpost, sandpit,
  climbing frame, roundabout, and the three Special pieces) never enter the box pool.

**Nine authored items had no implementation** and were built for this pack — art in
`js/art.js`, entries in `data/catalogue.js`.

**One authored conflict, resolved toward the kinder rule.** CONTENT_PRICES.md prices four
landscape items (flowerbed, bush, rock, path pack) that are **already free** in Build →
Landscape. Pricing them would take away something a child already has, so they are not
repriced; the Town shelf stocks what the shop can genuinely sell.

The save-up heart marks one goal and the hub can show a single progress chip — one chip,
no reminders, never a nag. Buying the goal clears it.

**Day one is browsing with money in hand:** the Welcome purse grants 20 legacy stars on
the first visit with a small ceremony, and a brand-new player can afford **27 items**.

## V5 — the balance simulation

Full output: `tests/run15_balance.md`. Thirty days × three profiles against the real
award machinery and the real price table.

| target | met | evidence |
|---|:--:|---|
| A new player can afford ≥6 items on day one | ✅ | 27, on the Welcome purse alone |
| Maths-only farmer at day 14 furnishes a room and buys several town items | ✅ | Town 10/10, buys all 10; House 12/20 |
| …but cannot reach the Special shelf at all | ✅ | Special 0/3 (lesson purse 0) |
| Broad player at day 14 affords something from every shelf, including one Special | ✅ | house 20, town 10, playground 8, wearables 9, special 3 |
| Lesson-keen player reaches the Special shelf fastest, inside a fortnight | ✅ | Special 3/3 by day 14 (25 Lesson Stars) |
| Nobody is locked out of every shelf for >3 days | ✅ | worst run: 0 days |

**One price was tuned; every other number is the authored draft.** The Special shelf went
from 20/24/28 to **24/28/32**. The draft's cheapest Special item cost exactly the Welcome
purse, and legacy spends as any type — so a player who had never opened a lesson could buy
a Special item on her first visit, which the authored target forbids. Lifting the entry
price to 24 restores it while keeping the shelf reachable for a lesson-keen player inside
a fortnight, which is the Lesson-price reachability rule.

## Day-7 / 14 / 30 affordability

Counts are "items individually affordable / shelf size (and how many she could actually
take home, spending cheapest-first)".

| profile | day | House | Town | Playground | Wearables | Special |
|---|---:|---|---|---|---|---|
| Maths-only farmer | 7 | 12/20 (2) | 10/10 (8) | **0/8** | 8/9 (1) | **0/3** |
| Maths-only farmer | 14 | 12/20 (2) | 10/10 (10) | **0/8** | 8/9 (1) | **0/3** |
| Maths-only farmer | 30 | 12/20 (2) | 10/10 (10) | **0/8** | 8/9 (1) | **0/3** |
| Broad player | 7 | 20/20 (4) | 10/10 (6) | 7/8 (1) | 9/9 (3) | 1/3 (1) |
| Broad player | 14 | 20/20 (5) | 10/10 (8) | 8/8 (2) | 9/9 (4) | 3/3 (1) |
| Broad player | 30 | 20/20 (7) | 10/10 (10) | 8/8 (4) | 9/9 (7) | 3/3 (1) |
| Lesson-keen | 7 | 12/20 (2) | 10/10 (4) | 2/8 (1) | 9/9 (3) | **3/3 (1)** |
| Lesson-keen | 14 | 12/20 (2) | 10/10 (6) | 7/8 (1) | 9/9 (4) | 3/3 (1) |
| Lesson-keen | 30 | 12/20 (2) | 10/10 (9) | 8/8 (2) | 9/9 (7) | 3/3 (2) |

The farmer's row is the shape the whole pack exists to produce. She can buy from three
shelves — the Welcome purse and her enormous maths pile see to that, and she is never
locked out of anything for a day — but the Playground and the Special shelf stay shut,
because those are what puzzles and lessons are for. She is never punished, never scolded,
never paid less than before. She simply cannot buy the telescope.

The lesson-keen player reaches the Special shelf **by day 7**, fastest of the three, which
is exactly the point of pricing it in the scarcest currency.

