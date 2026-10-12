// Plain-language explanations of common car wash and detailing services, for customers who
// don't know what "descontaminado mecánico" means. Each business picks one per service in
// the panel (services.explainer). Keep the wording simple and free of promises about how
// long things last: every business works differently.

export const STEP_ICONS = [
  "foam",
  "hand",
  "vacuum",
  "spray",
  "clay",
  "brush",
  "polish",
  "shield",
  "sun",
  "drop",
  "rinse",
  "rain",
  "sparkles",
  "dash",
  "sand",
  "wheel",
  "light",
  "seat",
] as const;
export type StepIcon = (typeof STEP_ICONS)[number];

export type Explainer = {
  name: string; // shown in the panel's list
  summary: string; // what it is, in one or two sentences
  steps: { icon: StepIcon; text: string }[];
  result: string;
  before: string;
  after: string;
};

export const EXPLAINERS = {
  "lavado-completo": {
    name: "Lavado con aspirado",
    summary:
      "Tu auto limpio por fuera y por dentro: lo lavamos a mano, lo aspiramos y le damos una limpieza rápida al tablero y a los paneles de las puertas.",
    steps: [
      { icon: "foam", text: "Espuma para aflojar el polvo y el lodo" },
      { icon: "hand", text: "Lavado a mano con guante de microfibra, que no raya" },
      { icon: "vacuum", text: "Aspirado de asientos y alfombras" },
      { icon: "dash", text: "Limpieza rápida de tablero y paneles" },
    ],
    result: "Brillante por fuera y sin polvo por dentro.",
    before: "Con polvo y lodo",
    after: "Limpio y brillante",
  },
  "lavado-exterior": {
    name: "Lavado exterior",
    summary: "Lavado a mano de toda la parte de afuera: carrocería, vidrios, rines y llantas.",
    steps: [
      { icon: "foam", text: "Espuma para aflojar el polvo y el lodo" },
      { icon: "hand", text: "Lavado a mano con guante de microfibra, que no raya" },
      { icon: "rinse", text: "Enjuague y secado con microfibra" },
    ],
    result: "Tu auto brillante, sin marcas de agua.",
    before: "Con polvo y lodo",
    after: "Limpio y brillante",
  },
  "full-detailing": {
    name: "Full detailing (todo el auto)",
    summary:
      "El servicio más completo: limpiamos a fondo cada parte del auto, por fuera y por dentro, y lo dejamos protegido.",
    steps: [
      { icon: "foam", text: "Lavado a fondo y descontaminado de la pintura" },
      { icon: "wheel", text: "Rines, llantas, faros y plásticos al detalle" },
      { icon: "seat", text: "Interiores: aspirado y tallado de asientos y alfombras" },
      { icon: "shield", text: "Protección y acabado final" },
    ],
    result: "Tu auto como nuevo, por dentro y por fuera.",
    before: "Desgastado",
    after: "Como nuevo",
  },
  "detallado-exterior": {
    name: "Detallado de exteriores",
    summary: "Limpieza a detalle de todo lo de afuera: pintura, vidrios, rines, faros y plásticos.",
    steps: [
      { icon: "foam", text: "Lavado a mano de toda la carrocería" },
      { icon: "wheel", text: "Rines y llantas al detalle" },
      { icon: "sparkles", text: "Vidrios, faros y plásticos impecables" },
      { icon: "shield", text: "Acabado brillante" },
    ],
    result: "Por fuera se ve como nuevo.",
    before: "Opaco",
    after: "Brillante",
  },
  "detallado-interior": {
    name: "Detallado de interiores",
    summary: "Limpieza profunda de todo lo de adentro: asientos, alfombras, tablero y paneles.",
    steps: [
      { icon: "vacuum", text: "Aspirado a fondo, hasta en las rendijas" },
      { icon: "brush", text: "Tallado de asientos y alfombras" },
      { icon: "dash", text: "Tablero y paneles limpios, sin polvo" },
      { icon: "sparkles", text: "Interior fresco y ordenado" },
    ],
    result: "Se siente como auto nuevo por dentro.",
    before: "Con polvo y manchas",
    after: "Limpio y fresco",
  },
  "descontaminado-pintura": {
    name: "Descontaminado de pintura",
    summary:
      "Aunque laves tu auto, a la pintura se le quedan pegadas cosas que el agua no quita: polvito de los frenos, savia de árboles, chapopote. Las quitamos con un líquido especial y con una barra de arcilla que funciona como goma de borrar.",
    steps: [
      { icon: "foam", text: "Lavamos la pintura" },
      { icon: "spray", text: "Líquido que disuelve el polvito de fierro (se pone morado mientras trabaja)" },
      { icon: "clay", text: "Barra de arcilla que levanta lo que sigue pegado" },
      { icon: "hand", text: "Revisamos con la mano que quede lisa" },
    ],
    result: "La pintura queda lisa como vidrio y brilla más.",
    before: "Pintura áspera",
    after: "Lisa como vidrio",
  },
  "ceramico-rapido": {
    name: "Protección cerámica rápida (SiO2)",
    summary:
      "Una capa protectora que se pone sobre la pintura. Está hecha de SiO2, el mismo componente del vidrio: el agua resbala en gotitas y el polvo se pega menos.",
    steps: [
      { icon: "foam", text: "Lavado y secado" },
      { icon: "spray", text: "Aplicamos la protección en toda la pintura" },
      { icon: "hand", text: "Retiramos el exceso con microfibra" },
      { icon: "rain", text: "Listo: el agua escurre en gotitas" },
    ],
    result: "Más brillo y tu auto se ensucia menos.",
    before: "Sin protección",
    after: "Protegido",
  },
  "tratamiento-ceramico": {
    name: "Tratamiento cerámico",
    summary:
      "Una protección más fuerte y duradera que la cera: una capa dura que cuida la pintura del sol, la lluvia y la suciedad.",
    steps: [
      { icon: "foam", text: "Lavado y descontaminado de la pintura" },
      { icon: "polish", text: "Pulido para quitar marcas finas" },
      { icon: "shield", text: "Recubrimiento cerámico, panel por panel" },
      { icon: "sun", text: "Curado: la capa se endurece y protege" },
    ],
    result: "Brillo profundo y la pintura protegida por mucho más tiempo.",
    before: "Sin protección",
    after: "Protegida",
  },
  vidrios: {
    name: "Vidrios y repelente de agua",
    summary:
      "Quitamos el sarro y las manchas de agua de los vidrios y les ponemos un repelente: cuando llueve, el agua escurre sola y ves mejor.",
    steps: [
      { icon: "spray", text: "Limpieza profunda de manchas y sarro" },
      { icon: "clay", text: "Descontaminado del vidrio" },
      { icon: "rain", text: "Repelente: la lluvia resbala" },
    ],
    result: "Vidrios transparentes y mejor visibilidad con lluvia.",
    before: "Manchados",
    after: "Transparentes",
  },
  "rines-llantas": {
    name: "Rines y llantas",
    summary:
      "Los rines juntan un polvo negro de los frenos que se pega muy fuerte. Lo quitamos con productos especiales y cepillos, y dejamos las llantas negras.",
    steps: [
      { icon: "spray", text: "Producto que afloja el polvo de los frenos" },
      { icon: "brush", text: "Cepillos para cada rincón del rin" },
      { icon: "rinse", text: "Enjuague" },
      { icon: "sparkles", text: "Llantas negras con acabado" },
    ],
    result: "Rines brillantes y llantas como nuevas.",
    before: "Con polvo de frenos",
    after: "Brillantes",
  },
  faros: {
    name: "Restauración de faros",
    summary:
      "Con el sol, los faros se ponen amarillos y opacos, y alumbran menos. Los lijamos y pulimos hasta dejarlos transparentes, y les ponemos protección.",
    steps: [
      { icon: "sand", text: "Lijado fino de la capa amarilla" },
      { icon: "polish", text: "Pulido hasta que quedan transparentes" },
      { icon: "sun", text: "Protección contra el sol" },
    ],
    result: "Faros claros que alumbran mejor.",
    before: "Amarillos y opacos",
    after: "Transparentes",
  },
  "plasticos-exteriores": {
    name: "Restauración de plásticos exteriores",
    summary:
      "Las defensas y molduras de plástico se ponen grises y opacas con el sol. Las limpiamos y les devolvemos su color.",
    steps: [
      { icon: "brush", text: "Limpieza profunda del plástico" },
      { icon: "spray", text: "Restaurador que devuelve el color" },
      { icon: "sun", text: "Protección contra el sol" },
    ],
    result: "Plásticos negros, como nuevos.",
    before: "Grises",
    after: "Negros otra vez",
  },
  "asientos-suelos": {
    name: "Tallado de asientos y alfombras",
    summary: "Tallado a fondo de asientos y alfombras para sacar manchas y la mugre que la aspiradora no quita.",
    steps: [
      { icon: "vacuum", text: "Aspirado" },
      { icon: "foam", text: "Champú especial para telas" },
      { icon: "brush", text: "Tallado con cepillo" },
      { icon: "vacuum", text: "Sacamos la suciedad y dejamos secar" },
    ],
    result: "Asientos y alfombras limpios y sin manchas.",
    before: "Con manchas",
    after: "Limpios",
  },
  "plasticos-interiores": {
    name: "Tablero y plásticos interiores",
    summary:
      "Limpiamos el tablero, la consola y los paneles de las puertas, y los hidratamos para que no se resequen ni se decoloren.",
    steps: [
      { icon: "brush", text: "Limpieza de tablero, consola y paneles" },
      { icon: "drop", text: "Hidratación del plástico" },
      { icon: "sun", text: "Protección contra el sol" },
    ],
    result: "Interiores limpios, sin polvo y sin brillo grasoso.",
    before: "Resecos",
    after: "Como nuevos",
  },
  cueros: {
    name: "Hidratación de cueros",
    summary:
      "El cuero se reseca y se agrieta con el sol y el uso. Lo limpiamos con cuidado y lo hidratamos para que siga suave.",
    steps: [
      { icon: "brush", text: "Limpieza suave del cuero" },
      { icon: "drop", text: "Crema hidratante especial" },
      { icon: "hand", text: "Acabado suave al tacto" },
    ],
    result: "Cuero suave y sin resequedad.",
    before: "Reseco",
    after: "Suave",
  },
} satisfies Record<string, Explainer>;

export type ExplainerId = keyof typeof EXPLAINERS;
export const EXPLAINER_IDS = Object.keys(EXPLAINERS) as ExplainerId[];

export function getExplainer(id: string | null | undefined): Explainer | null {
  return id && Object.hasOwn(EXPLAINERS, id) ? EXPLAINERS[id as ExplainerId] : null;
}
