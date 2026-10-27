import { useCallback, useEffect, useRef, useState, type PointerEvent as PE } from "react";
import { BARRIERES, DECORS, FEUX, INDICES, LIEUX, PORTS, RAMASSABLES, REGLAGES, VILLAGES } from "../content/monde";
import type { Px } from "../content/types";
import { CATEGORIES, type Annotation, type Categorie, type Fichier, type Forme } from "./types";

/** Taille de public/carte.jpg, en pixels. */
const L = 1920;
const H = 1080;

type Outil = "main" | Forme;
type Vue = { x: number; y: number; l: number };

const OUTILS: { id: Outil; nom: string; aide: string }[] = [
  { id: "main", nom: "Main", aide: "Glisser pour déplacer la carte, cliquer une annotation pour la modifier" },
  { id: "ping", nom: "Ping", aide: "Cliquer pour poser un point" },
  { id: "trait", nom: "Pinceau", aide: "Dessiner un trait (chemin, rivière, frontière…)" },
  { id: "zone", nom: "Zone", aide: "Entourer une zone (forêt, lac, quartier…)" },
];

const nouvelId = () => Math.random().toString(36).slice(2, 9);
const arrondi = ([x, y]: Px): Px => [Math.round(x), Math.round(y)];

/** Ce qui est déjà dans le jeu, pour se repérer. */
const EXISTANT: { position: Px; nom: string; rayon?: number }[] = [
  ...VILLAGES.map((v) => ({ position: v.centre, nom: `Village : ${v.id}`, rayon: v.rayon / REGLAGES.metresParPixel })),
  ...LIEUX.map((l) => ({ position: l.position, nom: l.nom })),
  ...PORTS.map((p) => ({ position: p.position, nom: `Port : ${p.nom}` })),
  ...FEUX.map((f) => ({ position: f.position, nom: `Feu : ${f.nom}` })),
  ...INDICES.map((i) => ({ position: i.position, nom: `Indice : ${i.titre}` })),
  ...DECORS.map((d) => ({ position: d.position, nom: `Décor : ${d.modele}` })),
  ...RAMASSABLES.map((r) => ({ position: r.position, nom: `Objet : ${r.objet}` })),
  ...BARRIERES.map((b) => ({ position: b.position, nom: `Barrière : ${b.id}` })),
];

