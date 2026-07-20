// ============================================================
// VISOR DE MAPA amb LOCALITZADOR GPS
// ------------------------------------------------------------
// Mostra el mapa oficial de l'àrea (imatge) i, a sobre, un punt
// blau amb la posició GPS de l'usuari.
//
// Com que el mapa és una imatge, cal "calibrar-lo" un cop: dir a
// quines coordenades GPS reals corresponen dos punts de la imatge.
// Amb dos punts de referència es pot situar qualsevol coordenada.
//
// La calibració es desa a localStorage per àrea, així que només
// s'ha de fer una vegada per àrea i dispositiu.
// ============================================================

const Mapa = (function () {
  'use strict';

  // Mapa d'imatge per àrea (nom d'àrea -> fitxer)
  const MAPES = {
    'AI Serra Cavallera': 'images/mapa-cavallera.jpg',
    'AI Serra de Montgrony Nord': 'images/mapa-montgrony-nord.jpg',
    'AI Serra de Montgrony Sud': 'images/mapa-montgrony-sud.jpg'
  };

  // Estat del visor
  let areaActual = null;
  let imgW = 0, imgH = 0;          // mida natural de la imatge
  let escala = 1, offX = 0, offY = 0;  // transformació de la vista (zoom/pan)
  let calib = null;                // { p1:{px,py,lat,lng}, p2:{...} }
  let watchId = null;              // id del watchPosition
  let ultimaPos = null;            // última coordenada GPS { lat, lng, acc }

  // Estat de la calibració en curs
  let calibrant = false;
  let calibPas = 0;                // 0=cap, 1=esperant clic p1, 2=esperant clic p2
  let calibTemp = {};
  let puntPendent = null;          // píxel tocat, a l'espera d'enganxar-ne les coords

  // Elements
  let overlay, viewport, mon, img, loc, estat, titol;

  // ---------- Inicialització ----------
  function init() {
    overlay = document.getElementById('mapaOverlay');
    viewport = document.getElementById('mapaViewport');
    mon = document.getElementById('mapaMon');
    img = document.getElementById('mapaImg');
    loc = document.getElementById('localitzador');
    estat = document.getElementById('mapaEstat');
    titol = document.getElementById('mapaTitol');

    document.getElementById('btnMapa').addEventListener('click', obrir);
    document.getElementById('mapaTancar').addEventListener('click', tancar);
    document.getElementById('mapaCentrar').addEventListener('click', centrarEnMi);
    document.getElementById('btnCalibrar').addEventListener('click', iniciarCalibracio);
    document.getElementById('calibCancelar').addEventListener('click', cancelarCalibracio);
    document.getElementById('calibAccio').addEventListener('click', accioCalibracio);

    configurarGestos();

    // Clic sobre el mapa (per calibrar)
    mon.addEventListener('click', onClicMapa);
  }

  // ---------- Obrir / tancar ----------
  function obrir() {
    areaActual = (typeof getArea === 'function') ? getArea() : null;
    if (!areaActual) {
      alert('Primer tria una àrea a la pantalla principal.');
      return;
    }
    if (!MAPES[areaActual]) {
      alert('Encara no hi ha mapa per a "' + areaActual.replace('AI ', '') + '".');
      return;
    }
    titol.textContent = areaActual.replace('AI ', '');
    calib = carregarCalib(areaActual);

    // Si hi havia una calibració a mitges (primer punt fet), la reprenem
    const parcial = carregarCalibParcial(areaActual);
    if (!calib && parcial && parcial.p1) {
      calibTemp = parcial;
    }

    // Carregar la imatge
    img.onload = function () {
      imgW = img.naturalWidth;
      imgH = img.naturalHeight;
      mon.style.width = imgW + 'px';
      mon.style.height = imgH + 'px';
      encaixar();
      overlay.classList.add('obert');
      history.pushState({ mapa: true }, '');
      iniciarGPS();
    };
    img.src = MAPES[areaActual];

    actualitzarEstatCalib();
  }

  function tancar() {
    overlay.classList.remove('obert');
    aturarGPS();
    if (calibrant) cancelarCalibracio();
    if (history.state && history.state.mapa) history.back();
  }

  // Tancar amb el botó enrere del mòbil
  window.addEventListener('popstate', function () {
    if (overlay.classList.contains('obert')) {
      overlay.classList.remove('obert');
      aturarGPS();
    }
  });

  // ---------- Encaixar la imatge a la pantalla ----------
  function encaixar() {
    const vw = viewport.clientWidth;
    const vh = viewport.clientHeight;
    const escX = vw / imgW;
    const escY = vh / imgH;
    escala = Math.min(escX, escY);
    offX = (vw - imgW * escala) / 2;
    offY = (vh - imgH * escala) / 2;
    aplicarTransform();
  }

  function aplicarTransform() {
    mon.style.transform = 'translate(' + offX + 'px,' + offY + 'px) scale(' + escala + ')';
    mon.style.transformOrigin = '0 0';
  }

  // ---------- Zoom i desplaçament (gestos tàctils) ----------
  function configurarGestos() {
    let arrossegant = false, iniX = 0, iniY = 0, iniOffX = 0, iniOffY = 0;
    let pinç = false, distIni = 0, escIni = 1, centreIni = null;

    viewport.addEventListener('touchstart', function (e) {
      if (e.touches.length === 1) {
        arrossegant = true; pinç = false;
        iniX = e.touches[0].clientX; iniY = e.touches[0].clientY;
        iniOffX = offX; iniOffY = offY;
      } else if (e.touches.length === 2) {
        pinç = true; arrossegant = false;
        distIni = dist(e.touches);
        escIni = escala;
        centreIni = centre(e.touches, viewport);
      }
    }, { passive: true });

    viewport.addEventListener('touchmove', function (e) {
      if (pinç && e.touches.length === 2) {
        const d = dist(e.touches);
        const nova = Math.max(0.05, Math.min(8, escIni * (d / distIni)));
        // zoom mantenint el centre del pinçament
        const c = centreIni;
        const mx = (c.x - offX) / escala;
        const my = (c.y - offY) / escala;
        escala = nova;
        offX = c.x - mx * escala;
        offY = c.y - my * escala;
        aplicarTransform();
        posarLocalitzador();
        e.preventDefault();
      } else if (arrossegant && e.touches.length === 1) {
        offX = iniOffX + (e.touches[0].clientX - iniX);
        offY = iniOffY + (e.touches[0].clientY - iniY);
        aplicarTransform();
      }
    }, { passive: false });

    viewport.addEventListener('touchend', function (e) {
      if (e.touches.length === 0) { arrossegant = false; pinç = false; }
    });

    // Zoom amb roda (ordinador, per proves)
    viewport.addEventListener('wheel', function (e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.15 : 0.87;
      const nova = Math.max(0.05, Math.min(8, escala * factor));
      const rect = viewport.getBoundingClientRect();
      const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
      const mx = (cx - offX) / escala, my = (cy - offY) / escala;
      escala = nova;
      offX = cx - mx * escala; offY = cy - my * escala;
      aplicarTransform();
      posarLocalitzador();
    }, { passive: false });
  }

  function dist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }
  function centre(t, el) {
    const r = el.getBoundingClientRect();
    return { x: (t[0].clientX + t[1].clientX) / 2 - r.left, y: (t[0].clientY + t[1].clientY) / 2 - r.top };
  }

  // ---------- GPS ----------
  function iniciarGPS() {
    if (!navigator.geolocation) {
      estat.textContent = '⚠️ Aquest dispositiu no té GPS disponible.';
      estat.className = 'mapa-estat avis';
      return;
    }
    estat.textContent = '📡 Buscant la teva posició…';
    estat.className = 'mapa-estat';
    watchId = navigator.geolocation.watchPosition(
      function (pos) {
        ultimaPos = { lat: pos.coords.latitude, lng: pos.coords.longitude, acc: pos.coords.accuracy };
        onNovaPos();
      },
      function (err) {
        let m = '⚠️ No es pot obtenir la posició.';
        if (err.code === 1) m = '⚠️ Has de permetre l\'accés a la ubicació.';
        else if (err.code === 3) m = '⚠️ El GPS triga massa. Prova a l\'aire lliure.';
        estat.textContent = m;
        estat.className = 'mapa-estat avis';
      },
      { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 }
    );
  }

  function aturarGPS() {
    if (watchId !== null) { navigator.geolocation.clearWatch(watchId); watchId = null; }
  }

  function onNovaPos() {
    if (!calib) {
      estat.innerHTML = '📍 Posició rebuda (±' + Math.round(ultimaPos.acc) + ' m). ' +
        '<b>El mapa encara no està calibrat</b> — prem «Calibrar».';
      estat.className = 'mapa-estat avis';
      return;
    }
    estat.textContent = '📍 La teva posició · precisió ±' + Math.round(ultimaPos.acc) + ' m';
    estat.className = 'mapa-estat ok';
    posarLocalitzador();
  }

  // ---------- Transformació GPS <-> píxels ----------
  // Amb 2 punts de referència, fem una transformació lineal (afí simple)
  // que converteix lat/lng a píxels de la imatge. Per a l'escala d'una
  // àrea (pocs km) n'hi ha prou amb una interpolació lineal.
  function gpsAPixel(lat, lng) {
    if (!calib) return null;
    const { p1, p2 } = calib;
    // Interpolació lineal independent per X (segons lng) i Y (segons lat)
    // px = p1.px + (lng - p1.lng) * (p2.px - p1.px) / (p2.lng - p1.lng)
    const dLng = (p2.lng - p1.lng);
    const dLat = (p2.lat - p1.lat);
    if (dLng === 0 || dLat === 0) return null;
    const px = p1.px + (lng - p1.lng) * (p2.px - p1.px) / dLng;
    const py = p1.py + (lat - p1.lat) * (p2.py - p1.py) / dLat;
    return { px, py };
  }

  function posarLocalitzador() {
    if (!calib || !ultimaPos) { loc.style.display = 'none'; return; }
    const p = gpsAPixel(ultimaPos.lat, ultimaPos.lng);
    if (!p) { loc.style.display = 'none'; return; }
    // píxel de la imatge -> posició a la pantalla (via transform del "mon")
    loc.style.display = '';
    loc.style.left = p.px + 'px';
    loc.style.top = p.py + 'px';
  }

  function centrarEnMi() {
    if (!calib) { toastMapa('Primer has de calibrar el mapa.'); return; }
    if (!ultimaPos) { toastMapa('Encara no tinc la teva posició.'); return; }
    const p = gpsAPixel(ultimaPos.lat, ultimaPos.lng);
    if (!p) return;
    // portar aquest píxel al centre del viewport amb un zoom còmode
    escala = Math.max(escala, 1.2);
    offX = viewport.clientWidth / 2 - p.px * escala;
    offY = viewport.clientHeight / 2 - p.py * escala;
    aplicarTransform();
    posarLocalitzador();
  }

  // ---------- CALIBRACIÓ ----------
  // Es toca un punt al mapa i s'enganxen les seves coordenades (sense
  // haver d'anar-hi). Amb dos punts allunyats, el mapa queda calibrat.
  function iniciarCalibracio() {
    calibrant = true;
    if (calibTemp && calibTemp.p1) {
      calibPas = 2;
      posarMarca('calib1', calibTemp.p1.px, calibTemp.p1.py, '1');
    } else {
      calibPas = 1;
      calibTemp = {};
    }
    puntPendent = null;
    document.getElementById('btnCalibrar').style.display = 'none';
    document.getElementById('calibPanell').style.display = '';
    document.getElementById('calibManual').style.display = 'none';
    document.getElementById('calibAccio').style.display = 'none';
    marcarPunts();
    mostrarPasCalib();
  }

  function mostrarPasCalib() {
    const text = document.getElementById('calibText');
    document.getElementById('calibManual').style.display = 'none';
    document.getElementById('calibAccio').style.display = 'none';
    if (calibPas === 1) {
      text.innerHTML = '<b>Pas 1 de 2.</b> Toca al mapa un punt que coneguis ' +
        '(per exemple un aparcament) i després n\'enganxes les coordenades.';
    } else if (calibPas === 2) {
      text.innerHTML = '<b>Pas 2 de 2.</b> Toca un <b>segon punt ben allunyat</b> del primer ' +
        'i enganxa\'n les coordenades.';
    }
  }

  function onClicMapa(e) {
    if (!calibrant) return;
    const rect = mon.getBoundingClientRect();
    const px = (e.clientX - rect.left) / escala;
    const py = (e.clientY - rect.top) / escala;
    if (px < 0 || py < 0 || px > imgW || py > imgH) return;

    // Marquem el punt tocat i demanem les coordenades
    puntPendent = { px: px, py: py };
    const idMarca = (calibPas === 1) ? 'calib1' : 'calib2';
    posarMarca(idMarca, px, py, String(calibPas));

    document.getElementById('calibText').innerHTML =
      'Punt <b>' + calibPas + '</b> marcat. Ara enganxa les seves coordenades:';
    document.getElementById('calibManual').style.display = '';
    document.getElementById('calibAccio').style.display = '';
    const input = document.getElementById('calibCoord');
    input.value = '';
    input.focus();
  }

  // "Desar punt": llegeix i valida les coordenades escrites
  function accioCalibracio() {
    if (!puntPendent) return;
    const coord = parseCoord(document.getElementById('calibCoord').value);
    if (!coord) {
      toastMapa('No entenc les coordenades. Exemple: 42.3120, 2.2050');
      return;
    }
    const punt = { px: puntPendent.px, py: puntPendent.py, lat: coord.lat, lng: coord.lng };

    if (calibPas === 1) {
      calibTemp.p1 = punt;
      guardarCalibParcial(calibTemp);
      puntPendent = null;
      calibPas = 2;
      mostrarPasCalib();
      toastMapa('Primer punt desat. Ara el segon.');
    } else if (calibPas === 2) {
      if (Math.abs(coord.lng - calibTemp.p1.lng) < 1e-6 ||
          Math.abs(coord.lat - calibTemp.p1.lat) < 1e-6) {
        toastMapa('Els dos punts són massa a prop o iguals. Tria\'n un de més allunyat.');
        return;
      }
      calibTemp.p2 = punt;
      calib = { p1: calibTemp.p1, p2: calibTemp.p2 };
      guardarCalib(areaActual, calib);
      esborrarCalibParcial(areaActual);
      finalitzarCalibracio();
      toastMapa('✅ Mapa calibrat! Ja pots veure la teva posició.');
      posarLocalitzador();
      onNovaPos();
    }
  }

  // Interpreta coordenades de moltes formes:
  //  "42.3120, 2.2050" · "42,3120; 2,2050" · "42.312 2.205" · amb N/E
  function parseCoord(text) {
    if (!text) return null;
    let s = String(text).trim().replace(/[NSEWnsew°]/g, ' ').trim();
    let parts;
    if (s.indexOf(';') !== -1) {
      parts = s.split(';');
    } else {
      const trossos = s.split(',').map(function (x) { return x.trim(); }).filter(Boolean);
      if (trossos.length === 2 && /^-?\d+\.?\d*$/.test(trossos[0]) && /^-?\d+\.?\d*$/.test(trossos[1])) {
        parts = trossos;                                   // "42.31, 2.20"
      } else if (trossos.length === 4) {
        parts = [trossos[0] + '.' + trossos[1], trossos[2] + '.' + trossos[3]]; // "42,31, 2,20"
      } else {
        parts = s.split(/\s+/);                            // per espais
      }
    }
    if (parts.length < 2) return null;
    const lat = parseFloat(String(parts[0]).replace(',', '.'));
    const lng = parseFloat(String(parts[1]).replace(',', '.'));
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
    return { lat: lat, lng: lng };
  }

  function finalitzarCalibracio() {
    calibrant = false;
    calibPas = 0;
    puntPendent = null;
    document.getElementById('calibPanell').style.display = 'none';
    document.getElementById('calibManual').style.display = 'none';
    document.getElementById('btnCalibrar').style.display = '';
    actualitzarEstatCalib();
  }

  function cancelarCalibracio() {
    calibrant = false;
    calibPas = 0;
    puntPendent = null;
    document.getElementById('calibPanell').style.display = 'none';
    document.getElementById('calibManual').style.display = 'none';
    document.getElementById('btnCalibrar').style.display = '';
    esborrarMarca('calib1'); esborrarMarca('calib2');
    calib = carregarCalib(areaActual);
    actualitzarEstatCalib();
  }

  function actualitzarEstatCalib() {
    const btn = document.getElementById('btnCalibrar');
    if (calib) { btn.textContent = '⌖ Recalibrar'; }
    else { btn.textContent = '⌖ Calibrar'; }
  }

  // ---------- Marques visuals de calibració ----------
  function marcarPunts() { /* opcional: podríem marcar aparcaments */ }
  function posarMarca(id, px, py, txt) {
    esborrarMarca(id);
    const m = document.createElement('div');
    m.id = id;
    m.className = 'calib-marca';
    m.style.left = px + 'px';
    m.style.top = py + 'px';
    m.textContent = txt;
    document.getElementById('marquesCalib').appendChild(m);
  }
  function esborrarMarca(id) {
    const m = document.getElementById(id);
    if (m) m.parentNode.removeChild(m);
  }

  // ---------- Persistència ----------
  function clau(area) { return 'calib_mapa_' + area; }
  function guardarCalib(area, c) {
    try { localStorage.setItem(clau(area), JSON.stringify(c)); } catch (e) {}
  }
  function guardarCalibParcial(temp) {
    try { localStorage.setItem('calib_parcial_' + areaActual, JSON.stringify(temp)); } catch (e) {}
  }
  function carregarCalib(area) {
    try {
      const s = localStorage.getItem(clau(area));
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  function carregarCalibParcial(area) {
    try {
      const s = localStorage.getItem('calib_parcial_' + area);
      return s ? JSON.parse(s) : null;
    } catch (e) { return null; }
  }
  function esborrarCalibParcial(area) {
    try { localStorage.removeItem('calib_parcial_' + area); } catch (e) {}
  }

  // ---------- Toast propi del mapa ----------
  let toastTimer = null;
  function toastMapa(msg) {
    let t = document.getElementById('mapaToast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'mapaToast';
      t.className = 'mapa-toast';
      overlay.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3500);
  }

  return { init: init };
})();

document.addEventListener('DOMContentLoaded', function () {
  if (document.getElementById('mapaOverlay')) Mapa.init();
});
