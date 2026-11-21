// rb-hilfen.js – gemeinsame Hilfen für alle Teile des Rechenblocks
//
// Bringt kein eigenes CSS mit. Es benutzt nur Klassen aus deiner styles.css
// (btn, on, sunk, row, muted, hide, menu, item, list) und alte HTML-Attribute
// (width, cellpadding, align, border, bgcolor). Diagramme bekommen ihre Farben
// als SVG-Attribute.

// ---------- Text & Zahlen ----------
export const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Zahl im deutschen Format mit d gültigen Stellen
export const fmt = (x, d = 6) => {
  if (x === undefined || x === null || Number.isNaN(x)) return '–';
  if (x === Infinity) return '∞';
  if (x === -Infinity) return '−∞';
  if (x === 0) return '0';
  const a = Math.abs(x);
  let s;
  if (a >= 1e9 || a < 1e-5) s = x.toExponential(d - 1).replace(/\.?0+e/, 'e').replace('e+', 'e');
  else s = String(+x.toPrecision(d));
  return s.replace('.', ',').replace(/-/g, '−');
};
export const pct = x => Number.isFinite(x) ? fmt(x * 100, 5) + ' %' : '–';

// Zahlen aus Text: getrennt durch Leerzeichen / Zeilenumbruch / Semikolon (dann ist Komma = Dezimalkomma),
// sonst durch Komma.
export const parseZahlen = s => {
  s = s.trim();
  if (!s) return [];
  const trenner = /[\s;]/.test(s) ? /[\s;]+/ : /,/;
  return s.split(trenner).map(x => x.replace(',', '.')).filter(x => x !== '').map(Number).filter(Number.isFinite);
};

// Große ganze Zahl (BigInt) lesbar ausgeben
export const gross = b => {
  const s = b.toString();
  return s.length > 24 ? s[0] + ',' + s.slice(1, 6) + ' · 10^' + (s.length - 1) : s;
};

export const fehler = e => `<font color="#a00000"><b>${esc(e && e.message ? e.message : e)}</b></font>`;

// ---------- Tabellen & Formulare (ohne CSS) ----------
// zeilen: [[Beschriftung, Wert], ...]; ein Eintrag mit nur einem Element ist eine graue Hinweiszeile
export const tabelle = zeilen => '<table width="100%" cellpadding="3" cellspacing="0">' + zeilen.map(r =>
  r[1] === undefined
    ? `<tr><td colspan="2" class="muted">${r[0]}</td></tr>`
    : `<tr><td valign="top"><b>${r[0]}</b></td><td align="right" valign="top"><tt>${r[1]}</tt></td></tr>`
).join('') + '</table>';

// Zahlenraster (Matrix, Wahrheitstabelle)
export const raster = (kopf, zeilen, hell = []) => '<table border="1" cellpadding="3" cellspacing="0">'
  + (kopf ? '<tr>' + kopf.map(k => `<th bgcolor="#c0c0c0">${k}</th>`).join('') + '</tr>' : '')
  + zeilen.map((r, i) => `<tr${hell.includes(i) ? ' bgcolor="#c8f0d8"' : ''}>` + r.map(c => `<td align="center"><tt>${c}</tt></td>`).join('') + '</tr>').join('')
  + '</table>';

// Ein Eingabefeld mit Beschriftung: [id, Beschriftung, Startwert]
export const formular = (felder, spalten = 2) => {
  const b = Math.floor(100 / spalten), bl = Math.round(b * 0.42), bi = b - bl;
  let h = '<table width="100%" cellpadding="2" cellspacing="0">';
  for (let i = 0; i < felder.length; i += spalten) {
    h += '<tr>';
    for (let j = 0; j < spalten; j++) {
      const f = felder[i + j];
      if (!f) { h += '<td></td><td></td>'; continue; }
      h += `<td width="${bl}%" valign="middle"><label for="${f[0]}">${f[1]}</label></td><td width="${bi}%"><input id="${f[0]}" value="${esc(f[2] ?? '')}" inputmode="decimal" autocomplete="off" spellcheck="false"></td>`;
    }
    h += '</tr>';
  }
  return h + '</table>';
};

export async function kopieren(text, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(text); ok = true; } catch (e) {
    try {
      const t = document.createElement('textarea');
      t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0';
      document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove();
    } catch (e2) { /* nichts */ }
  }
  if (btn) {
    const alt = btn.dataset.alt || btn.textContent;
    btn.dataset.alt = alt;
    btn.textContent = ok ? 'Kopiert ✓' : 'Nicht möglich';
    setTimeout(() => { btn.textContent = alt; }, 1400);
  }
  return ok;
}

// ---------- Diagramme (SVG, Farben als Attribute) ----------
export const FARBE = {
  gitter: 'stroke="#d4d4d4" stroke-width="1"',
  achse: 'stroke="#444" stroke-width="1"',
  linie: 'fill="none" stroke="#005e3f" stroke-width="2"',
  flaeche: 'fill="#00a651" fill-opacity=".38"',
  balken: 'fill="#00a651" fill-opacity=".55" stroke="#005e3f" stroke-width="1"',
  balkenAn: 'fill="#005e3f" fill-opacity=".9" stroke="#005e3f" stroke-width="1"',
  punkt: 'fill="#005e3f" fill-opacity=".8"',
  kasten: 'fill="#c8f0d8" stroke="#005e3f" stroke-width="1.5"',
  median: 'stroke="#005e3f" stroke-width="3"',
  text: 'font-size="12" fill="#222"'
};

