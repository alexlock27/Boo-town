// js/idb.js — a tiny IndexedDB wrapper for on-device artwork + audio (RUN3 C6/C7).
// The core save stays in localStorage; only large blobs (PNGs, recordings) live here so
// they never bloat the backup code. Everything stays on this device — nothing is uploaded.

const DB_NAME = 'bootown';
const DB_VERSION = 3;   // v3 adds 'jams' (RUN6 C1c Boo Band recordings — note events only)
const STORES = ['artworks', 'audio', 'backups', 'jams'];   // artworks: gallery PNGs; audio: Boo voice clips; backups: rolling save snapshots; jams: band note-event recordings
let dbPromise = null;

function open() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no-indexeddb')); return; }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => { const db = req.result; for (const s of STORES) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' }); };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function tx(store, mode, fn) {
  return open().then(db => new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const os = t.objectStore(store);
    let result;
    const r = fn(os);
    if (r) r.onsuccess = () => { result = r.result; };
    t.oncomplete = () => resolve(result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  }));
}

// record: { id, ... } — id required. Stores the whole object.
export function idbPut(store, record) { return tx(store, 'readwrite', os => os.put(record)); }
export function idbGet(store, id) { return tx(store, 'readonly', os => os.get(id)); }
export function idbGetAll(store) { return tx(store, 'readonly', os => os.getAll()); }
export function idbDelete(store, id) { return tx(store, 'readwrite', os => os.delete(id)); }
export function idbClear(store) { return tx(store, 'readwrite', os => os.clear()); }
export function idbCount(store) { return tx(store, 'readonly', os => os.count()); }

export function idbAvailable() { return typeof indexedDB !== 'undefined'; }
