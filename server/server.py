#!/usr/bin/env python3
# Kleiner Sicherungsdienst für die Lernapp. Nur Python-Standardbibliothek.
#
# Läuft nur auf 127.0.0.1 und ist von außen nicht erreichbar. Caddy schützt den
# Zugang mit Passwort und leitet /api/ hierher.
#
#   GET /api/state  liefert {"version", "updated", "state"} oder 404, wenn noch leer
#   PUT /api/state  erwartet {"basis": <bekannte Version>, "stand": {...}}
#                   Stimmt "basis" nicht mit der Serverversion überein: 409 (Konflikt)
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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = '127.0.0.1', 8787
DATEN = os.environ.get('STATE_DIRECTORY', './daten')   # systemd setzt STATE_DIRECTORY
BACKUPS = os.path.join(DATEN, 'backups')
DATEI = os.path.join(DATEN, 'state.json')
MAX_BYTES = 20 * 1024 * 1024           # Kartendaten
MAX_DATEI = 100 * 1024 * 1024          # einzelne Datei (PDF, Bild)
FILES = os.path.join(DATEN, 'files')
NAME_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]{0,99}$')
TYPEN = {'.pdf': 'application/pdf', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp'}
sperre = threading.Lock()   # verhindert, dass zwei Anfragen gleichzeitig schreiben

os.makedirs(BACKUPS, exist_ok=True)
os.makedirs(FILES, exist_ok=True)


def lesen():
    try:
        with open(DATEI, encoding='utf-8') as f:
            return json.load(f)
    except FileNotFoundError:
        return None


def schreiben(obj):
    tmp = DATEI + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False)
    os.replace(tmp, DATEI)   # atomar: entweder der alte oder der neue Stand, nie halb geschrieben


def sichern():
    jetzt = time.time()
    tag = os.path.join(BACKUPS, 'tag-' + time.strftime('%Y%m%d') + '.json')
    if not os.path.exists(tag):
        shutil.copyfile(DATEI, tag)
    laufend = sorted(f for f in os.listdir(BACKUPS) if f.startswith('stand-'))
    if not laufend or jetzt - os.path.getmtime(os.path.join(BACKUPS, laufend[-1])) > 600:
        shutil.copyfile(DATEI, os.path.join(BACKUPS, 'stand-' + time.strftime('%Y%m%d-%H%M%S') + '.json'))
    for prefix, behalten in (('stand-', 200), ('tag-', 90)):
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

    def pfad_ok(self):
        return self.path.split('?')[0] == '/api/state'

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

    def do_GET(self):
        if self.path.startswith('/api/files/'):
            return self.datei_senden(True)
        if not self.pfad_ok():
            return self.antwort(404, {'fehler': 'unbekannt'})
        with sperre:
            d = lesen()
        if d is None:
            return self.antwort(404, {'fehler': 'leer'})
        self.antwort(200, d)

    def do_PUT(self):
        if self.path.startswith('/api/files/'):
            return self.datei_speichern()
        if not self.pfad_ok():
            return self.antwort(404, {'fehler': 'unbekannt'})
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
            alt = lesen()
            aktuell = alt['version'] if alt else 0
            if eingang['basis'] != aktuell:
                return self.antwort(409, {'version': aktuell})
            if alt:
                sichern()
            neu = {'version': aktuell + 1, 'updated': int(time.time()), 'state': eingang['stand']}
            schreiben(neu)
        self.antwort(200, {'version': neu['version'], 'updated': neu['updated']})


if __name__ == '__main__':
    print('Lernen-Sync läuft auf %s:%d, Daten in %s' % (HOST, PORT, DATEN), flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()
