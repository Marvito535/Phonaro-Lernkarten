#!/usr/bin/env python3
# Kleiner Sicherungsdienst für die Lernapp. Nur Python-Standardbibliothek.
#
# Läuft nur auf 127.0.0.1 und ist von außen nicht erreichbar. Caddy schützt den
# Zugang mit Passwort und leitet /api/ hierher.
#
#   GET /api/state  liefert {"version", "updated", "state"} oder 404, wenn noch leer
#   PUT /api/state  erwartet {"basis": <bekannte Version>, "stand": {...}}
#                   Stimmt "basis" nicht mit der Serverversion überein: 409 (Konflikt)
#   Genauso für weitere Datensätze unter /api/state/<name> (z. B. /api/state/ziele),
#   jeder mit eigener Version und eigenen Backups.
#
#   GET /api/anrufe   Anrufzähler pro Tag aus dem Portunity-Einzelverbindungsnachweis (nur lesen)
#                     Zugangsdaten kommen aus Umgebungsvariablen (PORTUNITY_LOGIN, PORTUNITY_CODE)
#
#   GET/HEAD/PUT/DELETE /api/files/<name>   Dateien (PDF, PNG, JPG, WEBP), je bis 100 MB
#
# Vor jedem Überschreiben bleibt der alte Stand als Backup erhalten:
#   backups/tag-JJJJMMTT.json     erste Sicherung jedes Tages (90 Tage lang)
#   backups/stand-...json         laufende Sicherungen, höchstens alle 10 Minuten (letzte 200)

import json
import os
import re
import shutil
import threading
import time
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = '127.0.0.1', 8787
DATEN = os.environ.get('STATE_DIRECTORY', './daten')   # systemd setzt STATE_DIRECTORY
BACKUPS = os.path.join(DATEN, 'backups')
DATEI = os.path.join(DATEN, 'state.json')
MAX_BYTES = 20 * 1024 * 1024           # Kartendaten
MAX_DATEI = 100 * 1024 * 1024          # einzelne Datei (PDF, Bild)
FILES = os.path.join(DATEN, 'files')
STATE_RE = re.compile(r'^/api/state(?:/([a-z]{1,20}))?$')   # /api/state oder /api/state/<name>
NAME_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
TYPEN = {'.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp'}
PORTUNITY_URL = os.environ.get('PORTUNITY_URL', 'https://wr.ispsuite.portunity.de/webrequests/product-voip/')
PORTUNITY_LOGIN = os.environ.get('PORTUNITY_LOGIN', '')
PORTUNITY_CODE = os.environ.get('PORTUNITY_CODE', '')
ANRUFE_DATEI = os.path.join(DATEN, 'anrufe.json')
ANRUFE_PAUSE = 20    # frühestens alle 20 Sekunden bei Portunity nachfragen (und nur, wenn die App gerade abfragt)
DATUM_RE = re.compile(r'(\d{2})\.(\d{2})\.(\d{4})')   # Portunity: 27.10.2026
anrufe_stand = {'zeit': 0, 'fehler': None}
anrufe_sperre = threading.Lock()
sperre = threading.Lock()   # verhindert, dass zwei Anfragen gleichzeitig schreiben

os.makedirs(BACKUPS, exist_ok=True)
os.makedirs(FILES, exist_ok=True)


def datei_fuer(name):
    return os.path.join(DATEN, 'state-' + name + '.json') if name else DATEI


def lesen(datei=DATEI):
    try:
        with open(datei, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def schreiben(obj, datei=DATEI):
    tmp = datei + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, datei)   # atomar: entweder der alte oder der neue Stand, nie halb geschrieben


def sichern(datei=DATEI, name=''):
    p = name + '-' if name else ''   # eigene Backup-Namen je Datensatz
    jetzt = time.time()
    tag = os.path.join(BACKUPS, p + 'tag-' + time.strftime('%Y%m%d') + '.json')
    if not os.path.exists(tag):
        shutil.copyfile(datei, tag)
    laufend = sorted(f for f in os.listdir(BACKUPS) if f.startswith(p + 'stand-'))
    if not laufend or jetzt - os.path.getmtime(os.path.join(BACKUPS, laufend[-1])) > 600:
        shutil.copyfile(datei, os.path.join(BACKUPS, p + 'stand-' + time.strftime('%Y%m%d-%H%M%S') + '.json'))
    for prefix, behalten in ((p + 'stand-', 200), (p + 'tag-', 90)):
        dateien = sorted(f for f in os.listdir(BACKUPS) if f.startswith(prefix))
        for name in dateien[:-behalten]:
            os.remove(os.path.join(BACKUPS, name))


