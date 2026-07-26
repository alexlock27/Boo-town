// tests/r8p1-migrations.mjs — RUN8 v2 C1.3 migration proof (permanent suite).
// Authentic historical saves for schema v5 through v11 (shapes reconstructed from the
// git history of js/state.js) must each migrate to the current VERSION losslessly,
// field by field. Pure Node test — migrate() is DOM-free.
import { migrate, VERSION } from '../js/state.js';

let failed = false;
const assert = (c, m) => { if (!c) { failed = true; console.log('  ✗ FAIL:', m); } else console.log('  ✓', m); };
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const AREAS = ['meadow', 'riverside', 'hilltop', 'beach', 'funfair', 'playground', 'boohouse', 'gallery'];
// RUN13 T3: v15 adds the Boo House's two extra rooms as storage keys. The Lounge KEEPS the
// original 'boohouse' key, which is the whole point — a pre-rooms house needs no rewriting.
const HOUSE_ROOM_KEYS = ['boohouse_kitchen', 'boohouse_bedroom'];
const now = Date.now();

// Realistic per-era saves. Each carries genuine progress that must survive to v11.
// v3-v5 town is the FLAT array [{zone,x,item,row}]; v6+ is area-scoped {areas:{...}}.
function eraSave(version) {
  const base = {
    version,
    name: 'Ada',
    guide: version <= 2
      ? { body: 'sunshine', patch: 'cocoa', acc: 'bow', name: 'Twiggy' }             // pre-v3 giraffe-only shape
      : { species: 'giraffe', body: 'sunshine', pattern: 'spots', patternColour: 'cocoa', eyes: 'round', acc: 'none', name: 'Twiggy' },
    stars: { total: 40 * version, byGame: { bubblepop: { best: 6, plays: 12, earned: 55 }, detective: { best: 4, plays: 7, earned: 30 } } },
    meter: 3, boxes: 1, opened: 14, pity: { commons: 2 },
    inventory: { boo_pip: 3, boo_nova: 1, deco_bench: 2, acc_shades: 1 },
    nicknames: { boo_pip: 'Pippa', boo_nova: 'Sparkle' },
    trophies: { first_medal: '2026-01-05', all_bronze: '2026-02-10' },
    journal: { met_boo_pip: '2026-01-02' },
    ledger: { 'tmul7:8': { rights: 4, misses: 1, lastSeen: now - 5e5 } },
    shinies: { boo_nova: 1 }, shinyDrops: 7,
    created: now - 30 * 24 * 3600 * 1000, lastPlayed: now - 3600 * 1000
  };
  // town shape by era
  if (version <= 5) {
    base.town = [
      { zone: 'meadow', x: 0.30, item: 'boo_pip', row: 1 },
      { zone: 'hilltop', x: 0.55, item: 'deco_bench', row: 2 },
      { zone: 'beach', x: 0.20, item: 'boo_nova', row: 0 }
    ];
    base.equips = { boo_pip: 'acc_shades' };            // v3-v7 single-string accessory
    base.chest = { anchor: 100, opened: 2, welcome: true };
  } else {
    base.town = { areas: Object.fromEntries(AREAS.map(k => [k, { items: [], paths: [] }])) };
    base.town.areas.meadow.items = [{ zone: 'meadow', x: 0.30, row: 1, item: 'boo_pip' }];
    base.town.areas.hilltop.items = [{ zone: 'hilltop', x: 0.55, row: 2, item: 'deco_bench' }];
    base.town.areas.beach.items = [{ zone: 'beach', x: 0.20, row: 0, item: 'boo_nova' }];
    base.equips = version <= 7 ? { boo_pip: 'acc_shades' } : { boo_pip: { face: 'acc_shades' } };
  }
  if (version >= 9) base.care = { bonds: { boo_pip: 45 }, treats: 3 };            // P12 care era
  if (version >= 10) base.bloom = { max: { identify: 40, compute: 22 } };          // P19 bloom era
  if (version >= 11) base.wishes = { unlocked: { star: true, cake: true } };       // P20 wishes era
  if (version >= 12) base.lastBackupAt = 1_700_000_000_000;                        // RUN8 v2 backup era
  // A furnished pre-rooms Boo House (every era from v6 on could have one) — this is the
  // data RUN13 T3's room split must carry through untouched.
  if (version >= 6) {
    base.town.areas.boohouse.items = [
      { zone: 'boohouse', x: 0.22, row: 1, item: 'deco_rug', scale: 1.2 },
      { zone: 'boohouse', x: 0.58, row: 2, item: 'deco_sofa', scale: 1 },
      { zone: 'boohouse', x: 0.80, row: 3, item: 'deco_bookshelf', scale: 1 }
    ];
    base.town.areas.boohouse.paths = [{ cx: 3, cy: 4, style: 'stone' }];
  }
  return base;
}

