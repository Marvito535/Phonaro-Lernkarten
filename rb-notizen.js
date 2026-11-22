// rb-notizen.js – Notizblock mit LaTeX-Vorschau (ein Reiter des Rechenblocks)
//
// Links schreiben, darunter die Vorschau. Formeln: $…$ im Text, $$…$$ als eigene Formel.
// Mehrere Blätter, automatisch gespeichert (Speicher aus rb-hilfen.js).
// Die Symbol-Auswahl setzt LaTeX an die Cursorposition; Markiertes wird in das Symbol eingesetzt.
// Von außen: Event "rechenblock:einfuegen" ({ latex }) hängt eine Formel an das aktuelle Blatt.

import { Teil, esc, kopieren } from './rb-hilfen.js';
import { Formelanzeige } from './rb-formelanzeige.js';

// ¦ = Cursor bzw. Platz für die Markierung
const SCHNELL = [
  ['$…$', '$¦$'], ['$$…$$', '$$\n¦\n$$'], ['a/b', '\\frac{¦}{}'], ['√', '\\sqrt{¦}'], ['Σ', '\\sum_{i=1}^{n} ¦'], ['∫', '\\int_{a}^{b} ¦ \\,dx']
];
const GRIECH = { alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', theta: 'θ', lambda: 'λ', mu: 'μ', pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω' };
const PAL = [
  ['Griechisch', Object.entries(GRIECH).map(([n, z]) => [z, '\\' + n + ' ']).concat([['Γ', '\\Gamma '], ['Δ', '\\Delta '], ['Θ', '\\Theta '], ['Λ', '\\Lambda '], ['Σ', '\\Sigma '], ['Φ', '\\Phi '], ['Ψ', '\\Psi '], ['Ω', '\\Omega ']])],
  ['Rechnen', [['Auswertung |ₐᵇ', '\\Big|_{¦}^{}'], ['Eckklammer [ ]ₐᵇ', '\\left[ ¦ \\right]_{}^{}'], ['Produkt Π', '\\prod_{i=1}^{n} ¦'], ['Limes', '\\lim_{x \\to ¦}'], ['Potenz xⁿ', '^{¦}'], ['Index xₙ', '_{¦}'], ['·', '\\cdot '], ['×', '\\times '], ['±', '\\pm '], ['≤', '\\le '], ['≥', '\\ge '], ['≠', '\\ne '], ['≈', '\\approx '], ['∞', '\\infty '], ['→', '\\to '], ['⇒', '\\Rightarrow '], ['⇔', '\\Leftrightarrow '], ['∂', '\\partial '], ['∇', '\\nabla '], ['Klammer ( )', '\\left(¦\\right)'], ['Betrag |x|', '\\left|¦\\right|'], ['Querstrich x̄', '\\bar{¦}'], ['Dach x̂', '\\hat{¦}'], ['Vektor', '\\vec{¦}'], ['ln', '\\ln '], ['log', '\\log '], ['sin', '\\sin '], ['cos', '\\cos '], ['exp', '\\exp ']]],
  ['Mengen/Logik', [['∈', '\\in '], ['∉', '\\notin '], ['⊂', '\\subset '], ['⊆', '\\subseteq '], ['∪', '\\cup '], ['∩', '\\cap '], ['∅', '\\emptyset '], ['ℝ', '\\mathbb{R}'], ['ℕ', '\\mathbb{N}'], ['ℤ', '\\mathbb{Z}'], ['ℚ', '\\mathbb{Q}'], ['∀', '\\forall '], ['∃', '\\exists '], ['¬', '\\neg '], ['∧', '\\wedge '], ['∨', '\\vee '], ['⊕', '\\oplus ']]],
  ['Statistik', [['P(A)', 'P(¦)'], ['P(A|B)', 'P(¦ \\mid )'], ['E[X]', '\\mathbb{E}[¦]'], ['Var', '\\operatorname{Var}(¦)'], ['Cov', '\\operatorname{Cov}(¦)'], ['s²', 's^2'], ['σ²', '\\sigma^2'], ['N(μ,σ²)', '\\mathcal{N}(\\mu,\\sigma^2)'], ['Binomialkoeff.', '\\binom{n}{k}'], ['~ verteilt', '\\sim '], ['H₀', 'H_0'], ['H₁', 'H_1'], ['Φ( )', '\\Phi(¦)']]],
  ['Strukturen', [['Tabelle 2 Spalten', '\\begin{array}{c|c}\nx & P(X=x)\\\\ \\hline\n¦ & \\\\\n & \\\\\n & \n\\end{array}'], ['Two-way-Tabelle 2×2', '\\begin{array}{c|cc|c}\n & Y=0 & Y=1 & P(X=x)\\\\ \\hline\nX=0 & ¦ &  & \\\\\nX=1 &  &  & \\\\ \\hline\nP(Y=y) &  &  & 1\n\\end{array}'], ['Two-way-Tabelle 3×3', '\\begin{array}{c|ccc|c}\n & Y=0 & Y=1 & Y=2 & P(X=x)\\\\ \\hline\nX=0 & ¦ &  &  & \\\\\nX=1 &  &  &  & \\\\\nX=2 &  &  &  & \\\\ \\hline\nP(Y=y) &  &  &  & 1\n\\end{array}'], ['Matrix', '\\begin{pmatrix}\n¦ & \\\\\n & \n\\end{pmatrix}'], ['Fallunterscheidung', '\\begin{cases}\n¦ & \\text{wenn } \\\\\n & \\text{sonst}\n\\end{cases}'], ['Rechenweg', '\\begin{aligned}\n¦ &= \\\\\n&= \n\\end{aligned}'], ['Text', '\\text{¦}']]]
];

