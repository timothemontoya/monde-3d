import { useState } from "react";
import { ESPECES, INDICES, LIEUX, OBJETS, REGIONS, SUCCES } from "../content/monde";
import type { Lore, Region } from "../content/types";
import { MER, regionA, versMonde } from "../world/carte";
import { indiceParId, loreConnue, remplie, useJeu, type Onglet } from "../game/store";
import { GrandeCarte } from "./Carte";

const lieuParId = (id: string) => LIEUX.find((l) => l.id === id) ?? REGIONS.find((r) => r.id === id);

/** Paragraphes de lore : révélés, ou « · · · » s'ils restent à découvrir. */
export function Paragraphes({ lieu, lore }: { lieu: string; lore: Lore[] }) {
  const etat = useJeu();
  return (
    <>
      {lore.map((l, i) =>
        loreConnue(lieu, l, etat) ? (
          <p key={i} className="lore">
            {l.texte}
          </p>
        ) : (
          <p key={i} className="lore cache">
            · · · <small>à découvrir</small>
          </p>
        ),
      )}
    </>
  );
}

/** Espèces qui vivent dans un lieu : nom si rencontrée, « ??? » sinon. */
export function EspecesDuLieu({ id }: { id: string }) {
  const etat = useJeu();
  const especes = ESPECES.filter((e) => e.habitat.includes(id));
  if (!especes.length) return null;
  return (
    <div className="especes-lieu">
      <h5>Espèces</h5>
      <ul>
        {especes.map((e) => (
          <li key={e.id}>{remplie(e.quand, etat) ? e.nom : "???"}</li>
        ))}
      </ul>
    </div>
  );
}

/** Les lieux-dits rangés par région (celle où se trouve leur centre). */
const lieuxParRegion = (() => {
  let cache: Map<number, typeof LIEUX> | null = null;
  return () => {
    if (!cache) {
      cache = new Map();
      for (const l of LIEUX) {
        const r = regionA(...versMonde(l.position));
        cache.set(r, [...(cache.get(r) ?? []), l]);
      }
    }
    return cache;
  };
})();

/** Combien de paragraphes d'un lieu on connaît. */
function fragments(id: string, lore: Lore[], etat: ReturnType<typeof useJeu.getState>) {
  return { connus: lore.filter((l) => loreConnue(id, l, etat)).length, total: lore.length };
}

/** Lieux : la liste des régions et de leurs lieux-dits à gauche, la fiche de celui qu'on lit à droite. */
function OngletLieux() {
  const etat = useJeu();
  const { lieux } = etat;
  const [choisi, setChoisi] = useState<string | null>(null);
  if (!lieux.length) return <p className="vide">Aucun lieu découvert pour l'instant.</p>;
  // Par défaut, le dernier lieu découvert.
  const id = choisi && lieux.includes(choisi) ? choisi : lieux[lieux.length - 1];
  const fiche = lieuParId(id);
  const groupes = [...REGIONS.map((r, i) => ({ region: r as Region | null, index: i })), { region: null, index: MER }]
    .map(({ region, index }) => {
      const tous = lieuxParRegion().get(index) ?? [];
      return { region, connus: tous.filter((l) => lieux.includes(l.id)), restants: tous.filter((l) => !lieux.includes(l.id)).length };
    })
    .filter((g) => (g.region && lieux.includes(g.region.id)) || g.connus.length);
  const bouton = (l: { id: string; nom: string; lore: Lore[] }, classe: string, nom = l.nom) => {
    const f = fragments(l.id, l.lore, etat);
    return (
      <button key={l.id} className={`${classe} ${l.id === id ? "actif" : ""}`} onClick={() => setChoisi(l.id)}>
        <span>{nom}</span>
        {f.total > 0 && <small className={f.connus === f.total ? "complet" : ""}>{f.connus}/{f.total}</small>}
      </button>
    );
  };
  return (
    <div className="journal-lieux">
      <nav className="lieux-liste">
        {groupes.map((g) => (
          <div key={g.region?.id ?? "mer"} className="lieux-groupe">
            {g.region && lieux.includes(g.region.id) ? bouton(g.region, "lieu-region") : <p className="lieu-region inconnue">{g.region ? "Région inconnue" : "En mer"}</p>}
            {g.connus.map((l) => bouton(l, "lieu-dit"))}
            {g.restants > 0 && (
              <p className="lieu-restant">
                {g.restants} lieu{g.restants > 1 ? "x" : ""} à découvrir
              </p>
            )}
          </div>
        ))}
      </nav>
      {fiche && (
        <article className="lieu-fiche" key={id}>
          <p className="sur-titre">{fiche.sousTitre}</p>
          <h3>{fiche.nom}</h3>
          <div className="filet gauche" />
          <Paragraphes lieu={fiche.id} lore={fiche.lore} />
          <EspecesDuLieu id={fiche.id} />
        </article>
      )}
    </div>
  );
}