def sichern_datei(pfad, praefix):
    # Überschriebene oder gelöschte Dateien landen in backups/ (die letzten 10 je Art bleiben)
    ziel = os.path.join(BACKUPS, praefix + time.strftime('%Y%m%d-%H%M%S') + '-' + os.path.basename(pfad))
    shutil.copyfile(pfad, ziel)
    alte = sorted(f for f in os.listdir(BACKUPS) if f.startswith(praefix))
    for name in alte[:-10]:
        os.remove(os.path.join(BACKUPS, name))


# ---------- Portunity (nur lesend: Befehl "Connections") ----------
PERIODEN = ('NotCalced', 'Today', 'Yesterday', 'MonthThis', 'MonthLast')


def portunity_abfragen(periode=None):
    # POST statt GET, damit das Passwort nicht in einer URL (und in Logs) steht
    felder = {
        'sProductLogin': PORTUNITY_LOGIN, 'sProductCode': PORTUNITY_CODE,
        'sCommand': 'Connections'   # ohne Periode: die abgerechneten Verbindungen der letzten 30 Tage
    }
    if periode in PERIODEN:
        felder['sCommandPeriod'] = periode   # NotCalced = noch nicht abgerechnete Verbindungen
    daten = urllib.parse.urlencode(felder).encode('latin-1')
    with urllib.request.urlopen(urllib.request.Request(PORTUNITY_URL, data=daten), timeout=15) as r:
        text = r.read(2_000_000).decode('latin-1')   # die ISPSuite antwortet in ISO-8859-1
    werte, verbindungen = {}, []
    for zeile in text.splitlines():
        if ':' not in zeile:
            continue
        k, v = zeile.split(':', 1)
        k, v = k.strip(), v.strip()
        if re.fullmatch(r'WR_ConnectionsLog_\d+', k):   # eine Zeile pro Verbindung; _Legend nennt die Spalten
            verbindungen.append(v)
        else:
            werte[k] = v
    return werte, verbindungen


def tag_heute():
    try:
        from zoneinfo import ZoneInfo
        from datetime import datetime
        return datetime.now(ZoneInfo('Europe/Berlin')).strftime('%Y-%m-%d')
    except Exception:
        return time.strftime('%Y-%m-%d')


def verbindung_lesen(zeile):
    # Zeile: Ziel,Datum,Uhrzeit,Status,Dauer,Preis,... -> (ISO-Datum, Status); Rufnummer wird nie gespeichert
    teile = [t.strip() for t in zeile.split(',')]
    m = DATUM_RE.search(zeile)
    if not m:
        return None, ''
    return '%s-%s-%s' % (m.group(3), m.group(2), m.group(1)), (teile[3].lower() if len(teile) > 3 else '')


def anrufe_lesen():
    try:
        with open(ANRUFE_DATEI, encoding='utf-8') as f:
            d = json.load(f)
            return d if isinstance(d.get('tage'), dict) else {'tage': d, 'angenommen': {}}   # altes Format
    except (FileNotFoundError, ValueError, AttributeError):
        return {'tage': {}, 'angenommen': {}}


