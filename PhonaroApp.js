  class PhonaroApp { // Export der Klasse PhonaroApp als ES-Modul
  constructor(store, bilder) { // Konstruktor der Klasse, nimmt eine Store-Instanz entgegen
    this.store = store; // Speichert die Store-Instanz als Eigenschaft der App
    this.tab = 'lernen'; // Setzt den initialen aktiven Reiter auf 'lernen'
    this.topic = ''; // Initialisiert den Themen-Filter als leeren String (alle Themen)
    this.queue = []; // Initialisiert das Array für die aktuelle Lernkarten-Warteschlange
    this.shown = false; // Initialisiert den Status, ob die Antwort einer Karte sichtbar ist (false)
    this.msg = ''; // Initialisiert eine leere Statusnachricht für Benachrichtigungen
    this.letzteSeite = null; // zuletzt im Skript angezeigte Seite (kommt per Event vom Skript-Modul)
    this.bilder = bilder;
    this.ausschnitt = null; // { blob, vorschau, seite }
    this.bearbeiteId = null; // Karte, die gerade bearbeitet wird (null = neue Karte)
  } // Ende des Konstruktors

  $(selector) { // Hilfsmethode zum einfacheren Selektieren von DOM-Elementen
    return document.querySelector(selector); // Gibt das erste passende DOM-Element für den Selektor zurück
  } // Ende der $-Hilfsmethode

  esc(str) { // Methode zum Escapen von Sonderzeichen, um XSS-Injektionen zu verhindern
    return String(str).replace(/[&<>"]/g, c => ({ // Konvertiert den Wert in einen String und ersetzt kritische Zeichen
      '&': '&amp;', // Ersetzt kaufmännisches Und durch HTML-Entität
      '<': '&lt;', // Ersetzt "kleiner als" durch HTML-Entität
      '>': '&gt;', // Ersetzt "größer als" durch HTML-Entität
      '"': '&quot;' // Ersetzt Anführungszeichen durch HTML-Entität
    }[c])); // Gibt den bereinigten String zurück
  } // Ende der esc-Methode

  init() { // Initialisierungsmethode der Anwendung beim Start
    this.buildQueue(); // Erstellt die erste Warteschlange der fälligen Lernkarten
    this.bindGlobalKeys(); // Registriert die globalen Tastatur-Shortcuts
    document.addEventListener('skript:seite', e => { this.letzteSeite = e.detail.seite; }); // merkt sich die aktuelle Skriptseite
    this.render(); // Führt das initiale Rendern der Benutzeroberfläche aus

  document.addEventListener('skript:ausschnitt', e => { // Bildausschnitt aus dem Skript übernehmen
    // Eingaben merken, bevor render() das Formular neu aufbaut
    const felder = ['nt', 'nq', 'na'].concat(this.bearbeiteId ? ['ns'] : []);   // beim Bearbeiten gehört die Skriptseite zur Karte
    const entwurf = felder.map(id => {
      const el = this.$('#' + id);
      return [id, el ? el.value : null];   // null = Reiter war gar nicht offen
    });
    const haken = ['rq', 'ra'].map(id => [id, !!(this.$('#' + id) && this.$('#' + id).checked)]);

    if (this.ausschnitt) URL.revokeObjectURL(this.ausschnitt.vorschau);
    this.ausschnitt = { blob: e.detail.blob, vorschau: URL.createObjectURL(e.detail.blob), seite: e.detail.seite };
    this.letzteSeite = e.detail.seite;
    this.tab = 'karten';
    this.render();

    entwurf.forEach(([id, wert]) => { // Eingaben zurückschreiben
      const el = this.$('#' + id);
      if (el && wert !== null) el.value = wert;
    });
    haken.forEach(([id, an]) => { const el = this.$('#' + id); if (el) el.checked = an; });
  });
  } // Ende der init-Methode

  

  buildQueue() { // Methode zum Erstellen und Mischen der Lernkarten-Warteschlange
    this.queue = this.store.getDueCards(this.topic).sort(() => Math.random() - 0.5); // Holt fällige Karten für das Thema und mischt sie zufällig durch
    this.shown = false; // Setzt den Antwort-Anzeige-Status für die neue Queue auf unsichtbar zurück
  } // Ende der buildQueue-Methode

