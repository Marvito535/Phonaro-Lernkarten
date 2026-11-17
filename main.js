import CardStore  from './cardstore.js';
import PhonaroApp from './PhonaroApp.js';
import Skript     from './skript.js';
import Pomodoro   from './pomodoro.js';
import Fenster    from './fenster.js';
import Sync       from './sync.js';
import Bilder     from './bilder.js';
import Ziele from './ziele.js';


const aufServer = location.hostname === 'desk.phonaro.de';   // Server-Funktionen nur dort

const store = new CardStore();
const bilder = await new Bilder({ server: aufServer ? '/api/files/' : null }).init();
const app = new PhonaroApp(store, bilder);
app.init();   // zuerst die Karten, damit sie nicht auf das Laden von pdf.js warten
new Fenster().init();

const ziele = new Ziele('#ziele', { karten: () => store.state.log[store.day()] || 0 }).init();
if (aufServer) {
  new Sync({
    url: '/api/state/ziele',
    ereignis: 'ziele:geaendert',
    metaKey: 'phonaro-sync-ziele',
    lesen: () => ziele.stand,
    schreiben: stand => ziele.uebernehmen(stand),
    beschreiben: stand => ziele.beschreibung(stand)
  }).init();
}

new Pomodoro('#pomodoro').init();

// Karten-Abgleich mit dem Server (nicht in der lokalen Version)
if (aufServer) {
  new Sync({
    lesen: () => store.state,
    schreiben: stand => { store.state = stand; store.save(); app.buildQueue(); app.render(); },
    status: '#sync'
  }).init();
}

// Skript zuletzt, weil es auf pdf.js und das PDF vom Server warten kann
const skript = new Skript('#skript', {
  server: aufServer ? '/api/files/skript.pdf' : null
});
await skript.init();