console.log('== era migrations v5 → v14 reach current VERSION losslessly ==');
for (let v = 5; v <= 14; v++) {
  const src = eraSave(v);
  const m = migrate(structuredClone(src));
  assert(m.version === VERSION, `v${v}: migrates to VERSION ${VERSION}`);
  // core progress survives
  assert(m.stars.total === src.stars.total, `v${v}: stars.total preserved (${m.stars.total})`);
  assert(eq(m.stars.byGame.bubblepop, src.stars.byGame.bubblepop), `v${v}: per-game star ledger preserved`);
  assert(eq(m.inventory, src.inventory), `v${v}: inventory preserved`);
  assert(m.nicknames.boo_pip === 'Pippa' && m.nicknames.boo_nova === 'Sparkle', `v${v}: nicknames preserved`);
  assert(eq(m.trophies, src.trophies), `v${v}: trophies preserved`);
  assert(eq(m.journal, src.journal), `v${v}: journal preserved`);
  assert(eq(m.ledger, src.ledger), `v${v}: mistake ledger preserved`);
  assert(m.shinies.boo_nova === 1 && m.shinyDrops === 7, `v${v}: shiny data preserved`);
  // town: three placed items survive, area-scoped, by their original zone
  const houseItems = v >= 6 ? 3 : 0;
  const items = AREAS.reduce((n, k) => n + m.town.areas[k].items.length, 0);
  assert(items === 3 + houseItems, `v${v}: all ${3 + houseItems} town placements survive (${items})`);
  assert(m.town.areas.meadow.items.some(i => i.item === 'boo_pip'), `v${v}: meadow item kept`);
  assert(m.town.areas.beach.items.some(i => i.item === 'boo_nova'), `v${v}: beach item kept`);
  assert(AREAS.every(k => m.town.areas[k] && Array.isArray(m.town.areas[k].items) && Array.isArray(m.town.areas[k].paths)), `v${v}: all 8 areas present`);
  // RUN13 T3 (v15): the two new Boo House rooms appear, EMPTY, and the old house becomes
  // the Lounge with every placement — position, row, scale — and its floor paths intact.
  assert(HOUSE_ROOM_KEYS.every(k => m.town.areas[k] && Array.isArray(m.town.areas[k].items) && Array.isArray(m.town.areas[k].paths)),
    `v${v}: the Kitchen and the Bedroom exist`);
  assert(HOUSE_ROOM_KEYS.every(k => m.town.areas[k].items.length === 0), `v${v}: nothing was invented in the new rooms`);
  if (v >= 6) {
    assert(eq(m.town.areas.boohouse.items, src.town.areas.boohouse.items),
      `v${v}: the pre-rooms Boo House became the Lounge with every placement byte-identical`);
    assert(eq(m.town.areas.boohouse.paths, src.town.areas.boohouse.paths), `v${v}: its floor paths survived too`);
  }
  // equips: however stored, boo_pip ends up wearing acc_shades in the face slot
  assert(m.equips.boo_pip && m.equips.boo_pip.face === 'acc_shades', `v${v}: accessory carried into a slot`);
  // new-era fields default cleanly (never undefined)
  assert(m.care && typeof m.care === 'object' && m.care.bonds && typeof m.care.treats === 'number', `v${v}: care present`);
  assert(m.bloom && m.bloom.max && typeof m.bloom.max === 'object', `v${v}: bloom present`);
  assert(m.wishes && m.wishes.unlocked && typeof m.wishes.unlocked === 'object', `v${v}: wishes present`);
  assert(m.settings && typeof m.settings === 'object' && 'content' in m.settings, `v${v}: settings present`);
  assert(m.expedition && Array.isArray(m.expedition.party) && typeof m.expedition.tiers === 'object', `v${v}: expedition state present`);
  assert('caper' in m, `v${v}: caper field present`);
  // era-specific real data that existed must not be dropped
  if (v >= 9) assert(m.care.bonds.boo_pip === 45 && m.care.treats === 3, `v${v}: existing care data preserved`);
  if (v >= 10) assert(m.bloom.max.identify === 40 && m.bloom.max.compute === 22, `v${v}: existing bloom maxima preserved`);
  if (v >= 11) assert(m.wishes.unlocked.star === true && m.wishes.unlocked.cake === true, `v${v}: existing wish unlocks preserved`);
  // v12 backup field: preserved when present, defaults to 0 for older saves (lossless)
  assert(typeof m.lastBackupAt === 'number', `v${v}: lastBackupAt present`);
  if (v >= 12) assert(m.lastBackupAt === 1_700_000_000_000, `v${v}: existing lastBackupAt preserved`);
  else assert(m.lastBackupAt === 0, `v${v}: lastBackupAt defaults to 0 for pre-v12 saves`);
}

