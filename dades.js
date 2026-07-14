// ============================================================
// DADES DE L'APP — DADES REALS
// ------------------------------------------------------------
// Àrees d'Informació amb els seus trams i aparcaments (amb el
// número oficial de cada punt, tal com apareix als mapes) i els
// camps del formulari.
//
// Separació:
//   - Els punts que comencen amb "P." són APARCAMENTS.
//   - La resta són TRAMS.
// Cada punt té { num, nom }. Les llistes van ordenades pel número.
//
// Diferències reals de camps entre àrees:
//   - Montgrony Nord: té "Vehicles sense autorització d'accés"
//                     i NO té "Escaladors".
//   - Montgrony Sud i Serra Cavallera: tenen "Escaladors" i
//                     NO tenen "Vehicles sense autorització".
// ============================================================

const CAMPS_NORD = [
  { id: "veh_aparcament", etiqueta: 'Vehicles en aparcament', tipus: "number", obligatori: false },
  { id: "veh_fora_aparcament", etiqueta: "Vehicles fora d'aparcament", tipus: "number", obligatori: false },
  { id: "veh_impedeixen_pas", etiqueta: "Vehicles que impedeixen el pas", tipus: "number", obligatori: false },
  { id: "veh_sense_autoritzacio", etiqueta: "Vehicles sense autorització d'accés", tipus: "number", obligatori: false },
  { id: "tendes", etiqueta: "Tendes", tipus: "number", compacte: true, obligatori: false },
  { id: "autocaravana_pernocta", etiqueta: "Autocaravanes / furgonetes en pernocta", tipus: "number", obligatori: false },
  { id: "camping_excessiu", etiqueta: "Càmping excessiu (més d'una taula i 2 cadires)", tipus: "number", obligatori: false },
  { id: "veh_fora_pista", etiqueta: "Vehicles motoritzats fora de pista (cotxes, bicis elèctriques, motos, etc.)", tipus: "number", obligatori: false },
  { id: "bicicletes", etiqueta: "Bicicletes", tipus: "number", compacte: true, obligatori: false },
  { id: "persones", etiqueta: "Persones", tipus: "number", compacte: true, obligatori: false },
  { id: "deixalles", etiqueta: "Nivell de deixalles", tipus: "escala", opcions: ["1", "2", "3", "4", "5"], etiquetaMin: "Poques", etiquetaMax: "Moltes", obligatori: false },
  { id: "observacions", etiqueta: "Observacions", tipus: "textarea", obligatori: false }
];

const CAMPS_SUD_CAVALLERA = [
  { id: "veh_aparcament", etiqueta: 'Vehicles en aparcament', tipus: "number", obligatori: false },
  { id: "veh_fora_aparcament", etiqueta: "Vehicles fora d'aparcament", tipus: "number", obligatori: false },
  { id: "veh_impedeixen_pas", etiqueta: "Vehicles que impedeixen el pas", tipus: "number", obligatori: false },
  { id: "tendes", etiqueta: "Tendes", tipus: "number", compacte: true, obligatori: false },
  { id: "autocaravana_pernocta", etiqueta: "Autocaravanes / furgonetes en pernocta", tipus: "number", obligatori: false },
  { id: "camping_excessiu", etiqueta: "Càmping excessiu (més d'una taula i 2 cadires)", tipus: "number", obligatori: false },
  { id: "veh_fora_pista", etiqueta: "Vehicles motoritzats fora de pista (cotxes, bicis elèctriques, motos, etc.)", tipus: "number", obligatori: false },
  { id: "escaladors", etiqueta: "Escaladors", tipus: "number", compacte: true, obligatori: false },
  { id: "bicicletes", etiqueta: "Bicicletes", tipus: "number", compacte: true, obligatori: false },
  { id: "persones", etiqueta: "Persones", tipus: "number", compacte: true, obligatori: false },
  { id: "deixalles", etiqueta: "Nivell de deixalles", tipus: "escala", opcions: ["1", "2", "3", "4", "5"], etiquetaMin: "Poques", etiquetaMax: "Moltes", obligatori: false },
  { id: "observacions", etiqueta: "Observacions", tipus: "textarea", obligatori: false }
];

