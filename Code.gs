/**
 * REGISTRE D'ITINERÀNCIA — TRAMS I APARCAMENTS
 * ---------------------------------------------
 * Enganxa aquest codi a l'editor d'Apps Script d'un full de càlcul NOU.
 *
 * PASSOS:
 * 1) Enganxa tot aquest codi.
 * 2) Executa "setup" una vegada (accepta els permisos).
 * 3) Implementar > Nova implementació:
 *      - Tipus: Aplicació web
 *      - Executar com: Jo
 *      - Qui hi té accés: Qualsevol
 * 4) Copia la URL /exec i enganxa-la a app.js (CONFIG.SCRIPT_URL).
 *
 * Si canvien els camps o vols recalcular resums manualment, executa
 * la funció "actualitzarResums".
 */

const SHEET_REGISTRES = 'Registres';
const SHEET_RESUM_AREA = 'Resum per àrea';
const SHEET_RESUM_PUNT = 'Resum per punt';
const SHEET_RESUM_MES = 'Resum mensual';

// Columnes fixes al principi de "Registres"
// "ID" és tècnica (per evitar duplicats); es pot amagar al full.
const COLUMNES_FIXES = ['ID', 'Data i hora', 'Àrea', 'Tipus', 'Núm', 'Punt'];

const NOMS_MES = ['gener','febrer','març','abril','maig','juny','juliol','agost','setembre','octubre','novembre','desembre'];

// Mapa id intern del camp -> capçalera llegible al full.
const ETIQUETES = {
  veh_aparcament: 'Vehicles en aparcament',
  veh_fora_aparcament: 'Vehicles fora aparcament',
  veh_impedeixen_pas: 'Vehicles que impedeixen el pas',
  veh_sense_autoritzacio: 'Vehicles sense autorització',
  tendes: 'Tendes',
  autocaravana_pernocta: 'Autocaravana/furgoneta pernocta',
  camping_excessiu: 'Càmping excessiu',
  deixalles: 'Deixalles (1-5)',
  veh_fora_pista: 'Vehicles fora de pista',
  escaladors: 'Escaladors',
  bicicletes: 'Bicicletes',
  persones: 'Persones',
  observacions: 'Observacions'
};

// Ordre preferit de les columnes de camps
const ORDRE_CAMPS = [
  'veh_aparcament', 'veh_fora_aparcament', 'veh_impedeixen_pas',
  'veh_sense_autoritzacio', 'tendes', 'autocaravana_pernocta',
  'camping_excessiu', 'deixalles', 'veh_fora_pista', 'escaladors',
  'bicicletes', 'persones', 'observacions'
];

// Camps numèrics que se SUMEN als resums
const CAMPS_SUMA = [
  'veh_aparcament', 'veh_fora_aparcament', 'veh_impedeixen_pas',
  'veh_sense_autoritzacio', 'tendes', 'autocaravana_pernocta',
  'camping_excessiu', 'veh_fora_pista', 'escaladors',
  'bicicletes', 'persones'
];
// Camp que es fa la MITJANA
const CAMP_MITJANA = 'deixalles';

/**
 * Rep dades tant per POST (fetch) com per GET (JSONP amb ?payload=...&callback=...).
 * Sempre passa per processarRegistre_, que és segur contra duplicats i
 * escriptures simultànies.
 */
