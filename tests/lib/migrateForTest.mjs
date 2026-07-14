// tests/lib/migrateForTest.mjs — thin wrapper so state.js's migrate() can be unit
// tested headlessly (no browser) for RUN10 P1's legacy town migration.
import { migrate } from '../../js/state.js';
export function migrateForTest(obj) { return migrate(obj); }
