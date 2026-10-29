// Sons du monde, tous fabriqués dans le navigateur (Web Audio) : aucun fichier à charger.
// Des nappes en boucle (vent, mer, grondement de la lave) dont on règle le volume selon l'endroit,
// et des sons brefs (pas, atterrissage, oiseaux, grillons, cloches, carillons de découverte).

export type Sol = "herbe" | "terre" | "neige" | "eau" | "bois";
export type Nappe = "vent" | "sifflement" | "mer" | "grondement";

const CLE = "aurelith-son";
let ctx: AudioContext | null = null;
let maitre: GainNode;
let echo: ConvolverNode;
let bruit: AudioBuffer;
const nappes = {} as Record<Nappe, GainNode>;

function lireCoupe() {
  try {
    return localStorage.getItem(CLE) === "coupe";
  } catch {
    return false;
  }
}
let coupe = lireCoupe();

/** Volume général (0 à 1), réglable dans les réglages. */
let volume = 0.8;

/** Crée le son au premier geste du joueur (les navigateurs l'exigent), ou le relance. */
export function demarrerSon() {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  try {
    ctx = new AudioContext();
  } catch {
    return;
  }
  maitre = ctx.createGain();
  maitre.gain.value = coupe ? 0 : volume;
  // Un léger écrêtage doux : plusieurs sons ensemble ne saturent jamais.
  const compresseur = ctx.createDynamicsCompressor();
  compresseur.threshold.value = -14;
  compresseur.ratio.value = 4;
  maitre.connect(compresseur).connect(ctx.destination);

  // Deux secondes de bruit blanc, la matière de presque tous les sons.
  bruit = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

  // Réverbération (une réponse de bruit qui s'éteint) : pour les cloches et les carillons.
  echo = ctx.createConvolver();
  const duree = ctx.sampleRate * 2.5;
  const reponse = ctx.createBuffer(2, duree, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const r = reponse.getChannelData(c);
    for (let i = 0; i < duree; i++) r[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / duree, 3);
  }
  echo.buffer = reponse;
  const retour = ctx.createGain();
  retour.gain.value = 0.35;
  echo.connect(retour).connect(maitre);

  nappes.vent = nappe([["bandpass", 450, 0.7]], 0.06, 300);
  nappes.sifflement = nappe([["bandpass", 1900, 6]], 0.11, 500);
  nappes.mer = nappe([["lowpass", 480, 0.5]], 0.11, 0, 0.8);
  nappes.grondement = nappe([["lowpass", 85, 0.9]], 0.05, 20);
}

/** Une nappe en boucle : du bruit filtré, que des oscillateurs très lents font respirer. */
function nappe(filtres: [BiquadFilterType, number, number][], lfo: number, profondeur: number, houle = 0) {
  const c = ctx!;
  const source = c.createBufferSource();
  source.buffer = bruit;
  source.loop = true;
  let n: AudioNode = source;
  for (const [type, f, q] of filtres) {
    const filtre = c.createBiquadFilter();
    filtre.type = type;
    filtre.frequency.value = f;
    filtre.Q.value = q;
    if (profondeur) {
      const o = c.createOscillator();
      o.frequency.value = lfo;
      const g = c.createGain();
      g.gain.value = profondeur;
      o.connect(g).connect(filtre.frequency);
      o.start();
    }
    n = n.connect(filtre);
  }
  // La houle : le volume monte et descend comme des vagues.
  const respire = c.createGain();
  respire.gain.value = 1 - houle / 2;
  if (houle) {
    const o = c.createOscillator();
    o.frequency.value = lfo;
    const g = c.createGain();
    g.gain.value = houle / 2;
    o.connect(g).connect(respire.gain);
    o.start();
  }
  const volume = c.createGain();
  volume.gain.value = 0;
  n.connect(respire).connect(volume).connect(maitre);
  source.start(0, Math.random() * 2);
  return volume;
}

/** Volume voulu d'une nappe : on y glisse en douceur. */
export function regler(n: Nappe, volume: number) {
  if (!ctx) return;
  nappes[n].gain.setTargetAtTime(volume, ctx.currentTime, 1.2);
}

