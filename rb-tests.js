// rb-tests.js – Reiter „Tests & Schranken“
// t-/Gauß-Test, Konfidenzintervall für Anteile, Bayes, Markov/Chebyshev/Hoeffding, Kombinatorik.

import { Teil, fmt, pct, tabelle, fehler, formular, gross } from './rb-hilfen.js';
import { M } from './rb-mathe.js';

export class Tests extends Teil {
  html() {
    return `
<fieldset><legend>Test für den Mittelwert</legend>
${formular([['t-mean', 'Mittel x̄', '103'], ['t-s', 's (bzw. σ)', '12'], ['t-n', 'n', '25'], ['t-mu0', 'μ₀ (H₀)', '100'], ['t-alpha', 'α', '0,05']])}
<label for="t-side">Alternative H₁</label>
<select id="t-side"><option value="two">μ ≠ μ₀ (zweiseitig)</option><option value="right">μ &gt; μ₀ (rechtsseitig)</option><option value="left">μ &lt; μ₀ (linksseitig)</option></select>
<select id="t-known" aria-label="Streuung"><option value="t">σ unbekannt → t-Test</option><option value="z">σ bekannt → Gauß-Test</option></select>
<div id="t-out"></div></fieldset>
<fieldset><legend>Konfidenzintervall für einen Anteil</legend>
${formular([['a-x', 'Erfolge x', '56'], ['a-n', 'n', '200'], ['a-conf', 'Niveau 1−α', '0,95']])}
<div id="a-out"></div></fieldset>
<fieldset><legend>Bayes</legend>
${formular([['b-pa', 'P(A)', '0,01'], ['b-pba', 'P(B | A)', '0,95'], ['b-pbn', 'P(B | nicht A)', '0,05']], 1)}
<div id="b-out"></div></fieldset>
<fieldset><legend>Markov · Chebyshev · Hoeffding</legend>
${formular([['u-ex', 'Markov: E[X] (X ≥ 0)', '5'], ['u-a', 'Schwelle a', '20'], ['u-sig', 'Chebyshev: σ', '2'], ['u-eps', 'Abweichung ε', '6'], ['u-hn', 'Hoeffding: n', '100'], ['u-he', 'Abweichung ε', '0,1'], ['u-ha', 'Wertebereich a', '0'], ['u-hb', 'Wertebereich b', '1'], ['u-hd', 'Gewünschtes δ', '0,05']])}
<div id="u-out"></div></fieldset>
<fieldset><legend>Kombinatorik</legend>
${formular([['k-n', 'n', '10'], ['k-k', 'k', '3']])}
<div id="k-out"></div></fieldset>`;
  }

  init() { this.verdrahten(); this.rechne(); }

  rechne() { this.mittelwert(); this.anteil(); this.bayes(); this.schranken(); this.kombinatorik(); }

  mittelwert() {
    const out = this.$('t-out');
    try {
      const m = this.num('t-mean'), s = this.num('t-s'), n = this.num('t-n'), mu = this.num('t-mu0'), al = this.num('t-alpha'), side = this.val('t-side'), bekannt = this.val('t-known') === 'z';
      if ([m, s, n, mu, al].some(Number.isNaN) || !(s > 0) || !(n > 1) || !(al > 0 && al < 1)) throw new Error('Bitte gültige Werte eingeben (s > 0, n > 1, 0 < α < 1).');
      const se = s / Math.sqrt(n), st = (m - mu) / se, df = n - 1;
      const sf = z => bekannt ? M.normsf(z) : M.tsf(z, df), cdf = z => bekannt ? M.normcdf(z) : M.tcdf(z, df), inv = q => bekannt ? M.norminv(q) : M.tinv(q, df);
      let pv, krit;
      if (side === 'two') { pv = Math.min(1, 2 * sf(Math.abs(st))); krit = `±${fmt(inv(1 - al / 2))}`; }
      else if (side === 'right') { pv = sf(st); krit = `&gt; ${fmt(inv(1 - al))}`; }
      else { pv = cdf(st); krit = `&lt; ${fmt(inv(al))}`; }
      const kq = inv(1 - al / 2);
      out.innerHTML = tabelle([[bekannt ? 'Prüfgröße z' : 'Prüfgröße t', fmt(st)], ['Standardfehler', fmt(se)], bekannt ? ['Verteilung', 'N(0,1)'] : ['Freiheitsgrade', df],
        ['Kritischer Bereich (Ablehnung)', krit], ['p-Wert', fmt(pv, 5)], ['Entscheidung', pv < al ? '<b>H₀ ablehnen</b> (p &lt; α)' : 'H₀ nicht ablehnen (p ≥ α)'],
        [`${fmt((1 - al) * 100, 4)} %-Konfidenzintervall`, `[${fmt(m - kq * se)} ; ${fmt(m + kq * se)}]`]]);
    } catch (e) { out.innerHTML = fehler(e); }
  }

