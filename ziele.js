// ziele.js – Tages- und Wochenziele (eigenständiges Modul)
//
// Kennt keine anderen Module deiner App und bringt kein eigenes CSS mit.
// Es benutzt die Klassen aus deiner CSS-Datei. Falls du sie dort umbenannt
// hast, ändere sie nur hier in der Liste KLASSE.
//
//   new Ziele('#ziele', { karten: () => Anzahl heute beantworteter Karten }).init();
//   Änderungen meldet es per Event "ziele:geaendert"; für den Serverabgleich bietet es
//   stand, uebernehmen(stand) und beschreibung(stand) an (siehe main.js).
//
// Zählt Pomodoros über das Event "pomodoro:fertig" (kommt von pomodoro.js).
// Der Kartenzähler ist optional: ohne "karten" fehlt nur diese Zeile.

const KLASSE = {
  btn: 'btn',      // Win98-Button
  ok: 'ok',        // grüner Button (zusammen mit btn)
  sunk: 'sunk',    // eingedrückte weiße Fläche
  row: 'row',      // Zeile mit Abstand
  muted: 'muted',  // graue Hinweisschrift
  bar: 'bar',      // Fortschrittsbalken (mit <i> darin)
  hide: 'hide'     // display:none
};

const KEY = 'phonaro-ziele';
const STANDARD = {
  tag: 8,                 // Pomodoros pro Tag
  woche: 40,              // Pomodoros pro Woche (Mo–So)
  karten: 30,             // Karten pro Tag
  pruefung: '2026-11-29', // Prüfungsdatum (leer = aus)
  name: 'Statistik-Klausur'
};

const datum = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const heuteTag = () => datum(new Date());
const tageZwischen = (von, bis) => Math.round((new Date(bis + 'T00:00:00') - new Date(von + 'T00:00:00')) / 864e5);

