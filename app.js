// ============================================================
// CONFIGURACIÓ
// Substitueix la URL de sota per la del teu Apps Script Web App.
// ============================================================
const CONFIG = {
  SCRIPT_URL: "https://script.google.com/macros/s/AKfycbxvwXfBN6Gf5j7sNaa3poXKZbLx8WxRNZun_gZxlctbUC2E4WVrp6ayXTah_X33gTHZ/exec"
};

// ---------- Claus d'emmagatzematge local ----------
const K_AREA = 'it_area';
const K_DATA = 'it_data';   // data (YYYY-MM-DD) de l'última selecció d'àrea
const K_QUEUE = 'it_queue';

function getArea() { return localStorage.getItem(K_AREA) || ''; }
// En desar l'àrea hi guardem també la data d'avui, per saber si la
// selecció és d'avui o d'un dia anterior (avuiISO està definida a sota).
function setArea(v) { localStorage.setItem(K_AREA, v); localStorage.setItem(K_DATA, avuiISO()); }
function getDataSeleccio() { return localStorage.getItem(K_DATA) || ''; }

// Hi ha sessió activa d'AVUI? (àrea vàlida triada, i triada avui mateix)
function sessioAvui() {
  return !!(getArea() && trobarArea(getArea()) && getDataSeleccio() === avuiISO());
}

function getQueue() {
  try { return JSON.parse(localStorage.getItem(K_QUEUE)) || []; }
  catch (e) { return []; }
}
function saveQueue(q) {
  try { localStorage.setItem(K_QUEUE, JSON.stringify(q)); }
  catch (e) { /* emmagatzematge ple o no disponible */ }
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Data d'avui en format YYYY-MM-DD (hora local), per saber si la selecció
// d'àrea és d'avui o d'un dia anterior.
function avuiISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

// ---------- Elements ----------
const screens = {
  area: document.getElementById('screen-area'),
  main: document.getElementById('screen-main'),
  form: document.getElementById('screen-form'),
  config: document.getElementById('screen-config'),
};

// Pantalla actualment visible (per saber on som en tot moment)
let pantallaActual = null;

// Mostra una pantalla. Si empenyHistoric=true, afegeix una entrada a
// l'historial del navegador perquè el gest/botó "enrere" hi pugui tornar.
function showScreen(name, empenyHistoric) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
  pantallaActual = name;

  if (empenyHistoric) {
    history.pushState({ pantalla: name }, '');
  }
}

