import { useEffect, useRef, useState } from "react";
import { FEUX, LIEUX, REGIONS } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { lesExplorees, useJeu } from "../game/store";
import { capturerSouris, teleporterVers } from "../player/Joueur";
import { centreCellule, laCarte, MER, versMonde } from "../world/carte";
import { lePlan } from "../world/plan";
import { hauteurTerrain } from "../world/relief";

/**
 * Carte dessinée par le jeu à partir du monde lui-même : relief ombré, courbes de niveau,
 * côtes, profondeur de la mer, régions. Un brouillard couvre ce qui n'a pas été exploré.
 * Une seule image partagée par la mini-carte et la carte du journal.
 */

/** Pixels de carte par cellule du monde (une cellule = 16 m). */
const ECHELLE = 2;
const PARCHEMIN = [222, 206, 168];
const ENCRE = [46, 38, 30];
const EAU_CLAIRE = [158, 190, 184];
const EAU_PROFONDE = [72, 104, 118];
/** Écart entre deux courbes de niveau, en m. */
const COURBES = 20;

const hex = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const melange = (a: number[], b: number[], t: number) => a.map((v, k) => v + (b[k] - v) * t);

let fond: HTMLCanvasElement | null = null;
const composite = document.createElement("canvas");
const masque = document.createElement("canvas");
let versionDessinee = "";