export class Notizen extends Teil {
  html() {
    const sel = PAL.map((g, gi) => `<select data-pal="${gi}" aria-label="${esc(g[0])}"><option value="">${esc(g[0])} …</option>${g[1].map((s, si) => `<option value="${si}">${esc(s[0])}</option>`).join('')}</select>`).join('');
    const schnell = SCHNELL.map((s, i) => `<button class="btn" data-schnell="${i}" title="${esc(s[1].replace('¦', '…'))}">${esc(s[0])}</button>`).join('');
    return `
<div class="row" id="n-btns"></div>
<div class="row"><button class="btn" id="n-add">+ Neues Blatt</button><button class="btn" id="n-copy">Alles kopieren</button><button class="btn" id="n-del">Blatt löschen</button></div>
<input id="n-name" maxlength="40" aria-label="Name des Blattes">
<div class="row">${schnell}</div>
<div class="row">${sel}</div>
<textarea id="n-text" rows="14" spellcheck="false" aria-label="Notizen" placeholder="Hier schreiben. Formeln in $…$ (im Text) oder $$…$$ (eigene Zeile). Beispiel: $\\bar{x}=\\frac{1}{n}\\sum_{i=1}^{n}x_i$"></textarea>
<div class="muted" id="n-info"></div>
<p class="muted">Vorschau (Zeilen mit „# “ werden Überschriften):</p>
<div class="sunk" id="n-prev" aria-live="polite"></div>
<p class="muted">Tipp: Text markieren und ein Symbol wählen – die Markierung wird in das Symbol eingesetzt (Bruch, Wurzel, Klammer …).</p>`;
  }

  init() {
    this.blatt = () => this.sp.d.sheets[this.sp.d.cur];
    this.zeigeBlaetter();
    this.$('n-text').addEventListener('input', () => this.geaendert());
    this.$('n-name').addEventListener('input', () => {
      this.blatt().name = this.$('n-name').value;
      const b = this.$('n-btns').children[this.sp.d.cur];
      if (b) b.textContent = this.$('n-name').value || 'Blatt';
      this.sp.speichern();
    });
    this.$('n-add').addEventListener('click', () => {
      const d = this.sp.d;
      d.sheets.push({ name: 'Blatt ' + (d.sheets.length + 1), text: '' });
      d.cur = d.sheets.length - 1;
      this.sp.speichern(); this.zeigeBlaetter(); this.$('n-text').focus();
    });
    this.$('n-copy').addEventListener('click', e => kopieren(this.$('n-text').value, e.currentTarget));
    this.$('n-del').addEventListener('click', e => this.loeschen(e.currentTarget));
    this.$('n-btns').addEventListener('click', e => {
      const b = e.target.closest('[data-sheet]');
      if (b) { this.sp.d.cur = +b.dataset.sheet; this.sp.speichern(); this.zeigeBlaetter(); }
    });
    this.el.addEventListener('click', e => {
      const b = e.target.closest('[data-schnell]');
      if (b) this.einsetzen(SCHNELL[+b.dataset.schnell][1]);
    });
    this.el.addEventListener('change', e => {
      const s = e.target.closest('[data-pal]');
      if (!s || s.value === '') return;
      this.einsetzen(PAL[+s.dataset.pal][1][+s.value][1]);
      s.value = '';
    });
    document.addEventListener('rechenblock:einfuegen', e => this.anhaengen(e.detail.latex));
    document.addEventListener('rechenblock:formeln', () => this.vorschau());
  }