// Gestió del botó/gest "enrere" del dispositiu.
// En lloc de tancar l'app, tornem a la pantalla anterior segons on siguem.
window.addEventListener('popstate', function (e) {
  // Des del formulari -> tornar a la llista de trams/aparcaments (principal)
  if (pantallaActual === 'form') {
    entrarAMain(false);
    return;
  }
  // Des de configuració -> tornar a la principal
  if (pantallaActual === 'config') {
    entrarAMain(false);
    return;
  }
  // Des de la selecció d'àrea:
  //  - si venim de "Canviar àrea" (ja hi ha àrea activa) -> tornar a principal
  //  - si és la selecció inicial (sense àrea) -> deixem sortir de l'app
  if (pantallaActual === 'area') {
    if (sessioAvui()) {
      entrarAMain(false);
    }
    // si no hi ha sessió d'avui, no fem res especial: és la pantalla inicial
    return;
  }
  // Des de la pantalla principal -> reafirmem l'estat perquè el botó
  // enrere no tanqui l'app per accident (l'usuari pot sortir insistint,
  // o fent servir el botó d'inici del dispositiu).
  if (pantallaActual === 'main') {
    history.pushState({ pantalla: 'main' }, '');
    return;
  }
});

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  if (toastTimer) clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Estat temporal (quin punt s'està omplint) ----------
let formActual = null;

// ---------- Trobar una àrea per nom ----------
function trobarArea(nom) {
  return DADES.arees.find(a => a.nom === nom) || null;
}

// ---------- Pantalla selecció d'àrea ----------
function pintarArees() {
  const cont = document.getElementById('llistaArees');
  cont.innerHTML = '';
  DADES.arees.forEach(area => {
    const btn = document.createElement('button');
    btn.className = 'area-btn';
    btn.textContent = area.nom;
    btn.addEventListener('click', () => {
      setArea(area.nom);
      entrarAMain(true);
    });
    cont.appendChild(btn);
  });
}

// ---------- Pantalla principal ----------
// empenyHistoric=true quan hi arribem "endavant" (p. ex. en triar l'àrea).
// Quan hi tornem "enrere" des del formulari, es passa false.
function entrarAMain(empenyHistoric) {
  const areaNom = getArea();
  const area = trobarArea(areaNom);
  if (!area) { pintarArees(); showScreen('area'); return; }

  document.getElementById('nomAreaActiva').textContent = area.nom;

  pintarPunts('llistaTrams', area.trams, 'Tram');
  pintarPunts('llistaAparcaments', area.aparcaments, 'Aparcament');

  showScreen('main', empenyHistoric === true);
}

function pintarPunts(contId, punts, tipus) {
  const cont = document.getElementById(contId);
  cont.innerHTML = '';
  if (!punts || punts.length === 0) {
    cont.innerHTML = '<p class="buit">Cap element definit per aquesta àrea.</p>';
    return;
  }
  punts.forEach(punt => {
    const btn = document.createElement('button');
    btn.className = 'punt-btn';

    const badge = document.createElement('span');
    badge.className = 'punt-num';
    badge.textContent = punt.num;

    const text = document.createElement('span');
    text.className = 'punt-text';
    text.textContent = punt.nom;

    btn.appendChild(badge);
    btn.appendChild(text);
    btn.addEventListener('click', () => obrirFormulari(tipus, punt.num, punt.nom));
    cont.appendChild(btn);
  });
}

// ---------- Formulari dinàmic ----------
function obrirFormulari(tipus, num, nom) {
  formActual = { tipus, num, nom };

  document.getElementById('formTipus').textContent =
    tipus === 'Tram' ? '🥾 Tram' : '🅿️ Aparcament';
  document.getElementById('formTitol').textContent = num + '. ' + nom;
  document.getElementById('formArea').textContent = getArea();

  const cont = document.getElementById('formCamps');
  cont.innerHTML = '';

  const area = trobarArea(getArea());
  const camps = (area && area.camps) ? area.camps : [];

  // Contenidor on van els camps compactes consecutius (perquè es reparteixin
  // l'espai equitativament i quedin de costat, ompliguin o no la fila sencera).
  let grupCompacte = null;

  // Col·loca un camp: si és compacte, dins d'un grup flex (creant-lo si cal);
  // si no, directament al contenidor principal (i tanca el grup compacte obert).
  const colocar = (wrap, camp) => {
    if (camp.compacte) {
      if (!grupCompacte) {
        grupCompacte = document.createElement('div');
        grupCompacte.className = 'grup-compacte';
        cont.appendChild(grupCompacte);
      }
      grupCompacte.appendChild(wrap);
    } else {
      grupCompacte = null;
      cont.appendChild(wrap);
    }
  };

  camps.forEach(camp => {
    const wrap = document.createElement('div');
    wrap.className = 'camp';
    if (camp.tipus === 'textarea' || camp.tipus === 'escala') wrap.classList.add('camp-ample');
    if (camp.compacte) wrap.classList.add('camp-compacte');

    const label = document.createElement('label');
    label.textContent = camp.etiqueta + (camp.obligatori ? ' *' : '');
    label.setAttribute('for', 'camp_' + camp.id);
    wrap.appendChild(label);

    if (camp.tipus === 'number') {
      const stepper = document.createElement('div');
      stepper.className = 'stepper';

      const btnMenys = document.createElement('button');
      btnMenys.type = 'button';
      btnMenys.className = 'stepper-btn';
      btnMenys.textContent = '−';

      const input = document.createElement('input');
      input.type = 'number';
      input.inputMode = 'numeric';
      input.className = 'camp-input stepper-input';
      input.id = 'camp_' + camp.id;
      input.dataset.campId = camp.id;
      input.dataset.obligatori = camp.obligatori ? '1' : '0';
      input.dataset.etiqueta = camp.etiqueta;
      input.placeholder = '0';
      input.min = '0';

      const btnMes = document.createElement('button');
      btnMes.type = 'button';
      btnMes.className = 'stepper-btn';
      btnMes.textContent = '+';

      btnMenys.addEventListener('click', () => {
        const v = parseInt(input.value || '0', 10);
        input.value = Math.max(0, (isNaN(v) ? 0 : v) - 1);
      });
      btnMes.addEventListener('click', () => {
        const v = parseInt(input.value || '0', 10);
        input.value = (isNaN(v) ? 0 : v) + 1;
      });

      stepper.appendChild(btnMenys);
      stepper.appendChild(input);
      stepper.appendChild(btnMes);
      wrap.appendChild(stepper);
      colocar(wrap, camp);
      return;
    }

    if (camp.tipus === 'escala') {
      const escala = document.createElement('div');
      escala.className = 'escala';

      const hidden = document.createElement('input');
      hidden.type = 'hidden';
      hidden.className = 'camp-input';
      hidden.id = 'camp_' + camp.id;
      hidden.dataset.campId = camp.id;
      hidden.dataset.obligatori = camp.obligatori ? '1' : '0';
      hidden.dataset.etiqueta = camp.etiqueta;
      hidden.value = '';

      const etiqMin = document.createElement('span');
      etiqMin.className = 'escala-extrem';
      etiqMin.textContent = camp.etiquetaMin || 'Poques';

      const cercles = document.createElement('div');
      cercles.className = 'escala-cercles';

      const opcions = camp.opcions || ['1', '2', '3', '4', '5'];
      opcions.forEach(op => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'escala-cercle';
        b.textContent = op;
        b.addEventListener('click', () => {
          hidden.value = op;
          cercles.querySelectorAll('.escala-cercle').forEach(c => c.classList.remove('sel'));
          b.classList.add('sel');
        });
        cercles.appendChild(b);
      });

      const etiqMax = document.createElement('span');
      etiqMax.className = 'escala-extrem';
      etiqMax.textContent = camp.etiquetaMax || 'Moltes';

      escala.appendChild(etiqMin);
      escala.appendChild(cercles);
      escala.appendChild(etiqMax);
      wrap.appendChild(escala);
      wrap.appendChild(hidden);
      colocar(wrap, camp);
      return;
    }

    let input;
    if (camp.tipus === 'select') {
      input = document.createElement('select');
      const buida = document.createElement('option');
      buida.value = '';
      buida.textContent = '— Selecciona —';
      input.appendChild(buida);
      (camp.opcions || []).forEach(op => {
        const o = document.createElement('option');
        o.value = op; o.textContent = op;
        input.appendChild(o);
      });
    } else if (camp.tipus === 'textarea') {
      input = document.createElement('textarea');
      input.rows = 2;
    } else {
      input = document.createElement('input');
      input.type = 'text';
    }
    input.id = 'camp_' + camp.id;
    input.className = 'camp-input';
    input.dataset.campId = camp.id;
    input.dataset.obligatori = camp.obligatori ? '1' : '0';
    input.dataset.etiqueta = camp.etiqueta;
    wrap.appendChild(input);

    colocar(wrap, camp);
  });

  showScreen('form', true);
}

