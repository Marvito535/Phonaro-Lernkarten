// rb-informatik.js – Reiter „Informatik“
// Zahlensysteme + Zweierkomplement, IEEE 754, Bitoperationen, Wahrheitstabelle, Laufzeit-Wachstum.

import { Teil, esc, fmt, tabelle, raster, fehler, formular } from './rb-hilfen.js';
import { M } from './rb-mathe.js';

const bin = (v, w) => BigInt.asUintN(w, v).toString(2).padStart(w, '0').replace(/(.{4})(?=.)/g, '$1 ');

export class Informatik extends Teil {
  html() {
    return `
<fieldset><legend>Zahlensysteme &amp; Zweierkomplement</legend>
<input id="i-val" value="-42" autocomplete="off" spellcheck="false" aria-label="Zahl">
<div class="row">
 <select id="i-base" aria-label="Basis"><option value="10">Basis 10 (dezimal)</option><option value="2">Basis 2 (binär)</option><option value="8">Basis 8 (oktal)</option><option value="16">Basis 16 (hex)</option></select>
 <select id="i-w" aria-label="Breite"><option value="4">4 Bit</option><option value="8" selected>8 Bit</option><option value="16">16 Bit</option><option value="32">32 Bit</option><option value="64">64 Bit</option></select>
</div>
<div id="i-out"></div></fieldset>
<fieldset><legend>Gleitkommazahl (IEEE 754)</legend>
<input id="i-fl" value="-6,25" autocomplete="off" spellcheck="false" aria-label="Dezimalzahl">
<div id="i-flout"></div></fieldset>
<fieldset><legend>Bitoperationen (Dezimalzahlen)</legend>
${formular([['i-a', 'a', '202'], ['i-b', 'b', '85']])}
<select id="i-bw" aria-label="Breite"><option value="8" selected>8 Bit</option><option value="16">16 Bit</option><option value="32">32 Bit</option></select>
<div id="i-bout"></div></fieldset>
<fieldset><legend>Wahrheitstabelle</legend>
<input id="i-bool" value="(A &amp; B) | !C" autocomplete="off" spellcheck="false" aria-label="Boolescher Ausdruck">
<p class="muted">Operatoren: ! (NOT) &amp; (AND) ^ (XOR) | (OR) -&gt; (Implikation) &lt;-&gt; (Äquivalenz); auch NOT/AND/OR/XOR, ¬ ∧ ∨ ⊕ → ↔. Variablen: Buchstaben, bis 6 Stück.</p>
<div id="i-boolout"></div></fieldset>
<fieldset><legend>Wachstum von Laufzeiten</legend>
${formular([['i-g', 'n =', '1000']], 1)}
<div id="i-gout"></div></fieldset>`;
  }

  init() { this.verdrahten(); this.rechne(); }

  rechne() { this.zahlensysteme(); this.gleitkomma(); this.bits(); this.wahrheit(); this.wachstum(); }

  zahlensysteme() {
    const out = this.$('i-out');
    try {
      const base = +this.val('i-base'), w = +this.val('i-w'), v = M.parseBig(this.val('i-val'), base), W = BigInt(w);
      const a = v < 0n ? -v : v, vz = v < 0n ? '−' : '';
      const r = [['Dezimal', v.toString(10)], ['Binär', vz + a.toString(2)], ['Oktal', vz + a.toString(8)], ['Hexadezimal', vz + a.toString(16).toUpperCase()]];
      const mn = -(1n << (W - 1n)), mx = (1n << W) - 1n;
      if (v < mn || v > mx) r.push([`Außerhalb des Bereichs bei ${w} Bit (${mn} … ${mx})`]);
      else {
        const u = BigInt.asUintN(w, v);
        r.push([`${w}-Bit-Darstellung`, ''], ['Zweierkomplement', bin(v, w)], ['Hex', '0x' + u.toString(16).toUpperCase().padStart(Math.ceil(w / 4), '0')], ['als vorzeichenlos', u.toString()],
          ['als vorzeichenbehaftet', BigInt.asIntN(w, u).toString()], ['Einerkomplement von |x|', bin(~a, w)], ['Wertebereich mit Vorzeichen', `${mn} … ${(1n << (W - 1n)) - 1n}`]);
      }
      out.innerHTML = tabelle(r);
    } catch (e) { out.innerHTML = fehler(e); }
  }

