// rb-formeln.js – Reiter „Formeln“: Formelsammlung zum Suchen, Kopieren und Einfügen in den Notizblock
//
// „→ Notizblock“ sendet das Event "rechenblock:einfuegen" ({ latex }), das der Notizblock aufgreift.

import { Teil, esc, kopieren } from './rb-hilfen.js';
import { Formelanzeige } from './rb-formelanzeige.js';

const FORMELN=[
['Statistik','Mittelwert',String.raw`\bar{x}=\frac{1}{n}\sum_{i=1}^{n}x_i`],
['Statistik','Stichprobenvarianz',String.raw`s^2=\frac{1}{n-1}\sum_{i=1}^{n}(x_i-\bar{x})^2`],
['Statistik','Variationskoeffizient',String.raw`v=\frac{s}{\bar{x}}`],
['Statistik','Verschiebungssatz',String.raw`\operatorname{Var}(X)=\mathbb{E}[X^2]-(\mathbb{E}[X])^2`],
['Statistik','Kovarianz',String.raw`\operatorname{Cov}(X,Y)=\mathbb{E}[XY]-\mathbb{E}[X]\,\mathbb{E}[Y]`],
['Statistik','Korrelation',String.raw`r=\frac{\operatorname{Cov}(X,Y)}{\sigma_X\,\sigma_Y}`],
['Statistik','Lineare Regression',String.raw`\hat{\beta}_1=\frac{s_{xy}}{s_x^2},\quad \hat{\beta}_0=\bar{y}-\hat{\beta}_1\bar{x}`],
['Statistik','Bedingte Wahrscheinlichkeit',String.raw`P(A\mid B)=\frac{P(A\cap B)}{P(B)}`],
['Statistik','Satz von Bayes',String.raw`P(A\mid B)=\frac{P(B\mid A)\,P(A)}{P(B)}`],
['Statistik','Totale Wahrscheinlichkeit',String.raw`P(B)=\sum_{i}P(B\mid A_i)\,P(A_i)`],
['Statistik','Erwartungswert (diskret)',String.raw`\mathbb{E}[X]=\sum_x x\,P(X=x)`],
['Statistik','Binomialverteilung',String.raw`P(X=k)=\binom{n}{k}p^k(1-p)^{n-k},\quad \mathbb{E}[X]=np,\quad \operatorname{Var}(X)=np(1-p)`],
['Statistik','Poisson-Verteilung',String.raw`P(X=k)=\frac{\lambda^k}{k!}e^{-\lambda},\quad \mathbb{E}[X]=\operatorname{Var}(X)=\lambda`],
['Statistik','Standardisierung',String.raw`Z=\frac{X-\mu}{\sigma}\sim\mathcal{N}(0,1)`],
['Statistik','Markov-Ungleichung',String.raw`P(X\ge a)\le\frac{\mathbb{E}[X]}{a}\quad (X\ge 0,\ a>0)`],
['Statistik','Chebyshev-Ungleichung',String.raw`P(|X-\mu|\ge\varepsilon)\le\frac{\sigma^2}{\varepsilon^2}`],
['Statistik','Hoeffding-Ungleichung',String.raw`P(|\bar{X}-\mu|\ge\varepsilon)\le 2\exp\!\left(-\frac{2n\varepsilon^2}{(b-a)^2}\right)`],
['Statistik','Zentraler Grenzwertsatz',String.raw`\frac{\bar{X}_n-\mu}{\sigma/\sqrt{n}}\xrightarrow{d}\mathcal{N}(0,1)`],
['Statistik','t-Statistik',String.raw`t=\frac{\bar{x}-\mu_0}{s/\sqrt{n}}`],
['Statistik','Konfidenzintervall (Mittelwert)',String.raw`\bar{x}\pm t_{n-1,\,1-\alpha/2}\,\frac{s}{\sqrt{n}}`],
['Statistik','Maximum-Likelihood',String.raw`\hat\theta=\arg\max_\theta\prod_{i=1}^{n}f(x_i;\theta)`],
['Mathe','Quadratische Formel',String.raw`x_{1,2}=\frac{-b\pm\sqrt{b^2-4ac}}{2a}`],
['Mathe','Produkt- und Quotientenregel',String.raw`(uv)'=u'v+uv',\qquad \left(\frac{u}{v}\right)'=\frac{u'v-uv'}{v^2}`],
['Mathe','Kettenregel',String.raw`\frac{d}{dx}f(g(x))=f'(g(x))\,g'(x)`],
['Mathe','Partielle Integration',String.raw`\int u\,v'\,dx=uv-\int u'\,v\,dx`],
['Mathe','Hauptsatz der Analysis',String.raw`\int_a^b f(x)\,dx=F(b)-F(a)`],
['Mathe','Geometrische Summe',String.raw`\sum_{k=0}^{n}q^k=\frac{1-q^{n+1}}{1-q}\quad (q\ne 1)`],
['Mathe','Gaußsche Summenformel',String.raw`\sum_{k=1}^{n}k=\frac{n(n+1)}{2}`],
['Mathe','Binomischer Lehrsatz',String.raw`(a+b)^n=\sum_{k=0}^{n}\binom{n}{k}a^{n-k}b^k`],
['Mathe','Taylorreihe',String.raw`f(x)=\sum_{k=0}^{\infty}\frac{f^{(k)}(a)}{k!}(x-a)^k`],
['Mathe','Determinante 2×2',String.raw`\det\begin{pmatrix}a&b\\c&d\end{pmatrix}=ad-bc`],
['Mathe','Inverse 2×2',String.raw`A^{-1}=\frac{1}{ad-bc}\begin{pmatrix}d&-b\\-c&a\end{pmatrix}`],
['Mathe','Eulersche Formel',String.raw`e^{i\varphi}=\cos\varphi+i\sin\varphi`],
['Informatik','Landau-Notation',String.raw`f\in\mathcal{O}(g)\iff\exists c>0,\,n_0:\ f(n)\le c\,g(n)\ \ \forall n\ge n_0`],
['Informatik','Rekursionsgleichung',String.raw`T(n)=a\,T\!\left(\frac{n}{b}\right)+f(n)`],
['Informatik','Zweierkomplement',String.raw`-x=\overline{x}+1`],
['Informatik','Dezimalwert einer Binärzahl',String.raw`\sum_{i=0}^{n-1}b_i\,2^i`],
['Informatik','Bits für n Werte',String.raw`\lceil\log_2 n\rceil`],
['Informatik','De Morgan',String.raw`\overline{A\wedge B}=\overline{A}\vee\overline{B},\qquad \overline{A\vee B}=\overline{A}\wedge\overline{B}`],
['Informatik','Entropie',String.raw`H(X)=-\sum_i p_i\log_2 p_i`]
];

