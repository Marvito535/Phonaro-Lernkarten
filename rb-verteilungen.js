// rb-verteilungen.js – Reiter „Verteilungen“: Wahrscheinlichkeiten und Quantile mit Diagramm
// Normal, t, Chi², Exponential, Gleichverteilung, Binomial, Poisson, geometrisch.

import { Teil, esc, fmt, pct, tabelle, fehler, formular, rahmen, svg, pfad, FARBE } from './rb-hilfen.js';
import { M } from './rb-mathe.js';

const D = {
  normal: { n: 'Normalverteilung N(μ, σ²)', p: [['μ', 0], ['σ', 1]], c: 1, ok: ([m, s]) => s > 0, cdf: (x, [m, s]) => M.normcdf((x - m) / s), pdf: (x, [m, s]) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)), inv: (q, [m, s]) => m + s * M.norminv(q), E: ([m]) => m, V: ([m, s]) => s * s, sup: () => [-Infinity, Infinity] },
  t: { n: 't-Verteilung (ν Freiheitsgrade)', p: [['ν', 10]], c: 1, ok: ([v]) => v > 0, cdf: (x, [v]) => M.tcdf(x, v), pdf: (x, [v]) => Math.exp(M.lgamma((v + 1) / 2) - M.lgamma(v / 2)) / Math.sqrt(v * Math.PI) * Math.pow(1 + x * x / v, -(v + 1) / 2), E: ([v]) => v > 1 ? 0 : NaN, V: ([v]) => v > 2 ? v / (v - 2) : v > 1 ? Infinity : NaN, sup: () => [-Infinity, Infinity] },
  chi2: { n: 'χ²-Verteilung (k Freiheitsgrade)', p: [['k', 5]], c: 1, ok: ([k]) => k > 0, cdf: (x, [k]) => x <= 0 ? 0 : M.gammp(k / 2, x / 2), pdf: (x, [k]) => x <= 0 ? 0 : Math.exp((k / 2 - 1) * Math.log(x) - x / 2 - (k / 2) * Math.log(2) - M.lgamma(k / 2)), E: ([k]) => k, V: ([k]) => 2 * k, sup: () => [0, Infinity] },
  exp: { n: 'Exponentialverteilung (λ)', p: [['λ', 1]], c: 1, ok: ([l]) => l > 0, cdf: (x, [l]) => x <= 0 ? 0 : 1 - Math.exp(-l * x), pdf: (x, [l]) => x < 0 ? 0 : l * Math.exp(-l * x), inv: (q, [l]) => -Math.log(1 - q) / l, E: ([l]) => 1 / l, V: ([l]) => 1 / (l * l), sup: () => [0, Infinity] },
  unif: { n: 'Gleichverteilung stetig (a, b)', p: [['a', 0], ['b', 1]], c: 1, ok: ([a, b]) => b > a, cdf: (x, [a, b]) => x <= a ? 0 : x >= b ? 1 : (x - a) / (b - a), pdf: (x, [a, b]) => x < a || x > b ? 0 : 1 / (b - a), inv: (q, [a, b]) => a + q * (b - a), E: ([a, b]) => (a + b) / 2, V: ([a, b]) => (b - a) ** 2 / 12, sup: ([a, b]) => [a, b] },
  binom: { n: 'Binomialverteilung (n, p)', p: [['n', 10], ['p', 0.5]], c: 0, ok: ([n, p]) => Number.isInteger(n) && n >= 0 && n <= 1e6 && p >= 0 && p <= 1, pmf: (k, [n, p]) => M.binomPmf(k, n, p), E: ([n, p]) => n * p, V: ([n, p]) => n * p * (1 - p), sup: ([n]) => [0, n] },
  pois: { n: 'Poisson-Verteilung (λ)', p: [['λ', 3]], c: 0, ok: ([l]) => l >= 0 && l <= 1e6, pmf: (k, [l]) => M.poisPmf(k, l), E: ([l]) => l, V: ([l]) => l, sup: () => [0, Infinity] },
  geo: { n: 'Geometrische Verteilung (p)', p: [['p', 0.3]], c: 0, ok: ([p]) => p > 0 && p <= 1, pmf: (k, [p]) => k < 1 ? 0 : Math.pow(1 - p, k - 1) * p, E: ([p]) => 1 / p, V: ([p]) => (1 - p) / (p * p), sup: () => [1, Infinity] }
};