  gleitkomma() {
    const out = this.$('i-flout');
    try {
      const x = this.num('i-fl');
      if (Number.isNaN(x)) throw new Error('Dezimalzahl eingeben (z. B. −6,25).');
      const teile = dbl => {
        const dv = new DataView(new ArrayBuffer(8));
        let bits;
        if (dbl) { dv.setFloat64(0, x); bits = dv.getUint32(0).toString(2).padStart(32, '0') + dv.getUint32(4).toString(2).padStart(32, '0'); return [bits.slice(0, 1), bits.slice(1, 12), bits.slice(12), 1023, dv.getFloat64(0)]; }
        dv.setFloat32(0, x); bits = dv.getUint32(0).toString(2).padStart(32, '0');
        return [bits.slice(0, 1), bits.slice(1, 9), bits.slice(9), 127, dv.getFloat32(0)];
      };
      const zeile = (name, dbl) => {
        const [sg, ex, ma, bias, zurueck] = teile(dbl), e = parseInt(ex, 2);
        return [[`${name}: Vorzeichen | Exponent | Mantisse`, `${sg} | ${ex} | ${ma.replace(/(.{8})(?=.)/g, '$1 ')}`], ['Exponent e − Bias', `${e} − ${bias} = ${e - bias}`], ['gespeicherter Wert', fmt(zurueck, 17)]];
      };
      out.innerHTML = tabelle(zeile('float32', false).concat(zeile('float64', true)));
    } catch (e) { out.innerHTML = fehler(e); }
  }

  bits() {
    const out = this.$('i-bout');
    try {
      const ww = +this.val('i-bw'), w = BigInt(ww), a = M.parseBig(this.val('i-a'), 10), b = M.parseBig(this.val('i-b'), 10), sh = Number(BigInt.asUintN(8, b) % w);
      const A = BigInt.asUintN(ww, a), B = BigInt.asUintN(ww, b), zeige = v => `${bin(v, ww)} (${BigInt.asUintN(ww, v)})`;
      out.innerHTML = tabelle([['a', zeige(A)], ['b', zeige(B)], ['a AND b', zeige(A & B)], ['a OR b', zeige(A | B)], ['a XOR b', zeige(A ^ B)], ['NOT a', zeige(~A)],
        [`a &lt;&lt; ${sh}`, zeige(A << BigInt(sh))], [`a &gt;&gt; ${sh} (logisch)`, zeige(A >> BigInt(sh))], ['Schiebebetrag = b mod Breite', String(sh)]]);
    } catch (e) { out.innerHTML = fehler(e); }
  }

  wahrheit() {
    const out = this.$('i-boolout');
    try {
      const { f, vars } = M.bool(this.val('i-bool'));
      if (vars.length > 6) throw new Error('Höchstens 6 Variablen.');
      const n = vars.length, N = 1 << n, eins = [], zeilen = [];
      for (let i = 0; i < N; i++) {
        const env = {};
        vars.forEach((v, j) => { env[v] = (i >> (n - 1 - j)) & 1; });
        const y = f(env);
        if (y) eins.push(i);
        zeilen.push(vars.map(v => env[v]).concat([y]));
      }
      const art = eins.length === N ? '<b>Tautologie</b> (immer wahr)' : eins.length === 0 ? '<b>Kontradiktion</b> (nie wahr)' : 'erfüllbar, aber keine Tautologie';
      out.innerHTML = `<p>${art} · ${eins.length} von ${N} Zeilen wahr<br>Minterme (Zeilennummer): ${eins.length ? eins.join(', ') : '–'}</p>` + raster(vars.map(esc).concat(['F']), zeilen, eins);
    } catch (e) { out.innerHTML = fehler(e); }
  }

  wachstum() {
    const out = this.$('i-gout');
    try {
      const n = this.num('i-g');
      if (!(n >= 1) || n > 1e7) throw new Error('n zwischen 1 und 10 000 000.');
      const L = Math.log2(n);
      out.innerHTML = tabelle([['log₂ n', fmt(L, 6)], ['n', fmt(n)], ['n · log₂ n', fmt(n * L, 6)], ['n²', fmt(n * n, 6)], ['n³', fmt(n ** 3, 6)],
        ['2ⁿ', n <= 1000 ? fmt(Math.pow(2, n), 6) : 'zu groß (&gt; 10^300)'], ['n!', n <= 170 ? fmt(M.factNum(Math.floor(n)), 6) : 'zu groß'], ['Bits für Zahlen 0…n', Math.ceil(Math.log2(n + 1))]]);
    } catch (e) { out.innerHTML = fehler(e); }
  }
}

export default Informatik;
