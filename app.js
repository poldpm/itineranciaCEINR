// ============================================================
// CONFIGURACIÓ
// Substitueix la URL de sota per la del teu Apps Script Web App.
// ============================================================
const CONFIG = {
  SCRIPT_URL: "ENGANXA_AQUI_LA_URL_DEL_APPS_SCRIPT_ITINERANCIA"
};

// ---------- Claus d'emmagatzematge local ----------
const K_AREA = 'it_area';
const K_QUEUE = 'it_queue';

function getArea() { return localStorage.getItem(K_AREA) || ''; }
function setArea(v) { localStorage.setItem(K_AREA, v); }

function getQueue() {
  try { return JSON.parse(localStorage.getItem(K_QUEUE)) || []; }
  catch (e) { return []; }
}
function saveQueue(q) { localStorage.setItem(K_QUEUE, JSON.stringify(q)); }

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// ---------- Elements ----------
const screens = {
  area: document.getElementById('screen-area'),
  main: document.getElementById('screen-main'),
  form: document.getElementById('screen-form'),
  config: document.getElementById('screen-config'),
};

function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  screens[name].classList.add('active');
  window.scrollTo(0, 0);
}

function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 2400);
}

// ---------- Estat temporal (quin punt s'està omplint) ----------
let formActual = null; // { tipus: 'Tram'|'Aparcament', nom: '...' }

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
      entrarAMain();
    });
    cont.appendChild(btn);
  });
}

// ---------- Pantalla principal ----------
function entrarAMain() {
  const areaNom = getArea();
  const area = trobarArea(areaNom);
  if (!area) { showScreen('area'); return; }

  document.getElementById('nomAreaActiva').textContent = area.nom;

  pintarPunts('llistaTrams', area.trams, 'Tram');
  pintarPunts('llistaAparcaments', area.aparcaments, 'Aparcament');

  showScreen('main');
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

  camps.forEach(camp => {
    const wrap = document.createElement('div');
    wrap.className = 'camp';
    // els camps de text llarg i les escales ocupen tot l'ample; la resta, mitja columna
    if (camp.tipus === 'textarea' || camp.tipus === 'escala') wrap.classList.add('camp-ample');

    const label = document.createElement('label');
    label.textContent = camp.etiqueta + (camp.obligatori ? ' *' : '');
    label.setAttribute('for', 'camp_' + camp.id);
    wrap.appendChild(label);

    if (camp.tipus === 'number') {
      // Stepper: [−] [input] [+]
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
        input.value = Math.max(0, v - 1);
      });
      btnMes.addEventListener('click', () => {
        const v = parseInt(input.value || '0', 10);
        input.value = v + 1;
      });

      stepper.appendChild(btnMenys);
      stepper.appendChild(input);
      stepper.appendChild(btnMes);
      wrap.appendChild(stepper);
      cont.appendChild(wrap);
      return;
    }

    if (camp.tipus === 'escala') {
      // Escala de valoració: fila de cercles seleccionables amb etiquetes als extrems
      const escala = document.createElement('div');
      escala.className = 'escala';

      // input ocult que guarda el valor seleccionat
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
      cont.appendChild(wrap);
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

    cont.appendChild(wrap);
  });

  showScreen('form');
}

function desarFormulari() {
  const inputs = document.querySelectorAll('#formCamps .camp-input');
  const valors = {};
  let faltaObligatori = null;

  inputs.forEach(inp => {
    const val = inp.value.trim();
    valors[inp.dataset.campId] = val;
    if (inp.dataset.obligatori === '1' && !val && faltaObligatori === null) {
      faltaObligatori = inp.dataset.etiqueta;
    }
  });

  if (faltaObligatori) {
    toast('Falta omplir: ' + faltaObligatori);
    return;
  }

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

  trySync();
  entrarAMain();
}

// ---------- Comptadors / estat ----------
function updateCounters() {
  const pendents = getQueue().length;
  const badge = document.getElementById('pendents');
  const badgeConfig = document.getElementById('configPendents');
  badge.textContent = pendents > 0 ? `⏳ ${pendents} pendents` : '✓ Tot sincronitzat';
  badge.classList.toggle('zero', pendents === 0);
  if (badgeConfig) badgeConfig.textContent = pendents;
}

function updateConnexioIndicator() {
  const el = document.getElementById('estatConnexio');
  if (navigator.onLine) {
    el.textContent = '● Connectat';
    el.classList.remove('offline');
  } else {
    el.textContent = '● Sense connexió';
    el.classList.add('offline');
  }
}

// ---------- Sincronització ----------
let sincronitzant = false;

async function trySync() {
  if (sincronitzant) return;
  if (!navigator.onLine) { updateCounters(); return; }
  if (!CONFIG.SCRIPT_URL || CONFIG.SCRIPT_URL.startsWith('ENGANXA')) return;

  sincronitzant = true;
  let queue = getQueue();

  while (queue.length > 0) {
    const record = queue[0];
    try {
      const resp = await fetch(CONFIG.SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(record)
      });
      if (!resp.ok) throw new Error('resposta no OK');
      queue.shift();
      saveQueue(queue);
      updateCounters();
    } catch (e) {
      break;
    }
  }
  sincronitzant = false;
}

// ---------- Esdeveniments ----------
document.getElementById('btnCanviarArea').addEventListener('click', () => {
  pintarArees();
  showScreen('area');
});

document.getElementById('btnDesarForm').addEventListener('click', desarFormulari);
document.getElementById('btnCancelarForm').addEventListener('click', entrarAMain);

document.getElementById('btnConfig').addEventListener('click', () => {
  document.getElementById('configArea').textContent = getArea() || '(cap)';
  updateCounters();
  showScreen('config');
});

document.getElementById('btnTancarConfig').addEventListener('click', entrarAMain);

document.getElementById('btnSincronitzarAra').addEventListener('click', () => {
  trySync().then(() => toast('Sincronització intentada'));
});

window.addEventListener('online', () => { updateConnexioIndicator(); trySync(); });
window.addEventListener('offline', updateConnexioIndicator);

// ---------- Inicialització ----------
function init() {
  updateConnexioIndicator();

  if (getArea() && trobarArea(getArea())) {
    entrarAMain();
  } else {
    pintarArees();
    showScreen('area');
  }

  updateCounters();
  trySync();
  setInterval(trySync, 30000);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
}

init();