export function ticks(a, b, n = 6) {
  const span = (b - a) || 1, roh = span / n, p = Math.pow(10, Math.floor(Math.log10(roh))), f = roh / p;
  const st = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * p, out = [];
  for (let v = Math.ceil(a / st - 1e-9) * st; v <= b + st * 1e-9 && out.length < 40; v += st) out.push(Math.abs(v) < st * 1e-9 ? 0 : +v.toPrecision(12));
  return out;
}

let svgZaehler = 0;
// Koordinatensystem: gibt X(), Y(), g (Gitter+Achsen+Rahmen) und clip (Attribut zum Abschneiden) zurück
export function rahmen(W, H, xr, yr, o = {}) {
  const L = o.l ?? 48, R = 12, T = 10, B = o.b ?? 26, id = 'rb-clip-' + (++svgZaehler);
  const r = v => +v.toFixed(1);
  const X = v => r(L + (v - xr[0]) / ((xr[1] - xr[0]) || 1) * (W - L - R));
  const Y = v => r(H - B - (v - yr[0]) / ((yr[1] - yr[0]) || 1) * (H - T - B));
  let g = '';
  for (const v of ticks(xr[0], xr[1], o.nx ?? 7)) g += `<line ${FARBE.gitter} x1="${X(v)}" y1="${T}" x2="${X(v)}" y2="${H - B}"/><text ${FARBE.text} x="${X(v)}" y="${H - B + 15}" text-anchor="middle">${fmt(v, 4)}</text>`;
  if (!o.noy) for (const v of ticks(yr[0], yr[1], o.ny ?? 5)) g += `<line ${FARBE.gitter} x1="${L}" y1="${Y(v)}" x2="${W - R}" y2="${Y(v)}"/><text ${FARBE.text} x="${L - 5}" y="${Y(v) + 4}" text-anchor="end">${fmt(v, 4)}</text>`;
  if (xr[0] < 0 && xr[1] > 0) g += `<line ${FARBE.achse} x1="${X(0)}" y1="${T}" x2="${X(0)}" y2="${H - B}"/>`;
  if (yr[0] < 0 && yr[1] > 0 && !o.noy) g += `<line ${FARBE.achse} x1="${L}" y1="${Y(0)}" x2="${W - R}" y2="${Y(0)}"/>`;
  g += `<clipPath id="${id}"><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></clipPath><rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}" fill="none" stroke="#444"/>`;
  return { X, Y, g, clip: `clip-path="url(#${id})"`, L, R, T, B, W, H };
}
export const svg = (W, H, inner, beschreibung) => `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(beschreibung)}">${inner}</svg>`;
export const pfad = (punkte, f) => {
  let d = '', an = false;
  for (const [x, y] of punkte) { if (!Number.isFinite(y)) { an = false; continue; } d += (an ? 'L' : 'M') + f.X(x) + ' ' + f.Y(y); an = true; }
  return d;
};

// ---------- Speicher (localStorage, nur in diesem Browser) ----------
export class Speicher {
  constructor(key = 'phonaro-rechenblock') {
    this.key = key;
    this.d = { sheets: [{ name: 'Blatt 1', text: '' }], cur: 0, tab: 'notizen', f: {}, hist: [] };
    try {
      const r = localStorage.getItem(key);
      if (r) { const o = JSON.parse(r); if (o && Array.isArray(o.sheets) && o.sheets.length) this.d = Object.assign(this.d, o); }
    } catch (e) { /* ohne Speicher weiterarbeiten */ }
    if (!(this.d.cur >= 0 && this.d.cur < this.d.sheets.length)) this.d.cur = 0;
    this.t = 0;
  }
  get f() { return this.d.f; }
  speichern() {
    clearTimeout(this.t);
    this.t = setTimeout(() => { try { localStorage.setItem(this.key, JSON.stringify(this.d)); } catch (e) { /* egal */ } }, 300);
  }
}

// ---------- Basisklasse für einen Reiter ----------
// Unterklassen liefern html() und rechne(); Eingaben werden gespeichert und lösen rechne() aus.
export class Teil {
  constructor(el, speicher) { this.el = el; this.sp = speicher; this.raf = 0; }
  $(id) { return this.el.querySelector('#' + id); }
  val(id) { return this.$(id).value; }
  num(id) { const v = this.$(id).value.trim().replace(',', '.'); return v === '' ? NaN : Number(v); }
  anzeigen(id, an) { this.$(id).classList.toggle('hide', !an); }
  verdrahten(ausnahmen = []) {
    this.el.querySelectorAll('input[id],textarea[id],select[id]').forEach(e => {
      if (ausnahmen.includes(e.id)) return;
      const v = this.sp.f[e.id];
      if (v !== undefined) e.value = v;
    });
    const h = e => {
      const t = e.target;
      if (!t.id || ausnahmen.includes(t.id)) return;
      this.sp.f[t.id] = t.value; this.sp.speichern();
      this.nachAenderung(t);
    };
    this.el.addEventListener('input', h);
    this.el.addEventListener('change', h);
  }
  nachAenderung() {
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(() => this.sicher(() => this.rechne()));
  }
  sicher(fn) { try { fn(); } catch (e) { console.error(e); } }
  rechne() { /* Unterklasse */ }
}
