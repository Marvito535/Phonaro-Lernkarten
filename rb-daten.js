// rb-daten.js – Reiter „Daten“: Kennzahlen, Histogramm, Boxplot, Regression

import { Teil, esc, fmt, tabelle, fehler, parseZahlen, formular, rahmen, svg, FARBE } from './rb-hilfen.js';
import { M } from './rb-mathe.js';

export class Daten extends Teil {
  html() {
    return `
<h4>Werte (eine Variable)</h4>
<textarea id="d-data" rows="4" spellcheck="false" aria-label="Werte">12 15 11 18 14 15 20 13 15 17</textarea>
${formular([['d-bins', 'Klassen (leer = Sturges)', '']], 1)}
<div class="sunk" id="d-out"></div>
<div id="d-hist"></div>
<h4>Wertepaare x y (eine Zeile je Paar) für die Regression</h4>
<textarea id="d-xy" rows="5" spellcheck="false" aria-label="Wertepaare">1 2,1
2 3,9
3 6,2
4 7,8
5 10,1</textarea>
${formular([['d-px', 'Prognose für x =', '6']], 1)}
<div class="sunk" id="d-reg"></div>`;
  }

  init() { this.verdrahten(); this.rechne(); }

  rechne() { this.kennzahlen(); this.regression(); }

  kennzahlen() {
    const out = this.$('d-out'), hist = this.$('d-hist'), a = parseZahlen(this.val('d-data'));
    if (!a.length) { out.innerHTML = '<span class="muted">Zahlen eingeben – getrennt durch Leerzeichen, Zeilenumbruch oder Semikolon. Dezimalkomma ist erlaubt.</span>'; hist.innerHTML = ''; return; }
    const d = M.desc(a);
    out.innerHTML = tabelle([['Anzahl n', d.n], ['Summe', fmt(d.sum)], ['Mittelwert x̄', fmt(d.mean)], ['Median', fmt(d.median)],
      ['Modus', d.modes.length ? d.modes.map(v => fmt(v)).join('; ') + ' (je ' + d.mx + '×)' : 'kein Modus'],
      ['Minimum / Maximum', fmt(d.min) + ' / ' + fmt(d.max)], ['Spannweite', fmt(d.range)], ['Q1 / Q3', fmt(d.q1) + ' / ' + fmt(d.q3)], ['Quartilsabstand IQR', fmt(d.iqr)],
      ['Varianz s² (n−1)', fmt(d.varS)], ['Varianz σ² (n)', fmt(d.varP)], ['Std.-Abw. s (n−1)', fmt(d.sd)], ['Std.-Abw. σ (n)', fmt(d.sdP)],
      ['Variationskoeffizient', fmt(d.cv)], ['Standardfehler s/√n', fmt(d.se)], ['Schiefe', fmt(d.skew)], ['Wölbung (Exzess)', fmt(d.kurt)],
      ['Quartile nach Excel/R (Typ 7). Lehrbuch-Methoden können leicht abweichen.']]);
    const W = 560, H = 250;
    let lo = d.min, hi = d.max;
    if (lo === hi) { lo -= 1; hi += 1; }
    let k = parseInt(this.val('d-bins'), 10);
    if (!(k > 0)) k = Math.ceil(Math.log2(d.n)) + 1;
    k = Math.min(k, 60);
    const w = (hi - lo) / k, cnt = new Array(k).fill(0);
    for (const v of a) cnt[Math.min(k - 1, Math.floor((v - lo) / w))]++;
    const ymax = Math.max(...cnt), f = rahmen(W, H, [lo, hi], [0, ymax * 1.1], { ny: Math.min(ymax, 6) });
    let bars = '';
    cnt.forEach((c, i) => {
      const x0 = f.X(lo + i * w), x1 = f.X(lo + (i + 1) * w);
      bars += `<rect ${FARBE.balken} x="${x0}" y="${f.Y(c)}" width="${Math.max(1, x1 - x0 - 1)}" height="${f.Y(0) - f.Y(c)}"><title>${c}</title></rect>`;
    });
    const f2 = rahmen(W, 70, [lo, hi], [0, 1], { noy: true, nx: 7, b: 22 });
    const iqr = d.iqr, wl = Math.min(...a.filter(v => v >= d.q1 - 1.5 * iqr)), wh = Math.max(...a.filter(v => v <= d.q3 + 1.5 * iqr));
    let box = `<line ${FARBE.achse} x1="${f2.X(wl)}" x2="${f2.X(d.q1)}" y1="30" y2="30"/><line ${FARBE.achse} x1="${f2.X(d.q3)}" x2="${f2.X(wh)}" y1="30" y2="30"/>`
      + `<rect ${FARBE.kasten} x="${f2.X(d.q1)}" y="14" width="${Math.max(1, f2.X(d.q3) - f2.X(d.q1))}" height="32"/><line ${FARBE.median} x1="${f2.X(d.median)}" x2="${f2.X(d.median)}" y1="14" y2="46"/>`;
    for (const v of a) if (v < wl || v > wh) box += `<circle ${FARBE.punkt} cx="${f2.X(v)}" cy="30" r="3"/>`;
    hist.innerHTML = svg(W, H, f.g + `<g ${f.clip}>${bars}</g>`, 'Histogramm') + svg(W, 70, f2.g + box, 'Boxplot');
  }