/** Dessine la carte complète, sans brouillard (une fois, pendant le chargement). */
export function preparerCarte() {
  if (fond) return fond;
  const c = laCarte();
  const L = c.largeur;
  const H = c.hauteur;
  const W = L * ECHELLE;
  const Hc = H * ECHELLE;

  // Altitude au centre de chaque cellule, puis interpolée pour chaque pixel (côtes et ombres lisses).
  const alt = new Float32Array(L * H);
  for (let i = 0; i < alt.length; i++) alt[i] = hauteurTerrain(...centreCellule(i));
  // Couleur de région de chaque cellule (la mer : parchemin, ce qui dessine un liseré le long des côtes).
  const teintes = REGIONS.map((r) => melange(PARCHEMIN, hex(r.sol[0]), 0.5));
  const coul = new Float32Array(L * H * 3);
  for (let i = 0; i < L * H; i++) coul.set(c.region[i] === MER ? PARCHEMIN : teintes[c.region[i]], i * 3);

  const h = new Float32Array(W * Hc);
  const rgb = new Float32Array(W * Hc * 3);
  for (let py = 0; py < Hc; py++)
    for (let px = 0; px < W; px++) {
      const fx = Math.min(L - 1.001, Math.max(0, (px + 0.5) / ECHELLE - 0.5));
      const fy = Math.min(H - 1.001, Math.max(0, (py + 0.5) / ECHELLE - 0.5));
      const x0 = Math.floor(fx);
      const y0 = Math.floor(fy);
      const tx = fx - x0;
      const ty = fy - y0;
      const i = y0 * L + x0;
      const poids = [(1 - tx) * (1 - ty), tx * (1 - ty), (1 - tx) * ty, tx * ty];
      const voisins = [i, i + 1, i + L, i + L + 1];
      const k = py * W + px;
      for (let v = 0; v < 4; v++) {
        h[k] += alt[voisins[v]] * poids[v];
        for (let n = 0; n < 3; n++) rgb[k * 3 + n] += coul[voisins[v] * 3 + n] * poids[v];
      }
    }

  fond = document.createElement("canvas");
  fond.width = W;
  fond.height = Hc;
  const ctx = fond.getContext("2d")!;
  const image = ctx.createImageData(W, Hc);
  const regionPixel = (px: number, py: number) => c.region[Math.floor(py / ECHELLE) * L + Math.floor(px / ECHELLE)];
  // Lumière venue du nord-ouest, comme sur les cartes anciennes.
  const [lx, ly, lz] = [-1, -1, 1.2].map((v) => v / Math.hypot(1, 1, 1.2));
  const pas = c.pas / ECHELLE;
  for (let py = 0; py < Hc; py++)
    for (let px = 0; px < W; px++) {
      const k = py * W + px;
      const a = h[k];
      const g = h[py * W + Math.max(0, px - 1)];
      const d = h[py * W + Math.min(W - 1, px + 1)];
      const hh = h[Math.max(0, py - 1) * W + px];
      const b = h[Math.min(Hc - 1, py + 1) * W + px];
      let couleur: number[];
      if (a < 0.3) {
        // Mer et lacs : plus sombres en profondeur, plus clairs près des côtes.
        couleur = melange(EAU_CLAIRE, EAU_PROFONDE, Math.min(1, -a / 14));
        if (Math.max(g, d, hh, b) >= 0.3) couleur = ENCRE;
      } else {
        couleur = [rgb[k * 3], rgb[k * 3 + 1], rgb[k * 3 + 2]];
        // Relief ombré (exagéré deux fois pour bien le lire).
        const nx = (-(d - g) / (2 * pas)) * 2;
        const ny = (-(b - hh) / (2 * pas)) * 2;
        const l = Math.hypot(nx, ny, 1);
        const ombre = Math.max(0, (nx * lx + ny * ly + lz) / l);
        couleur = couleur.map((v) => v * (0.5 + 0.68 * ombre));
        // Courbes de niveau (plus marquées tous les 100 m).
        const niveau = Math.floor(a / COURBES);
        if (niveau !== Math.floor(d / COURBES) || niveau !== Math.floor(b / COURBES)) {
          const majeure = Math.floor(a / 100) !== Math.floor(d / 100) || Math.floor(a / 100) !== Math.floor(b / 100);
          couleur = melange(couleur, ENCRE, majeure ? 0.35 : 0.16);
        }
        // Frontières entre régions, en pointillés.
        const r = regionPixel(px, py);
        const rd = regionPixel(Math.min(W - 1, px + 1), py);
        const rb = regionPixel(px, Math.min(Hc - 1, py + 1));
        if (((rd !== r && rd !== MER) || (rb !== r && rb !== MER)) && (px + py) % 6 < 3) couleur = melange(couleur, ENCRE, 0.55);
      }
      // Grain du papier.
      const grain = 0.95 + (((px * 73856093) ^ (py * 19349663)) & 1023) / 1023 * 0.08;
      image.data[k * 4] = couleur[0] * grain;
      image.data[k * 4 + 1] = couleur[1] * grain;
      image.data[k * 4 + 2] = couleur[2] * grain;
      image.data[k * 4 + 3] = 255;
    }
  ctx.putImageData(image, 0, 0);
  return fond;
}

