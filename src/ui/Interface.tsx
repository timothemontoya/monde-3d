import { useEffect, useRef, useState } from "react";
import { ENIGMES, INDICES, SUCCES, ZONES } from "../content/monde";
import { capturerSouris } from "../player/Joueur";
import { enigmeParId, indiceParId, normaliser, useJeu } from "../game/store";

/**
 * Ferme le panneau. Si on était en jeu, la partie reprend : le clic sur « Fermer »
 * permet de recapturer la souris. Ouvert depuis l'écran titre, on y revient.
 */
function reprendre() {
  const s = useJeu.getState();
  s.fermer();
  if (s.enJeu) capturerSouris();
}

function EcranTitre() {
  const { zones, indices, entrer, ouvrir, reinitialiser } = useJeu();
  const dejaCommence = zones.length > 0 || indices.length > 0;
  return (
    <div className="ecran-titre">
      <div className="titre-bloc">
        <p className="sur-titre">Un monde à découvrir</p>
        <h1>L'Île sans nom</h1>
        <div className="filet" />
        <button
          className="bouton bouton-principal"
          onClick={() => {
            entrer();
            capturerSouris();
          }}
        >
          {dejaCommence ? "Reprendre l'exploration" : "Entrer dans le monde"}
        </button>
        {dejaCommence && (
          <div className="boutons-secondaires">
            <button className="bouton" onClick={() => ouvrir({ type: "carnet" })}>
              Carnet
            </button>
            <button
              className="bouton"
              onClick={() => {
                if (confirm("Effacer toute la progression ?")) reinitialiser();
              }}
            >
              Recommencer
            </button>
          </div>
        )}
      </div>
      <ul className="commandes">
        <li><kbd>Souris</kbd> regarder</li>
        <li><kbd>Z Q S D</kbd> se déplacer</li>
        <li><kbd>Espace</kbd> / <kbd>C</kbd> monter / descendre</li>
        <li><kbd>Maj</kbd> aller vite</li>
        <li><kbd>E</kbd> examiner</li>
        <li><kbd>Tab</kbd> carnet</li>
        <li><kbd>Échap</kbd> pause</li>
      </ul>
    </div>
  );
}

/** Grande bannière quand on entre dans une zone, comme « Lieu de grâce découvert ». */
function Banniere() {
  const banniere = useJeu((s) => s.banniere);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!banniere) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 3800);
    return () => clearTimeout(t);
  }, [banniere]);
  if (!banniere) return null;
  return (
    <div className={`banniere ${visible ? "visible" : ""}`} key={banniere.cle}>
      <div className="banniere-lumiere" />
      <h2>{banniere.titre}</h2>
      <p>{banniere.sousTitre}</p>
    </div>
  );
}

function Notifications() {
  const { notifications, retirerNotification } = useJeu();
  useEffect(() => {
    if (!notifications.length) return;
    const t = setTimeout(() => retirerNotification(notifications[0].id), 5000);
    return () => clearTimeout(t);
  }, [notifications, retirerNotification]);
  return (
    <div className="notifications">
      {notifications.slice(0, 3).map((n) => (
        <div key={n.id} className="notification">
          <strong>{SUCCES.some((s) => s.id === n.id) ? `Succès · ${n.titre}` : n.titre}</strong>
          <span>{n.texte}</span>
        </div>
      ))}
    </div>
  );
}

function ATH() {
  const { cible, messageBarriere, indices, succes } = useJeu();
  const libelle =
    cible?.type === "indice"
      ? `${indices.includes(cible.id) ? "Relire" : "Examiner"} · ${indiceParId(cible.id).titre}`
      : cible?.type === "enigme"
        ? `Examiner · ${enigmeParId(cible.id).titre}`
        : null;
  return (
    <>
      <div className="viseur" />
      {libelle && (
        <div className="invite">
          <kbd>E</kbd> {libelle}
        </div>
      )}
      {!libelle && messageBarriere && <div className="message-barriere">{messageBarriere}</div>}
      <div className="compteurs">
        <span>
          Indices {indices.length}/{INDICES.length}
        </span>
        <span>
          Succès {succes.length}/{SUCCES.length}
        </span>
        <span className="aide">Tab · carnet</span>
      </div>
    </>
  );
}

function Panneau({ titre, children }: { titre: string; children: React.ReactNode }) {
  return (
    <div className="voile-panneau">
      <div className="panneau">
        <h2>{titre}</h2>
        <div className="filet" />
        {children}
        <button className="bouton fermer" onClick={reprendre}>
          Fermer
        </button>
      </div>
    </div>
  );
}

function Lecture({ id }: { id: string }) {
  const indice = indiceParId(id);
  const trouverIndice = useJeu((s) => s.trouverIndice);
  useEffect(() => trouverIndice(id), [id, trouverIndice]);
  return (
    <Panneau titre={indice.titre}>
      <p className="texte-indice">{indice.texte}</p>
    </Panneau>
  );
}

