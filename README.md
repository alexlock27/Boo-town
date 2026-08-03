# Boo Town 👻⭐

A cosy offline learning game for kids, covering the England Year 3/4 curriculum, with a
separate Toddler tier for much younger players. Play short maths, spelling and phonics
games, earn stars, open mystery boxes, collect fluffy critters called **Boos**, and build
them a whole island of places to live under an indigo night sky.

- **No internet needed** after first load — installs as a web app (PWA) and runs fully offline.
- **No accounts, no ads, no data collection, no AI at runtime.** Everything ships with the app.
- **Vanilla HTML / CSS / JavaScript.** No frameworks, no build step.
- **Touch-first**, tablet-first, works in landscape and portrait.

## What's inside

**23 games on the home screen**, grouped into Learn and Play.

- **Learn (15)** — Teach Me (guided mini-lessons), Bubble Pop (times tables), Feed the Boos
  (number sense), Spell Boo (Year 3/4 spelling), Word Detective (guess the word), Sound Sorter,
  Blend It, Rhyme Time, Story Order, Twin Trouble, Apostrophe Patrol, Clock Shop, Odd Boo Out,
  Flash Boos and the Boo Expedition.
- **Play (8)** — Boo Blocks, Boo Bounce, Boo Beat, Boo Dash, Boo Pop, Boo Roll, Echo Boos and
  Joke Boos.
- Every game has friendly three-star scoring, gentle wrong-answer handling and no punishing
  timers. Each one teaches itself with a short skippable intro and a "?" replay.
- **Toddler mode** swaps the home screen for a calm column of **7 big picture cards**, all
  playable with the sound off.

**A world of eight places**, reached from an island world map.

- Six outdoors — the Meadow, Riverside, Hilltop, Sunny Beach, the Boo Funfair and the
  Playground — each **four screens wide**, with wandering Boos, real-clock day and night,
  weather and per-area ambient sound.
- Two indoors — the Boo House (Lounge, Kitchen and Bedroom, each with its own wallpaper and
  floor) and the Gallery.
- The Meadow, Funfair, Playground, Boo House and Gallery are open from the start; Riverside,
  Hilltop and Sunny Beach unlock with stars.
- Drag things anywhere along the ground, hang them on walls, stand small things on top of big
  ones, paint paths, and resize what you place.

**149 catalogue items to collect and place** — 44 Boos, 36 pieces of furniture, 34 wearable
accessories, 27 decorations and 8 landscape pieces. (The landscape set is an always-available
build toybox rather than something to collect.) 15 of them are seasonal and only appear in
summer, at Halloween and in winter. Plus **60 Wish Well words** that arrive in the town as real
things, and **24 wallpaper and floor dressings** for the house.

**Things to do with a Boo** — care for them (brush teeth, feed, brush fur, bath and play),
dress them up, name them, hear them, watch them nap, sit on the swings, fish at the pond and
ask you for things. Plus the band and disco at the funfair, Snaffle's Caper, Boo Quest, the
Feelings Corner, the Boo Studio (paint, collage, build-a-Boo and a gallery of her own art) and
a Town Postcard she can share.

**A character you make and re-make** — five animals with colours, patterns, eyes, accessories
and a name, changeable any time.

All content maps to the England Year 3/4 curriculum and ships with the app.

## Live link

### 👉 https://alexlock27.github.io/Boo-town/

_All asset paths are relative, so the app works at that subpath as-is. Open it once online,
add it to the home screen, and it works fully offline forever after._

Install it on a tablet: open the link in Chrome → menu (⋮) → **Add to Home screen** → **Install**.

## Running locally

Service workers and ES modules need `http://`, not `file://`. From this folder:

```
python _serve.py 8000        # or: npm run serve
```

Then open <http://localhost:8000/>. Use `_serve.py` rather than `python -m http.server`: it
sends `no-store` on everything, so what you see is always what is on disk (`index.html` is the
one file that cannot carry a `?v=` cache-buster, so a stale copy silently loads old modules).
In Chrome DevTools, use the device toolbar to simulate a tablet. If the service worker serves
a stale version during development, hard-refresh with **Ctrl+F5**.

## Tests

The board is **185 Playwright suites** (of 210 files under `tests/` — the rest are the runner
itself, the minutes-long pre-merge walk, and screenshot scripts that run on their own).
`npm test` drives the board through `_runall.sh`, which shards the suites across worker lanes
and then runs the frame-evidence `@serial` set alone at the end. It starts a local server for
you if one is not already answering.

```
npm test                     # the full board (minutes)
npm test -- --smoke          # the fast gate: routes, contrast, migrations, copy guard
npm test -- --workers 4      # lane count
BASE=http://127.0.0.1:8071 npm test -- --smoke     # reuse a server you already started
```

Nothing under `tests/`, `tools/` or `scripts/` ships to the app.

## Project docs

- [CHANGELOG.md](CHANGELOG.md) — versioned change history.
- [PROJECT_STATE.md](PROJECT_STATE.md) — generated inventory of the app (`node tools/gen-state.mjs`).
- [CLAUDE.md](CLAUDE.md) — the house rules every change is held to.
