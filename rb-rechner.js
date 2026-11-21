// rb-rechner.js – Reiter „Mathe“: Taschenrechner, Funktion f(x), Summe/Produkt, Matrix/Gleichungssystem

import { Teil, esc, fmt, tabelle, raster, fehler, parseZahlen, formular, rahmen, svg, pfad, FARBE } from './rb-hilfen.js';
import { M } from './rb-mathe.js';

export class Rechner extends Teil {
  html() {
    return `
<fieldset><legend>Taschenrechner</legend>
<input id="m-expr" value="sqrt(2)*3^2 + 5!/(2*3)" autocomplete="off" spellcheck="false" aria-label="Ausdruck">
<div class="row"><b id="m-res"></b><button class="btn" id="m-keep">Merken</button></div>
<div class="sunk list" id="m-hist"></div>
<p class="muted">Erlaubt: + − * / ^ ! ( ), pi, e, sin cos tan asin acos atan sinh cosh tanh sqrt cbrt ln log (10er) log2 exp abs floor ceil round fact gamma. Winkel in Bogenmaß. „2x“ und „2(x+1)“ gehen auch.</p></fieldset>
<fieldset><legend>Funktion f(x): Wert, Ableitung, Integral, Nullstellen</legend>
<label for="m-f">f(x) =</label>
<input id="m-f" value="x^3 - 2x" autocomplete="off" spellcheck="false">
${formular([['m-x0', 'x₀ =', '1'], ['m-a', 'von a =', '-2'], ['m-b', 'bis b =', '2']], 3)}
<div id="m-fout"></div><div id="m-plot"></div></fieldset>
<fieldset><legend>Summe / Produkt über k</legend>
<select id="m-sop" aria-label="Summe oder Produkt"><option value="s">Σ Summe</option><option value="p">Π Produkt</option></select>
${formular([['m-sa', 'k von', '1'], ['m-sb', 'bis', '100']])}
<input id="m-sf" value="1/k^2" autocomplete="off" spellcheck="false" aria-label="Term in k">
<div id="m-sout"></div></fieldset>
<fieldset><legend>Matrix / lineares Gleichungssystem</legend>
<label for="m-A">Matrix A (Zeilen untereinander, Zahlen mit Leerzeichen)</label>
<textarea id="m-A" rows="4" spellcheck="false">2 1 -1
-3 -1 2
-2 1 2</textarea>
<label for="m-B">Rechte Seite b (optional, ein Wert je Zeile) – löst A·x = b</label>
<textarea id="m-B" rows="3" spellcheck="false">8
-11
-3</textarea>
<div id="m-mout"></div></fieldset>`;
  }

  init() {
    this.verdrahten();
    this.zeigeVerlauf();
    this.$('m-expr').addEventListener('keydown', e => { if (e.key === 'Enter') this.$('m-keep').click(); });
    this.$('m-keep').addEventListener('click', () => {
      const r = this.$('m-res');
      if (r.dataset.v === undefined) return;
      this.sp.d.hist.unshift([this.val('m-expr'), fmt(+r.dataset.v, 12)]);
      this.sp.d.hist = this.sp.d.hist.slice(0, 30);
      this.sp.speichern(); this.zeigeVerlauf();
    });
    this.$('m-hist').addEventListener('click', e => {
      const d = e.target.closest('[data-h]');
      if (!d) return;
      const h = this.sp.d.hist[+d.dataset.h];
      if (h) { this.$('m-expr').value = h[0]; this.sp.f['m-expr'] = h[0]; this.sp.speichern(); this.taschenrechner(); }
    });
    this.rechne();
  }

  rechne() { this.taschenrechner(); this.funktion(); this.summe(); this.matrix(); }

  zeigeVerlauf() {
    const h = this.sp.d.hist;
    this.$('m-hist').innerHTML = h.length
      ? h.map((x, i) => `<div data-h="${i}" title="Klicken zum Wiederverwenden"><tt>${esc(x[0])} = ${esc(x[1])}</tt></div>`).join('')
      : '<span class="muted">„Merken“ legt Ergebnisse hier ab (Klick = wieder verwenden).</span>';
  }

  taschenrechner() {
    const res = this.$('m-res');
    try { const v = M.compile(this.val('m-expr'))({}); res.textContent = '= ' + fmt(v, 12); res.dataset.v = String(v); }
    catch (e) { res.innerHTML = e.message === 'leer' ? '' : fehler(e); delete res.dataset.v; }
  }

