  class CardStore { // Export der Klasse CardStore
  constructor(storageKey = 'phonaro-lernkarten-v1') { // Konstruktor zur Initialisierung des Stores mit einem Storage-Key
    this.key = storageKey; // Zuweisung des Storage-Keys an die Instanzvariable
    this.intervals = [0,1,3,7,21]; // Definition der Lernintervalle in Tagen für die Fächer
    this.state = this.load(); // Laden des aktuellen Zustands aus dem LocalStorage
  } // Ende des Konstruktors

  day() { // Methode zur Ermittlung des aktuellen Tages als Integer-Wert
    return Math.floor(Date.now() / 864e5); // Berechnung der vergangenen Tage seit Epoche durch Division von Millisekunden
  } // Ende der day-Methode

  createId() { // Methode zum Generieren einer zufälligen ID für Karten
    return Math.random().toString(36).slice(2, 10); // Erzeugung eines Base-36-Zufallsstrings als ID
  } // Ende der createId-Methode

  seed() { // Methode zur Bereitstellung von Initial-/Standardkarten
    const t = 'Statistik'; // Festlegung des Standardthemas für die Startkarten
    return [ // Rückgabe eines Arrays mit vordefinierten Lernkarten
      ['Was misst die Standardabweichung?', 'Die durchschnittliche Streuung der Werte um den Mittelwert (Wurzel der Varianz).'], // Erste Beispielkarte (Frage und Antwort)
      ['Was besagt der zentrale Grenzwertsatz?', 'Die Verteilung von Stichprobenmittelwerten nähert sich bei wachsendem n einer Normalverteilung an.'], // Zweite Beispielkarte
      ['Was ist ein p-Wert?', 'Die Wahrscheinlichkeit, ein mindestens so extremes Ergebnis zu sehen, wenn die Nullhypothese stimmt.'], // Dritte Beispielkarte
      ['Fehler 1. Art?', 'Die Nullhypothese wird verworfen, obwohl sie wahr ist (α-Fehler).'], // Vierte Beispielkarte
      ['Fehler 2. Art?', 'Die Nullhypothese wird beibehalten, obwohl sie falsch ist (β-Fehler).'], // Fünfte Beispielkarte
      ['Unterschied zwischen Median und Mittelwert?', 'Der Median ist der mittlere Wert der Rangfolge und robust gegenüber Ausreißern, der Mittelwert nicht.'] // Sechste Beispielkarte
    ].map(([q, a]) => ({ id: this.createId(), topic: t, q, a, box: 1, due: 0 })); // Umwandlung des Arrays in strukturierte Kartenobjekte mit Metadaten
  } // Ende der seed-Methode

  load() { // Methode zum Laden des gespeicherten Anwendungszustands
    try { // Fehlerbehandlungsblock für das Auslesen des LocalStorages
      const parsed = JSON.parse(localStorage.getItem(this.key)); // Einlesen und Parsen des JSON-Strings aus dem Speicher
      if (parsed && Array.isArray(parsed.cards)) return parsed; // Rückgabe des geparsten Zustands, falls das Karten-Array existiert
    } catch (e) {} // Abfangen eventueller Parsing- oder Speicherfehler ohne Unterbrechung
    return { cards: this.seed(), streak: 0, last: 0, log: {} }; // Rückgabe eines Standard-Initialstatus bei Fehlern oder leerem Speicher
  } // Ende der load-Methode

 save() {
  try { localStorage.setItem(this.key, JSON.stringify(this.state)); } catch (e) {}
  document.dispatchEvent(new CustomEvent('karten:geaendert')); // meldet Änderungen an andere Module (z. B. Sync)
} // Ende der save-Methode

  reset() { // Methode zum Zurücksetzen der gesamten Lernkarten-Daten
    try { // Fehlerbehandlungsblock für das Löschen des Eintrags
      localStorage.removeItem(this.key); // Entfernen des Schlüssels aus dem LocalStorage
    } catch (e) {} // Abfangen eventueller Löschfehler
    this.state = { cards: this.seed(), streak: 0, last: 0, log: {} }; // Wiederherstellung des ursprünglichen Startzustands
    this.save();
  } // Ende der reset-Methode

  getTopics() { // Methode zum Ermitteln aller vorhandenen Themen
    return [...new Set(this.state.cards.map(c => c.topic))].sort(); // Extrahieren, Duplikatbereinigung (Set) und alphabetische Sortierung der Themen
  } // Ende der getTopics-Methode

  getCards(topic = '') { // Methode zum Abrufen von Karten, optional gefiltert nach Thema
    return this.state.cards.filter(c => !topic || c.topic === topic); // Filtert das Karten-Array nach dem angegebenen Thema oder gibt alles zurück
  } // Ende der getCards-Methode

  getDueCards(topic = '') { // Methode zum Abrufen aller fälligen Karten für das Training
    return this.state.cards.filter(c => c.due <= this.day() && (!topic || c.topic === topic)); // Filtert nach fälligem Datum (kleiner/gleich heute) und Thema
  } // Ende der getDueCards-Methode

  answerCard(cardId, isCorrect) { // Methode zur Verarbeitung der Antwort auf eine bestimmte Karte
    const card = this.state.cards.find(c => c.id === cardId); // Suchen der Karte im Array anhand ihrer ID
    if (!card) return; // Abbrechen der Funktion, falls die Karte nicht gefunden wurde

    card.box = isCorrect ? Math.min(5, card.box + 1) : 1; // Heraufsetzen des Lernfachs bei korrekter Antwort (max. 5) oder Zurücksetzen auf 1
    const intervalIndex = Math.min(card.box - 1, this.intervals.length - 1); // Bestimmen des Intervall-Indexes entsprechend dem aktuellen Fach
    card.due = this.day() + this.intervals[intervalIndex]; // Neuberechnung des Fälligkeitstages auf Basis des Intervalls

    const today = this.day(); // Speichern des heutigen Tageswertes in einer Konstanten
    if (this.state.last !== today) { // Prüfung, ob heute noch keine Lernaktivität registriert wurde
      this.state.streak = (this.state.last === today - 1) ? this.state.streak + 1 : 1; // Inkrementieren der Streak bei aufeinanderfolgenden Tagen oder Reset auf 1
      this.state.last = today; // Aktualisieren des Datums der letzten Aktivität auf den heutigen Tag
    } // Ende der if-Bedingung für die Streak-Aktualisierung
    this.state.log[today] = (this.state.log[today] || 0) + 1; // Inkrementieren des Zählers für heute beantwortete Karten im Logbuch
    this.save(); // Abspeichern des modifizierten Zustands im LocalStorage
  } // Ende der answerCard-Methode

// addCard: Parameter seite ergänzen und im Objekt speichern
addCard(topic, q, a, seite = null,bild = {}) {
  this.state.cards.push({
    id: this.createId(), topic: topic || 'Allgemein', q, a,

    
    seite: seite || null,   // Skriptseite (optional)
    qBild: bild.q || null,   // Bild bei der Frage
    aBild: bild.a || null,    // Bild bei der Antwort
    box: 1, due: 0
    
 
  });
  this.save();
}

// neue Methode: Seite einer bestehenden Karte nachträglich setzen
setSeite(cardId, seite) {
  const card = this.state.cards.find(c => c.id === cardId);
  if (!card) return;
  card.seite = seite || null;
  this.save();
}

  deleteCard(cardId) { // Methode zum Löschen einer Karte anhand ihrer ID
    this.state.cards = this.state.cards.filter(c => c.id !== cardId); // Entfernen der Karte aus dem Array durch Filterung
    this.save(); // Abspeichern des aktualisierten Zustands
  } // Ende der deleteCard-Methode

  importCards(rawText) { // Methode zum Importieren von Karten aus Rohtext (JSON oder getrennte Zeilen)
    let added = []; // Initialisierung eines Arrays für die erfolgreich hinzugefügten Karten
    if (rawText.startsWith('[')) { // Prüfung, ob es sich um ein JSON-Array im Text handelt
      added = JSON.parse(rawText) // Parsen des JSON-Textes in ein JavaScript-Array
        .filter(c => c.q && c.a) // Filtern von Einträgen, die weder Frage noch Antwort besitzen
        .map(c => ({ // Mappen der geparsten Daten auf das standardisierte Kartenformat
          id: this.createId(), // Generieren einer neuen ID für jede importierte Karte
          topic: c.topic || 'Allgemein', // Übernehmen des Themas oder Fallback
          q: c.q, // Übernehmen der Frage
          a: c.a, // Übernehmen der Antwort
          box: c.box || 1, // Übernehmen des Fachs oder Start in Fach 1
          due: c.due || 0, // Übernehmen der Fälligkeit oder sofort fällig
          seite: c.seite || null,

          qBild: c.qBild || null,
          aBild: c.aBild || null
        })); // Ende des Map-Blocks für JSON
    } else { // Falls kein JSON vorliegt, wird tabellarischer/zeilenbasierter Text erwartet
      added = rawText // Verarbeiten des Rohtextes zeilenweise
        .split('\n') // Aufteilen des Textes an Zeilenumbrüchen
        .map(line => line.split(/;|\t/)) // Aufteilen jeder Zeile anhand von Semikolon oder Tabulator
        .filter(parts => parts.length >= 3) // Filtern von Zeilen mit weniger als 3 Spalten (Thema, Frage, Antwort)
       .map(parts => {
  const last = parts[parts.length - 1].trim();
  const hatSeite = parts.length >= 4 && /^\d{1,4}$/.test(last);   // vierte Spalte nur, wenn sie eine reine Zahl ist
  return {
    id: this.createId(),
    topic: parts[0].trim() || 'Allgemein',
    q: parts[1].trim(),
    a: parts.slice(2, hatSeite ? -1 : undefined).join(';').trim(),
    seite: hatSeite ? +last : null,
    box: 1, due: 0
  };
}); // Ende des Map-Blocks für zeilenbasierten Text
    } // Ende des If-Else-Blocks für Importformate
    this.state.cards.push(...added); // Hinzufügen aller neuen Karten zum Hauptarray
    this.save(); // Abspeichern des aktualisierten Zustands
    return added.length; // Rückgabe der Anzahl der erfolgreich importierten Karten
  } // Ende der importCards-Methode
} // Ende der Klasse CardStore

export default CardStore; // Exportieren der Klasse als Standard-Modul