handleAnswer(isCorrect) {
  const currentCard = this.queue[0];
  if (!currentCard) return;

  this.store.answerCard(currentCard.id, isCorrect);
  this.queue.shift();

  // Wenn falsch beantwortet: Karte wieder hinten an die aktuelle Warteschlange anhängen
  if (!isCorrect) {
    this.queue.push(currentCard);
  }

  this.shown = false;
  this.render();
}

  bindGlobalKeys() { // Methode zum Registrieren globaler Tastatur-Eventlistener
    document.addEventListener('keydown', e => { // Fügt dem Dokument einen Listener für Tastendrücke hinzu
      if ( // Beginn der Bedingungsprüfung, wann Tastenkombinationen ignoriert werden sollen
        this.tab !== 'lernen' || // Ignorieren, wenn man sich nicht im 'lernen'-Reiter befindet
        /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) || // Ignorieren, wenn sich der Fokus in einem Eingabefeld befindet
        !this.queue[0] // Ignorieren, wenn keine Karten in der Warteschlange sind
      ) { // Ende der Bedingungsprüfung
        return; // Bricht die Ausführung des Event-Listeners ab
      } // Ende des if-Blocks

      if (!this.shown && (e.key === ' ' || e.key === 'Enter')) { // Wenn Antwort noch nicht sichtbar und Leertaste oder Enter gedrückt wird
        e.preventDefault(); // Verhindert das Standardverhalten der Taste (z.B. Scrollen)
        this.shown = true; // Setzt den Status auf "Antwort anzeigen"
        this.render(); // Aktualisiert die Ansicht, um die Antwort anzuzeigen
      } else if (this.shown && e.key === '1') { // Wenn Antwort sichtbar ist und Taste '1' (Gewusst) gedrückt wird
        this.handleAnswer(true); // Verarbeitet die Antwort als korrekt
      } else if (this.shown && e.key === '2') { // Wenn Antwort sichtbar ist und Taste '2' (Nicht gewusst) gedrückt wird
        this.handleAnswer(false); // Verarbeitet die Antwort als nicht korrekt
      } // Ende der Tastatur-Weiche
    }); // Ende des Event-Listeners
  } // Ende der bindGlobalKeys-Methode

  renderTabs() { // Methode zum Rendern der Navigations-Reiter (Tabs)
    const items = [ // Definiert ein Array mit den verfügbaren Reitern und deren Beschriftungen
      ['lernen', 'Lernen'], // Tab-Eintrag für den Lernmodus
      ['karten', 'Karten'], // Tab-Eintrag für die Kartenverwaltung
      ['stats', 'Statistik'], // Tab-Eintrag für Statistiken
      ['daten', 'Import/Export'] // Tab-Eintrag für Import/Export-Funktionen
    ]; // Ende des Reiter-Arrays

    this.$('#tabs').innerHTML = items // Generiert den HTML-String für das Reiter-Menü im DOM-Element #tabs
      .map(([k, l]) => `<button class="btn ${this.tab === k ? 'on' : ''}" data-t="${k}">${l}</button>`) // Erstellt für jeden Reiter einen Button und setzt die 'on'-Klasse bei aktivem Tab
      .join(''); // Verbindet alle generierten HTML-Buttons zu einem String

    document.querySelectorAll('[data-t]').forEach(btn => { // Durchläuft alle erstellten Tab-Buttons im DOM
      btn.onclick = () => { // Registriert einen Klick-Handler für jeden Tab-Button
        this.tab = btn.dataset.t; // Aktualisiert den aktiven Tab auf den Wert des Buttons
        this.msg = ''; // Setzt eventuelle Statusnachrichten beim Tabwechsel zurück
        if (this.tab === 'lernen') this.buildQueue(); // Erstellt die Lern-Warteschlange neu, wenn zum Lern-Tab gewechselt wird
        this.render(); // Rendert die App neu, um den neuen Tab anzuzeigen
      }; // Ende des Klick-Handlers
    }); // Ende der Schleife über die Tab-Buttons
  } // Ende der renderTabs-Methode

  renderTopicSelect() { // Methode zum Rendern des Themen-Auswahl-Dropdowns
    const options = this.store.getTopics() // Holt alle verfügbaren Themen aus dem Store
      .map(t => `<option ${t === this.topic ? 'selected' : ''}>${this.esc(t)}</option>`) // Erstellt für jedes Thema ein Option-Tag und markiert das aktive Thema als 'selected'
      .join(''); // Verbindet die Optionen zu einem HTML-String
    return `<select id="tsel"><option value="">Alle Themen</option>${options}</select>`; // Gibt das komplette HTML für das Select-Element zurück
  } // Ende der renderTopicSelect-Methode

  renderLernen() { // Methode zum Rendern der Haupt-Lernansicht
    const total = this.store.getDueCards(this.topic).length; // Ermittelt die Gesamtanzahl fälliger Karten für das gewählte Thema
    const card = this.queue[0]; // Holt die oberste Karte aus der aktuellen Warteschlange
    let html = `<div class="row">${this.renderTopicSelect()}<span class="muted">Fällig: ${this.queue.length} von ${total}</span></div>`; // Generiert den HTML-Kopf mit Dropdown und Zähler

    if (!card) { // Prüft, ob keine fälligen Karten mehr vorhanden sind
      html += `<div class="sunk card"><b>Alles erledigt!</b><br>Für heute ist nichts mehr fällig. Gut gemacht.<br><small>Neue Karten kannst du unter „Karten“ anlegen.</small></div>`; // Fügt eine Erfolgsmeldung hinzu, wenn alles gelernt wurde
    } else { // Wenn noch Karten fällig sind
      html += `
          <div class="sunk card"> 
          <small>${this.esc(card.topic)} · Fach ${card.box} von 5</small> 
          <p>${this.esc(card.q)}</p> 
          ${card.qBild ? `<img class="kartenbild" data-bild="${card.qBild}" alt="">` : ''} 
          ${this.shown ? `<hr><p style="color:var(--gd)">${this.esc(card.a)}</p>${card.aBild ? `<img class="kartenbild" data-bild="${card.aBild}" alt="">` : ''}` : ''} 
        </div>
        <div class="row"> 
          ${this.shown // Bedingte Anzeige der Buttons je nach Aufdeckungsstatus
            ? `<button class="btn no" id="bn">Nicht gewusst (2)</button><button class="btn ok" id="by">Gewusst (1)</button>${card.seite ? `<button class="btn" id="bk">Im Skript nachschlagen (S. ${card.seite})</button>` : ''}` // Buttons nach dem Aufdecken der Antwort
            : `<button class="btn" id="bs">Antwort zeigen (Leertaste)</button>`} 
        </div>`; // Ende der Button-Reihe
    } // Ende der If-Else-Bedingung für die Karte

    this.$('#main').innerHTML = html; // Schreibt den generierten HTML-Inhalt in den Hauptbereich der App

      document.querySelectorAll('#main [data-bild]').forEach(img => {
      this.bilder.url(img.dataset.bild).then(u => { if (u) img.src = u; });
      });

    this.$('#tsel').onchange = e => { // Registriert einen Event-Listener für Änderungen im Themen-Dropdown
      this.topic = e.target.value; // Aktualisiert das ausgewählte Thema
      this.buildQueue(); // Baut die Warteschlange für das neue Thema neu auf
      this.render(); // Rendert die App neu
    }; // Ende des onchange-Handlers
    if (this.$('#bs')) { // Prüft, ob der "Antwort zeigen"-Button im DOM existiert
      this.$('#bs').onclick = () => { // Registriert einen Klick-Handler für diesen Button
        this.shown = true; // Setzt den Status auf sichtbar
        this.render(); // Rendert die App neu
      }; // Ende des Klick-Handlers
    } // Ende der Prüfung
    if (this.$('#by')) { // Prüft, ob die Bewertungsbuttons ("Gewusst" / "Nicht gewusst") im DOM existieren
      this.$('#by').onclick = () => this.handleAnswer(true); // Klick-Handler für "Gewusst" (korrekt)
      this.$('#bn').onclick = () => this.handleAnswer(false); // Klick-Handler für "Nicht gewusst" (falsch)
      if (this.$('#bk')) this.$('#bk').onclick = () => document.dispatchEvent(new CustomEvent('skript:gehezu', { detail: { seite: card.seite } })); // springt im Skript zur Seite
    } // Ende der Prüfung
  } // Ende der renderLernen-Methode

  renderKarten() { // Methode zum Rendern der Karten-Verwaltungsansicht
    const list = this.store.getCards(this.topic); // Holt alle Karten des aktuellen Themas aus dem Store
    const datalist = this.store.getTopics().map(t => `<option value="${this.esc(t)}">`).join(''); // Erstellt Autovervollständigungs-Optionen für Themen
    const edit = this.bearbeiteId ? this.store.state.cards.find(c => c.id === this.bearbeiteId) : null; // Karte im Bearbeiten-Modus
    if (!edit) this.bearbeiteId = null; // Karte gibt es nicht mehr (z. B. gelöscht)

    this.$('#main').innerHTML = ` 
      <fieldset><legend>${edit ? 'Karte bearbeiten' : 'Neue Karte'}</legend> 
        <label>Thema</label><input id="nt" list="tl" value="${this.esc(edit ? edit.topic : this.topic)}" placeholder="z. B. Statistik"> 
        <datalist id="tl">${datalist}</datalist> 
        <label>Frage</label><textarea id="nq" rows="2">${edit ? this.esc(edit.q) : ''}</textarea> 
        <label>Antwort</label><textarea id="na" rows="2">${edit ? this.esc(edit.a) : ''}</textarea> 
        <label>Skriptseite (optional)</label><input id="ns" type="number" min="1" value="${edit ? (edit.seite || '') : (this.letzteSeite || '')}" placeholder="z. B. 12">
        ${edit && (edit.qBild || edit.aBild) ? `<div class="row">
          ${edit.qBild ? '<label><input type="checkbox" id="rq"> Bild bei der Frage entfernen</label>' : ''}
          ${edit.aBild ? '<label><input type="checkbox" id="ra"> Bild bei der Antwort entfernen</label>' : ''}
        </div>` : ''}
        <div class="row">${edit
          ? '<button class="btn ok" id="save">Änderungen speichern</button><button class="btn" id="cancel">Abbrechen</button>'
          : '<button class="btn ok" id="add">Karte hinzufügen</button>'}<span class="muted">${this.esc(this.msg)}</span></div> 

         ${this.ausschnitt ? `
        <label>Bildausschnitt (S. ${this.ausschnitt.seite})</label>
        <img src="${this.ausschnitt.vorschau}" alt="" style="max-width:100%;max-height:160px;display:block">
        <div class="row">
        <label><input type="radio" name="bildziel" value="q"> bei der Frage</label>
        <label><input type="radio" name="bildziel" value="a" checked> bei der Antwort</label>
        <button class="btn" id="bild-weg">Verwerfen</button>
        </div>` : ''}

      </fieldset> 
      <div class="row">${this.renderTopicSelect()}<span class="muted">${list.length} Karten</span></div>
      <div class="sunk list">${list.map(c => ` 
        <div class="item"> 
          <div><b>${this.esc(c.q)}</b><br><span class="muted">${this.esc(c.a)}</span><br><small class="muted">${this.esc(c.topic)} · Fach ${c.box}${c.seite ? ' · S. ' + c.seite : ''}</small></div> 

          <button class="btn" data-e="${c.id}">Bearbeiten</button><button class="btn" data-s="${c.id}">Seite</button><button class="btn" data-d="${c.id}">Löschen</button> 
        </div>`).join('') || 'Noch keine Karten.'}
      </div>`; // Ende der Kartenliste

    this.$('#tsel').onchange = e => { // Event-Handler für den Themenfilter in der Verwaltung
      this.topic = e.target.value; // Aktualisiert das gefilterte Thema
      this.render(); // Rendert die Ansicht neu
    }; // Ende des onchange-Handlers


  if (this.$('#add')) this.$('#add').onclick = async () => {
  const t = this.$('#nt').value.trim();
  const q = this.$('#nq').value.trim();
  const a = this.$('#na').value.trim();
  if (!q && !a && !this.ausschnitt) { this.msg = 'Bitte Frage und Antwort ausfüllen.'; this.render(); return; }
  if (!q || (!a && !this.ausschnitt)) { this.msg = 'Bitte Frage und Antwort ausfüllen.'; this.render(); return; }
  const bild = {};
  if (this.ausschnitt) {
    const ziel = (document.querySelector('input[name="bildziel"]:checked') || {}).value || 'a';
    bild[ziel] = await this.bilder.speichern(this.ausschnitt.blob);
    URL.revokeObjectURL(this.ausschnitt.vorschau);
    this.ausschnitt = null;
  }
  this.store.addCard(t, q, a, parseInt(this.$('#ns').value, 10) || null, bild);
  this.msg = 'Gespeichert.';
  this.render();
};

  // ---- Karte bearbeiten ----
  document.querySelectorAll('[data-e]').forEach(btn => {
    btn.onclick = () => {
      this.bearbeiteId = btn.dataset.e;
      this.msg = '';
      this.render();
      const q = this.$('#nq'); if (q) { q.focus(); q.scrollIntoView({ block: 'center' }); }
    };
  });
  if (this.$('#cancel')) this.$('#cancel').onclick = () => { this.bearbeiteId = null; this.msg = ''; this.render(); };
  if (this.$('#save')) this.$('#save').onclick = async () => {
    const c = edit;
    const t = this.$('#nt').value.trim();
    const q = this.$('#nq').value.trim();
    const a = this.$('#na').value.trim();
    const entfQ = !!(this.$('#rq') && this.$('#rq').checked);
    const entfA = !!(this.$('#ra') && this.$('#ra').checked);
    let qBild = entfQ ? null : c.qBild, aBild = entfA ? null : c.aBild;
    let ziel = null;
    if (this.ausschnitt) ziel = (document.querySelector('input[name="bildziel"]:checked') || {}).value || 'a';
    const hatBildQ = ziel === 'q' || qBild, hatBildA = ziel === 'a' || aBild;
    if ((!q && !hatBildQ) || (!a && !hatBildA)) { this.msg = 'Bitte Frage und Antwort ausfüllen.'; this.render(); return; }
    if (entfQ && c.qBild) this.bilder.loeschen(c.qBild);
    if (entfA && c.aBild) this.bilder.loeschen(c.aBild);
    if (ziel) { // neuer Ausschnitt ersetzt ein vorhandenes Bild an dieser Stelle
      const alt = ziel === 'q' ? qBild : aBild;
      if (alt) this.bilder.loeschen(alt);
      const neu = await this.bilder.speichern(this.ausschnitt.blob);
      if (ziel === 'q') qBild = neu; else aBild = neu;
      URL.revokeObjectURL(this.ausschnitt.vorschau);
      this.ausschnitt = null;
    }
    this.store.updateCard(c.id, { topic: t, q, a, seite: parseInt(this.$('#ns').value, 10) || null, qBild, aBild });
    this.bearbeiteId = null;
    this.msg = 'Änderungen gespeichert.';
    this.render();
  };

if (this.$('#bild-weg')) this.$('#bild-weg').onclick = () => { URL.revokeObjectURL(this.ausschnitt.vorschau); this.ausschnitt = null; this.render(); };
  
    document.querySelectorAll('[data-s]').forEach(btn => { // Buttons zum Setzen oder Ändern der Skriptseite
  btn.onclick = () => {
    const card = this.store.state.cards.find(c => c.id === btn.dataset.s);
    const eingabe = prompt('Skriptseite (leer lassen = Verweis entfernen):', card && card.seite ? card.seite : '');
    if (eingabe === null) return; // abgebrochen
    this.store.setSeite(btn.dataset.s, parseInt(eingabe, 10) || null);
    this.render();
  };
});


document.querySelectorAll('[data-d]').forEach(btn => {
  btn.onclick = () => {
    if (!confirm('Karte wirklich löschen?')) return;
    const c = this.store.state.cards.find(x => x.id === btn.dataset.d);
    if (c) { this.bilder.loeschen(c.qBild); this.bilder.loeschen(c.aBild); }   // Bilder der Karte mitlöschen

    this.store.deleteCard(btn.dataset.d);
    this.render();
  };
});
  

  
  } 
  
  // Ende der renderKarten-Methode

  renderStats() { // Methode zum Rendern der Statistik-Ansicht
    const cards = this.store.state.cards; // Holt alle Karten aus dem Store-Zustand
    const total = cards.length || 1; // Ermittelt die Gesamtzahl der Karten (verhindert Division durch 0)
    const boxes = [1, 2, 3, 4, 5].map(b => cards.filter(c => c.box === b).length); // Zählt die Anzahl der Karten in jedem der 5 Fächer
    const learned = boxes[4]; // Ermittelt die Anzahl der Karten im höchsten Fach (Fach 5)
    const todayCount = this.store.state.log[this.store.day()] || 0; // Holt die Anzahl der heute gelernten Karten aus dem Log
    const dueCount = this.store.getDueCards().length; // Ermittelt die Gesamtzahl aktuell fälliger Karten
    const learnedPercent = Math.round((learned / total) * 100); // Berechnet den prozentualen Anteil der gelernten Karten in Fach 5

    this.$('#main').innerHTML = `
      <div class="sunk"> 
        <p><b>Serie:</b> ${this.store.state.streak} Tag(e) · <b>Heute beantwortet:</b> ${todayCount} · <b>Fällig:</b> ${dueCount}</p> 
        <p><b>Gesamtfortschritt</b> (Karten in Fach 5: ${learned} von ${cards.length})</p> 
        <div class="row"><div class="bar"><i style="width:${learnedPercent}%"></i></div><span>${learnedPercent} %</span></div> 
        <p><b>Verteilung nach Fächern</b></p> 
        ${boxes.map((v, i) => { // Iteriert durch jedes Lernfach, um die Balken zu generieren
          const p = Math.round((v / total) * 100); // Berechnet den Prozentwert für das jeweilige Fach
          return `<div class="row"><span style="width:60px">Fach ${i + 1}</span><div class="bar"><i style="width:${p}%"></i></div><span style="width:30px">${v}</span></div>`; // Gibt das HTML für eine Fach-Zeile zurück
        }).join('')} 
        <p class="muted">Intervalle: Fach 1 sofort, Fach 2 nach 1 Tag, Fach 3 nach 3 Tagen, Fach 4 nach 7 Tagen, Fach 5 nach 21 Tagen.</p> 
      </div>`; // Ende des Statistik-Containers
  } // Ende der renderStats-Methode

  renderDaten() {
    this.$('#main').innerHTML = ` 
      <fieldset><legend>Import</legend> 
      <p>Eine Karte pro Zeile: <code>Thema;Frage;Antwort</code> (optional als vierte Spalte die Skriptseite, z. B. <code>…;12</code>), oder eine zuvor exportierte JSON-Liste einfügen.</p>        <textarea id="imp" rows="4" placeholder="Thema;Frage;Antwort"></textarea>
        <div class="row"><button class="btn ok" id="bi">Importieren</button><span class="muted">${this.esc(this.msg)}</span></div> 
      </fieldset> 
      <fieldset><legend>Export / Sicherung</legend>
        <textarea id="exp" rows="5" readonly>${this.esc(JSON.stringify(this.store.state.cards))}</textarea> 
        <div class="row"><button class="btn" id="cp">Kopieren</button><button class="btn no" id="rs">Alles zurücksetzen</button></div> 
      </fieldset>`;

    this.$('#bi').onclick = () => { // Klick-Handler für den Import-Button
      const raw = this.$('#imp').value.trim(); // Liest den Inhalt des Import-Textfeldes aus
      try { // Fehlerbehandlungsblock für den Importvorgang
        const count = this.store.importCards(raw); // Führt den Import im Store aus und speichert die Anzahl importierter Karten
        this.msg = `${count} Karten importiert.`; // Setzt die Erfolgsmeldung mit Anzahl
      } catch (e) { // Fängt Fehler beim Import ab (z.B. falsches Format)
        this.msg = 'Das Format wurde nicht erkannt.'; // Setzt eine Fehlermeldung
      } // Ende des Try-Catch-Blocks
      this.render(); // Rendert die Ansicht neu
    }; // Ende des Import-Klick-Handlers

    this.$('#cp').onclick = async () => { // Asynchroner Klick-Handler für den Kopieren-Button
      try { // Versuch, den Export-Text über die moderne Clipboard-API zu kopieren
        await navigator.clipboard.writeText(this.$('#exp').value); // Schreibt den JSON-Export in die Zwischenablage
      } catch (e) { // Fallback, falls die Clipboard-API nicht verfügbar ist
        this.$('#exp').select(); // Markiert den Text im Export-Textfeld
        document.execCommand('copy'); // Führt den Kopiervorgang über den Legacy-Befehl aus
      } // Ende des Try-Catch-Blocks
    }; // Ende des Kopieren-Klick-Handlers

    this.$('#rs').onclick = () => { // Klick-Handler für den "Alles zurücksetzen"-Button
      if (confirm('Wirklich alle Karten und den Lernstand löschen?')) { // Zeigt einen Sicherheits-Bestätigungsdialog an
        this.store.reset(); // Setzt den Store komplett auf den Anfangszustand zurück
        this.buildQueue(); // Baut die Lern-Warteschlange neu auf
        this.render(); // Rendert die Ansicht neu
      } // Ende der Bestätigungsprüfung
    }; // Ende des Reset-Klick-Handlers
  } // Ende der renderDaten-Methode

  render() { // Zentrale Render-Methode zur Aktualisierung der gesamten Benutzeroberfläche
    this.renderTabs(); // Aktualisiert die Darstellung der Navigationstabs
    const views = { // Objekt zur Zuordnung der Ansichts-Methoden je Tab-Schlüssel
      lernen: () => this.renderLernen(), // Verknüpft 'lernen' mit der entsprechenden Render-Methode
      karten: () => this.renderKarten(), // Verknüpft 'karten' mit der entsprechenden Render-Methode
      stats: () => this.renderStats(), // Verknüpft 'stats' mit der entsprechenden Render-Methode
      daten: () => this.renderDaten() // Verknüpft 'daten' mit der entsprechenden Render-Methode
    }; // Ende des views-Objekts
    views[this.tab](); // Ruft die Render-Funktion auf, die zum aktuell aktiven Tab passt

    this.$('#st1').textContent = `${this.store.state.cards.length} Karten · ${this.store.getTopics().length} Thema/Themen`; // Aktualisiert die erste Statuszeile unten mit Gesamtzahl und Themen
    this.$('#st2').textContent = `Serie: ${this.store.state.streak} Tag(e)`; // Aktualisiert die zweite Statuszeile unten mit der aktuellen Lern-Serie (Streak)
  } // Ende der render-Methode
} // Ende der Klasse PhonaroApp

export default PhonaroApp; // Exportiert die Klasse PhonaroApp als Standard-Modul