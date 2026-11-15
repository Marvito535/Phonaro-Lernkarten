// fenster.js – Fenster per Drag & Drop verschieben (eigenständiges Modul)
//
// Kennt keine anderen Module deiner App und bringt kein eigenes CSS mit.
// Es verschiebt die Fenster nur optisch (transform), das Layout deiner Seite
// bleibt unverändert. Ohne gespeicherte Position sitzt jedes Fenster dort,
// wo dein normales CSS es hinlegt.
//
// Bedienung:
//   - Fenster an der Titelleiste ziehen (Maus und Touch)
//   - Klick auf ein Fenster holt es nach vorn
//   - Doppelklick auf die Titelleiste setzt dieses Fenster zurück

const KLASSE = {
  fenster: 'win',     // das Fenster (muss eine id haben)
  titel: 'title',     // die Titelleiste, an der gezogen wird
  schliessen: 'x'     // das × in der Titelleiste (startet keinen Zug)
};

const KEY = 'phonaro-fenster';

export class Fenster {
  // selektor: welche Fenster verschiebbar sein sollen
  constructor(selektor = `.${KLASSE.fenster}[id]`) {
    this.liste = [...document.querySelectorAll(selektor)];
    this.pos = {};      // id → { x, y }: Verschiebung in Pixeln gegenüber dem Normalplatz
    this.z = 10;        // höchster z-index, wird beim Nach-vorn-Holen hochgezählt
  }

  // ---------- Start ----------
  init() {
    this.laden();
    this.liste.forEach(el => {
      const titel = el.querySelector('.' + KLASSE.titel);
      if (!titel) return;
      el.style.position = 'relative';   // damit z-index auch bei Block-Elementen wirkt (ändert das Layout nicht)
      this.anwenden(el);
      this.begrenzen(el);
      titel.addEventListener('pointerdown', e => this.start(e, el, titel));
      titel.addEventListener('dblclick', e => {
        if (!e.target.closest('.' + KLASSE.schliessen)) this.zuruecksetzen(el);
      });
      el.addEventListener('pointerdown', () => this.nachVorn(el));
    });
    // Nach einer Größenänderung darf kein Fenster außerhalb des Bildschirms hängen
    window.addEventListener('resize', () => this.liste.forEach(el => this.begrenzen(el)));
    return this;
  }

  // ---------- von außen nutzbar ----------
  // Alle Fenster zurück an ihren Normalplatz
  reset() {
    this.pos = {};
    this.liste.forEach(el => this.anwenden(el));
    this.speichern();
  }

  zuruecksetzen(el) {
    delete this.pos[el.id];
    this.anwenden(el);
    this.speichern();
  }

  // ---------- Ziehen ----------
  start(e, el, titel) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;   // nur linke Maustaste
    if (e.target.closest('.' + KLASSE.schliessen)) return;
    e.preventDefault();   // verhindert Textmarkieren beim Ziehen

    const startX = e.clientX;
    const startY = e.clientY;
    const p0 = this.pos[el.id] || { x: 0, y: 0 };
    titel.setPointerCapture(e.pointerId);   // Zug läuft weiter, auch wenn die Maus die Titelleiste verlässt

    const bewegen = ev => {
      this.pos[el.id] = { x: p0.x + ev.clientX - startX, y: p0.y + ev.clientY - startY };
      this.anwenden(el);
      this.begrenzen(el);
    };
    const ende = () => {
      titel.removeEventListener('pointermove', bewegen);
      titel.removeEventListener('pointerup', ende);
      titel.removeEventListener('pointercancel', ende);
      this.speichern();
    };
    titel.addEventListener('pointermove', bewegen);
    titel.addEventListener('pointerup', ende);
    titel.addEventListener('pointercancel', ende);
  }

  nachVorn(el) {
    el.style.zIndex = ++this.z;
  }

  // Verschiebung auf das Element anwenden
  anwenden(el) {
    const p = this.pos[el.id];
    el.style.transform = p ? `translate(${p.x}px, ${p.y}px)` : '';
  }

  // Fenster nicht links, rechts oder oberhalb der Seite verschwinden lassen
  // (nach unten ist alles erlaubt, die Seite scrollt dann)
  begrenzen(el) {
    const p = this.pos[el.id];
    if (!p) return;
    const r = el.getBoundingClientRect();
    const breite = document.documentElement.clientWidth;
    let dx = 0;
    let dy = 0;
    if (r.left < 0) dx = -r.left;
    else if (r.right > breite) dx = breite - r.right;
    if (r.top + window.scrollY < 0) dy = -(r.top + window.scrollY);
    if (dx || dy) {
      p.x += dx;
      p.y += dy;
      this.anwenden(el);
    }
  }

  // ---------- Speicher (localStorage) ----------
  laden() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (d && typeof d === 'object') this.pos = d;
    } catch (e) { /* ignorieren */ }
  }

  speichern() {
    try { localStorage.setItem(KEY, JSON.stringify(this.pos)); } catch (e) { /* ignorieren */ }
  }
}

export default Fenster;   // damit "import Fenster from './fenster.js'" funktioniert
