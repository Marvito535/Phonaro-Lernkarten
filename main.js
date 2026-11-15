import CardStore  from './cardstore.js';
import PhonaroApp from './PhonaroApp.js';
import Skript     from './skript.js';
import Pomodoro   from './pomodoro.js';
import Fenster from './fenster.js';
import Sync from './sync.js';


const store = new CardStore();
const app = new PhonaroApp(store);
app.init();   // zuerst die Karten, damit sie nicht auf das Laden von pdf.js warten
new Fenster().init();

new Pomodoro('#pomodoro').init();
const skript = new Skript('#skript');
await skript.init();

// Abgleich nur auf dem Server, nicht in der lokalen Version
if (location.hostname === 'desk.phonaro.de') {
  new Sync({
    lesen: () => store.state,
    schreiben: stand => { store.state = stand; store.save(); app.buildQueue(); app.render(); },
    status: '#sync'
  }).init();
}