export const sonCoupe = () => coupe;

/** Coupe ou rétablit le son ; le choix est retenu d'une partie à l'autre. */
export function basculerSon() {
  coupe = !coupe;
  try {
    localStorage.setItem(CLE, coupe ? "coupe" : "");
  } catch {
    /* navigation privée : le choix ne dure que la partie */
  }
  if (ctx) maitre.gain.setTargetAtTime(coupe ? 0 : volume, ctx.currentTime, 0.05);
  return coupe;
}

/** Règle le volume général (0 à 1). */
export function fixerVolume(v: number) {
  volume = v;
  if (ctx && !coupe) maitre.gain.setTargetAtTime(volume, ctx.currentTime, 0.05);
}

// ─── Sons brefs ─────────────────────────────────────────────────────────────

/** Sortie d'un son bref, placé à gauche ou à droite (-1 à 1), avec un peu d'écho si demandé. */
function sortie(pan = 0, reverb = 0) {
  const c = ctx!;
  const g = c.createGain();
  const p = c.createStereoPanner();
  p.pan.value = Math.max(-1, Math.min(1, pan));
  g.connect(p).connect(maitre);
  if (reverb) {
    const r = c.createGain();
    r.gain.value = reverb;
    p.connect(r).connect(echo);
  }
  return g;
}

/** Un souffle de bruit filtré, avec une attaque et une chute (s). */
function souffle(type: BiquadFilterType, f: number, q: number, volume: number, chute: number, quand = 0, pan = 0) {
  const c = ctx!;
  const t = c.currentTime + quand;
  const s = c.createBufferSource();
  s.buffer = bruit;
  s.playbackRate.value = 0.8 + Math.random() * 0.4;
  const filtre = c.createBiquadFilter();
  filtre.type = type;
  filtre.frequency.value = f * (0.9 + Math.random() * 0.2);
  filtre.Q.value = q;
  const g = sortie(pan);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + chute);
  s.connect(filtre).connect(g);
  s.start(t, Math.random() * 1.5, chute + 0.05);
}

/** Une note (sinusoïde), qui glisse éventuellement d'une fréquence à l'autre. */
function note(f: number, volume: number, chute: number, { quand = 0, vers = f, glisse = 0.05, pan = 0, reverb = 0, type = "sine" as OscillatorType } = {}) {
  const c = ctx!;
  const t = c.currentTime + quand;
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (vers !== f) o.frequency.exponentialRampToValueAtTime(vers, t + glisse);
  const g = sortie(pan, reverb);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(volume, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + chute);
  o.connect(g);
  o.start(t);
  o.stop(t + chute + 0.05);
}

/** Un pas, selon le sol ; `force` : 0 en marchant, 1 en courant. */
export function pas(sol: Sol, force: number) {
  if (!ctx || coupe) return;
  const v = 0.7 + 0.5 * force;
  if (sol === "herbe") souffle("bandpass", 2600, 0.7, 0.16 * v, 0.09);
  else if (sol === "terre") {
    souffle("bandpass", 950, 1.1, 0.26 * v, 0.07);
    note(95, 0.12 * v, 0.06, { vers: 60 });
  } else if (sol === "bois") {
    note(180, 0.18 * v, 0.08, { vers: 120, type: "triangle" });
    souffle("bandpass", 1400, 2, 0.1 * v, 0.05);
  } else if (sol === "neige") {
    // La neige crisse : deux craquements serrés.
    souffle("lowpass", 1500, 0.8, 0.2 * v, 0.1);
    souffle("bandpass", 3200, 1.5, 0.08 * v, 0.07, 0.035);
  } else {
    souffle("bandpass", 900, 0.6, 0.3 * v, 0.28);
    souffle("highpass", 3000, 0.5, 0.06 * v, 0.2, 0.04);
  }
}

/** Retombée au sol, plus sourde après une grande chute (`force` de 0 à 1). */
export function atterrir(force: number, sol: Sol) {
  if (!ctx || coupe) return;
  note(80, 0.3 * force + 0.1, 0.18, { vers: 40, glisse: 0.15 });
  pas(sol, 1);
}