export class Ziele {
  constructor(container, optionen = {}) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    this.el.classList.add('ziele');           // Haken für dein CSS
    this.karten = optionen.karten || null;    // optional: () => Zahl
    this.ziel = { ...STANDARD, ...(optionen.ziel || {}) };
    this.tage = {};                           // 'JJJJ-MM-TT' → Anzahl Pomodoros
    this.einstellen = false;                  // Einstellungen sichtbar?
  }

  // ---------- Start ----------
  init() {
    this.laden();
    document.addEventListener('pomodoro:fertig', () => this.zaehlen(1));
    document.addEventListener('karten:geaendert', () => { if (!this.einstellen) this.render(); });
    document.addEventListener('visibilitychange', () => { if (!document.hidden && !this.einstellen) this.render(); });   // Tageswechsel
    this.render();
    return this;
  }

  // ---------- von außen nutzbar ----------
  // Für den Abgleich (sync.js): kompletter Stand lesen / vom Server übernehmen
  get stand() { return { ziel: this.ziel, tage: this.tage }; }

  uebernehmen(stand) {
    if (!stand) return;
    this.ziel = { ...STANDARD, ...(stand.ziel || {}) };
    this.tage = stand.tage || {};
    this.speichern(false);   // lokal sichern, aber nicht erneut als Änderung melden
    this.render();
  }

  beschreibung(stand) {
    const t = stand && stand.tage ? stand.tage[heuteTag()] || 0 : 0;
    return 'heute ' + t + ' Pomodoros';
  }

  zaehlen(n = 1) {
    const t = heuteTag();
    this.tage[t] = Math.max(0, (this.tage[t] || 0) + n);
    this.speichern();
    if (!this.einstellen) this.render();
  }

  get heute() { return this.tage[heuteTag()] || 0; }

  get woche() {
    const jetzt = new Date();
    const mo = new Date(jetzt.getFullYear(), jetzt.getMonth(), jetzt.getDate() - ((jetzt.getDay() + 6) % 7));
    let summe = 0;
    for (let i = 0; i < 7; i++) {
      summe += this.tage[datum(new Date(mo.getFullYear(), mo.getMonth(), mo.getDate() + i))] || 0;
    }
    return summe;
  }

  // ---------- Oberfläche ----------
  $(sel) { return this.el.querySelector(sel); }

  zeile(titel, ist, soll) {
    const k = KLASSE;
    const pct = soll > 0 ? Math.min(100, Math.round(ist / soll * 100)) : 0;
    return `<div class="${k.row}"><b>${titel}</b><span class="${k.muted}">${ist} / ${soll}${ist >= soll ? ' ✓' : ''}</span></div>
        <div class="${k.row}"><div class="${k.bar}"><i style="width:${pct}%"></i></div></div>`;
  }

  nachricht() {
    const z = this.ziel, h = this.heute;
    if (h === 0) return 'Der erste Pomodoro ist der schwerste. Danach läuft es.';
    if (h >= z.tag) return 'Tagesziel erreicht. Alles darüber ist Bonus, aber vergiss die Pause nicht.';
    const rest = z.tag - h;
    if (h / z.tag >= 0.5) return `Mehr als die Hälfte geschafft. Noch ${rest} bis zum Tagesziel.`;
    return `Gut gestartet. Noch ${rest} bis zum Tagesziel.`;
  }

  pruefungsText() {
    const z = this.ziel;
    if (!z.pruefung) return '';
    const n = tageZwischen(heuteTag(), z.pruefung);
    const name = this.esc(z.name || 'Prüfung');
    if (n < 0) return `${name}: vorbei`;
    if (n === 0) return `${name}: heute!`;
    return `${name}: noch ${n} ${n === 1 ? 'Tag' : 'Tage'}`;
  }

  esc(s) { return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  render() {
    const k = KLASSE, z = this.ziel;
    if (this.einstellen) return this.renderEinstellungen();
    const kartenHeute = this.karten ? this.karten() : null;
    this.el.innerHTML = `
        ${z.pruefung ? `<div class="${k.sunk}"><b>${this.pruefungsText()}</b></div>` : ''}
        ${this.zeile('Pomodoros heute', this.heute, z.tag)}
        ${this.zeile('Pomodoros diese Woche', this.woche, z.woche)}
        ${kartenHeute !== null ? this.zeile('Karten heute', kartenHeute, z.karten) : ''}
        <div class="${k.row}"><span class="${k.muted}">${this.nachricht()}</span></div>
        <div class="${k.row}">
          <button class="${k.btn}" id="zl-plus" title="Einen Pomodoro nachtragen">+1</button>
          <button class="${k.btn}" id="zl-minus" title="Einen Pomodoro abziehen">−1</button>
          <button class="${k.btn}" id="zl-edit">Ziele ändern</button>
        </div>`;
    this.$('#zl-plus').onclick = () => this.zaehlen(1);
    this.$('#zl-minus').onclick = () => this.zaehlen(-1);
    this.$('#zl-edit').onclick = () => { this.einstellen = true; this.render(); };
  }

  renderEinstellungen() {
    const k = KLASSE, z = this.ziel;
    this.el.innerHTML = `<fieldset><legend>Meine Ziele</legend>
          <div class="${k.row}">
            <label>Pomodoros pro Tag <input type="number" min="1" max="30" id="zl-tag" value="${z.tag}"></label>
            <label>pro Woche <input type="number" min="1" max="200" id="zl-woche" value="${z.woche}"></label>
            <label>Karten pro Tag <input type="number" min="1" max="500" id="zl-karten" value="${z.karten}"></label>
          </div>
          <label>Prüfung (Name)</label><input id="zl-name" value="${this.esc(z.name)}">
          <label>Prüfungsdatum (leer = aus)</label><input type="date" id="zl-pruefung" value="${this.esc(z.pruefung)}">
        </fieldset>
        <div class="${k.row}">
          <button class="${k.btn} ${k.ok}" id="zl-save">Speichern</button>
          <button class="${k.btn}" id="zl-cancel">Abbrechen</button>
        </div>`;
    const zahl = (id, min, max, alt) => { const v = Math.round(+this.$(id).value); return v >= min && v <= max ? v : alt; };
    this.$('#zl-save').onclick = () => {
      this.ziel.tag = zahl('#zl-tag', 1, 30, z.tag);
      this.ziel.woche = zahl('#zl-woche', 1, 200, z.woche);
      this.ziel.karten = zahl('#zl-karten', 1, 500, z.karten);
      this.ziel.name = this.$('#zl-name').value.trim() || 'Prüfung';
      this.ziel.pruefung = this.$('#zl-pruefung').value;
      this.speichern();
      this.einstellen = false;
      this.render();
    };
    this.$('#zl-cancel').onclick = () => { this.einstellen = false; this.render(); };
  }

  // ---------- Speicher (localStorage) ----------
  laden() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d) return;
      if (d.ziel) this.ziel = { ...this.ziel, ...d.ziel };
      if (d.tage) this.tage = d.tage;
    } catch (e) { /* ignorieren */ }
  }

  speichern(melden = true) {
    // nur die letzten 120 Tage behalten
    const grenze = datum(new Date(Date.now() - 120 * 864e5));
    Object.keys(this.tage).forEach(t => { if (t < grenze) delete this.tage[t]; });
    try { localStorage.setItem(KEY, JSON.stringify({ ziel: this.ziel, tage: this.tage })); } catch (e) { /* ignorieren */ }
    if (melden) document.dispatchEvent(new CustomEvent('ziele:geaendert'));   // für sync.js
  }
}

export default Ziele;
