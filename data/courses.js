// data/courses.js — RUN14 U1: the SIX authored single-screen Boo Roll courses.
// Transcribed EXACTLY from CONTENT_COURSES.md (v2, geometry verified) — that file is LAW:
// geometry, mechanisms, stars, checkpoints, catch floors and pars are implemented as
// written, never redesigned here. The old RUN10 P8 multi-screen layouts are replaced
// entirely (their medals/best times live on under save.booRoll.legacy — VERSION 16).
//
// COORDINATES ARE NORMALISED: x 0-100 left to right, y 0-60 top to bottom, square units
// (the renderer letterboxes a uniform scale). Segment types:
//   platform {x,y,w}            flat surface (catch:true = soft recovery floor: landing
//                               from ANY height never BONKs; 3s dwell → parachute)
//   ramp {x,y,w,deg}            +deg rises rightward (y falls as x grows)
//   wall {x,y,h}                vertical blocker rising from y
// Mechanisms (LEFT paddle operates the nearest; RIGHT thumb button is HOP):
//   seesaw {x,y,w}   idles tipped 22° down-left; held = level bridge; held longer =
//                    tipped down-right for a launch. Never passable without a press.
//   lift {x,y,rise,w}  platform at (x,y) rising `rise` units while held, sinking after
//   girder {x,y,len}   rotates 90°/press between vertical (blocking) and horizontal
//                      (a bridge at y). Idles VERTICAL.
//   gate {x,y,h}       closed panel; opens while held.