function doPost(e) {
  var record = null;
  try { record = JSON.parse(e.postData.contents); } catch (err) {}
  var res = processarRegistre_(record);
  return ContentService
    .createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  // Comprovació simple d'estat
  if (!e || !e.parameter || !e.parameter.payload) {
    var cb0 = e && e.parameter && e.parameter.callback;
    var msg = { ok: true, estat: 'servei actiu' };
    if (cb0) {
      return ContentService
        .createTextOutput(cb0 + '(' + JSON.stringify(msg) + ')')
        .setMimeType(ContentService.MimeType.JAVASCRIPT);
    }
    return ContentService.createTextOutput('Servei actiu ✅');
  }

  // Enviament de registre via JSONP
  var record = null;
  try { record = JSON.parse(e.parameter.payload); } catch (err) {}
  var res = processarRegistre_(record);

  var cb = e.parameter.callback;
  if (cb) {
    return ContentService
      .createTextOutput(cb + '(' + JSON.stringify(res) + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(JSON.stringify(res))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Processa un registre de manera segura:
 *  - Bloqueja l'accés (LockService) perquè dues peticions no escriguin alhora.
 *  - Comprova si l'ID ja existeix al full (deduplicació): si hi és, no el torna
 *    a guardar però respon "ok" perquè l'app el pugui treure de la cua.
 */
function processarRegistre_(data) {
  if (!data || !data.id) {
    return { ok: false, error: 'dades invàlides' };
  }

  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(20000); // espera fins a 20s el seu torn
  } catch (e) {
    return { ok: false, error: 'ocupat, torna-ho a provar' };
  }

  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(SHEET_REGISTRES) || crearFullRegistres_(ss);

    // Deduplicació: si l'ID ja hi és, considerem l'entrega feta
    if (idJaExisteix_(sheet, data.id)) {
      return { ok: true, duplicat: true, id: data.id };
    }

    var dataHora = data.timestamp ? new Date(data.timestamp) : new Date();
    var area = data.area || '';
    var tipus = data.tipus || '';
    var num = (data.num !== undefined && data.num !== null) ? data.num : '';
    var punt = data.punt || '';
    var valors = data.valors || {};

    var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

    // Afegeix columnes noves si apareix un camp desconegut
    var afegides = false;
    Object.keys(valors).forEach(function (campId) {
      var etiqueta = ETIQUETES[campId] || campId;
      if (headers.indexOf(etiqueta) === -1) {
        sheet.getRange(1, headers.length + 1).setValue(etiqueta);
        sheet.getRange(1, headers.length + 1).setFontWeight('bold')
          .setBackground('#0097b2').setFontColor('white');
        headers.push(etiqueta);
        afegides = true;
      }
    });

    if (afegides) {
      headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    }

    var fila = headers.map(function (h) {
      switch (h) {
        case 'ID': return data.id;
        case 'Data i hora': return dataHora;
        case 'Àrea': return area;
        case 'Tipus': return tipus;
        case 'Núm': return num;
        case 'Punt': return punt;
        default:
          var campId = Object.keys(ETIQUETES).find(function (k) { return ETIQUETES[k] === h; }) || h;
          return valors[campId] !== undefined ? valors[campId] : '';
      }
    });

    sheet.appendRow(fila);

    return { ok: true, id: data.id };

  } catch (err) {
    return { ok: false, error: String(err) };
  } finally {
    lock.releaseLock();
  }
}

/**
 * Comprova si un ID ja és a la columna "ID" del full.
 */
function idJaExisteix_(sheet, id) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colId = headers.indexOf('ID') + 1;
  if (colId < 1) return false;
  var valors = sheet.getRange(2, colId, lastRow - 1, 1).getValues();
  for (var i = 0; i < valors.length; i++) {
    if (String(valors[i][0]) === String(id)) return true;
  }
  return false;
}

function crearFullRegistres_(ss) {
  const sheet = ss.insertSheet(SHEET_REGISTRES, 0);
  const capcaleres = COLUMNES_FIXES.concat(ORDRE_CAMPS.map(id => ETIQUETES[id] || id));
  sheet.appendRow(capcaleres);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, capcaleres.length)
    .setFontWeight('bold').setBackground('#0097b2').setFontColor('white');
  sheet.getRange('A2:A').setNumberFormat('dd/MM/yyyy HH:mm');
  ajustarAmplades_(sheet);
  return sheet;
}

/**
 * Ajusta automàticament l'amplada de totes les columnes al contingut,
 * perquè els títols no quedin tallats.
 */
function ajustarAmplades_(sheet) {
  const nCols = sheet.getLastColumn();
  if (nCols < 1) return;
  sheet.autoResizeColumns(1, nCols);
  // Marge extra perquè no quedi enganxat, i mínim per la data
  for (let c = 1; c <= nCols; c++) {
    const ample = sheet.getColumnWidth(c);
    sheet.setColumnWidth(c, Math.min(ample + 20, 320));
  }
}

/**
 * EXECUTAR UNA VEGADA: prepara el full de registres, els resums,
 * i un trigger que actualitza els resums automàticament cada hora
 * (així guardar cada registre és instantani).
 */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss.getSheetByName(SHEET_REGISTRES)) {
    crearFullRegistres_(ss);
  }
  actualitzarResums();

  // Crear trigger horari per als resums (evitant duplicar-lo)
  const triggers = ScriptApp.getProjectTriggers();
  const jaExisteix = triggers.some(t => t.getHandlerFunction() === 'actualitzarResums');
  if (!jaExisteix) {
    ScriptApp.newTrigger('actualitzarResums')
      .timeBased()
      .everyHours(1)
      .create();
  }

  ss.toast('Configuració completada! Ara fes "Implementar" per obtenir la URL.');
}

