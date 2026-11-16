// sync.js – Abgleich der Lerndaten mit dem Server (eigenständiges Modul)
//
// Kennt weder CardStore noch PhonaroApp. Die App gibt beim Erzeugen mit:
//   lesen()           liefert den aktuellen Stand (JSON-fähiges Objekt)
//   schreiben(stand)  übernimmt einen Stand vom Server in die App
//   status            (optional) Selektor eines Elements für die Statusanzeige
// Änderungen meldet die App per Event auf document (Standard "karten:geaendert",
// änderbar mit der Option ereignis). Mehrere Sync-Instanzen sind möglich, wenn jede
// eine eigene url und einen eigenen metaKey hat.
//
// Regeln:
//   - Lokal wird immer zuerst gespeichert. Der Server ist Sicherung und Abgleich.
//   - Jede Serverversion hat eine Nummer. Gesendet wird nur, wenn man auf der
//     neuesten Nummer aufbaut. Sonst gibt es einen Konflikt, und du entscheidest.

const META_KEY = 'phonaro-sync-meta';

export class Sync {
  constructor({ lesen, schreiben, url = '/api/state', status = null, verzoegerung = 2000, beschreiben, ereignis = 'karten:geaendert', metaKey = META_KEY } = {}) {
    this.lesen = lesen;
    this.schreiben = schreiben;
    this.url = url;
    this.statusEl = status ? document.querySelector(status) : null;
    this.ereignis = ereignis;   // Event auf document, das Änderungen meldet
    this.metaKey = metaKey;     // eigener Speicherschlüssel je Datensatz
    this.verzoegerung = verzoegerung;   // Wartezeit nach der letzten Änderung, bevor gesendet wird
    this.beschreiben = beschreiben || (s => (s && Array.isArray(s.cards) ? s.cards.length + ' Karten' : 'Daten'));
    this.version = 0;          // zuletzt bekannte Serverversion
    this.dirty = false;        // es gibt lokale Änderungen, die noch nicht gesendet sind
    this.zaehler = 0;          // zählt Änderungen, damit während des Sendens nichts verloren geht
    this.timer = null;
    this.laeuft = false;       // gerade wird gesendet
    this.ignorieren = false;   // Events ignorieren, die wir selbst beim Übernehmen auslösen
  }

  // ---------- Start ----------
  async init() {
    this.metaLaden();
    document.addEventListener(this.ereignis, () => { if (!this.ignorieren) this.geaendert(); });
    window.addEventListener('online', () => this.abgleichen());
    document.addEventListener('visibilitychange', () => { if (document.hidden && this.dirty) this.senden(); });
    setInterval(() => { if (this.dirty) this.senden(); }, 60000);
    await this.abgleichen();
    return this;
  }

  // ---------- Abgleich beim Start ----------
  async abgleichen() {
    this.zeigen('Abgleich …');
    let r;
    try { r = await fetch(this.url, { cache: 'no-store' }); } catch (e) { return this.zeigen('Offline'); }
    if (r.status === 404) { this.version = 0; return this.senden(); }   // Server noch leer: Stand hochladen
    if (!r.ok) return this.zeigen('Serverfehler ' + r.status);
    const s = await r.json();
    if (s.version === this.version) return this.dirty ? this.senden() : this.zeigen('Gesichert');
    if (s.version > this.version && !this.dirty) return this.uebernehmen(s);   // Server ist neuer, hier nichts offen
    if (s.version > this.version) return this.konflikt(s);                      // beide Seiten geändert
    this.version = s.version;   // Server hat einen älteren Stand als bekannt (Daten dort verloren?): hochladen
    return this.senden();
  }

  // ---------- Änderung von der App ----------
  geaendert() {
    this.zaehler++;
    this.dirty = true;
    this.metaSpeichern();
    this.zeigen('Änderung wird gesendet …');
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.senden(), this.verzoegerung);
  }

  // ---------- Senden ----------
  async senden() {
    if (this.laeuft) return;
    this.laeuft = true;
    clearTimeout(this.timer);
    const marke = this.zaehler;
    try {
      const r = await fetch(this.url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ basis: this.version, stand: this.lesen() })
      });
      if (r.status === 409) { this.laeuft = false; return this.konflikt(); }
      if (!r.ok) throw new Error('Status ' + r.status);
      const d = await r.json();
      this.version = d.version;
      if (this.zaehler === marke) this.dirty = false;
      this.metaSpeichern();
      if (this.zaehler !== marke) {   // währenddessen wurde weiter geändert: nochmal senden
        this.timer = setTimeout(() => this.senden(), this.verzoegerung);
        this.zeigen('Änderung wird gesendet …');
      } else {
        this.zeigen('Gesichert ' + new Date().toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }));
      }
    } catch (e) {
      this.zeigen(e instanceof TypeError ? 'Offline: wird später gesendet' : 'Serverfehler');
    }
    this.laeuft = false;
  }

  // ---------- Konflikt: Server und dieses Gerät wurden unterschiedlich geändert ----------
  async konflikt(s) {
    if (!s) {
      try {
        const r = await fetch(this.url, { cache: 'no-store' });
        if (r.ok) s = await r.json();
      } catch (e) { return this.zeigen('Offline'); }
      if (!s) { this.version = 0; return this.senden(); }
    }
    const zeit = new Date(s.updated * 1000).toLocaleString('de-DE');
    const frage = 'Der Server und dieses Gerät wurden unterschiedlich geändert.\n\n'
      + `Server (Stand ${zeit}): ${this.beschreiben(s.state)}\n`
      + `Dieses Gerät: ${this.beschreiben(this.lesen())}\n\n`
      + 'OK = Stand vom Server übernehmen (dein Stand von hier wird vorher als Datei heruntergeladen)\n'
      + 'Abbrechen = diesen Stand behalten und den Server überschreiben (der alte Serverstand bleibt als Backup)';
    if (confirm(frage)) {
      this.herunterladen('lernkarten-lokal-' + Date.now() + '.json', this.lesen());
      this.uebernehmen(s);
    } else {
      this.version = s.version;
      await this.senden();
    }
  }

  // ---------- Stand vom Server in die App übernehmen ----------
  uebernehmen(s) {
    this.ignorieren = true;   // die App speichert dabei und löst selbst ein Änderungs-Event aus
    try { this.schreiben(s.state); } finally { this.ignorieren = false; }
    this.version = s.version;
    this.dirty = false;
    this.metaSpeichern();
    this.zeigen('Vom Server geladen');
  }

  // ---------- Hilfsfunktionen ----------
  herunterladen(name, obj) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(obj)], { type: 'application/json' }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  zeigen(text) { if (this.statusEl) this.statusEl.textContent = text; }

  metaLaden() {
    try {
      const m = JSON.parse(localStorage.getItem(this.metaKey));
      if (m) { this.version = m.version || 0; this.dirty = !!m.dirty; }
    } catch (e) { /* ignorieren */ }
  }

  metaSpeichern() {
    try { localStorage.setItem(this.metaKey, JSON.stringify({ version: this.version, dirty: this.dirty })); } catch (e) { /* ignorieren */ }
  }
}

export default Sync;