def anrufe_aktualisieren():
    # liefert (Daten, Fehlertext oder None); fragt höchstens alle ANRUFE_PAUSE Sekunden nach
    with anrufe_sperre:
        daten = anrufe_lesen()
        if not PORTUNITY_LOGIN or not PORTUNITY_CODE:
            return daten, 'Portunity nicht eingerichtet'
        if time.time() - anrufe_stand['zeit'] < ANRUFE_PAUSE:
            return daten, anrufe_stand['fehler']
        anrufe_stand['zeit'] = time.time()
        try:
            werte, verbindungen = portunity_abfragen()
            if werte.get('WR_Status', '').lower() != 'ok':
                raise RuntimeError(werte.get('WR_Comment') or 'Portunity: ' + werte.get('WR_Status', 'keine Antwort'))
            # Kurze oder nicht angenommene Anrufe stehen bei Portunity erst als "nicht abgerechnet".
            # Sie kommen dazu, doppelte Zeilen (gleiche Verbindung in beiden Listen) werden übersprungen.
            try:
                werte2, offen = portunity_abfragen('NotCalced')
                if werte2.get('WR_Status', '').lower() == 'ok':
                    bekannt = set(verbindungen)
                    verbindungen = verbindungen + [v for v in offen if v not in bekannt]
            except Exception:
                pass   # die abgerechneten Anrufe zählen trotzdem
            alle, angenommen = {}, {}
            for v in verbindungen:
                tag, status = verbindung_lesen(v)
                if tag:
                    alle[tag] = alle.get(tag, 0) + 1
                    if status == 'angenommen':
                        angenommen[tag] = angenommen.get(tag, 0) + 1
            heute = tag_heute()
            alle.setdefault(heute, 0)
            # die 30 Tage von Portunity ersetzen die gespeicherten Werte dieser Tage, ältere bleiben erhalten
            daten['tage'].update(alle)
            daten['angenommen'].update({t: angenommen.get(t, 0) for t in alle})
            grenze = time.strftime('%Y-%m-%d', time.localtime(time.time() - 120 * 86400))
            for schluessel in ('tage', 'angenommen'):
                daten[schluessel] = {t: n for t, n in daten[schluessel].items() if t >= grenze}
            tmp = ANRUFE_DATEI + '.tmp'
            with open(tmp, 'w', encoding='utf-8') as f:
                json.dump(daten, f)
            os.replace(tmp, ANRUFE_DATEI)
            anrufe_stand['fehler'] = None
        except Exception as e:   # Netz, Passwort, Format: Fehler melden, alten Stand behalten
            anrufe_stand['fehler'] = 'Portunity nicht erreichbar' if isinstance(e, OSError) else str(e)[:120]
        return daten, anrufe_stand['fehler']


def anrufe_roh(periode=None):
    # Diagnose: Aufbau der Antwort zeigen, Rufnummern (lange Ziffernfolgen) unkenntlich gemacht
    werte, verbindungen = portunity_abfragen(periode)
    maske = lambda t: re.sub(r'\d{6,}', lambda m: '#' * len(m.group()), t)
    return {'felder': {k: maske(v) for k, v in werte.items() if not re.fullmatch(r'WR_ConnectionsLog_\d+', k)},
            'anzahl': len(verbindungen), 'beispiele': [maske(v) for v in verbindungen[:15]]}