const DADES = {
  arees: [
    {
      nom: "AI Serra de Montgrony Nord",
      camps: CAMPS_NORD,
      trams: [
        { num: 1,  nom: "Casassa - Sant Antoni" },
        { num: 3,  nom: "Pujada mirador (a peu)" },
        { num: 4,  nom: "Cementiri - Plaça de les Fonts" },
        { num: 6,  nom: "Plaça de les Fonts - El Baell" },
        { num: 7,  nom: "Plaça de les Fonts - Pla de Prats" },
        { num: 8,  nom: "Desemboscos Suronell" },
        { num: 10, nom: "Pla de Prats - Font Roja" },
        { num: 12, nom: "Font Roja - Coll de l'Erola" },
        { num: 14, nom: "Coll de l'Erola - Coll de Prat de Jou" },
        { num: 16, nom: "Coll de Prat de Jou - Coll Roig (a peu)" },
        { num: 17, nom: "Coll de Prat de Jou - Coll Pan" },
        { num: 18, nom: "Campelles - Collet de la Daina" },
        { num: 20, nom: "Collet de la Daina - Planoles" },
        { num: 21, nom: "Nevà - Plans de Nevà" },
        { num: 22, nom: "Sant Cristòfol - La Tussa" }
      ],
      aparcaments: [
        { num: 2,  nom: "P. Sant Antoni" },
        { num: 5,  nom: "P. Plaça de les Fonts" },
        { num: 9,  nom: "P. Pla de Prats" },
        { num: 11, nom: "P. Font Roja" },
        { num: 13, nom: "P. de l'Erola" },
        { num: 15, nom: "P de Prat de Jou" },
        { num: 19, nom: "P. Collet de la Daina" },
        { num: 23, nom: "P. La Tussa" }
      ]
    },
    {
      nom: "AI Serra de Montgrony Sud",
      camps: CAMPS_SUD_CAVALLERA,
      trams: [
        { num: 1,  nom: "Trencant Montgrony - Trencant Viles Xiques" },
        { num: 3,  nom: "Pujada Coll Roig" },
        { num: 4,  nom: "Trencant Viles Xiques Montgrony" },
        { num: 6,  nom: "Volta a Sant Ou" },
        { num: 7,  nom: "SE El Prestill" },
        { num: 8,  nom: "Trencant Viles Xiques - Plans de la Pera" },
        { num: 10, nom: "Trencant de Montgrony - Coll de l'Espluga" }
      ],
      aparcaments: [
        { num: 2,  nom: "P. Les Planelles" },
        { num: 5,  nom: "P. Montgrony" },
        { num: 9,  nom: "P. Plans de la Pera" },
        { num: 11, nom: "P. Coll de l'Espluga" }
      ]
    },
    {
      nom: "AI Serra Cavallera",
      camps: CAMPS_SUD_CAVALLERA,
      trams: [
        { num: 3,  nom: "Orri Vell" },
        { num: 4,  nom: "Bruguera - La Blanquina" },
        { num: 6,  nom: "La Blanquina - Coll de Jou" },
        { num: 8,  nom: "Pujada Taga" },
        { num: 9,  nom: "Coll de Jou - Trencant Ribamala" },
        { num: 10, nom: "Trencant Ribamala - St. Martí d'Ogassa" },
        { num: 12, nom: "St. Martí d'Ogassa - Cingleres can Camps" },
        { num: 14, nom: "Cingleres can Camps - Collada Caritat" },
        { num: 16, nom: "Cruïlla Can Picola - Cal Frare" },
        { num: 18, nom: "Pujada Gran Jaça (a peu)" },
        { num: 19, nom: "Collada Caritat - Pla d'en Plata" }
      ],
      aparcaments: [
        { num: 1,  nom: "P. Puigsac" },
        { num: 2,  nom: "P. Foranques" },
        { num: 5,  nom: "P. La Blanquina" },
        { num: 7,  nom: "P. Coll de Jou" },
        { num: 11, nom: "P. St. Martí d'Ogassa" },
        { num: 13, nom: "P. Cingleres can Camps" },
        { num: 15, nom: "P. Collada Caritat" },
        { num: 17, nom: "P. Cal Frare" },
        { num: 20, nom: "P. Pla d'en Plata" }
      ]
    }
  ]
};