/**
 * Recalcula les tres pestanyes de resum a partir de "Registres".
 * No esborra els fulls (manté posició, colors i gràfics), només reescriu dades.
 */
function actualitzarResums() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const reg = ss.getSheetByName(SHEET_REGISTRES);
  if (!reg) return;
  const tz = ss.getSpreadsheetTimeZone();

  const lastRow = reg.getLastRow();
  const lastCol = reg.getLastColumn();
  const headers = reg.getRange(1, 1, 1, lastCol).getValues()[0];

  // índex de cada columna rellevant
  const idx = {
    data: headers.indexOf('Data i hora'),
    area: headers.indexOf('Àrea'),
    tipus: headers.indexOf('Tipus'),
    punt: headers.indexOf('Punt')
  };
  // índexs dels camps de suma i mitjana
  const colSuma = CAMPS_SUMA.map(id => ({ id: id, etiqueta: ETIQUETES[id], col: headers.indexOf(ETIQUETES[id]) }))
                            .filter(c => c.col !== -1);
  const colMitjana = { etiqueta: ETIQUETES[CAMP_MITJANA], col: headers.indexOf(ETIQUETES[CAMP_MITJANA]) };

  // acumuladors
  const nou = () => {
    const o = { registres: 0, sumes: {}, deixSuma: 0, deixCount: 0 };
    colSuma.forEach(c => o.sumes[c.id] = 0);
    return o;
  };
  const perArea = {};   // "area|tipus"
  const perPunt = {};   // "area|tipus|punt"
  const perMes = {};    // "yyyy-MM|area|tipus"

  if (lastRow >= 2) {
    const dades = reg.getRange(2, 1, lastRow - 1, lastCol).getValues();
    dades.forEach(row => {
      const dataHora = row[idx.data];
      if (!dataHora) return;
      const area = row[idx.area] || '(sense àrea)';
      const tipus = row[idx.tipus] || '';
      const punt = row[idx.punt] || '';
      const mesKey = Utilities.formatDate(new Date(dataHora), tz, 'yyyy-MM');

      const kArea = area + '|' + tipus;
      const kPunt = area + '|' + tipus + '|' + punt;
      const kMes = mesKey + '|' + area + '|' + tipus;

      [ [perArea, kArea], [perPunt, kPunt], [perMes, kMes] ].forEach(([obj, k]) => {
        if (!obj[k]) obj[k] = nou();
        const acc = obj[k];
        acc.registres++;
        colSuma.forEach(c => {
          const v = Number(row[c.col]);
          if (!isNaN(v)) acc.sumes[c.id] += v;
        });
        if (colMitjana.col !== -1) {
          const dv = Number(row[colMitjana.col]);
          if (!isNaN(dv) && row[colMitjana.col] !== '') { acc.deixSuma += dv; acc.deixCount++; }
        }
      });
    });
  }

  // capçaleres dels resums
  const capBase = (primeres) => primeres
    .concat(['Registres'])
    .concat(colSuma.map(c => c.etiqueta))
    .concat([colMitjana.etiqueta + ' (mitjana)']);

  const filaResum = (acc) => {
    const f = [acc.registres];
    colSuma.forEach(c => f.push(acc.sumes[c.id]));
    f.push(acc.deixCount > 0 ? Math.round((acc.deixSuma / acc.deixCount) * 10) / 10 : '');
    return f;
  };

  // ---- Resum per àrea ----
  const shArea = prepararFull_(ss, SHEET_RESUM_AREA, capBase(['Àrea', 'Tipus']));
  const filesArea = Object.keys(perArea).sort().map(k => {
    const [area, tipus] = k.split('|');
    return [area, tipus].concat(filaResum(perArea[k]));
  });
  if (filesArea.length) shArea.getRange(2, 1, filesArea.length, filesArea[0].length).setValues(filesArea);

  // ---- Resum per punt ----
  const shPunt = prepararFull_(ss, SHEET_RESUM_PUNT, capBase(['Àrea', 'Tipus', 'Punt']));
  const filesPunt = Object.keys(perPunt).sort().map(k => {
    const [area, tipus, punt] = k.split('|');
    return [area, tipus, punt].concat(filaResum(perPunt[k]));
  });
  if (filesPunt.length) shPunt.getRange(2, 1, filesPunt.length, filesPunt[0].length).setValues(filesPunt);

  // ---- Resum mensual ----
  const shMes = prepararFull_(ss, SHEET_RESUM_MES, capBase(['Mes', 'Àrea', 'Tipus']));
  const filesMes = Object.keys(perMes).sort().map(k => {
    const [mesKey, area, tipus] = k.split('|');
    const [y, m] = mesKey.split('-').map(Number);
    const etiquetaMes = NOMS_MES[m - 1] + ' ' + y;
    return [etiquetaMes, area, tipus].concat(filaResum(perMes[k]));
  });
  if (filesMes.length) shMes.getRange(2, 1, filesMes.length, filesMes[0].length).setValues(filesMes);

  // Ajustem amplades de tots els resums
  [shArea, shPunt, shMes].forEach(sh => ajustarAmplades_(sh));

  // Ajustem també l'amplada de "Registres" i amaguem la columna tècnica ID
  ajustarAmplades_(reg);
  amagarColumnaID_(reg);

  // Generem/actualitzem els gràfics
  try { generarGrafics_(ss, shArea, shMes); } catch (e) { /* opcional */ }
}