class Handler(BaseHTTPRequestHandler):
    server_version = 'LernenSync'

    def antwort(self, code, obj):
        body = json.dumps(obj, ensure_ascii=False).encode('utf-8')
        self.send_response(code)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.send_header('Cache-Control', 'no-store')
        self.end_headers()
        self.wfile.write(body)

    def state_name(self):
        # None = ungültiger Pfad, '' = Hauptdatensatz (Karten), sonst Name des Datensatzes
        m = STATE_RE.match(self.path.split('?')[0])
        return None if not m else (m.group(1) or '')

    # ---------- Dateien (PDF, Bilder) ----------
    def datei_pfad(self):
        name = urllib.parse.unquote(self.path.split('?')[0][len('/api/files/'):])
        if not NAME_RE.match(name) or os.path.splitext(name)[1].lower() not in TYPEN:
            return None, None
        return name, os.path.join(FILES, name)

    def datei_senden(self, mit_inhalt):
        name, pfad = self.datei_pfad()
        if not name:
            return self.antwort(400, {'fehler': 'Dateiname'})
        with sperre:
            if not os.path.isfile(pfad):
                return self.antwort(404, {'fehler': 'unbekannt'})
            meta = {}
            try:
                with open(pfad + '.meta', encoding='utf-8') as f:
                    meta = json.load(f)
            except (FileNotFoundError, ValueError):
                pass
            f = open(pfad, 'rb')   # Handle bleibt gültig, auch wenn die Datei währenddessen ersetzt wird
            groesse = os.path.getsize(pfad)
            updated = int(meta.get('updated') or os.path.getmtime(pfad))
        try:
            self.send_response(200)
            self.send_header('Content-Type', TYPEN[os.path.splitext(name)[1].lower()])
            self.send_header('Content-Length', str(groesse))
            self.send_header('Cache-Control', 'no-store')
            self.send_header('X-Updated', str(updated))
            self.send_header('X-Dateiname', urllib.parse.quote(meta.get('dateiname') or name))
            self.end_headers()
            if mit_inhalt:
                shutil.copyfileobj(f, self.wfile)
        finally:
            f.close()

    def datei_speichern(self):
        name, pfad = self.datei_pfad()
        if not name:
            return self.antwort(400, {'fehler': 'Dateiname'})
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_DATEI:
            return self.antwort(413, {'fehler': 'Größe'})
        tmp = pfad + '.tmp'
        rest = n
        with open(tmp, 'wb') as f:   # in Stücken lesen, damit große PDFs nicht den Speicher füllen
            while rest > 0:
                teil = self.rfile.read(min(65536, rest))
                if not teil:
                    break
                f.write(teil)
                rest -= len(teil)
        if rest > 0:
            os.remove(tmp)
            return self.antwort(400, {'fehler': 'abgebrochen'})
        updated = int(time.time())
        dateiname = urllib.parse.unquote(self.headers.get('X-Dateiname') or name)[:200]
        with sperre:
            if os.path.exists(pfad):
                sichern_datei(pfad, 'datei-')
            os.replace(tmp, pfad)
            with open(pfad + '.meta', 'w', encoding='utf-8') as f:
                json.dump({'updated': updated, 'dateiname': dateiname}, f, ensure_ascii=False)
        self.antwort(200, {'updated': updated})

    def datei_loeschen(self):
        name, pfad = self.datei_pfad()
        if not name:
            return self.antwort(400, {'fehler': 'Dateiname'})
        with sperre:
            if os.path.isfile(pfad):
                sichern_datei(pfad, 'geloescht-')
                os.remove(pfad)
                if os.path.exists(pfad + '.meta'):
                    os.remove(pfad + '.meta')
        self.antwort(200, {'geloescht': name})

    def do_HEAD(self):
        if self.path.startswith('/api/files/'):
            return self.datei_senden(False)
        self.antwort(404, {'fehler': 'unbekannt'})

    def do_DELETE(self):
        if self.path.startswith('/api/files/'):
            return self.datei_loeschen()
        self.antwort(404, {'fehler': 'unbekannt'})

    def anrufe_antwort(self):
        abfrage = urllib.parse.urlparse(self.path).query
        if 'roh=1' in abfrage:
            if not PORTUNITY_LOGIN or not PORTUNITY_CODE:
                return self.antwort(200, {'fehler': 'Portunity nicht eingerichtet'})
            try:
                periode = urllib.parse.parse_qs(abfrage).get('periode', [None])[0]
                return self.antwort(200, anrufe_roh(periode))
            except Exception as e:
                return self.antwort(200, {'fehler': 'Abfrage fehlgeschlagen: ' + type(e).__name__})
        daten, fehler = anrufe_aktualisieren()
        self.antwort(200, {'tage': daten['tage'], 'angenommen': daten['angenommen'],
                           'aktualisiert': int(anrufe_stand['zeit']), 'fehler': fehler})

    def do_GET(self):
        if self.path.split('?')[0] == '/api/anrufe':
            return self.anrufe_antwort()
        if self.path.startswith('/api/files/'):
            return self.datei_senden(True)
        name = self.state_name()
        if name is None:
            return self.antwort(404, {'fehler': 'unbekannt'})
        with sperre:
            d = lesen(datei_fuer(name))
        if d is None:
            return self.antwort(404, {'fehler': 'leer'})
        self.antwort(200, d)

    def do_PUT(self):
        if self.path.startswith('/api/files/'):
            return self.datei_speichern()
        name = self.state_name()
        if name is None:
            return self.antwort(404, {'fehler': 'unbekannt'})
        datei = datei_fuer(name)
        n = int(self.headers.get('Content-Length') or 0)
        if n <= 0 or n > MAX_BYTES:
            return self.antwort(413, {'fehler': 'Größe'})
        try:
            eingang = json.loads(self.rfile.read(n))
        except ValueError:
            return self.antwort(400, {'fehler': 'kein JSON'})
        if (not isinstance(eingang, dict) or 'stand' not in eingang
                or not isinstance(eingang.get('basis'), int)):
            return self.antwort(400, {'fehler': 'Format'})
        with sperre:
            alt = lesen(datei)
            aktuell = alt['version'] if alt else 0
            if eingang['basis'] != aktuell:
                return self.antwort(409, {'version': aktuell})
            if alt:
                sichern(datei, name)
            neu = {'version': aktuell + 1, 'updated': int(time.time()), 'state': eingang['stand']}
            schreiben(neu, datei)
        self.antwort(200, {'version': neu['version'], 'updated': neu['updated']})


if __name__ == '__main__':
    print('Lernen-Sync läuft auf %s:%d, Daten in %s' % (HOST, PORT, DATEN), flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