function dessinerComposite(explore: string) {
  if (versionDessinee === explore) return;
  const c = laCarte();
  const f = preparerCarte();
  composite.width = f.width;
  composite.height = f.height;
  const ctx = composite.getContext("2d")!;
  ctx.drawImage(f, 0, 0);
  // Brouillard : une petite image (une case par cellule) agrandie avec lissage → bords doux.
  masque.width = c.largeur;
  masque.height = c.hauteur;
  const m = masque.getContext("2d")!;
  const donnees = m.createImageData(c.largeur, c.hauteur);
  const bits = lesExplorees(c.largeur * c.hauteur);
  for (let i = 0; i < c.largeur * c.hauteur; i++) {
    const vu = bits[i >> 3] & (1 << (i & 7));
    donnees.data.set([24, 20, 16, vu ? 0 : 238], i * 4);
  }
  m.putImageData(donnees, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(masque, 0, 0, composite.width, composite.height);
  versionDessinee = explore;
}

/** Redessine le brouillard quand l'exploration avance (au plus une fois par seconde). */
function useComposite() {
  const explore = useJeu((s) => s.explore);
  useEffect(() => {
    const t = setTimeout(() => dessinerComposite(explore), versionDessinee ? 1000 : 0);
    return () => clearTimeout(t);
  }, [explore]);
}

/** Mètres → pixels de la carte dessinée. */
function versImage(x: number, z: number): [number, number] {
  const c = laCarte();
  return [(x / c.pas + c.largeur / 2) * ECHELLE, (z / c.pas + c.hauteur / 2) * ECHELLE];
}

function dessinerFleche(ctx: CanvasRenderingContext2D, x: number, y: number, cap: number, taille: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(cap + Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(0, -taille);
  ctx.lineTo(taille * 0.65, taille * 0.8);
  ctx.lineTo(0, taille * 0.35);
  ctx.lineTo(-taille * 0.65, taille * 0.8);
  ctx.closePath();
  ctx.fillStyle = "#f1dcaa";
  ctx.strokeStyle = "#1a1510";
  ctx.lineWidth = 2;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

/** Mini-carte ronde en haut à droite, nord en haut. */
export function MiniCarte() {
  useComposite();
  const toile = useRef<HTMLCanvasElement>(null);
  const TAILLE = 190;
  /** Rayon visible autour du joueur, en m. */
  const RAYON = 150;

  useEffect(() => {
    let id = 0;
    let dernierX = NaN, dernierZ = NaN, dernierCap = NaN;
    const boucle = () => {
      id = requestAnimationFrame(boucle);
      // Ne redessine que si le joueur a bougé ou tourné (évite 60 drawImage/s à l'arrêt).
      if (
        Math.abs(positionJoueur.x - dernierX) < 0.5 &&
        Math.abs(positionJoueur.z - dernierZ) < 0.5 &&
        Math.abs(positionJoueur.cap - dernierCap) < 0.005
      ) return;
      const ctx = toile.current?.getContext("2d");
      if (!ctx || !composite.width) return;
      dernierX = positionJoueur.x;
      dernierZ = positionJoueur.z;
      dernierCap = positionJoueur.cap;
      const c = laCarte();
      const r = (RAYON / c.pas) * ECHELLE;
      const [px, py] = versImage(positionJoueur.x, positionJoueur.z);
      ctx.clearRect(0, 0, TAILLE, TAILLE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(TAILLE / 2, TAILLE / 2, TAILLE / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#16130f";
      ctx.fillRect(0, 0, TAILLE, TAILLE);
      ctx.drawImage(composite, px - r, py - r, r * 2, r * 2, 0, 0, TAILLE, TAILLE);
      // Feux de camp découverts.
      const etat = useJeu.getState();
      const plan = lePlan();
      for (const f of etat.feux) {
        const feu = plan.feux[f];
        if (!feu) continue;
        const [fx, fy] = versImage(feu.x, feu.z);
        const sx = TAILLE / 2 + ((fx - px) / r) * (TAILLE / 2);
        const sy = TAILLE / 2 + ((fy - py) / r) * (TAILLE / 2);
        ctx.beginPath();
        ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
        ctx.fillStyle = "#ff9a3a";
        ctx.fill();
      }
      ctx.restore();
      dessinerFleche(ctx, TAILLE / 2, TAILLE / 2, positionJoueur.cap, 8);
    };
    boucle();
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <div className="mini-carte">
      <canvas ref={toile} width={TAILLE} height={TAILLE} />
      <span className="nord">N</span>
    </div>
  );
}

/** Où écrire le nom de chaque région : son point le plus éloigné de ses bords (au cœur de la région). */
let etiquettesRegions: Record<string, [number, number]> | null = null;
function lesEtiquettesRegions() {
  if (etiquettesRegions) return etiquettesRegions;
  const c = laCarte();
  const L = c.largeur;
  const N = c.region.length;
  // Distance (en cellules) au bord de sa région, par un parcours en largeur depuis tous les bords.
  const dist = new Int32Array(N).fill(-1);
  const file: number[] = [];
  for (let i = 0; i < N; i++) {
    if (c.region[i] === MER) continue;
    const x = i % L;
    const voisins = [x > 0 ? i - 1 : -1, x < L - 1 ? i + 1 : -1, i - L, i + L];
    if (voisins.some((j) => j < 0 || j >= N || c.region[j] !== c.region[i])) {
      dist[i] = 0;
      file.push(i);
    }
  }
  for (let k = 0; k < file.length; k++) {
    const i = file[k];
    const x = i % L;
    for (const j of [x > 0 ? i - 1 : -1, x < L - 1 ? i + 1 : -1, i - L, i + L]) {
      if (j < 0 || j >= N || dist[j] >= 0 || c.region[j] !== c.region[i]) continue;
      dist[j] = dist[i] + 1;
      file.push(j);
    }
  }
  const meilleur = REGIONS.map(() => ({ d: -1, i: -1 }));
  for (let i = 0; i < N; i++) {
    const r = c.region[i];
    if (r !== MER && dist[i] > meilleur[r].d) meilleur[r] = { d: dist[i], i };
  }
  etiquettesRegions = Object.fromEntries(REGIONS.map((r, k) => [r.id, meilleur[k].i >= 0 ? centreCellule(meilleur[k].i) : [0, 0]]));
  return etiquettesRegions;
}

/** Grande carte du journal : lieux découverts, feux de camp (voyage rapide), position. */
export function GrandeCarte() {
  useComposite();
  const { lieux, feux, setFondu, fermer, notifier } = useJeu();
  const toile = useRef<HTMLCanvasElement>(null);
  const [pret, setPret] = useState(false);

  useEffect(() => {
    dessinerComposite(useJeu.getState().explore);
    const t = toile.current;
    const ctx = t?.getContext("2d");
    if (!t || !ctx) return;
    t.width = t.clientWidth * devicePixelRatio;
    t.height = (t.width * composite.height) / composite.width;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(composite, 0, 0, t.width, t.height);
    const [px, py] = versImage(positionJoueur.x, positionJoueur.z);
    const k = t.width / composite.width;
    dessinerFleche(ctx, px * k, py * k, positionJoueur.cap, 9 * devicePixelRatio);
    setPret(true);
  }, [lieux]);

  const c = laCarte();
  const echelle = ([x, z]: [number, number]) => ({ left: `${(x / (c.largeur * c.pas) + 0.5) * 100}%`, top: `${(z / (c.hauteur * c.pas) + 0.5) * 100}%` });
  const plan = lePlan();
  const regions = lesEtiquettesRegions();

  const voyager = (id: string) => {
    const feu = FEUX.find((f) => f.id === id)!;
    const [x, z] = plan.feux[id].arrivee;
    setFondu(true);
    fermer();
    capturerSouris();
    setTimeout(() => teleporterVers(x, z), 600);
    setTimeout(() => {
      setFondu(false);
      notifier(feu.nom, "Tu te reposes au coin du feu.");
    }, 1300);
  };

  return (
    <div className="grande-carte">
      <canvas ref={toile} />
      {pret &&
        REGIONS.filter((r) => lieux.includes(r.id)).map((r) => (
          <span key={r.id} className="etiquette-carte region" style={echelle(regions[r.id])}>
            {r.nom}
          </span>
        ))}
      {pret &&
        LIEUX.filter((l) => lieux.includes(l.id)).map((l) => (
          <span key={l.id} className="etiquette-carte" style={echelle(versMonde(l.position))}>
            {l.nom}
          </span>
        ))}
      {pret &&
        FEUX.filter((f) => feux.includes(f.id)).map((f) => (
          <button key={f.id} className="feu-carte" style={echelle([plan.feux[f.id].x, plan.feux[f.id].z])} onClick={() => voyager(f.id)} title={`Voyager · ${f.nom}`}>
            <span className="flamme" />
            <em>{f.nom}</em>
          </button>
        ))}
    </div>
  );
}