  zeigeBlaetter() {
    const d = this.sp.d;
    this.$('n-btns').innerHTML = d.sheets.map((s, i) => `<button class="btn${i === d.cur ? ' on' : ''}" data-sheet="${i}">${esc(s.name || 'Blatt')}</button>`).join('');
    this.$('n-name').value = this.blatt().name;
    this.$('n-text').value = this.blatt().text;
    this.vorschau();
  }

  loeschen(b) {
    if (!b.dataset.sicher) {
      b.dataset.sicher = '1'; b.textContent = 'Wirklich löschen?';
      this.t = setTimeout(() => { delete b.dataset.sicher; b.textContent = 'Blatt löschen'; }, 3000);
      return;
    }
    clearTimeout(this.t); delete b.dataset.sicher; b.textContent = 'Blatt löschen';
    const d = this.sp.d;
    if (d.sheets.length > 1) { d.sheets.splice(d.cur, 1); d.cur = Math.max(0, d.cur - 1); } else d.sheets[0] = { name: 'Blatt 1', text: '' };
    this.sp.speichern(); this.zeigeBlaetter();
  }

  // Steht die Position text[pos] innerhalb von $…$ oder $$…$$ ?
  imMathe(text, pos) {
    let modus = '';
    for (const m of text.slice(0, pos).replace(/\\\$/g, '').matchAll(/\$\$|\$/g)) {
      if (m[0] === '$$') modus = modus === 'd' ? '' : (modus === '' ? 'd' : modus);
      else modus = modus === 'i' ? '' : (modus === '' ? 'i' : modus);
    }
    return modus !== '';
  }

  // Symbol einsetzen; außerhalb einer Formel automatisch in $…$ (mehrzeilig: $$…$$) packen
  einsetzen(sn) {
    const ta = this.$('n-text'), a = ta.selectionStart, b = ta.selectionEnd, sel = ta.value.slice(a, b);
    let rand = 0;
    if (!sn.startsWith('$') && !this.imMathe(ta.value, a)) {
      if (sn.includes('\n')) sn = '$$\n' + sn + '\n$$'; else { sn = '$' + sn + '$'; rand = 1; }
    }
    const k = sn.indexOf('¦');
    let pos;
    if (k >= 0) {
      if (sel) { sn = sn.replace('¦', () => sel); pos = a + sn.length - rand; } else { sn = sn.replace('¦', ''); pos = a + k; }
    } else pos = a + sn.length - rand;
    ta.setRangeText(sn, a, b, 'end');
    ta.setSelectionRange(pos, pos);
    ta.focus();
    this.geaendert();
  }

  anhaengen(latex) {
    const t = this.$('n-text');
    t.value += (t.value && !t.value.endsWith('\n') ? '\n' : '') + '$$' + latex + '$$\n';
    this.geaendert();
  }

  geaendert() {
    this.blatt().text = this.$('n-text').value;
    this.sp.speichern();
    clearTimeout(this.pt);
    this.pt = setTimeout(() => this.vorschau(), 220);
  }

  // Text → HTML: Formeln bleiben am Stück (Zeilenumbrüche darin werden Leerzeichen), sonst <br>
  vorschauHtml(text) {
    if (!text.trim()) return '<span class="muted">Die Vorschau erscheint hier, sobald du schreibst.</span>';
    return text.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).map((t, i) => i % 2
      ? esc(t).replace(/\n/g, ' ')
      : esc(t).replace(/^# (.*)$/gm, '<b>$1</b>').replace(/\n/g, '<br>')).join('');
  }

  vorschau() {
    const t = this.$('n-text').value, el = this.$('n-prev');
    el.innerHTML = this.vorschauHtml(t);
    const ohne = t.split(/(\$\$[\s\S]*?\$\$|\$[^$\n]+\$)/g).some((x, i) => i % 2 === 0 && /\\[a-zA-Z]{2,}/.test(x));
    this.$('n-info').textContent = (t.length ? t.length + ' Zeichen · automatisch gespeichert' : '') + (ohne ? ' · Achtung: LaTeX-Befehl (\\…) außerhalb von $…$ – wird nicht als Formel dargestellt' : '');
    if (t.trim()) Formelanzeige.setzen(el);
  }

  zeigen() { this.vorschau(); }
}

export default Notizen;
