import { useEffect, useRef, useState } from "react";
import { FEUX, LIEUX, REGIONS, REGLAGES } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { lesExplorees, useJeu } from "../game/store";
import { capturerSouris, teleporterVers } from "../player/Joueur";
import { laCarte, versCarte } from "../world/carte";

/**
 * Ton dessin, avec un brouillard sur ce qui n'a pas encore été exploré.
 * Une seule image partagée par la mini-carte et la carte du journal, refaite quand on explore.
 */
let image: HTMLImageElement | null = null;
const composite = document.createElement("canvas");
const masque = document.createElement("canvas");
let versionDessinee = "";

function dessinerComposite(explore: string) {
  if (!image?.complete || versionDessinee === explore) return;
  const c = laCarte();
  composite.width = image.naturalWidth;
  composite.height = image.naturalHeight;
  const ctx = composite.getContext("2d")!;
  ctx.drawImage(image, 0, 0);
  // Brouillard : une petite image (une case par cellule) agrandie avec lissage → bords doux.
  masque.width = c.largeur;
  masque.height = c.hauteur;
  const m = masque.getContext("2d")!;
  const donnees = m.createImageData(c.largeur, c.hauteur);
  const bits = lesExplorees(c.largeur * c.hauteur);
  for (let i = 0; i < c.largeur * c.hauteur; i++) {
    const vu = bits[i >> 3] & (1 << (i & 7));
    donnees.data.set([22, 19, 15, vu ? 0 : 235], i * 4);
  }
  m.putImageData(donnees, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(masque, 0, 0, composite.width, composite.height);
  versionDessinee = explore;
}

/** Charge l'image et redessine le brouillard quand l'exploration avance. */
function useComposite() {
  const explore = useJeu((s) => s.explore);
  const [, setPret] = useState(false);
  useEffect(() => {
    if (image) return;
    image = new Image();
    image.onload = () => setPret(true);
    image.src = `${import.meta.env.BASE_URL}${REGLAGES.carte}`;
  }, []);
  // Redessin au plus une fois par seconde (l'exploration change souvent).
  useEffect(() => {
    const t = setTimeout(() => dessinerComposite(explore), versionDessinee ? 1000 : 0);
    return () => clearTimeout(t);
  }, [explore]);
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
  /** Pixels de carte visibles autour du joueur (rayon). */
  const RAYON_CARTE = 130;

  useEffect(() => {
    let id = 0;
    const boucle = () => {
      id = requestAnimationFrame(boucle);
      const ctx = toile.current?.getContext("2d");
      if (!ctx || !composite.width) return;
      const [px, py] = versCarte(positionJoueur.x, positionJoueur.z);
      ctx.clearRect(0, 0, TAILLE, TAILLE);
      ctx.save();
      ctx.beginPath();
      ctx.arc(TAILLE / 2, TAILLE / 2, TAILLE / 2 - 2, 0, Math.PI * 2);
      ctx.clip();
      ctx.fillStyle = "#16130f";
      ctx.fillRect(0, 0, TAILLE, TAILLE);
      ctx.drawImage(composite, px - RAYON_CARTE, py - RAYON_CARTE, RAYON_CARTE * 2, RAYON_CARTE * 2, 0, 0, TAILLE, TAILLE);
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

/** Grande carte du journal : lieux découverts, feux de camp (voyage rapide), position. */
export function GrandeCarte() {
  useComposite();
  const { lieux, feux, setFondu, fermer, notifier } = useJeu();
  const toile = useRef<HTMLCanvasElement>(null);
  const [taille, setTaille] = useState({ l: 0, h: 0 });

  useEffect(() => {
    const ctx = toile.current?.getContext("2d");
    if (!ctx || !composite.width || !toile.current) return;
    const l = toile.current.clientWidth;
    const h = (l * composite.height) / composite.width;
    toile.current.width = l;
    toile.current.height = h;
    setTaille({ l, h });
    ctx.drawImage(composite, 0, 0, l, h);
    const [px, py] = versCarte(positionJoueur.x, positionJoueur.z);
    dessinerFleche(ctx, (px / composite.width) * l, (py / composite.height) * h, positionJoueur.cap, 9);
  }, [lieux]);

  const echelle = (p: [number, number]) => ({ left: `${(p[0] / (composite.width || 1)) * 100}%`, top: `${(p[1] / (composite.height || 1)) * 100}%` });

  const voyager = (id: string) => {
    const feu = FEUX.find((f) => f.id === id)!;
    setFondu(true);
    fermer();
    capturerSouris();
    setTimeout(() => teleporterVers(feu.position), 600);
    setTimeout(() => {
      setFondu(false);
      notifier(feu.nom, "Tu te reposes au coin du feu.");
    }, 1300);
  };

  return (
    <div className="grande-carte">
      <canvas ref={toile} />
      {taille.l > 0 &&
        LIEUX.filter((l) => lieux.includes(l.id)).map((l) => (
          <span key={l.id} className="etiquette-carte" style={echelle(l.position)}>
            {l.nom}
          </span>
        ))}
      {taille.l > 0 &&
        REGIONS.filter((r) => r.point && lieux.includes(r.id)).map((r) => (
          <span key={r.id} className="etiquette-carte region" style={echelle(r.point!)}>
            {r.nom}
          </span>
        ))}
      {taille.l > 0 &&
        FEUX.filter((f) => feux.includes(f.id)).map((f) => (
          <button key={f.id} className="feu-carte" style={echelle(f.position)} onClick={() => voyager(f.id)} title={`Voyager · ${f.nom}`}>
            <span className="flamme" />
            <em>{f.nom}</em>
          </button>
        ))}
    </div>
  );
}