function PanneauEnigme({ id }: { id: string }) {
  const enigme = enigmeParId(id);
  const resoudre = useJeu((s) => s.resoudre);
  const [reponse, setReponse] = useState("");
  const [erreur, setErreur] = useState(false);
  const champ = useRef<HTMLInputElement>(null);
  useEffect(() => champ.current?.focus(), []);

  const valider = (e: React.FormEvent) => {
    e.preventDefault();
    if (normaliser(reponse) === normaliser(enigme.solution)) {
      resoudre(id);
      reprendre();
    } else {
      setErreur(true);
      setTimeout(() => setErreur(false), 600);
    }
  };

  return (
    <Panneau titre={enigme.titre}>
      <p className="texte-indice">{enigme.question}</p>
      <form onSubmit={valider} className={`formulaire-enigme ${erreur ? "secousse" : ""}`}>
        <input ref={champ} value={reponse} onChange={(e) => setReponse(e.target.value)} placeholder="Ta réponse" />
        <button className="bouton bouton-principal" type="submit">
          Valider
        </button>
      </form>
      {erreur && <p className="erreur">Rien ne se passe…</p>}
    </Panneau>
  );
}

function Carnet() {
  const { indices, succes, zones, enigmes } = useJeu();
  const [onglet, setOnglet] = useState<"indices" | "succes">("indices");
  return (
    <Panneau titre="Carnet">
      <div className="onglets">
        <button className={onglet === "indices" ? "actif" : ""} onClick={() => setOnglet("indices")}>
          Indices ({indices.length}/{INDICES.length})
        </button>
        <button className={onglet === "succes" ? "actif" : ""} onClick={() => setOnglet("succes")}>
          Succès ({succes.length}/{SUCCES.length})
        </button>
      </div>
      {onglet === "indices" ? (
        <div className="carnet">
          {ZONES.filter((z) => zones.includes(z.id)).map((z) => {
            const trouves = INDICES.filter((i) => i.zone === z.id && indices.includes(i.id));
            const total = INDICES.filter((i) => i.zone === z.id).length;
            return (
              <section key={z.id}>
                <h3>
                  {z.nom} <small>{trouves.length}/{total}</small>
                </h3>
                {trouves.map((i) => (
                  <article key={i.id}>
                    <h4>{i.titre}</h4>
                    <p>{i.texte}</p>
                    {i.liens?.length ? (
                      <p className="liens">
                        Lié à :{" "}
                        {i.liens.map((l) => (indices.includes(l) ? indiceParId(l).titre : "???")).join(" · ")}
                      </p>
                    ) : null}
                  </article>
                ))}
              </section>
            );
          })}
          {zones.length === 0 && <p className="vide">Aucun lieu découvert pour l'instant.</p>}
          {ENIGMES.length > 0 && <p className="vide">Énigmes résolues : {enigmes.length}/{ENIGMES.length}</p>}
        </div>
      ) : (
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
      )}
    </Panneau>
  );
}

const TOUCHES_NAVIGATEUR = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Quote", "Slash", "Backquote"]);

/** Raccourcis clavier de l'interface : E pour examiner, Tab pour le carnet, Échap pour fermer. */
function useRaccourcis() {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const s = useJeu.getState();
      // En jeu, certaines touches ne doivent pas déclencher d'action du navigateur : Espace et les
      // flèches font défiler, ' et / ouvrent la recherche rapide de Firefox. (F5, F11… restent libres.)
      if (s.enJeu && !s.panneau && TOUCHES_NAVIGATEUR.has(e.code)) e.preventDefault();
      if (e.target instanceof HTMLInputElement) {
        if (e.key === "Escape") s.fermer();
        return;
      }
      if (e.code === "KeyE" && s.enJeu && !s.panneau && s.cible) {
        // Sans ça, le « e » s'écrirait dans le champ de réponse qui prend le focus.
        e.preventDefault();
        s.ouvrir({ type: s.cible.type, id: s.cible.id });
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (s.panneau?.type === "carnet") reprendre();
        else if (!s.panneau) s.ouvrir({ type: "carnet" });
      } else if (e.key === "Escape" && s.panneau) {
        // Échap ne permet pas de recapturer la souris : on passe par l'écran de pause.
        s.fermer();
        s.sortir();
      }
    };
    window.addEventListener("keydown", surTouche);
    return () => window.removeEventListener("keydown", surTouche);
  }, []);
}

export function Interface() {
  useRaccourcis();
  const { enJeu, panneau } = useJeu();
  return (
    <div className="interface">
      {enJeu && !panneau && <ATH />}
      {!enJeu && !panneau && <EcranTitre />}
      <Banniere />
      <Notifications />
      {panneau?.type === "indice" && <Lecture id={panneau.id} />}
      {panneau?.type === "enigme" && <PanneauEnigme id={panneau.id} />}
      {panneau?.type === "carnet" && <Carnet />}
    </div>
  );
}