export class Verteilungen extends Teil {
  html() {
    return `
<label for="v-dist">Verteilung</label>
<select id="v-dist">${Object.entries(D).map(([k, d]) => `<option value="${k}">${esc(d.n)}</option>`).join('')}</select>
<div id="v-par"></div>
<label for="v-mode">Gesucht</label>
<select id="v-mode">
 <option value="le">P(X ≤ x)</option><option value="lt">P(X &lt; x)</option>
 <option value="ge">P(X ≥ x)</option><option value="gt">P(X &gt; x)</option>
 <option value="bt">P(a ≤ X ≤ b)</option><option value="q">Quantil: kleinstes x mit P(X ≤ x) ≥ p</option>
</select>
<div id="v-xw">${formular([['v-x', '<span id="v-xl">x</span> =', '1,96']], 1)}</div>
<div id="v-bw" class="hide">${formular([['v-b', 'b =', '1']], 1)}</div>
<div id="v-qw" class="hide">${formular([['v-q', 'p =', '0,975']], 1)}</div>
<div class="sunk" id="v-out"></div>
<div id="v-plot"></div>`;
  }

  init() {
    this.verdrahten(['v-p1', 'v-p2']);
    this.parameterFelder(false);
    this.rechne();
  }

  // Parameterfelder passend zur Verteilung (Werte werden gemerkt)
  parameterFelder(zuruecksetzen) {
    const d = D[this.val('v-dist')];
    this.$('v-par').innerHTML = formular(d.p.map((pp, i) => ['v-p' + (i + 1), pp[0] + ' =', String(pp[1]).replace('.', ',')]), d.p.length);
    d.p.forEach((pp, i) => {
      const id = 'v-p' + (i + 1), gespeichert = this.sp.f[id + ':' + this.val('v-dist')];
      if (!zuruecksetzen && gespeichert !== undefined) this.$(id).value = gespeichert;
      this.$(id).addEventListener('input', () => { this.sp.f[id + ':' + this.val('v-dist')] = this.$(id).value; this.sp.speichern(); this.nachAenderung(); });
    });
    const mode = this.val('v-mode');
    this.anzeigen('v-xw', mode !== 'q'); this.anzeigen('v-bw', mode === 'bt'); this.anzeigen('v-qw', mode === 'q');
    this.$('v-xl').textContent = mode === 'bt' ? 'a' : 'x';
  }

  nachAenderung(t) {
    if (t && (t.id === 'v-dist' || t.id === 'v-mode')) this.parameterFelder(t.id === 'v-dist');
    super.nachAenderung();
  }

  rechne() {
    const out = this.$('v-out'), pl = this.$('v-plot'), key = this.val('v-dist'), d = D[key];
    const p = d.p.map((_, i) => this.num('v-p' + (i + 1))), mode = this.val('v-mode');
    pl.innerHTML = '';
    if (p.some(Number.isNaN) || !d.ok(p)) { out.innerHTML = fehler('Ungültige Parameter für diese Verteilung.'); return; }
    const [s0, s1] = d.sup(p);
    const Fd = k => { k = Math.floor(k + 1e-9); if (k < s0) return 0; if (k >= s1) return 1; let s = 0; for (let j = s0; j <= k && j - s0 < 2e6; j++) s += d.pmf(j, p); return Math.min(1, s); };
    const F = d.c ? (x => d.cdf(x, p)) : Fd;
    const x = this.num('v-x'), b = this.num('v-b'), q = this.num('v-q');
    let res, lab, reg;
    if (mode === 'q') {
      if (!(q > 0 && q < 1)) { out.innerHTML = fehler('p muss zwischen 0 und 1 liegen.'); return; }
      if (d.c) res = d.inv ? d.inv(q, p) : M.invCdf(F, q, s0, s1);
      else { let k = s0; while (F(k) < q - 1e-12 && k < s1 && k - s0 < 2e6) k++; res = k; }
      lab = `Quantil x<sub>${fmt(q, 4)}</sub>`; reg = [-Infinity, res];
    } else {
      if (Number.isNaN(x) || (mode === 'bt' && Number.isNaN(b))) { out.innerHTML = fehler('Bitte Zahlen eingeben.'); return; }
      if (d.c) {
        if (mode === 'le' || mode === 'lt') { res = F(x); reg = [-Infinity, x]; lab = 'P(X ≤ x)'; }
        else if (mode === 'ge' || mode === 'gt') { res = 1 - F(x); reg = [x, Infinity]; lab = 'P(X ≥ x)'; if (key === 'normal') res = M.normsf((x - p[0]) / p[1]); if (key === 't') res = M.tsf(x, p[0]); }
        else { res = F(b) - F(x); reg = [x, b]; lab = 'P(a ≤ X ≤ b)'; }
      } else {
        if (mode === 'le') { res = Fd(x); lab = 'P(X ≤ x)'; reg = [-Infinity, x]; }
        else if (mode === 'lt') { res = Fd(Math.ceil(x) - 1); lab = 'P(X &lt; x)'; reg = [-Infinity, Math.ceil(x) - 1]; }
        else if (mode === 'ge') { res = 1 - Fd(Math.ceil(x) - 1); lab = 'P(X ≥ x)'; reg = [Math.ceil(x), Infinity]; }
        else if (mode === 'gt') { res = 1 - Fd(x); lab = 'P(X &gt; x)'; reg = [Math.floor(x) + 1, Infinity]; }
        else { res = Fd(b) - Fd(Math.ceil(x) - 1); lab = 'P(a ≤ X ≤ b)'; reg = [Math.ceil(x), Math.floor(b)]; }
        res = Math.max(0, res);
      }
    }
    const E = d.E(p), V = d.V(p), r = [[lab, mode === 'q' ? fmt(res) : `<b>${fmt(res, 8)}</b>`]];
    if (mode !== 'q') r.push(['in Prozent', pct(res)]);
    if (key === 'normal' && mode !== 'q' && !Number.isNaN(x)) r.push(['z-Wert (x−μ)/σ', fmt((x - p[0]) / p[1])]);
    r.push(['Erwartungswert', fmt(E)], ['Varianz', fmt(V)], ['Standardabweichung', fmt(Math.sqrt(V))]);
    out.innerHTML = tabelle(r);
    try { pl.innerHTML = this.diagramm(d, key, p, F, s0, s1, reg); } catch (e) { /* Diagramm ist nur Beigabe */ }
  }

