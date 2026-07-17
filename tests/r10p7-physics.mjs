import { slopeStep, shouldBonk, MAX_SPEED } from '../js/games/boorollphysics.js';
let failed = false;
const assert = (ok, msg) => { if (!ok) { failed = true; console.log('FAIL:', msg); } else console.log('✓', msg); };
let uphill = 7; for (let i = 0; i < 80; i++) uphill = slopeStep({ vx: uphill, deg: -8 });
assert(uphill < 0, '8 degree uphill decelerates and rolls back at zero tilt');
let downhill = 0; for (let i = 0; i < 80; i++) downhill = slopeStep({ vx: downhill, deg: 60 });
assert(downhill > MAX_SPEED * 0.8, 'downhill reaches at least 0.8x max speed');
assert(shouldBonk(11.1, 0) && shouldBonk(0, 261) && !shouldBonk(11, 260), 'bonk thresholds match the P7 contract');
process.exit(failed ? 1 : 0);