// evita desar dues vegades si es fa doble clic al botó
let desantAra = false;

function desarFormulari() {
  if (desantAra) return;

  const inputs = document.querySelectorAll('#formCamps .camp-input');
  const valors = {};
  let faltaObligatori = null;

  inputs.forEach(inp => {
    const val = (inp.value || '').trim();
    valors[inp.dataset.campId] = val;
    if (inp.dataset.obligatori === '1' && !val && faltaObligatori === null) {
      faltaObligatori = inp.dataset.etiqueta;
    }
  });

  if (faltaObligatori) {
    toast('Falta omplir: ' + faltaObligatori);
    return;
  }

  desantAra = true;

  const record = {
    id: uid(),
    timestamp: new Date().toISOString(),
    area: getArea(),
    tipus: formActual.tipus,
    num: formActual.num,
    punt: formActual.nom,
    valors: valors
  };

  const queue = getQueue();
  queue.push(record);
  saveQueue(queue);

  updateCounters();
  toast('✅ Registre desat: ' + formActual.num + '. ' + formActual.nom);
  document.getElementById('ultimRegistre').textContent =
    'Últim registre: ' + formActual.tipus + ' "' + formActual.num + '. ' + formActual.nom + '" a les ' +
    new Date().toLocaleTimeString('ca-ES', { hour: '2-digit', minute: '2-digit' });

  desantAra = false;

  // Tornem a la pantalla principal traient l'entrada del formulari de
  // l'historial (així el gest "enrere" no reobre un formulari ja desat).
  // El popstate resultant crida entrarAMain(false).
  if (history.state && history.state.pantalla === 'form') {
    history.back();
  } else {
    entrarAMain(false);
  }

  // sincronitza en segon pla (no bloqueja la interfície)
  trySync();
  // i demana al navegador que ho reintenti en segon pla si perd la connexió
  demanarBackgroundSync();
}