export const COURSES = [
  {
    key: 'first-roll', name: 'First Roll', pars: { gold: 20, silver: 28, bronze: 38 },
    teaches: 'tilt, the seesaw, the hop',
    start: { x: 6, y: 8 },
    segments: [
      { t: 'platform', x: 2, y: 14, w: 26 },
      { t: 'ramp', x: 28, y: 14, w: 18, deg: -9 },
      { t: 'platform', x: 46, y: 20, w: 10 },
      { t: 'platform', x: 68, y: 20, w: 12 },
      { t: 'ramp', x: 80, y: 20, w: 8, deg: -7 },
      { t: 'platform', x: 88, y: 24, w: 12 },
      { t: 'platform', x: 40, y: 52, w: 40, catch: true },
      { t: 'wall', x: 40, y: 52, h: 8 }
    ],
    mechanisms: [
      { t: 'seesaw', x: 56, y: 20, w: 12 }
    ],
    stars: [{ x: 22, y: 9 }, { x: 62, y: 13 }, { x: 92, y: 18 }],
    checkpoints: [{ x: 46 }],
    finish: { x: 96, y: 24 }
  },
  {
    key: 'over-and-under', name: 'Over and Under', pars: { gold: 26, silver: 34, bronze: 45 },
    teaches: 'momentum up a rise, the lift',
    start: { x: 5, y: 6 },
    segments: [
      { t: 'ramp', x: 2, y: 12, w: 20, deg: -11 },
      { t: 'platform', x: 22, y: 18, w: 16 },
      { t: 'ramp', x: 38, y: 18, w: 20, deg: 12 },
      { t: 'platform', x: 58, y: 10, w: 12 },
      // gap 70-76
      { t: 'platform', x: 76, y: 14, w: 10 },
      { t: 'platform', x: 86, y: 14, w: 14 },
      // lower deck
      { t: 'platform', x: 30, y: 40, w: 34, catch: true }
    ],
    mechanisms: [
      { t: 'lift', x: 68, y: 40, rise: 26, w: 8 }
    ],
    stars: [{ x: 30, y: 13 }, { x: 64, y: 5 }, { x: 36, y: 35 }],
    checkpoints: [{ x: 38 }],
    finish: { x: 96, y: 14 }
  },
  {
    key: 'lift-off', name: 'Lift Off', pars: { gold: 30, silver: 40, bronze: 52 },
    teaches: 'the lift, patience',
    start: { x: 4, y: 44 },
    segments: [
      { t: 'platform', x: 2, y: 50, w: 22 },
      { t: 'wall', x: 24, y: 50, h: 14 },
      { t: 'platform', x: 36, y: 24, w: 18 },
      { t: 'ramp', x: 54, y: 24, w: 14, deg: -9 },
      { t: 'platform', x: 68, y: 30, w: 10 },
      { t: 'platform', x: 87, y: 14, w: 12 }
    ],
    mechanisms: [
      { t: 'lift', x: 26, y: 50, rise: 26, w: 10 },
      { t: 'lift', x: 78, y: 30, rise: 16, w: 9 }
    ],
    stars: [{ x: 14, y: 45 }, { x: 44, y: 18 }, { x: 82, y: 24 }],
    checkpoints: [{ x: 36 }],
    finish: { x: 96, y: 14 }
  },
  {
    key: 'spin-cycle', name: 'Spin Cycle', pars: { gold: 34, silver: 44, bronze: 58 },
    teaches: 'the girder as a bridge',
    start: { x: 6, y: 10 },
    segments: [
      { t: 'platform', x: 2, y: 16, w: 20 },
      // gap 22-34, bridged by girder@22
      { t: 'platform', x: 34, y: 16, w: 14 },
      { t: 'ramp', x: 48, y: 16, w: 14, deg: 10 },
      { t: 'platform', x: 62, y: 10, w: 8 },
      // gap 70-82, bridged by girder@70
      { t: 'platform', x: 82, y: 10, w: 16 },
      { t: 'platform', x: 18, y: 50, w: 56, catch: true }
    ],
    mechanisms: [
      { t: 'girder', x: 22, y: 16, len: 12 },
      { t: 'girder', x: 70, y: 10, len: 12 }
    ],
    stars: [{ x: 28, y: 11 }, { x: 56, y: 6 }, { x: 76, y: 5 }],
    checkpoints: [{ x: 48 }],
    finish: { x: 96, y: 10 }
  },
  {
    key: 'the-gate', name: 'The Gate', pars: { gold: 38, silver: 50, bronze: 64 },
    teaches: 'braking, holding, the leap of faith',
    start: { x: 4, y: 6 },
    segments: [
      { t: 'ramp', x: 2, y: 12, w: 24, deg: -13 },
      { t: 'platform', x: 26, y: 20, w: 8 },     // short ledge: overshoot falls
      { t: 'platform', x: 34, y: 20, w: 20 },
      { t: 'ramp', x: 54, y: 20, w: 16, deg: 9 },
      { t: 'platform', x: 70, y: 13, w: 6 },
      // gap 76-84
      { t: 'platform', x: 84, y: 18, w: 14 },
      { t: 'platform', x: 2, y: 44, w: 66, catch: true }
    ],
    mechanisms: [
      { t: 'gate', x: 34, y: 20, h: 10 },
      { t: 'lift', x: 76, y: 44, rise: 26, w: 8 }
    ],
    stars: [{ x: 30, y: 15 }, { x: 60, y: 14 }, { x: 80, y: 8 }],
    checkpoints: [{ x: 34 }],
    finish: { x: 96, y: 18 }
  },
  {
    key: 'sunset-ridge', name: 'Sunset Ridge', pars: { gold: 45, silver: 60, bronze: 78 },
    teaches: 'everything at once',
    start: { x: 5, y: 8 },
    segments: [
      { t: 'ramp', x: 2, y: 14, w: 16, deg: -10 },
      { t: 'platform', x: 32, y: 20, w: 6 },
      // gap 38-48, bridged by girder@38
      { t: 'ramp', x: 48, y: 20, w: 12, deg: 11 },
      { t: 'platform', x: 60, y: 13, w: 6 },
      // gap 66-76 — the course's exam
      { t: 'platform', x: 76, y: 12, w: 6 },
      { t: 'platform', x: 82, y: 12, w: 16 },
      { t: 'platform', x: 2, y: 46, w: 66, catch: true }
    ],
    mechanisms: [
      { t: 'seesaw', x: 18, y: 20, w: 14 },
      { t: 'girder', x: 38, y: 20, len: 10 },
      { t: 'gate', x: 82, y: 12, h: 8 },
      { t: 'lift', x: 68, y: 46, rise: 34, w: 8 }
    ],
    stars: [{ x: 24, y: 14 }, { x: 52, y: 8 }, { x: 88, y: 6 }],
    checkpoints: [{ x: 38 }, { x: 76 }],
    finish: { x: 97, y: 12 }
  }
];
export const COURSE_KEYS = COURSES.map(c => c.key);
