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
# Vor jedem Überschreiben bleibt der alte Stand als Backup erhalten:
#   backups/tag-JJJJMMTT.json     erste Sicherung jedes Tages (90 Tage lang)
#   backups/stand-...json         laufende Sicherungen, höchstens alle 10 Minuten (letzte 200)

import json
import os
import shutil
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HOST, PORT = '127.0.0.1', 8787
DATEN = os.environ.get('STATE_DIRECTORY', './daten')   # systemd setzt STATE_DIRECTORY
BACKUPS = os.path.join(DATEN, 'backups')
DATEI = os.path.join(DATEN, 'state.json')
MAX_BYTES = 20 * 1024 * 1024
sperre = threading.Lock()   # verhindert, dass zwei Anfragen gleichzeitig schreiben

os.makedirs(BACKUPS, exist_ok=True)


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

    def do_GET(self):
        if not self.pfad_ok():
            return self.antwort(404, {'fehler': 'unbekannt'})
        with sperre:
            d = lesen()
        if d is None:
            return self.antwort(404, {'fehler': 'leer'})
        self.antwort(200, d)

    def do_PUT(self):
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