  funktion() {
    const out = this.$('m-fout'), pl = this.$('m-plot');
    try {
      const f = M.fn(this.val('m-f')), x0 = this.num('m-x0'), a = this.num('m-a'), b = this.num('m-b'), r = [];
      if (!Number.isNaN(x0)) r.push([`f(${fmt(x0)})`, fmt(f(x0), 9)], [`f′(${fmt(x0)}) (numerisch)`, fmt(M.deriv(f, x0), 7)], [`f″(${fmt(x0)}) (numerisch)`, fmt(M.deriv2(f, x0), 6)]);
      pl.innerHTML = '';
      if (!Number.isNaN(a) && !Number.isNaN(b) && a < b) {
        const integral = M.simpson(f, a, b);
        r.push([`∫ von ${fmt(a)} bis ${fmt(b)} f(x) dx`, fmt(Math.abs(integral) < 1e-12 ? 0 : integral, 9)]);
        const rt = M.roots(f, a, b);
        r.push(['Nullstellen in [a, b]', rt.length ? rt.map(v => fmt(v, 8)).join('; ') : 'keine gefunden']);
        const W = 560, H = 250, N = 500, pts = [], ys = [];
        for (let i = 0; i <= N; i++) { const x = a + (b - a) * i / N, y = f(x); pts.push([x, y]); if (Number.isFinite(y)) ys.push(y); }
        if (ys.length) {
          ys.sort((p, q) => p - q);
          let lo = ys[Math.floor(ys.length * 0.01)], hi = ys[Math.ceil(ys.length * 0.99) - 1];
          if (lo === hi) { lo -= 1; hi += 1; }
          const pd = (hi - lo) * 0.08; lo -= pd; hi += pd;
          const fr = rahmen(W, H, [a, b], [lo, hi]);
          const mk = Number.isFinite(x0) && x0 >= a && x0 <= b && Number.isFinite(f(x0)) ? `<circle ${FARBE.punkt} cx="${fr.X(x0)}" cy="${fr.Y(f(x0))}" r="4"/>` : '';
          pl.innerHTML = svg(W, H, fr.g + `<g ${fr.clip}><path ${FARBE.linie} d="${pfad(pts, fr)}"/>${mk}</g>`, 'Graph von f(x)');
        }
      } else r.push(['Für Integral, Nullstellen und Graph: a &lt; b eingeben.']);
      out.innerHTML = tabelle(r);
    } catch (e) { out.innerHTML = fehler(e); pl.innerHTML = ''; }
  }

  summe() {
    const out = this.$('m-sout');
    try {
      const f = M.compile(this.val('m-sf')), a = Math.round(this.num('m-sa')), b = Math.round(this.num('m-sb')), prod = this.val('m-sop') === 'p';
      if (Number.isNaN(a) || Number.isNaN(b)) throw new Error('Grenzen eingeben.');
      if (b < a) throw new Error('Obergrenze muss ≥ Untergrenze sein.');
      if (b - a > 2e6) throw new Error('Höchstens 2 Mio. Summanden.');
      let s = prod ? 1 : 0;
      for (let k = a; k <= b; k++) { const v = f({ k }); s = prod ? s * v : s + v; }
      out.innerHTML = tabelle([[(prod ? 'Π' : 'Σ') + ` für k = ${a} … ${b}`, `<b>${fmt(s, 12)}</b>`], ['Anzahl Terme', b - a + 1]]);
    } catch (e) { out.innerHTML = fehler(e); }
  }

  matrix() {
    const out = this.$('m-mout');
    try {
      const A = this.val('m-A').split(/\n+/).map(l => parseZahlen(l)).filter(r => r.length);
      if (!A.length) throw new Error('Matrix eingeben.');
      const c = A[0].length;
      if (A.some(r => r.length !== c)) throw new Error('Alle Zeilen brauchen gleich viele Zahlen.');
      const R = A.length, rk = M.rref(A, c), r = [['Format', `${R} × ${c}`], ['Rang', rk.piv.length]], zahlen = m => raster(null, m.map(row => row.map(v => fmt(v, 6))));
      let html = '';
      if (R === c) {
        r.push(['Determinante', fmt(rk.det, 8)]);
        if (rk.piv.length === c) {
          const aug = A.map((row, i) => row.concat(Array.from({ length: c }, (_, j) => i === j ? 1 : 0)));
          html += '<p><b>Inverse A⁻¹</b></p>' + zahlen(M.rref(aug, c).m.map(row => row.slice(c)));
        } else r.push(['Inverse', 'nicht vorhanden (singulär)']);
      }
      const B = this.val('m-B').split(/\n+/).map(l => parseZahlen(l)).filter(rw => rw.length);
      if (B.length) {
        if (B.length !== R) r.push(['Gleichungssystem', `b braucht ${R} Zeilen`]);
        else {
          const rr = M.rref(A.map((row, i) => row.concat(B[i])), c), rkA = rr.piv.filter(p => p < c).length, rkAug = rr.piv.length;
          if (rkAug > rkA) r.push(['Gleichungssystem A·x = b', 'keine Lösung']);
          else if (rkA < c) r.push(['Gleichungssystem A·x = b', `unendlich viele Lösungen (Rang ${rkA} &lt; ${c} Unbekannte)`]);
          else { const xs = []; for (let i = 0; i < c; i++) xs.push(rr.m[i].slice(c)); html += '<p><b>Lösung x</b></p>' + zahlen(xs); }
        }
      }
      out.innerHTML = tabelle(r) + html;
    } catch (e) { out.innerHTML = fehler(e); }
  }
}

export default Rechner;
