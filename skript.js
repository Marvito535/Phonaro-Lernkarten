// skript.js – PDF-Skript-Modul
//
// Enthält KEIN eigenes CSS. Es benutzt die Klassen aus deiner CSS-Datei.
// Falls du sie dort umbenannt hast, ändere sie nur hier in der Liste KLASSE.

const KLASSE = {
  btn: 'btn',      // Win98-Button
  sunk: 'sunk',    // eingedrückte weiße Fläche
  row: 'row',      // Zeile mit Abstand
  muted: 'muted',  // graue Hinweisschrift
  hide: 'hide'     // display:none
};

const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/';
const DB_NAME = 'phonaro-lernkarten-pdf';
const SEITE_KEY = 'phonaro-lernkarten-seite';

// pdf.js einmalig von cdnjs laden
let libPromise = null;
function ladeLib() {
  if (window.pdfjsLib) return Promise.resolve();
  if (!libPromise) {
    libPromise = new Promise((ok, fehler) => {
      const s = document.createElement('script');
      s.src = PDFJS + 'pdf.min.js';
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.js';
        ok();
      };
      s.onerror = () => { libPromise = null; fehler(); };
      document.head.appendChild(s);
    });
  }
  return libPromise;
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

export class Skript {
  constructor(container) {
    this.el = typeof container === 'string' ? document.querySelector(container) : container;
    this.el.classList.add('skript');   // Haken für dein CSS
    this.pdf = null;
    this.page = 1;
    this.zoom = 1;
    this.name = '';
    this.busy = false;
    this.dirty = false;
    this.texte = null;   // Text jeder Seite, wird beim ersten Suchen eingelesen
  }