export function Editeur() {
  const [annotations, setAnnotations] = useState<Annotation[] | null>(null);
  const [historique, setHistorique] = useState<Annotation[][]>([]);
  const [outil, setOutil] = useState<Outil>("ping");
  const [categorie, setCategorie] = useState<Categorie>("village");
  const [couleur, setCouleur] = useState<string>(CATEGORIES.village.couleur);
  const [selection, setSelection] = useState<string | null>(null);
  const [vue, setVue] = useState<Vue>({ x: 0, y: 0, l: L });
  const [existant, setExistant] = useState(true);
  const [etat, setEtat] = useState("");
  const [curseur, setCurseur] = useState<Px | null>(null);
  const [trace, setTrace] = useState<Px[] | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const glisse = useRef<{ type: "vue"; depart: Px; vue: Vue } | { type: "ping"; id: string } | null>(null);
  const enregistre = useRef<string>("");

  // ─── Chargement et enregistrement ─────────────────────────────────────────
  useEffect(() => {
    fetch("/__annotations")
      .then((r) => r.json() as Promise<Fichier>)
      .then((f) => {
        enregistre.current = JSON.stringify(f.annotations);
        setAnnotations(f.annotations);
      })
      .catch(() => setEtat("Impossible de lire plans/annotations.json : lance « npm run dev »."));
  }, []);

  // Claude modifie aussi le fichier (statut, réponses) : on le relit s'il a changé et que rien n'est en attente ici.
  const actuelles = useRef(annotations);
  actuelles.current = annotations;
  useEffect(() => {
    const t = setInterval(() => {
      if (JSON.stringify(actuelles.current) !== enregistre.current) return;
      fetch("/__annotations")
        .then((r) => r.json() as Promise<Fichier>)
        .then((f) => {
          const texte = JSON.stringify(f.annotations);
          if (texte === enregistre.current || JSON.stringify(actuelles.current) !== enregistre.current) return;
          enregistre.current = texte;
          setAnnotations(f.annotations);
          setEtat("Mis à jour par Claude");
        })
        .catch(() => {});
    }, 3000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!annotations) return;
    const texte = JSON.stringify(annotations);
    if (texte === enregistre.current) return;
    setEtat("Enregistrement…");
    const t = setTimeout(() => {
      fetch("/__annotations", { method: "PUT", body: JSON.stringify({ annotations } satisfies Fichier, null, 2) })
        .then((r) => {
          if (!r.ok) throw new Error();
          enregistre.current = texte;
          setEtat("Enregistré");
        })
        .catch(() => setEtat("Échec de l'enregistrement"));
    }, 400);
    return () => clearTimeout(t);
  }, [annotations]);

  /** Modifie les annotations en gardant l'état précédent pour Ctrl+Z. */
  const modifier = useCallback(
    (f: (a: Annotation[]) => Annotation[], memoriser = true) => {
      if (!annotations) return;
      if (memoriser) setHistorique((h) => [...h.slice(-50), annotations]);
      setAnnotations(f(annotations));
    },
    [annotations],
  );
  const changer = (id: string, champs: Partial<Annotation>, memoriser = false) =>
    modifier((a) => a.map((n) => (n.id === id ? { ...n, ...champs } : n)), memoriser);
  const supprimer = useCallback(
    (id: string) => {
      modifier((a) => a.filter((n) => n.id !== id));
      setSelection(null);
    },
    [modifier],
  );

  useEffect(() => {
    const touche = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) return;
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && historique.length) {
        setAnnotations(historique[historique.length - 1]);
        setHistorique((h) => h.slice(0, -1));
      } else if ((e.key === "Delete" || e.key === "Backspace") && selection) supprimer(selection);
      else if (e.key === "Escape") setSelection(null);
    };
    window.addEventListener("keydown", touche);
    return () => window.removeEventListener("keydown", touche);
  }, [historique, selection, supprimer]);

  // ─── Souris ───────────────────────────────────────────────────────────────
  const surCarte = (e: { clientX: number; clientY: number }): Px => {
    const m = svg.current!.getScreenCTM()!.inverse();
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m);
    return [p.x, p.y];
  };

  const creer = (forme: Forme, points: Px[]) => {
    const a: Annotation = { id: nouvelId(), forme, categorie, points, couleur, nom: "", note: "", statut: "a-faire", cree: new Date().toISOString() };
    modifier((liste) => [...liste, a]);
    setSelection(a.id);
  };

  const appui = (e: PE<SVGSVGElement>) => {
    svg.current!.setPointerCapture(e.pointerId);
    const p = surCarte(e);
    if (e.button === 1 || e.button === 2 || outil === "main") {
      glisse.current = { type: "vue", depart: [e.clientX, e.clientY], vue };
      return;
    }
    if (outil === "ping") creer("ping", [arrondi(p)]);
    else setTrace([arrondi(p)]);
  };

  const mouvement = (e: PE<SVGSVGElement>) => {
    const p = surCarte(e);
    setCurseur(arrondi(p));
    const g = glisse.current;
    if (g?.type === "vue") {
      const echelle = g.vue.l / svg.current!.clientWidth;
      setVue({ ...g.vue, x: g.vue.x - (e.clientX - g.depart[0]) * echelle, y: g.vue.y - (e.clientY - g.depart[1]) * echelle });
    } else if (g?.type === "ping") {
      setAnnotations((a) => a && a.map((n) => (n.id === g.id ? { ...n, points: [arrondi(p)] } : n)));
    } else if (trace) {
      const [dx, dy] = [p[0] - trace[trace.length - 1][0], p[1] - trace[trace.length - 1][1]];
      if (Math.hypot(dx, dy) > vue.l / 400) setTrace([...trace, arrondi(p)]);
    }
  };

  const relache = () => {
    glisse.current = null;
    if (trace) {
      if (trace.length > 2) creer(outil as Forme, trace);
      setTrace(null);
    }
  };

  const molette = (e: React.WheelEvent) => {
    const [px, py] = surCarte(e);
    const k = Math.exp(e.deltaY * 0.0015);
    const l = Math.min(L * 1.5, Math.max(120, vue.l * k));
    const r = l / vue.l;
    setVue({ l, x: px - (px - vue.x) * r, y: py - (py - vue.y) * r });
  };

  const choisirAnnotation = (e: PE, a: Annotation) => {
    if (outil !== "main") return;
    e.stopPropagation();
    setSelection(a.id);
    if (a.forme === "ping") {
      svg.current!.setPointerCapture(e.pointerId);
      setHistorique((h) => [...h.slice(-50), annotations!]);
      glisse.current = { type: "ping", id: a.id };
    }
  };

  // ─── Affichage ────────────────────────────────────────────────────────────
  const z = vue.l / L; // taille des repères : constante à l'écran quel que soit le zoom
  const choisie = annotations?.find((a) => a.id === selection) ?? null;
  const aFaire = annotations?.filter((a) => a.statut === "a-faire") ?? [];
  const faites = annotations?.filter((a) => a.statut === "fait") ?? [];

  const dessiner = (a: Annotation, provisoire = false) => {
    const actif = a.id === selection;
    const style = { cursor: outil === "main" ? "pointer" : undefined, opacity: a.statut === "fait" ? 0.55 : 1 };
    const evts = provisoire ? {} : { onPointerDown: (e: PE) => choisirAnnotation(e, a) };
    if (a.forme === "ping") {
      const [x, y] = a.points[0];
      return (
        <g key={a.id} {...evts} style={style}>
          <circle cx={x} cy={y} r={9 * z} fill={a.couleur} stroke={actif ? "#fff" : "#1a140c"} strokeWidth={(actif ? 3 : 1.5) * z} />
          <text x={x} y={y + 3.5 * z} fontSize={10 * z} textAnchor="middle" fill="#1a140c" fontWeight={600}>
            {CATEGORIES[a.categorie].nom[0]}
          </text>
          {a.nom && (
            <text x={x} y={y + 22 * z} fontSize={13 * z} textAnchor="middle" className="etiquette" strokeWidth={3 * z}>
              {a.nom}
            </text>
          )}
        </g>
      );
    }
    const pts = a.points.map((p) => p.join(",")).join(" ");
    const milieu = a.points[Math.floor(a.points.length / 2)];
    return (
      <g key={a.id} {...evts} style={style}>
        {a.forme === "zone" ? (
          <polygon points={pts} fill={a.couleur} fillOpacity={0.3} stroke={actif ? "#fff" : a.couleur} strokeWidth={(actif ? 3 : 2) * z} />
        ) : (
          <polyline points={pts} fill="none" stroke={actif ? "#fff" : a.couleur} strokeWidth={(actif ? 6 : 4) * z} strokeLinecap="round" strokeLinejoin="round" />
        )}
        {a.nom && (
          <text x={milieu[0]} y={milieu[1]} fontSize={13 * z} textAnchor="middle" className="etiquette" strokeWidth={3 * z}>
            {a.nom}
          </text>
        )}
      </g>
    );
  };

  const ligne = (a: Annotation) => (
    <li key={a.id} className={a.id === selection ? "choisie" : ""} onClick={() => setSelection(a.id)}>
      <span className="pastille" style={{ background: a.couleur }} />
      <span>{a.nom || <em>{CATEGORIES[a.categorie].nom}</em>}</span>
      {a.reponse && <span className="a-reponse" title={a.reponse}>réponse</span>}
    </li>
  );

  return (
    <div className="editeur">
      <aside>
        <h1>Carte de travail</h1>

        <section>
          <h2>Outil</h2>
          <div className="boutons">
            {OUTILS.map((o) => (
              <button key={o.id} className={outil === o.id ? "actif" : ""} title={o.aide} onClick={() => setOutil(o.id)}>
                {o.nom}
              </button>
            ))}
          </div>
          <p className="aide">{OUTILS.find((o) => o.id === outil)!.aide}. Molette : zoom, clic droit : déplacer.</p>
        </section>

        <section>
          <h2>Quoi</h2>
          <div className="categories">
            {(Object.keys(CATEGORIES) as Categorie[]).map((c) => (
              <button
                key={c}
                className={categorie === c ? "actif" : ""}
                onClick={() => {
                  setCategorie(c);
                  setCouleur(CATEGORIES[c].couleur);
                }}
              >
                <span className="pastille" style={{ background: CATEGORIES[c].couleur }} />
                {CATEGORIES[c].nom}
              </button>
            ))}
          </div>
          <label className="couleur">
            Couleur <input type="color" value={couleur} onChange={(e) => setCouleur(e.target.value)} />
          </label>
        </section>

        {choisie && (
          <section className="fiche">
            <h2>Annotation</h2>
            <input placeholder="Nom (ex. Port-Brume)" value={choisie.nom} onChange={(e) => changer(choisie.id, { nom: e.target.value })} autoFocus />
            <textarea
              placeholder="Ce que tu veux ici (ex. un petit village de pêcheurs, 6 maisons, un ponton)"
              value={choisie.note}
              rows={4}
              onChange={(e) => changer(choisie.id, { note: e.target.value })}
            />
            <select value={choisie.categorie} onChange={(e) => changer(choisie.id, { categorie: e.target.value as Categorie }, true)}>
              {(Object.keys(CATEGORIES) as Categorie[]).map((c) => (
                <option key={c} value={c}>
                  {CATEGORIES[c].nom}
                </option>
              ))}
            </select>
            {choisie.reponse && <p className="reponse">Claude : {choisie.reponse}</p>}
            <div className="boutons">
              <button onClick={() => changer(choisie.id, { statut: choisie.statut === "fait" ? "a-faire" : "fait" }, true)}>
                {choisie.statut === "fait" ? "Remettre à faire" : "Marquer fait"}
              </button>
              <button className="danger" onClick={() => supprimer(choisie.id)}>
                Supprimer
              </button>
            </div>
          </section>
        )}

        <section className="liste">
          <h2>À faire ({aFaire.length})</h2>
          <ul>{aFaire.map(ligne)}</ul>
          {faites.length > 0 && (
            <>
              <h2>Fait ({faites.length})</h2>
              <ul className="faites">{faites.map(ligne)}</ul>
            </>
          )}
        </section>

        <footer>
          <label>
            <input type="checkbox" checked={existant} onChange={(e) => setExistant(e.target.checked)} /> Montrer ce qui est déjà dans le jeu
          </label>
          <div className="etat">
            {etat} {curseur && `· ${curseur[0]}, ${curseur[1]}`}
          </div>
        </footer>
      </aside>

      <svg
        ref={svg}
        viewBox={`${vue.x} ${vue.y} ${vue.l} ${(vue.l * H) / L}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={appui}
        onPointerMove={mouvement}
        onPointerUp={relache}
        onPointerLeave={() => setCurseur(null)}
        onWheel={molette}
        onContextMenu={(e) => e.preventDefault()}
        className={`outil-${outil}`}
      >
        <image href="/carte.jpg" width={L} height={H} />
        {existant &&
          EXISTANT.map((e, i) => (
            <g key={i} className="existant">
              <title>{e.nom}</title>
              {e.rayon && <circle cx={e.position[0]} cy={e.position[1]} r={e.rayon} />}
              <rect x={e.position[0] - 4 * z} y={e.position[1] - 4 * z} width={8 * z} height={8 * z} transform={`rotate(45 ${e.position[0]} ${e.position[1]})`} />
            </g>
          ))}
        {annotations?.map((a) => dessiner(a))}
        {trace && dessiner({ id: "trace", forme: outil as Forme, categorie, points: trace, couleur, nom: "", note: "", statut: "a-faire", cree: "" }, true)}
      </svg>
    </div>
  );
}
