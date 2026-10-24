import { ESPECES, INDICES, LIEUX, OBJETS, REGIONS, SUCCES } from "../content/monde";
import type { Lore } from "../content/types";
import { indiceParId, remplie, useJeu, type Onglet } from "../game/store";
import { GrandeCarte } from "./Carte";

const lieuParId = (id: string) => LIEUX.find((l) => l.id === id) ?? REGIONS.find((r) => r.id === id);

/** Paragraphes de lore : révélés, ou « · · · » s'ils restent à découvrir. */
export function Paragraphes({ lore }: { lore: Lore[] }) {
  const etat = useJeu();
  return (
    <>
      {lore.map((l, i) =>
        remplie(l.quand, etat) ? (
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

function OngletLieux() {
  const { lieux } = useJeu();
  const decouverts = [...REGIONS, ...LIEUX].filter((l) => lieux.includes(l.id));
  if (!decouverts.length) return <p className="vide">Aucun lieu découvert pour l'instant.</p>;
  return (
    <div className="carnet">
      {decouverts.map((l) => (
        <section key={l.id}>
          <h3>
            {l.nom} <small>{l.sousTitre}</small>
          </h3>
          <Paragraphes lore={l.lore} />
          <EspecesDuLieu id={l.id} />
        </section>
      ))}
    </div>
  );
}

function OngletIndices() {
  const { indices } = useJeu();
  const trouves = INDICES.filter((i) => indices.includes(i.id));
  if (!trouves.length) return <p className="vide">Aucun indice pour l'instant.</p>;
  return (
    <div className="carnet">
      {trouves.map((i) => (
        <article key={i.id}>
          <h4>{i.titre}</h4>
          <p>{i.texte}</p>
          {i.liens?.length ? (
            <p className="liens">Lié à : {i.liens.map((l) => (indices.includes(l) ? indiceParId(l).titre : "???")).join(" · ")}</p>
          ) : null}
        </article>
      ))}
    </div>
  );
}

function OngletEspeces() {
  const etat = useJeu();
  return (
    <div className="carnet">
      {ESPECES.map((e) => {
        const connue = remplie(e.quand, etat);
        return (
          <article key={e.id} className={connue ? "" : "inconnu"}>
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
    <ul className="sac">
      {OBJETS.filter((o) => objets.includes(o.id)).map((o, i) => (
        <li key={o.id} className={enMain === o.id ? "en-main" : ""}>
          <div>
            <strong>
              <kbd>{i + 1}</kbd> {o.nom}
            </strong>
            <span>{o.description}</span>
          </div>
          <button className="bouton" onClick={() => tenir(o.id)}>
            {enMain === o.id ? "Ranger" : "Prendre en main"}
          </button>
        </li>
      ))}
    </ul>
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
            <strong>{cache ? "Succès secret" : s.titre}</strong>
            <span>{cache ? "???" : s.description}</span>
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

export function Journal({ onglet }: { onglet: Onglet }) {
  const ouvrir = useJeu((s) => s.ouvrir);
  return (
    <>
      <div className="onglets">
        {ONGLETS.map((o) => (
          <button key={o.id} className={onglet === o.id ? "actif" : ""} onClick={() => ouvrir({ type: "journal", onglet: o.id })}>
            {o.nom}
          </button>
        ))}
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
