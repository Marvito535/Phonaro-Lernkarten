// rechenblock.js – Rechen- und Schreibblock für Mathe, Statistik und Informatik
//
// Eigenständiges Modul wie ziele.js: kennt keine anderen Module deiner App und bringt kein
// eigenes CSS mit. Es benutzt nur Klassen aus deiner styles.css. Falls du sie dort umbenannt
// hast, ändere sie nur hier in der Liste KLASSE.
//
//   new Rechenblock('#rechenblock-inhalt').init();
//
// Die Reiter sind eigene Dateien (rb-*.js). Alles läuft im Browser, gespeichert wird in
// localStorage unter "phonaro-rechenblock" (Notizen, Eingaben, zuletzt gewählter Reiter).
// Die Formel-Vorschau lädt MathJax von cdnjs; ohne Internet bleibt LaTeX als Text sichtbar.

import { Speicher } from './rb-hilfen.js';
import { Formelanzeige } from './rb-formelanzeige.js';
import { Notizen } from './rb-notizen.js';
import { Daten } from './rb-daten.js';
import { Verteilungen } from './rb-verteilungen.js';
import { Tests } from './rb-tests.js';
import { Rechner } from './rb-rechner.js';
import { Informatik } from './rb-informatik.js';
import { Formeln } from './rb-formeln.js';

const KLASSE = {
  menu: 'menu',    // Reiterleiste
  btn: 'btn',      // Win98-Button
  an: 'on',        // gedrückter Button (zusammen mit btn)
  muted: 'muted',  // graue Hinweisschrift
  hide: 'hide'     // display:none
};

const TEILE = [
  ['notizen', 'Notizblock', Notizen],
  ['daten', 'Daten', Daten],
  ['verteilungen', 'Verteilungen', Verteilungen],
  ['tests', 'Tests & Schranken', Tests],
  ['rechner', 'Mathe', Rechner],
  ['informatik', 'Informatik', Informatik],
  ['formeln', 'Formeln', Formeln]
];

export class Rechenblock {
  constructor(container) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    this.el.classList.add('rechenblock');   // Haken für dein CSS
    this.sp = new Speicher();
    this.teile = {};
    this.felder = {};
  }

  init() {
    this.el.innerHTML = `<div class="${KLASSE.menu}" role="tablist" aria-label="Bereiche"></div><div data-rb="seiten"></div><div class="${KLASSE.muted}" data-rb="status"></div>`;
    const leiste = this.el.querySelector('.' + KLASSE.menu), seiten = this.el.querySelector('[data-rb="seiten"]');
    TEILE.forEach(([key, name, Klasse]) => {
      const b = document.createElement('button');
      b.className = KLASSE.btn; b.dataset.tab = key; b.setAttribute('role', 'tab'); b.textContent = name;
      leiste.appendChild(b);
      const feld = document.createElement('div');
      feld.dataset.seite = key;
      seiten.appendChild(feld);
      const teil = new Klasse(feld, this.sp);
      feld.innerHTML = teil.html();
      try { teil.init(); } catch (e) { console.error('Rechenblock:', key, e); }
      this.teile[key] = teil; this.felder[key] = feld;
    });
    leiste.addEventListener('click', e => { const b = e.target.closest('[data-tab]'); if (b) this.zeigen(b.dataset.tab); });
    document.addEventListener('rechenblock:formeln', e => {
      this.el.querySelector('[data-rb="status"]').textContent = e.detail.bereit ? '' : 'Formel-Vorschau nicht verfügbar (offline?) – LaTeX bleibt als Text sichtbar.';
    });
    Formelanzeige.laden();
    this.zeigen(this.felder[this.sp.d.tab] ? this.sp.d.tab : 'notizen');
    return this;
  }

  zeigen(key) {
    this.sp.d.tab = key; this.sp.speichern();
    this.el.querySelectorAll('[data-tab]').forEach(b => {
      const an = b.dataset.tab === key;
      b.classList.toggle(KLASSE.an, an); b.setAttribute('aria-selected', an);
    });
    for (const k of Object.keys(this.felder)) {
      const sichtbar = k === key;
      this.felder[k].classList.toggle(KLASSE.hide, !sichtbar);
      const t = this.teile[k];
      if (sichtbar && t.zeigen) t.zeigen();
      if (!sichtbar && t.verstecken) t.verstecken();
    }
  }
}

export default Rechenblock;