function OngletIndices() {
  const { indices } = useJeu();
  const trouves = INDICES.filter((i) => indices.includes(i.id));
  const restants = INDICES.length - trouves.length;
  if (!trouves.length) return <p className="vide">Aucun indice pour l'instant.</p>;
  return (
    <div className="grille-cartes">
      {trouves.map((i) => (
        <article key={i.id} id={`indice-${i.id}`} className="fiche">
          <h4>{i.titre}</h4>
          <p>{i.texte}</p>
          {i.liens?.length ? (
            <p className="liens">
              Lié à :{" "}
              {i.liens.map((l, k) => (
                <span key={l}>
                  {k > 0 && " · "}
                  {indices.includes(l) ? (
                    <a href={`#indice-${l}`} onClick={(e) => (e.preventDefault(), document.getElementById(`indice-${l}`)?.scrollIntoView({ behavior: "smooth", block: "center" }))}>
                      {indiceParId(l).titre}
                    </a>
                  ) : (
                    "???"
                  )}
                </span>
              ))}
            </p>
          ) : null}
        </article>
      ))}
      {restants > 0 && (
        <article className="fiche inconnu">
          <h4>
            {restants} indice{restants > 1 ? "s" : ""} encore caché{restants > 1 ? "s" : ""}
          </h4>
          <p>À trouver en explorant le monde.</p>
        </article>
      )}
    </div>
  );
}

function OngletEspeces() {
  const etat = useJeu();
  return (
    <div className="grille-cartes">
      {ESPECES.map((e) => {
        const connue = remplie(e.quand, etat);
        return (
          <article key={e.id} className={`fiche ${connue ? "" : "inconnu"}`}>
            <h4>{connue ? e.nom : "Espèce inconnue"}</h4>
            <p>{connue ? e.description : "Tu n'as pas encore croisé cette créature."}</p>
            <p className="liens">Habitat : {e.habitat.map((h) => (etat.lieux.includes(h) ? lieuParId(h)?.nom : "???")).join(" · ")}</p>
          </article>
        );
      })}
    </div>
  );
}

function OngletSac() {
  const { objets, enMain, tenir } = useJeu();
  if (!objets.length) return <p className="vide">Ton sac est vide.</p>;
  return (
    <div className="grille-cartes sac">
      {OBJETS.filter((o) => objets.includes(o.id)).map((o, i) => (
        <article key={o.id} className={`fiche objet ${enMain === o.id ? "en-main" : ""}`}>
          <h4>
            <kbd>{i + 1}</kbd> {o.nom}
            {enMain === o.id && <small>en main</small>}
          </h4>
          <p>{o.description}</p>
          <button className="bouton" onClick={() => tenir(o.id)}>
            {enMain === o.id ? "Ranger" : "Prendre en main"}
          </button>
        </article>
      ))}
    </div>
  );
}

function OngletSucces() {
  const { succes } = useJeu();
  return (
    <ul className="liste-succes">
      {SUCCES.map((s) => {
        const obtenu = succes.includes(s.id);
        const cache = s.secret && !obtenu;
        return (
          <li key={s.id} className={obtenu ? "obtenu" : ""}>
            <span className="sceau">{obtenu ? "✦" : cache ? "?" : "◇"}</span>
            <div>
              <strong>{cache ? "Succès secret" : s.titre}</strong>
              <span>{cache ? "???" : s.description}</span>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

const ONGLETS: { id: Onglet; nom: string }[] = [
  { id: "carte", nom: "Carte" },
  { id: "lieux", nom: "Lieux" },
  { id: "indices", nom: "Indices" },
  { id: "especes", nom: "Espèces" },
  { id: "sac", nom: "Sac" },
  { id: "succes", nom: "Succès" },
];

/** Ce qu'on a trouvé de chaque catégorie, affiché sur les onglets. */
function compte(onglet: Onglet, etat: ReturnType<typeof useJeu.getState>): string | null {
  if (onglet === "lieux") return `${etat.lieux.length}/${LIEUX.length + REGIONS.length}`;
  if (onglet === "indices") return `${etat.indices.length}/${INDICES.length}`;
  if (onglet === "especes") return `${ESPECES.filter((e) => remplie(e.quand, etat)).length}/${ESPECES.length}`;
  if (onglet === "sac") return etat.objets.length ? `${etat.objets.length}` : null;
  if (onglet === "succes") return `${etat.succes.length}/${SUCCES.length}`;
  return null;
}

export function Journal({ onglet }: { onglet: Onglet }) {
  const etat = useJeu();
  return (
    <>
      <div className="onglets">
        {ONGLETS.map((o) => {
          const n = compte(o.id, etat);
          return (
            <button key={o.id} className={onglet === o.id ? "actif" : ""} onClick={() => etat.ouvrir({ type: "journal", onglet: o.id })}>
              {o.nom}
              {n && <small>{n}</small>}
            </button>
          );
        })}
      </div>
      {onglet === "carte" && <GrandeCarte />}
      {onglet === "lieux" && <OngletLieux />}
      {onglet === "indices" && <OngletIndices />}
      {onglet === "especes" && <OngletEspeces />}
      {onglet === "sac" && <OngletSac />}
      {onglet === "succes" && <OngletSucces />}
    </>
  );
}
