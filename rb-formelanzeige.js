// rb-formelanzeige.js – lädt MathJax (Formel-Darstellung) und setzt Formeln in ein Element
//
// MathJax kommt von cdnjs. Ohne Internet bleibt LaTeX als Text sichtbar, alle Rechner laufen weiter.
// Meldet sich per Event "rechenblock:formeln" ({ bereit: true/false }) bei den anderen Teilen.

window.MathJax = {
  tex: { inlineMath: [['$', '$']], displayMath: [['$$', '$$']], processEscapes: true },
  svg: { fontCache: 'global' },
  options: { enableMenu: false },
  startup: { typeset: false }
};

const URL_MATHJAX = 'https://cdnjs.cloudflare.com/ajax/libs/mathjax/3.2.2/es5/tex-svg.min.js';

export const Formelanzeige = {
  bereit: false,
  gestartet: false,

  laden() {
    if (this.gestartet) return;
    this.gestartet = true;
    const melden = bereit => {
      this.bereit = bereit;
      document.dispatchEvent(new CustomEvent('rechenblock:formeln', { detail: { bereit } }));
    };
    const sc = document.createElement('script');
    sc.src = URL_MATHJAX;
    sc.async = true;
    sc.onload = () => {
      const los = () => melden(true);
      const mj = window.MathJax;
      if (mj && mj.startup && mj.startup.promise) mj.startup.promise.then(los); else los();
    };
    sc.onerror = () => melden(false);
    document.head.appendChild(sc);
  },

  // Formeln in el darstellen (tut nichts, solange MathJax nicht geladen ist)
  setzen(el) {
    const mj = window.MathJax;
    if (this.bereit && mj && mj.typesetPromise) return mj.typesetPromise([el]).catch(() => {});
  }
};

export default Formelanzeige;
