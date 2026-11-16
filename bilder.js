// bilder.js – Bilder für Karten speichern (eigenständiges Modul)
//
// Kennt weder Karten noch Skript. Bilder liegen lokal in IndexedDB und, wenn eine
// Serveradresse angegeben ist, zusätzlich auf dem Server (gleiche Schnittstelle wie das PDF).
//
//   const bilder = await new Bilder({ server: '/api/files/' }).init();
//   const id  = await bilder.speichern(blob);   // liefert z. B. "bk3x9a2f7q1.png"
//   const url = await bilder.url(id);           // für <img src>, lokal oder vom Server geholt
//   await bilder.loeschen(id);

const DB_NAME = 'phonaro-lernkarten-bilder';

export class Bilder {
  constructor(optionen = {}) {
    this.server = optionen.server || null;   // z. B. '/api/files/' (mit Schrägstrich am Ende)
    this.cache = new Map();                  // id → Objekt-URL
  }

  async init() {
    if (this.server) this.nachsenden();      // Bilder, die vorher nicht hochgeladen werden konnten
    return this;
  }

  // ---------- von außen nutzbar ----------
  async speichern(blob) {
    const id = 'b' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8) + '.png';
    await this.dbSet(id, { blob, gesendet: false });
    if (this.server) this.senden(id, blob);   // im Hintergrund, blockiert nichts
    return id;
  }

  async url(id) {
    if (!id) return null;
    if (this.cache.has(id)) return this.cache.get(id);
    let eintrag = await this.dbGet(id);
    if (!eintrag && this.server) {   // lokal nicht da (anderes Gerät): vom Server holen und merken
      try {
        const r = await fetch(this.server + id, { cache: 'no-store' });
        if (r.ok) {
          const blob = await r.blob();
          eintrag = { blob, gesendet: true };
          await this.dbSet(id, eintrag);
        }
      } catch (e) { /* offline */ }
    }
    if (!eintrag) return null;
    const u = URL.createObjectURL(eintrag.blob);
    this.cache.set(id, u);
    return u;
  }

  async loeschen(id) {
    if (!id) return;
    if (this.cache.has(id)) { URL.revokeObjectURL(this.cache.get(id)); this.cache.delete(id); }
    await this.dbDel(id);
    if (this.server) {
      try { await fetch(this.server + id, { method: 'DELETE' }); } catch (e) { /* bleibt auf dem Server */ }
    }
  }

  // ---------- Server ----------
  async senden(id, blob) {
    try {
      const r = await fetch(this.server + id, { method: 'PUT', headers: { 'Content-Type': 'image/png' }, body: blob });
      if (r.ok) await this.dbSet(id, { blob, gesendet: true });
    } catch (e) { /* offline: wird beim nächsten Start erneut versucht */ }
  }

  async nachsenden() {
    const ids = (await this.dbRun('readonly', s => s.getAllKeys())) || [];
    for (const id of ids) {
      const e = await this.dbGet(id);
      if (e && !e.gesendet) await this.senden(id, e.blob);
    }
  }

  // ---------- Speicher (IndexedDB) ----------
  async dbRun(modus, aktion) {
    try {
      const db = await new Promise((ok, fehler) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('b');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      });
      return await new Promise(ok => {
        const req = aktion(db.transaction('b', modus).objectStore('b'));
        req.onsuccess = () => ok(req.result);
        req.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  }
  dbSet(id, wert) { return this.dbRun('readwrite', s => s.put(wert, id)); }
  dbDel(id) { return this.dbRun('readwrite', s => s.delete(id)); }
  dbGet(id) { return this.dbRun('readonly', s => s.get(id)); }
}

export default Bilder;
