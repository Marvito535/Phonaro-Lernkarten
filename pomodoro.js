// pomodoro.js – Pomodoro-Timer (eigenständiges Modul)
//
// Kennt keine anderen Module deiner App und bringt kein eigenes CSS mit.
// Es benutzt die Klassen aus deiner CSS-Datei. Falls du sie dort umbenannt
// hast, ändere sie nur hier in der Liste KLASSE.

const KLASSE = {
  btn: 'btn',      // Win98-Button
  sunk: 'sunk',    // eingedrückte weiße Fläche
  row: 'row',      // Zeile mit Abstand
  muted: 'muted',  // graue Hinweisschrift
  bar: 'bar',      // Fortschrittsbalken (mit <i> darin)
  hide: 'hide'     // display:none
};

const KEY = 'phonaro-pomodoro';
const NAMEN = { arbeit: 'Arbeiten', kurz: 'Kurze Pause', lang: 'Lange Pause' };
const RUNDEN_BIS_LANG = 4;   // nach 4 Arbeitsphasen kommt die lange Pause

const heuteTag = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };   // lokales Datum

export class Pomodoro {
  // optionen: { arbeit: 25, kurz: 5, lang: 15 }  (Minuten)
  constructor(container, optionen = {}) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    this.el.classList.add('pomodoro');   // Haken für dein CSS
    this.min = { arbeit: 25, kurz: 5, lang: 15, ...optionen };
    this.phase = 'arbeit';
    this.runden = 0;          // abgeschlossene Arbeitsphasen im aktuellen Zyklus
    this.heute = 0;           // abgeschlossene Arbeitsphasen heute
    this.rest = 0;            // verbleibende Millisekunden
    this.ende = null;         // Zeitpunkt, an dem die Phase endet (nur wenn sie läuft)
    this.timer = null;
    this.audio = null;
    this.titelOriginal = document.title;
  }

  // ---------- Start ----------
  init() {
    const zustand = this.laden();
    this.rest = this.min[this.phase] * 60000;
    if (zustand && typeof zustand.rest === 'number' && zustand.rest > 0) this.rest = zustand.rest;
    this.render();
    // Der Timer lief, als die Seite geschlossen oder neu geladen wurde: weiterlaufen lassen
    if (zustand && zustand.ende) {
      if (zustand.ende > Date.now()) {
        this.rest = zustand.ende - Date.now();
        this.ende = zustand.ende;
        this.timer = setInterval(() => this.tick(), 250);
        this.anzeigen();
      } else {
        this.naechstePhase(true);   // die Phase ist in der Zwischenzeit abgelaufen (zählt)
      }
    }
    return this;
  }

  // ---------- von außen nutzbar ----------
  get laeuft() { return this.ende !== null; }

  start() {
    if (this.laeuft) return;
    this.audioVorbereiten();
    this.ende = Date.now() + this.rest;
    this.timer = setInterval(() => this.tick(), 250);
    this.speichern();
    this.anzeigen();
  }

  pause() {
    if (!this.laeuft) return;
    this.rest = Math.max(0, this.ende - Date.now());
    this.ende = null;
    clearInterval(this.timer);
    this.speichern();
    this.anzeigen();
  }

  reset() {
    this.pause();
    this.rest = this.min[this.phase] * 60000;
    this.speichern();
    this.anzeigen();
  }

  // Zyklus von vorn: Runde 1, Arbeitsphase, volle Zeit. Die Zahl "heute" bleibt.
  neu() {
    if (this.laeuft && !confirm('Der Timer läuft. Wirklich von vorn beginnen?')) return;
    this.pause();
    this.phase = 'arbeit';
    this.runden = 0;
    this.rest = this.min.arbeit * 60000;
    this.speichern();
    this.anzeigen();
  }

  skip() {
    this.pause();
    this.naechstePhase(false);
  }

  show(an = true) { this.el.classList.toggle(KLASSE.hide, !an); }

  // ---------- Ablauf ----------
  tick() {
    this.rest = this.ende - Date.now();
    if (this.rest <= 0) this.fertig();
    else this.anzeigen();
  }

  fertig() {
    clearInterval(this.timer);
    this.ende = null;
    this.piep();
    this.naechstePhase(true);
  }

  // gezaehlt = true: Phase wurde zu Ende gebracht (zählt für die Statistik)
  naechstePhase(gezaehlt) {
    if (this.phase === 'arbeit') {
      if (gezaehlt) {
        this.heute++; this.runden++; this.speichern();
        document.dispatchEvent(new CustomEvent('pomodoro:fertig', { detail: { heute: this.heute } }));   // für andere Module (z. B. Ziele)
      }
      this.phase = this.runden > 0 && this.runden % RUNDEN_BIS_LANG === 0 ? 'lang' : 'kurz';
    } else {
      this.phase = 'arbeit';
    }
    this.rest = this.min[this.phase] * 60000;
    this.speichern();
    this.anzeigen();
  }

  // ---------- Oberfläche ----------
  $(sel) { return this.el.querySelector(sel); }

  render() {
    const k = KLASSE;
    this.el.innerHTML = `<div class="${k.sunk} pomodoro-zeit" id="pm-zeit"></div>
        <div class="${k.row}"><div class="${k.bar}"><i id="pm-balken"></i></div></div>
        <div class="${k.row}"><b id="pm-phase"></b><span class="${k.muted}" id="pm-heute"></span></div>
        <div class="${k.sunk}"><div id="pm-zyklus"></div><div class="${k.muted}" id="pm-danach"></div></div>
        <div class="${k.row}">
          <button class="${k.btn}" id="pm-start"></button>
          <button class="${k.btn}" id="pm-reset">Zurück</button>
          <button class="${k.btn}" id="pm-neu" title="Zyklus von vorn beginnen: Runde 1, volle Arbeitszeit. Die Pomodoros von heute bleiben erhalten.">Neu</button>
          <button class="${k.btn}" id="pm-skip" title="Phase überspringen. Eine übersprungene Arbeitsphase zählt nicht als Pomodoro.">Weiter</button>
        </div>
        <fieldset><legend>Minuten</legend>
          <div class="${k.row}">
            <label>Arbeit <input type="number" min="1" max="120" id="pm-m-arbeit" value="${this.min.arbeit}"></label>
            <label>Kurz <input type="number" min="1" max="60" id="pm-m-kurz" value="${this.min.kurz}"></label>
            <label>Lang <input type="number" min="1" max="60" id="pm-m-lang" value="${this.min.lang}"></label>
          </div>
        </fieldset>`;

    this.$('#pm-start').onclick = () => (this.laeuft ? this.pause() : this.start());
    this.$('#pm-reset').onclick = () => this.reset();
    this.$('#pm-skip').onclick = () => this.skip();
    this.$('#pm-neu').onclick = () => this.neu();
    ['arbeit', 'kurz', 'lang'].forEach(name => {
      this.$('#pm-m-' + name).onchange = e => this.dauerAendern(name, +e.target.value);
    });
    this.anzeigen();
  }

  dauerAendern(name, minuten) {
    if (!minuten || minuten < 1) return;
    this.min[name] = Math.min(120, Math.round(minuten));
    this.speichern();
    // laufende Phase nicht stören; im Stillstand sofort übernehmen
    if (!this.laeuft && name === this.phase) this.rest = this.min[name] * 60000;
    this.speichern();
    this.anzeigen();
  }

  anzeigen() {
    const sek = Math.max(0, Math.ceil(this.rest / 1000));
    const zeit = String(Math.floor(sek / 60)).padStart(2, '0') + ':' + String(sek % 60).padStart(2, '0');
    const gesamt = this.min[this.phase] * 60000;
    this.$('#pm-zeit').textContent = zeit;
    this.$('#pm-balken').style.width = Math.round((1 - this.rest / gesamt) * 100) + '%';
    this.$('#pm-phase').textContent = NAMEN[this.phase];
    this.$('#pm-heute').textContent = 'Heute: ' + this.heute;
    this.zyklusZeigen();
    this.$('#pm-start').textContent = this.laeuft ? 'Pause' : 'Start';
    document.title = this.laeuft ? `${zeit} · ${NAMEN[this.phase]}` : this.titelOriginal;
  }

  // Leiste mit den 4 Arbeitsrunden bis zur langen Pause: ■ geschafft, ▶ jetzt, □ kommt noch
  zyklusZeigen() {
    const imZyklus = this.runden % RUNDEN_BIS_LANG;   // geschaffte Runden in diesem Zyklus
    const lang = this.phase === 'lang';
    let leiste = '';
    for (let i = 0; i < RUNDEN_BIS_LANG; i++) {
      const jetzt = this.phase === 'arbeit' && i === imZyklus;
      const fertig = lang || i < imZyklus;
      leiste += jetzt ? '<b>▶</b> ' : (fertig ? '■ ' : '□ ');
    }
    leiste += lang ? '<b>⏸ lange Pause</b>' : '→ lange Pause';
    this.$('#pm-zyklus').innerHTML = leiste;

    let danach;
    if (this.phase === 'arbeit') {
      const lange = (imZyklus + 1) === RUNDEN_BIS_LANG;
      danach = 'Nach Ablauf: ' + (lange ? 'LANGE Pause (' + this.min.lang + ' Min.)' : 'kurze Pause (' + this.min.kurz + ' Min.)')
        + ' · Runde ' + (imZyklus + 1) + ' von ' + RUNDEN_BIS_LANG;
    } else {
      danach = 'Danach: Arbeiten (' + this.min.arbeit + ' Min.) · Runde ' + (lang ? 1 : imZyklus + 1) + ' von ' + RUNDEN_BIS_LANG;
    }
    this.$('#pm-danach').textContent = danach;
  }

  // ---------- Ton (Web Audio, keine Datei nötig) ----------
  audioVorbereiten() {
    // muss durch einen Klick ausgelöst werden, sonst blockt der Browser den Ton
    try {
      if (!this.audio) this.audio = new (window.AudioContext || window.webkitAudioContext)();
      if (this.audio.state === 'suspended') this.audio.resume();
    } catch (e) { /* kein Ton möglich */ }
  }

  piep() {
    if (!this.audio) return;
    try {
      for (let i = 0; i < 3; i++) {
        const o = this.audio.createOscillator();
        const g = this.audio.createGain();
        const t = this.audio.currentTime + i * 0.3;
        o.frequency.value = 880;
        g.gain.value = 0.1;
        o.connect(g);
        g.connect(this.audio.destination);
        o.start(t);
        o.stop(t + 0.15);
      }
    } catch (e) { /* ignorieren */ }
  }

  // ---------- Speicher (localStorage) ----------
  // Gespeichert wird auch der Zustand des Timers. "ende" ist ein fester Zeitpunkt,
  // deshalb stimmt die Restzeit nach einem Neuladen, egal wie lange die Seite zu war.
  laden() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (!d) return null;
      if (d.min) this.min = { ...this.min, ...d.min };
      if (d.tag === heuteTag()) { this.heute = d.heute || 0; }
      if (NAMEN[d.phase]) this.phase = d.phase;
      this.runden = d.runden || 0;
      return { rest: d.rest, ende: d.ende || null };
    } catch (e) { return null; }
  }

  speichern() {
    try {
      localStorage.setItem(KEY, JSON.stringify({
        min: this.min, tag: heuteTag(), heute: this.heute,
        phase: this.phase, runden: this.runden,
        rest: this.laeuft ? Math.max(0, this.ende - Date.now()) : this.rest,
        ende: this.ende
      }));
    } catch (e) { /* ignorieren */ }
  }
}

export default Pomodoro;   // damit "import Pomodoro from './pomodoro.js'" funktioniert