  // ---------- Start ----------
  async init() {
    this.render();
    try { await ladeLib(); } catch (e) { return this.msg('pdf.js konnte nicht geladen werden (Internet nötig).'); }
    const gespeichert = await this.dbGet();
    if (gespeichert) await this.open(gespeichert.buf, gespeichert.name, this.getSeite());
    window.addEventListener('resize', () => this.draw());
    // Markieren beendet: Endmarke der Textebene wieder zurücksetzen
    const loslassen = () => {
      const e = this.$('#sk-text .endOfContent');
      if (e) e.classList.remove('active');
    };
    document.addEventListener('pointerup', loslassen);
    document.addEventListener('pointercancel', loslassen);
    // Schnittstelle: andere Module (z. B. die Karten) sagen per Event, welche Seite gezeigt werden soll
    document.addEventListener('skript:gehezu', e => {
      this.goTo(e.detail.seite);
      this.el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
  }

  // ---------- von außen nutzbar ----------
  show(an = true) { this.el.classList.toggle(KLASSE.hide, !an); }

  goTo(n) {
    if (!this.pdf) return;
    this.page = Math.min(Math.max(1, Math.round(n) || this.page), this.pdf.numPages);
    this.setSeite(this.page);
    this.$('#sk-label').textContent = `${this.page} / ${this.pdf.numPages}`;
    this.draw();
    this.melden();
  }

  // Schnittstelle nach außen: "skript:seite" mit { seite, gesamt }
  melden() {
    document.dispatchEvent(new CustomEvent('skript:seite', {
      detail: { seite: this.page, gesamt: this.pdf.numPages }
    }));
  }

  // ---------- Oberfläche ----------
  $(sel) { return this.el.querySelector(sel); }
  msg(text) { const m = this.$('#sk-msg'); if (m) m.textContent = text; }

  render() {
    const p = this.pdf;
    const k = KLASSE;
    this.el.innerHTML = `<fieldset><legend>Skript (PDF)</legend>
      <div class="${k.row}">
        <input type="file" id="sk-file" accept="application/pdf,.pdf">
        ${p ? `<button class="${k.btn}" id="sk-remove">Entfernen</button>` : ''}
        <span class="${k.muted}" id="sk-msg"></span>
      </div>
      ${p ? `
      <div class="${k.row}">
        <button class="${k.btn}" id="sk-prev">◄</button>
        <span id="sk-label">${this.page} / ${p.numPages}</span>
        <button class="${k.btn}" id="sk-next">►</button>
        <input type="number" id="sk-num" min="1" max="${p.numPages}" placeholder="Seite">
        <button class="${k.btn}" id="sk-go">Gehe zu</button>
        <button class="${k.btn}" id="sk-minus">−</button>
        <button class="${k.btn}" id="sk-plus">+</button>
        <span class="${k.muted}">${esc(this.name)}</span>
      </div>
      <div class="${k.row}">
        <input type="search" id="sk-suche" placeholder="Im Skript suchen …">
        <button class="${k.btn}" id="sk-suchen">Suchen</button>
        <span class="${k.muted}" id="sk-status"></span>
      </div>
      <div class="${k.sunk} skript-treffer ${k.hide}" id="sk-treffer"></div>
      <div class="${k.sunk} skript-view"><div class="skript-seite"><canvas id="sk-canvas"></canvas><div class="textLayer" id="sk-text"></div></div></div>`
      : `<p class="${k.muted}">Lade dein Skript als PDF hoch. Es bleibt auf diesem Gerät gespeichert.</p>`}
    </fieldset>`;

    // Klicks verbinden
    this.$('#sk-file').onchange = e => this.loadFile(e.target.files[0]);
    if (p) {
      this.$('#sk-remove').onclick = () => this.remove();
      this.$('#sk-prev').onclick = () => this.goTo(this.page - 1);
      this.$('#sk-next').onclick = () => this.goTo(this.page + 1);
      this.$('#sk-go').onclick = () => this.goTo(+this.$('#sk-num').value || this.page);
      this.$('#sk-suchen').onclick = () => this.suchen(this.$('#sk-suche').value);
      this.$('#sk-suche').onkeydown = e => { if (e.key === 'Enter') this.suchen(e.target.value); };
      this.$('#sk-minus').onclick = () => { this.zoom = Math.max(0.5, this.zoom - 0.2); this.draw(); };
      this.$('#sk-plus').onclick = () => { this.zoom = Math.min(3, this.zoom + 0.2); this.draw(); };
      this.draw();
    }
  }

  // ---------- PDF laden, öffnen, entfernen ----------
  async loadFile(datei) {
    if (!datei) return;
    if (datei.size > 50e6) return this.msg('Die Datei ist zu groß (maximal 50 MB).');
    const buf = await datei.arrayBuffer();
    await this.dbSet({ name: datei.name, buf });
    this.setSeite(1);
    await this.open(buf, datei.name, 1);
  }

  async open(buf, name, seite) {
    try {
      await ladeLib();
      // Kopie übergeben, weil pdf.js den Puffer sonst verbraucht
      this.pdf = await window.pdfjsLib.getDocument({ data: new Uint8Array(buf.slice(0)) }).promise;
      this.name = name;
      this.page = Math.min(Math.max(1, seite || 1), this.pdf.numPages);
      this.texte = null;   // neue PDF: Suchtext neu einlesen
      this.render();
      this.melden();
    } catch (e) {
      this.pdf = null;
      this.render();
      this.msg('Diese PDF konnte nicht geöffnet werden.');
    }
  }

  async remove() {
    if (!confirm('Skript wirklich entfernen?')) return;
    this.pdf = null;
    await this.dbDel();
    this.setSeite(1);
    this.render();
  }

  // ---------- Volltextsuche ----------
  status(text) { const s = this.$('#sk-status'); if (s) s.textContent = text; }

  // Text aller Seiten einmalig auslesen (beim ersten Suchen) und merken
  async textLaden() {
    if (this.texte) return this.texte;
    const pdf = this.pdf;
    const texte = [];
    for (let i = 1; i <= pdf.numPages; i++) {
      if (pdf !== this.pdf) return null;   // PDF wurde währenddessen ersetzt
      const seite = await pdf.getPage(i);
      const inhalt = await seite.getTextContent();
      texte.push(inhalt.items.map(t => t.str).join(' ').replace(/\s+/g, ' '));
      if (i % 5 === 0) this.status(`Lese Seite ${i} von ${pdf.numPages} …`);
    }
    this.texte = texte;
    return texte;
  }

  async suchen(eingabe) {
    const begriff = (eingabe || '').trim().toLowerCase();
    if (!this.pdf) return;
    if (begriff.length < 2) return this.status('Bitte mindestens 2 Zeichen eingeben.');
    const pdf = this.pdf;
    this.status('Suche läuft …');
    const texte = await this.textLaden();
    if (!texte || pdf !== this.pdf) return;

    // Fundstellen sammeln: höchstens 3 pro Seite, damit die Liste übersichtlich bleibt
    const treffer = [];
    texte.forEach((text, i) => {
      const klein = text.toLowerCase();
      let pos = klein.indexOf(begriff);
      for (let n = 0; pos !== -1 && n < 3; n++) {
        treffer.push({
          seite: i + 1,
          davor: text.slice(Math.max(0, pos - 40), pos),
          fund: text.slice(pos, pos + begriff.length),
          danach: text.slice(pos + begriff.length, pos + begriff.length + 40)
        });
        pos = klein.indexOf(begriff, pos + begriff.length);
      }
    });

    const box = this.$('#sk-treffer');
    box.classList.toggle(KLASSE.hide, treffer.length === 0);
    box.innerHTML = treffer.map(t =>
      `<div class="skript-hit" data-seite="${t.seite}"><b>S. ${t.seite}</b> … ${esc(t.davor)}<mark>${esc(t.fund)}</mark>${esc(t.danach)} …</div>`
    ).join('');
    box.onclick = e => {
      const zeile = e.target.closest('[data-seite]');
      if (zeile) this.goTo(+zeile.dataset.seite);
    };

    const seiten = new Set(treffer.map(t => t.seite)).size;
    this.status(treffer.length
      ? `${treffer.length} Fundstellen auf ${seiten} Seite(n)`
      : 'Keine Treffer. Bei eingescannten PDFs ist keine Textsuche möglich.');
  }

  // ---------- Seite zeichnen ----------
  async draw() {
    if (!this.pdf) return;
    if (this.busy) { this.dirty = true; return; }   // läuft schon, danach nochmal
    this.busy = true;
    do {
      this.dirty = false;
      try {
        const seite = await this.pdf.getPage(this.page);
        const basis = seite.getViewport({ scale: 1 });
        const breite = this.$('.skript-view').clientWidth || 600;
        const vp = seite.getViewport({ scale: (breite - 8) / basis.width * this.zoom });
        const cv = this.$('#sk-canvas');
        const dpr = window.devicePixelRatio || 1;   // scharf auf Retina/Handy
        cv.width = Math.floor(vp.width * dpr);
        cv.height = Math.floor(vp.height * dpr);
        cv.style.width = vp.width + 'px';
        cv.style.height = vp.height + 'px';
        await seite.render({
          canvasContext: cv.getContext('2d'),
          viewport: vp,
          transform: dpr !== 1 ? [dpr, 0, 0, dpr, 0, 0] : null
        }).promise;

        // Unsichtbare Textebene über dem Bild: macht den Text markier- und kopierbar
        try {
          const inhalt = await seite.getTextContent();
          const tl = this.$('#sk-text');
          tl.innerHTML = '';
          tl.style.width = vp.width + 'px';
          tl.style.height = vp.height + 'px';
          tl.style.setProperty('--scale-factor', vp.scale);
          await window.pdfjsLib.renderTextLayer({
            textContentSource: inhalt,
            container: tl,
            viewport: vp,
            textDivs: []
          }).promise;

          // Endmarke gegen springende Markierungen (gleicher Trick wie im pdf.js-Viewer):
          // Solange die Maus gedrückt ist, füllt sie die Lücken zwischen den Textstücken aus
          const ende = document.createElement('div');
          ende.className = 'endOfContent';
          tl.appendChild(ende);
          tl.onpointerdown = () => ende.classList.add('active');
        } catch (e) { /* ohne Textebene bleibt die Seite trotzdem sichtbar */ }
      } catch (e) { /* Seite wurde währenddessen ersetzt oder entfernt */ }
    } while (this.dirty);
    this.busy = false;
  }

  // ---------- Speicher: PDF in IndexedDB, Seite in localStorage ----------
  getSeite() { try { return +localStorage.getItem(SEITE_KEY) || 1; } catch (e) { return 1; } }
  setSeite(n) { try { localStorage.setItem(SEITE_KEY, n); } catch (e) { /* egal */ } }

  async dbRun(modus, aktion) {
    try {
      const db = await new Promise((ok, fehler) => {
        const r = indexedDB.open(DB_NAME, 1);
        r.onupgradeneeded = () => r.result.createObjectStore('f');
        r.onsuccess = () => ok(r.result);
        r.onerror = () => fehler(r.error);
      });
      return await new Promise(ok => {
        const req = aktion(db.transaction('f', modus).objectStore('f'));
        req.onsuccess = () => ok(req.result);
        req.onerror = () => ok(null);
      });
    } catch (e) { return null; }
  }
  dbSet(wert) { return this.dbRun('readwrite', s => s.put(wert, 'skript')); }
  dbDel() { return this.dbRun('readwrite', s => s.delete('skript')); }
  dbGet() { return this.dbRun('readonly', s => s.get('skript')); }
}

export default Skript;   // damit "import Skript from './skript.js'" funktioniert