// ---------- Comptadors / estat ----------
function updateCounters() {
  const pendents = getQueue().length;
  const badge = document.getElementById('pendents');
  const badgeConfig = document.getElementById('configPendents');
  if (badge) {
    badge.textContent = pendents > 0 ? `⏳ ${pendents} per enviar` : '✓ Tot desat al full';
    badge.classList.toggle('zero', pendents === 0);
  }
  if (badgeConfig) badgeConfig.textContent = pendents;
}

function updateConnexioIndicator() {
  const el = document.getElementById('estatConnexio');
  if (!el) return;
  if (navigator.onLine) {
    el.textContent = '● Connectat';
    el.classList.remove('offline');
  } else {
    el.textContent = '● Sense connexió';
    el.classList.add('offline');
  }
}

// ---------- Sincronització ----------
// Estratègia fiable:
//  - Enviem els registres D'UN EN UN al servidor.
//  - El servidor confirma amb un GET de comprovació (retorna els id ja rebuts),
//    però com que amb Apps Script no podem llegir la resposta directament de
//    manera fiable des d'un altre domini, fem servir un enviament amb resposta
//    JSON i el paràmetre callback (JSONP) per confirmar l'entrega.
//  - Un registre només s'elimina de la cua quan el servidor n'ha confirmat l'id.

let sincronitzant = false;

function enviarRegistreJSONP(record, timeoutMs) {
  return new Promise((resolve, reject) => {
    const cbName = 'cb_' + record.id;
    let acabat = false;

    const netejar = () => {
      if (script && script.parentNode) script.parentNode.removeChild(script);
      try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
      if (timer) clearTimeout(timer);
    };

    window[cbName] = (resposta) => {
      if (acabat) return;
      acabat = true;
      netejar();
      if (resposta && resposta.ok) resolve(resposta);
      else reject(new Error(resposta && resposta.error ? resposta.error : 'error servidor'));
    };

    const dades = encodeURIComponent(JSON.stringify(record));
    const url = CONFIG.SCRIPT_URL +
      (CONFIG.SCRIPT_URL.indexOf('?') === -1 ? '?' : '&') +
      'callback=' + cbName + '&payload=' + dades;

    const script = document.createElement('script');
    script.src = url;
    script.onerror = () => {
      if (acabat) return;
      acabat = true;
      netejar();
      reject(new Error('error de xarxa'));
    };

    const timer = setTimeout(() => {
      if (acabat) return;
      acabat = true;
      netejar();
      reject(new Error('temps esgotat'));
    }, timeoutMs || 15000);

    document.body.appendChild(script);
  });
}

async function trySync() {
  if (sincronitzant) return;
  if (!navigator.onLine) { updateCounters(); return; }
  if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.indexOf('ENGANXA') === 0) return;

  sincronitzant = true;
  try {
    let queue = getQueue();
    while (queue.length > 0) {
      const record = queue[0];
      try {
        await enviarRegistreJSONP(record, 15000);
        // èxit confirmat pel servidor: el traiem de la cua
        queue = getQueue();
        queue = queue.filter(r => r.id !== record.id);
        saveQueue(queue);
        updateCounters();
      } catch (e) {
        // fallada temporal: ho deixem per al proper intent, sense duplicar
        break;
      }
    }
  } finally {
    sincronitzant = false;
  }
}