// v12→v13 (RUN11 Q1): a save owning both retired party Boos emerges owning both neutral
// gift Boos with shiny + bond + nickname + equip intact. Name-free suffixes exercise the
// prefix remap without embedding a retired name (G9).
console.log('== v12 → v13 party-Boo retirement is lossless ==');
{
  const v12 = {
    version: 12, name: 'Ada',
    inventory: { boo_birthday_one: 1, boo_birthday_two: 1, boo_pip: 2 },
    shinies: { boo_birthday_one: 1 },
    nicknames: { boo_birthday_two: 'Speedy' },
    equips: { boo_birthday_one: { hat: 'acc_sunhat' } },
    care: { bonds: { boo_birthday_two: 45 }, treats: 1 },
    birthdayParty: { opened: { first: true, second: false }, visits: 2 },
    stars: { total: 90, byGame: {} }
  };
  const m = migrate(structuredClone(v12));
  assert(m.version === VERSION, 'reaches current VERSION');
  assert(m.inventory.boo_party_gift_a === 1 && m.inventory.boo_party_gift_b === 1, 'both gift Boos owned under new ids');
  assert(!('boo_birthday_one' in m.inventory) && !('boo_birthday_two' in m.inventory), 'legacy ids removed');
  assert(m.shinies.boo_party_gift_a === 1, 'shiny carried to new id');
  assert(m.nicknames.boo_party_gift_b === 'Speedy', 'nickname carried to new id');
  assert(m.equips.boo_party_gift_a && m.equips.boo_party_gift_a.hat === 'acc_sunhat', 'equip carried to new id');
  assert(m.care.bonds.boo_party_gift_b === 45, 'bond carried to new id');
  assert(m.partyGiftArchived === true && !('birthdayParty' in m), 'party state folded into a neutral archived flag');
  assert(m.inventory.boo_pip === 2 && m.stars.total === 90, 'unrelated data untouched');
}

// idempotence: migrating an already-current save changes nothing material
console.log('== idempotence ==');
{
  const once = migrate(structuredClone(eraSave(11)));
  const twice = migrate(structuredClone(once));
  assert(eq(once, twice), 'migrate() is idempotent on a current save');
}

console.log('RESULT: ' + (failed ? 'FAIL' : 'PASS'));
process.exit(failed ? 1 : 0);