  regression() {
    const rg = this.$('d-reg');
    const paare = this.val('d-xy').split(/\n+/).map(l => parseZahlen(l)).filter(r => r.length >= 2);
    if (paare.length < 3) { rg.innerHTML = '<span class="muted">Regression: mindestens 3 Zeilen „x y“ eingeben.</span>'; return; }
    const xs = paare.map(r => r[0]), ys = paare.map(r => r[1]), r = M.reg(xs, ys), px = this.num('d-px');
    if (!(r.sxx > 0)) { rg.innerHTML = fehler('Alle x-Werte sind gleich.'); return; }
    const W = 560, H = 260, pad = (Math.max(...xs) - Math.min(...xs)) * 0.08 || 1, xr = [Math.min(...xs) - pad, Math.max(...xs) + pad];
    const yl = [...ys, r.a + r.b * xr[0], r.a + r.b * xr[1]], yp = (Math.max(...yl) - Math.min(...yl)) * 0.08 || 1;
    const yr = [Math.min(...yl) - yp, Math.max(...yl) + yp], f = rahmen(W, H, xr, yr);
    let pts = '';
    xs.forEach((x, i) => { pts += `<circle ${FARBE.punkt} cx="${f.X(x)}" cy="${f.Y(ys[i])}" r="4"/>`; });
    const line = `<line ${FARBE.linie} x1="${f.X(xr[0])}" y1="${f.Y(r.a + r.b * xr[0])}" x2="${f.X(xr[1])}" y2="${f.Y(r.a + r.b * xr[1])}"/>`;
    rg.innerHTML = tabelle([['Regressionsgerade ŷ = a + b·x', `ŷ = ${fmt(r.a)} ${r.b < 0 ? '−' : '+'} ${fmt(Math.abs(r.b))}·x`], ['Steigung b = s<sub>xy</sub>/s<sub>x</sub>²', fmt(r.b)], ['Achsenabschnitt a', fmt(r.a)],
      ['Korrelation r', fmt(r.r)], ['Bestimmtheitsmaß R²', fmt(r.r2)], ['Kovarianz (n−1) / (n)', fmt(r.cov) + ' / ' + fmt(r.covP)], ['x̄ / ȳ', fmt(r.mx) + ' / ' + fmt(r.my)],
      Number.isFinite(px) ? ['Prognose ŷ(' + fmt(px) + ')', fmt(r.a + r.b * px)] : ['Prognose: x₀ oben eingeben']])
      + svg(W, H, f.g + `<g ${f.clip}>${line}${pts}</g>`, 'Streudiagramm mit Regressionsgerade');
  }
}

export default Daten;