// ---------- Esdeveniments ----------
// Funció auxiliar: torna enrere de manera segura (treu l'entrada actual
// de l'historial si n'hi ha, o va a la principal si no).
function tornarEnrere() {
  if (history.state && (history.state.pantalla === 'form' || history.state.pantalla === 'config' || history.state.pantalla === 'area')) {
    history.back();
  } else {
    entrarAMain(false);
  }
}

document.getElementById('btnCanviarArea').addEventListener('click', () => {
  pintarArees();
  showScreen('area', true);
});

document.getElementById('btnDesarForm').addEventListener('click', desarFormulari);
document.getElementById('btnCancelarForm').addEventListener('click', tornarEnrere);

document.getElementById('btnConfig').addEventListener('click', () => {
  document.getElementById('configArea').textContent = getArea() || '(cap)';
  updateCounters();
  showScreen('config', true);
});

document.getElementById('btnTancarConfig').addEventListener('click', tornarEnrere);

document.getElementById('btnSincronitzarAra').addEventListener('click', () => {
  toast('Enviant registres pendents…');
  trySync().then(() => {
    const p = getQueue().length;
    toast(p === 0 ? '✓ Tot enviat al full' : `Encara queden ${p} per enviar`);
  });
});

// ---- Disparadors de sincronització ----
// L'objectiu: pujar els registres pendents tan aviat com sigui possible
// quan l'app "reviu" (recupera connexió, es desbloqueja la tablet, es torna
// a l'app, etc.), sense esperes.

// Recuperació de connexió
window.addEventListener('online', () => { updateConnexioIndicator(); trySync(); });
window.addEventListener('offline', updateConnexioIndicator);

// L'app torna a ser visible (desbloqueig de la tablet, tornar a l'app...)
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) { updateConnexioIndicator(); trySync(); }
});

// La finestra recupera el focus (canvi d'app, desbloqueig)
window.addEventListener('focus', () => { updateConnexioIndicator(); trySync(); });

// L'app es torna a mostrar des de la memòria cau del navegador
window.addEventListener('pageshow', () => { updateConnexioIndicator(); trySync(); });

// Si el service worker avisa que hi ha connexió (background sync a Android),
// intentem sincronitzar també des d'aquí.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.tipus === 'sync-pendents') {
      trySync();
    }
  });
}

// Registrem una petició de Background Sync (funciona a Android/Chrome;
// a Apple s'ignora silenciosament, però la resta de disparadors ja cobreixen
// el cas). Es torna a demanar cada cop que desem un registre nou.
function demanarBackgroundSync() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.ready.then((reg) => {
    if (reg.sync) {
      reg.sync.register('sync-registres').catch(() => {});
    }
  }).catch(() => {});
}

// ---------- Inicialització ----------
function init() {
  updateConnexioIndicator();

  // Estat base de l'historial (evita que el primer "enrere" tanqui l'app)
  history.replaceState({ pantalla: 'base' }, '');

  // Cada jornada (dia nou) tornem a demanar l'àrea: només entrem directes
  // si la selecció és d'AVUI. Si és d'un dia anterior, mostrem la selecció.
  if (sessioAvui()) {
    entrarAMain(false);
  } else {
    pintarArees();
    showScreen('area');
  }

  updateCounters();
  trySync();
  setInterval(trySync, 8000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').then((reg) => {
      // Intent d'activar la sincronització periòdica en segon pla (Android/Chrome).
      // Si el navegador no ho permet (Apple, o sense permís), s'ignora.
      if ('periodicSync' in reg) {
        reg.periodicSync.register('sync-registres-periodic', {
          minInterval: 15 * 60 * 1000 // cada 15 min com a mínim
        }).catch(() => {});
      }
    }).catch(() => {});
  }
}

init();