/** Notes de la gamme pentatonique (Hz), pour les carillons. */
const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5, 1174.66, 1318.5];

/** Carillon : un lieu découvert (montant, ample), un indice lu, un objet trouvé, un feu allumé. */
export function carillon(sorte: "lieu" | "indice" | "objet" | "feu") {
  if (!ctx || coupe) return;
  const suite = { lieu: [0, 2, 4, 7], indice: [4, 2, 5], objet: [2, 4, 7], feu: [0, 4, 3] }[sorte];
  const ecart = sorte === "lieu" ? 0.22 : 0.13;
  suite.forEach((i, k) => {
    const f = PENTA[i] / (sorte === "lieu" ? 2 : 1);
    note(f, 0.11, sorte === "lieu" ? 3 : 1.6, { quand: k * ecart, reverb: 0.9 });
    note(f * 2, 0.025, 1.2, { quand: k * ecart, reverb: 0.6 });
  });
  // Un lieu découvert : une basse qui tient sous l'arpège.
  if (sorte === "lieu") note(PENTA[0] / 4, 0.09, 4, { reverb: 1, type: "triangle" });
}

/** Une cloche lointaine (ses partiels ne sont pas harmoniques), plus faible avec la distance. */
export function cloche(distance: number, pan: number) {
  if (!ctx || coupe) return;
  const v = 0.12 / (1 + distance / 60);
  const f0 = 196 + Math.random() * 60;
  [1, 2.01, 2.76, 4.07, 5.4].forEach((r, i) => note(f0 * r, v / (1 + i * 0.8), 4.5 - i * 0.6, { pan, reverb: 1.2 }));
}

/** Un oiseau : quelques gazouillis rapides, quelque part autour. */
export function oiseau() {
  if (!ctx || coupe) return;
  const pan = Math.random() * 1.6 - 0.8;
  const base = 2200 + Math.random() * 2200;
  const n = 2 + Math.floor(Math.random() * 4);
  const v = 0.025 + Math.random() * 0.03;
  for (let k = 0; k < n; k++) note(base * (0.9 + Math.random() * 0.25), v, 0.07, { quand: k * (0.09 + Math.random() * 0.05), vers: base * (1.3 + Math.random() * 0.4), glisse: 0.05, pan });
}

/** Un grillon, la nuit : trois stridulations très aiguës. */
export function grillon() {
  if (!ctx || coupe) return;
  const pan = Math.random() * 1.8 - 0.9;
  const f = 4300 + Math.random() * 600;
  for (let k = 0; k < 3; k++) note(f, 0.012, 0.025, { quand: k * 0.05, pan });
}

/** Crépitement d'un feu de camp proche (0 à 1). */
export function crepiter(proximite: number) {
  if (!ctx || coupe) return;
  souffle("highpass", 2500, 0.7, 0.05 * proximite, 0.02 + Math.random() * 0.02, 0, Math.random() * 0.6 - 0.3);
}

/** Un mouton bêle, plus ou moins loin (m) : une voix nasillarde qui chevrote. */
export function beler(distance: number) {
  if (!ctx || coupe) return;
  const c = ctx;
  const t = c.currentTime;
  const v = 0.07 / (1 + distance / 15);
  const o = c.createOscillator();
  o.type = "sawtooth";
  const f = 260 + Math.random() * 120;
  o.frequency.setValueAtTime(f, t);
  o.frequency.linearRampToValueAtTime(f * 0.92, t + 0.7);
  // Le chevrotement : la hauteur tremble vite.
  const tremble = c.createOscillator();
  tremble.frequency.value = 22;
  const ampleur = c.createGain();
  ampleur.gain.value = f * 0.04;
  tremble.connect(ampleur).connect(o.frequency);
  const voix = c.createBiquadFilter();
  voix.type = "bandpass";
  voix.frequency.value = 1100;
  voix.Q.value = 2.5;
  const g = sortie(Math.random() * 1.2 - 0.6, 0.3);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(v, t + 0.06);
  g.gain.setValueAtTime(v, t + 0.45);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.75);
  o.connect(voix).connect(g);
  for (const s of [o, tremble]) (s.start(t), s.stop(t + 0.8));
}