  diagramm(d, key, p, F, s0, s1, reg) {
    const W = 560, H = 240;
    if (d.c) {
      let lo = Number.isFinite(s0) ? s0 : (d.inv ? d.inv(0.0005, p) : M.invCdf(F, 0.0005, s0, s1));
      let hi = Number.isFinite(s1) ? s1 : (d.inv ? d.inv(0.9995, p) : M.invCdf(F, 0.9995, s0, s1));
      if (key === 'unif') { const w = hi - lo; lo -= w * 0.15; hi += w * 0.15; }
      if (!(hi > lo)) return '';
      const N = 300, pts = [];
      let ym = 0;
      for (let i = 0; i <= N; i++) { const xx = lo + (hi - lo) * i / N, y = d.pdf(xx, p); pts.push([xx, y]); if (Number.isFinite(y)) ym = Math.max(ym, y); }
      const f = rahmen(W, H, [lo, hi], [0, ym * 1.1], { ny: 4 });
      const a = Math.max(lo, reg[0]), bb = Math.min(hi, reg[1]);
      let flaeche = '';
      if (bb > a) {
        const seg = pts.filter(pt => pt[0] >= a && pt[0] <= bb);
        if (seg.length) flaeche = `M${f.X(seg[0][0])} ${f.Y(0)}` + seg.map(pt => `L${f.X(pt[0])} ${f.Y(pt[1])}`).join('') + `L${f.X(seg[seg.length - 1][0])} ${f.Y(0)}Z`;
      }
      return svg(W, H, f.g + `<g ${f.clip}><path ${FARBE.flaeche} d="${flaeche}"/><path ${FARBE.linie} d="${pfad(pts, f)}"/></g>`, 'Dichtefunktion mit markiertem Bereich');
    }
    let a = s0;
    while (a < s1 && F(a) < 0.0005 && a - s0 < 2e6) a++;
    let c = a;
    while (c < s1 && F(c) < 0.9995 && c - a < 2e6) c++;
    const k0 = a, k1 = Math.min(c, k0 + 80), ks = [];
    for (let k = k0; k <= k1; k++) ks.push(k);
    const vals = ks.map(k => d.pmf(k, p)), ym = Math.max(...vals);
    const f = rahmen(W, H, [k0 - 0.7, k1 + 0.7], [0, ym * 1.1], { ny: 4, nx: Math.min(10, ks.length) });
    const bw = Math.max(1, f.X(1) - f.X(0) - 2);
    const bars = ks.map((k, i) => `<rect ${k >= reg[0] && k <= reg[1] ? FARBE.balkenAn : FARBE.balken} x="${f.X(k) - bw / 2}" y="${f.Y(vals[i])}" width="${bw}" height="${Math.max(0, f.Y(0) - f.Y(vals[i]))}"><title>P(X=${k}) = ${fmt(vals[i], 6)}</title></rect>`).join('');
    return svg(W, H, f.g + `<g ${f.clip}>${bars}</g>`, 'Wahrscheinlichkeitsfunktion mit markiertem Bereich');
  }
}

export default Verteilungen;