/**
 * Amaga la columna tècnica "ID" del full de registres (només visual).
 */
function amagarColumnaID_(sheet) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var colId = headers.indexOf('ID') + 1;
  if (colId >= 1) sheet.hideColumns(colId);
}

/**
 * Menú personalitzat al full de càlcul perquè els responsables puguin
 * actualitzar els resums quan vulguin, sense obrir l'editor de codi.
 */
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🐾 Itinerància')
    .addItem('Actualitzar resums i gràfics ara', 'actualitzarResums')
    .addToUi();
}

/**
 * Crea els gràfics a la pestanya "Gràfics" (els refà cada vegada).
 * - Persones per àrea (columnes)
 * - Persones per mes (columnes)
 */
function generarGrafics_(ss, shArea, shMes) {
  const NOM_GRAFICS = 'Gràfics';
  let sh = ss.getSheetByName(NOM_GRAFICS);
  if (!sh) sh = ss.insertSheet(NOM_GRAFICS);

  // Eliminem gràfics existents per refer-los
  sh.getCharts().forEach(c => sh.removeChart(c));

  // Localitzem la columna "Persones" al resum per àrea
  const headArea = shArea.getRange(1, 1, 1, shArea.getLastColumn()).getValues()[0];
  const colPersones = headArea.indexOf('Persones') + 1;
  const filesArea = shArea.getLastRow();

  if (colPersones > 0 && filesArea >= 2) {
    // Gràfic 1: Persones per àrea+tipus (columna A = Àrea, B = Tipus)
    const chart1 = sh.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(shArea.getRange(1, 1, filesArea, 1))          // Àrea
      .addRange(shArea.getRange(1, colPersones, filesArea, 1)) // Persones
      .setPosition(1, 1, 0, 0)
      .setOption('title', 'Persones per àrea')
      .setOption('legend', { position: 'none' })
      .setOption('width', 480)
      .setOption('height', 300)
      .build();
    sh.insertChart(chart1);
  }

  // Localitzem "Persones" al resum mensual
  const headMes = shMes.getRange(1, 1, 1, shMes.getLastColumn()).getValues()[0];
  const colPersMes = headMes.indexOf('Persones') + 1;
  const filesMes = shMes.getLastRow();

  if (colPersMes > 0 && filesMes >= 2) {
    // Gràfic 2: Persones per mes (columna A = Mes)
    const chart2 = sh.newChart()
      .setChartType(Charts.ChartType.COLUMN)
      .addRange(shMes.getRange(1, 1, filesMes, 1))            // Mes
      .addRange(shMes.getRange(1, colPersMes, filesMes, 1))   // Persones
      .setPosition(18, 1, 0, 0)
      .setOption('title', 'Persones per mes')
      .setOption('legend', { position: 'none' })
      .setOption('width', 480)
      .setOption('height', 300)
      .build();
    sh.insertChart(chart2);
  }
}

/**
 * Obté (o crea) un full i en buida només el CONTINGUT (no format,
 * posició, color de pestanya ni gràfics), i hi posa les capçaleres.
 */
function prepararFull_(ss, nom, capcaleres) {
  let sheet = ss.getSheetByName(nom);
  if (!sheet) {
    sheet = ss.insertSheet(nom);
  } else {
    const files = Math.max(sheet.getMaxRows(), 2);
    const cols = Math.max(sheet.getMaxColumns(), capcaleres.length);
    sheet.getRange(1, 1, files, cols).clearContent();
  }
  sheet.getRange(1, 1, 1, capcaleres.length).setValues([capcaleres]);
  sheet.setFrozenRows(1);
  sheet.getRange(1, 1, 1, capcaleres.length)
    .setFontWeight('bold').setBackground('#0097b2').setFontColor('white');
  return sheet;
}