export class Formeln extends Teil {
  html() {
    let h = '<input id="f-q" placeholder="Suchen (z. B. Bayes, Varianz, Ableitung)" aria-label="Formeln suchen"><div class="sunk" id="f-list">', g = '';
    FORMELN.forEach((f, i) => {
      if (f[0] !== g) { g = f[0]; h += `<p data-grp="${esc(g)}"><b>${esc(g)}</b></p>`; }
      h += `<div class="item" data-g="${esc(g)}" data-s="${esc((f[0] + ' ' + f[1] + ' ' + f[2]).toLowerCase())}"><div><span class="muted">${esc(f[1])}</span><br>$\\displaystyle ${esc(f[2])}$</div><span><button class="btn" data-copy="${i}">LaTeX kopieren</button> <button class="btn" data-tonote="${i}">→ Notizblock</button></span></div>`;
    });
    return h + '</div>';
  }

  init() {
    this.fertig = false;
    this.$('f-q').addEventListener('input', () => this.filtern());
    this.$('f-list').addEventListener('click', e => {
      const c = e.target.closest('[data-copy]'), n = e.target.closest('[data-tonote]');
      if (c) kopieren(FORMELN[+c.dataset.copy][2], c);
      if (n) {
        document.dispatchEvent(new CustomEvent('rechenblock:einfuegen', { detail: { latex: FORMELN[+n.dataset.tonote][2] } }));
        const alt = n.textContent; n.textContent = 'Eingefügt ✓'; setTimeout(() => { n.textContent = alt; }, 1200);
      }
    });
    document.addEventListener('rechenblock:formeln', () => { if (this.sichtbar) this.setzen(); });
  }

  filtern() {
    const q = this.val('f-q').trim().toLowerCase(), da = {};
    this.el.querySelectorAll('.item').forEach(el => { const ok = !q || el.dataset.s.includes(q); el.classList.toggle('hide', !ok); if (ok) da[el.dataset.g] = 1; });
    this.el.querySelectorAll('[data-grp]').forEach(el => el.classList.toggle('hide', !da[el.dataset.grp]));
  }

  setzen() { if (!this.fertig && Formelanzeige.bereit) { this.fertig = true; Formelanzeige.setzen(this.$('f-list')); } }

  zeigen() { this.sichtbar = true; this.setzen(); }
  verstecken() { this.sichtbar = false; }
}

export default Formeln;
