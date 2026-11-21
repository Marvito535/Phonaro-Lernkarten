// schubladen.js – Fenster per × in eine Schublade am Bildschirmrand einfahren (eigenständiges Modul)
//
// Kennt keine anderen Module deiner App und bringt kein eigenes CSS mit. Das Aussehen der
// Schubladen steht in deiner styles.css (Block "Schubladen"). Die Fenster werden nur versteckt,
// nicht entfernt: Pomodoro läuft weiter, Notizen, Skript-Seite und Karten bleiben, wie sie waren.
//
//   new Schubladen().init();      // nach new Fenster().init() und nachdem alle Module gestartet sind
//
// Bedienung:
//   - × in der Titelleiste: Fenster fährt in seine Schublade
//   - Klick auf die Schublade: Fenster kommt zurück (nach vorn); noch ein Klick fährt es wieder ein
//   - Welche Fenster eingefahren sind, wird in localStorage gemerkt ("phonaro-schubladen")
//
// Jeder Eintrag in SCHUBLADEN: suche = Teil der id oder des Titels des Fensters (Groß/Klein egal),
// kurz = Beschriftung (max. 2 Zeichen), seite = 'links' oder 'rechts'.
// Die Reihenfolge in der Liste ist die Reihenfolge am Rand von oben nach unten; die Plätze sind fest.

const KLASSE = {
  fenster: 'win',                 // das Fenster
  titel: 'title',                 // Titelleiste
  schliessen: 'x',                // das × in der Titelleiste
  hide: 'hide',                   // display:none
  schublade: 'schublade',         // die Kachel (Aussehen in styles.css)
  offen: 'offen',                 // Kachel, deren Fenster gerade draußen ist
  links: 'schubladen-links',      // Spalte am linken Rand
  rechts: 'schubladen-rechts'     // Spalte am rechten Rand
};

const KEY = 'phonaro-schubladen';

const SCHUBLADEN = [
  { suche: 'lernkarten', kurz: 'LK', seite: 'links' },    // Prio 1: oben links
  { suche: 'skript', kurz: 'SK', seite: 'rechts' },       // Prio 2: oben rechts
  { suche: 'rechenblock', kurz: 'RB', seite: 'links' },   // Prio 3: links, 2. Platz
  { suche: 'pomodoro', kurz: 'PO', seite: 'rechts' },     // Prio 4: rechts, 2. Platz
  { suche: 'ziele', kurz: 'ZI', seite: 'links' }          // Prio 5: links, 3. Platz
];

export class Schubladen {
  constructor(liste = SCHUBLADEN) {
    this.liste = liste;
    this.eintraege = [];   // { s, fenster, kachel, name }
    this.zu = new Set();   // Namen (suche) der eingefahrenen Fenster
  }

  // ---------- Start ----------
  init() {
    this.laden();
    const spalten = { links: this.spalte(KLASSE.links), rechts: this.spalte(KLASSE.rechts) };
    this.liste.forEach(s => {
      const fenster = this.finden(s.suche);
      if (!fenster) { console.warn('Schubladen: kein Fenster zu „' + s.suche + '“ gefunden'); return; }
      const titel = fenster.querySelector('.' + KLASSE.titel);
      const name = (titel ? titel.textContent.replace('×', '') : s.suche).trim();
      const kachel = document.createElement('button');
      kachel.type = 'button';
      kachel.className = KLASSE.schublade;
      kachel.textContent = s.kurz;
      kachel.title = name;
      kachel.setAttribute('aria-label', name + ' ein- oder ausfahren');
      (spalten[s.seite] || spalten.links).appendChild(kachel);
      const eintrag = { s, fenster, kachel, name };
      kachel.addEventListener('click', () => this.umschalten(eintrag));
      this.eintraege.push(eintrag);
      this.zeigeZustand(eintrag, !this.zu.has(s.suche));
    });
    // × schickt das Fenster in die Schublade
    document.addEventListener('click', e => {
      const x = e.target.closest('.' + KLASSE.schliessen);
      if (!x) return;
      const eintrag = this.eintraege.find(en => en.fenster === x.closest('.' + KLASSE.fenster));
      if (eintrag) this.einfahren(eintrag);
    });
    return this;
  }

  // ---------- von außen nutzbar ----------
  // Fenster mit diesem Suchwort einfahren / ausfahren
  einfahrenPerName(suche) { const e = this.eintraege.find(x => x.s.suche === suche); if (e) this.einfahren(e); }
  ausfahrenPerName(suche) { const e = this.eintraege.find(x => x.s.suche === suche); if (e) this.ausfahren(e); }

  // ---------- Intern ----------
  spalte(klasse) {
    let el = document.querySelector('.' + klasse);
    if (!el) { el = document.createElement('div'); el.className = klasse; document.body.appendChild(el); }
    return el;
  }

  // Fenster zu einem Suchwort: id oder Titel enthält es
  finden(suche) {
    const s = suche.toLowerCase();
    return [...document.querySelectorAll('.' + KLASSE.fenster)].find(w => {
      const t = w.querySelector('.' + KLASSE.titel);
      return (w.id || '').toLowerCase().includes(s) || (t && t.textContent.toLowerCase().includes(s));
    }) || null;
  }

  zeigeZustand(eintrag, draussen) {
    eintrag.fenster.classList.toggle(KLASSE.hide, !draussen);
    eintrag.kachel.classList.toggle(KLASSE.offen, draussen);
    eintrag.kachel.setAttribute('aria-pressed', draussen ? 'true' : 'false');
  }

  umschalten(eintrag) {
    if (eintrag.fenster.classList.contains(KLASSE.hide)) this.ausfahren(eintrag); else this.einfahren(eintrag);
  }

  einfahren(eintrag) {
    this.zu.add(eintrag.s.suche);
    this.zeigeZustand(eintrag, false);
    this.speichern();
    document.dispatchEvent(new CustomEvent('schubladen:geaendert', { detail: { fenster: eintrag.s.suche, offen: false } }));
  }

  ausfahren(eintrag) {
    this.zu.delete(eintrag.s.suche);
    this.zeigeZustand(eintrag, true);
    this.speichern();
    eintrag.fenster.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));   // nach vorn holen (fenster.js)
    window.dispatchEvent(new Event('resize'));   // Module dürfen neu messen, z. B. das Skript
    eintrag.fenster.scrollIntoView({ block: 'nearest' });
    document.dispatchEvent(new CustomEvent('schubladen:geaendert', { detail: { fenster: eintrag.s.suche, offen: true } }));
  }

  // ---------- Speicher (localStorage) ----------
  laden() {
    try {
      const d = JSON.parse(localStorage.getItem(KEY));
      if (Array.isArray(d)) this.zu = new Set(d);
    } catch (e) { /* ignorieren */ }
  }

  speichern() {
    try { localStorage.setItem(KEY, JSON.stringify([...this.zu])); } catch (e) { /* ignorieren */ }
  }
}

export default Schubladen;