  anteil() {
    const out = this.$('a-out');
    try {
      const x = this.num('a-x'), n = this.num('a-n'), c = this.num('a-conf');
      if ([x, n, c].some(Number.isNaN) || !(n > 0) || x < 0 || x > n || !(c > 0 && c < 1)) throw new Error('Gültige Werte: 0 ≤ x ≤ n, 0 < Niveau < 1.');
      const p = x / n, z = M.norminv(1 - (1 - c) / 2), w = z * Math.sqrt(p * (1 - p) / n), z2 = z * z, den = 1 + z2 / n;
      const mid = (p + z2 / (2 * n)) / den, hw = z * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / den;
      out.innerHTML = tabelle([['Anteil p̂ = x/n', fmt(p)], ['z-Quantil', fmt(z)], ['Wald-Intervall', `[${fmt(Math.max(0, p - w))} ; ${fmt(Math.min(1, p + w))}]`], ['Wilson-Intervall', `[${fmt(Math.max(0, mid - hw))} ; ${fmt(Math.min(1, mid + hw))}]`]]);
    } catch (e) { out.innerHTML = fehler(e); }
  }

  bayes() {
    const out = this.$('b-out');
    try {
      const pa = this.num('b-pa'), pba = this.num('b-pba'), pbn = this.num('b-pbn');
      if ([pa, pba, pbn].some(v => Number.isNaN(v) || v < 0 || v > 1)) throw new Error('Alle Wahrscheinlichkeiten müssen zwischen 0 und 1 liegen.');
      const pb = pba * pa + pbn * (1 - pa);
      out.innerHTML = tabelle([['P(B) (totale Wahrscheinlichkeit)', fmt(pb, 6)], ['P(A | B)', pb > 0 ? `<b>${fmt(pba * pa / pb, 6)}</b> (${pct(pba * pa / pb)})` : '–'], ['P(nicht A | B)', pb > 0 ? fmt(pbn * (1 - pa) / pb, 6) : '–']]);
    } catch (e) { out.innerHTML = fehler(e); }
  }

  schranken() {
    const out = this.$('u-out');
    try {
      const ex = this.num('u-ex'), a = this.num('u-a'), sg = this.num('u-sig'), ep = this.num('u-eps'), n = this.num('u-hn'), he = this.num('u-he'), ha = this.num('u-ha'), hb = this.num('u-hb'), hd = this.num('u-hd');
      const r = [];
      if (a > 0 && ex >= 0) r.push(['Markov: P(X ≥ a) ≤ E[X]/a', fmt(Math.min(1, ex / a))]);
      if (sg >= 0 && ep > 0) r.push(['Chebyshev: P(|X−μ| ≥ ε) ≤ σ²/ε²', fmt(Math.min(1, sg * sg / (ep * ep)))], ['entspricht k = ε/σ', sg > 0 ? fmt(ep / sg) : '–']);
      if (n > 0 && he > 0 && hb > ha) {
        const e1 = Math.exp(-2 * n * he * he / ((hb - ha) ** 2));
        r.push(['Hoeffding einseitig: P(X̄−μ ≥ ε) ≤', fmt(Math.min(1, e1))], ['Hoeffding zweiseitig: P(|X̄−μ| ≥ ε) ≤', fmt(Math.min(1, 2 * e1))]);
        if (hd > 0 && hd < 1) r.push(['n für Fehler ≤ δ (zweiseitig)', fmt(Math.ceil((hb - ha) ** 2 * Math.log(2 / hd) / (2 * he * he)), 9)]);
      }
      out.innerHTML = r.length ? tabelle(r) : '<span class="muted">Werte eingeben …</span>';
    } catch (e) { out.innerHTML = fehler(e); }
  }

  kombinatorik() {
    const out = this.$('k-out');
    try {
      const n = Math.round(this.num('k-n')), k = Math.round(this.num('k-k'));
      if (!(n >= 0 && n <= 5000) || !(k >= 0 && k <= 5000)) throw new Error('n und k zwischen 0 und 5000.');
      out.innerHTML = tabelle([['n!', gross(M.factBig(n))], ['k!', gross(M.factBig(k))], ['Variationen ohne Wdh. n!/(n−k)!', k <= n ? gross(M.permBig(n, k)) : 'k &gt; n'],
        ['Kombinationen C(n,k)', k <= n ? gross(M.combBig(n, k)) : 'k &gt; n'], ['Variationen mit Wdh. nᵏ', gross(BigInt(n) ** BigInt(k))], ['Kombinationen mit Wdh. C(n+k−1,k)', gross(M.combBig(n + k - 1, k))]]);
    } catch (e) { out.innerHTML = fehler(e); }
  }
}

export default Tests;
