# Boo Town 👻⭐

A cosy offline learning game for kids, covering the England Year 3/4 curriculum. Play short
maths and spelling games, earn stars, open mystery boxes, collect fluffy critters called
**Boos**, and build them a little town under an indigo night sky.

- **No internet needed** after first load — installs as a web app (PWA) and runs fully offline.
- **No accounts, no ads, no data collection, no AI at runtime.** Everything ships with the app.
- **Vanilla HTML / CSS / JavaScript.** No frameworks, no build step.
- **Touch-first**, tablet-first, works in landscape and portrait.

## Live link

### 👉 https://alexlock27.github.io/Boo-town/

_All asset paths are relative, so the app works at that subpath as-is. Open it once online,
add it to the home screen, and it works fully offline forever after._

Install it on a tablet: open the link in Chrome → menu (⋮) → **Add to Home screen** → **Install**.

## Running locally

Service workers and ES modules need `http://`, not `file://`. From this folder:

```
python -m http.server 8000
```

Then open <http://localhost:8000/>. In Chrome DevTools, use the device toolbar to
simulate a tablet. If the service worker serves a stale version during development,
hard-refresh with **Ctrl+F5**.

## Project docs

- [CHANGELOG.md](CHANGELOG.md) — versioned change history.
