import { useEffect, useRef, useState } from "react";
import { INDICES, LIEUX, OBJETS, REGIONS, SUCCES, USAGES } from "../content/monde";
import { positionJoueur } from "../game/joueur";
import { enigmeParId, indiceParId, normaliser, objetParId, portParId, remplie, useJeu } from "../game/store";
import { capturerSouris, teleporterVers } from "../player/Joueur";
import { versMonde } from "../world/carte";
import { lePlan } from "../world/plan";
import { MiniCarte } from "./Carte";
import { EspecesDuLieu, Journal, Paragraphes } from "./Journal";

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
  const { lieux, entrer, ouvrir, reinitialiser } = useJeu();
  const dejaCommence = lieux.length > 0;
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
            <button className="bouton" onClick={() => ouvrir({ type: "journal", onglet: "carte" })}>
              Journal
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
        <li><kbd>Espace</kbd> sauter · deux fois : voler</li>
        <li><kbd>Espace</kbd> / <kbd>C</kbd> en vol : monter / descendre</li>
        <li><kbd>Maj</kbd> aller vite</li>
        <li><kbd>E</kbd> examiner, ramasser</li>
        <li><kbd>1</kbd>…<kbd>8</kbd> prendre un objet en main</li>
        <li><kbd>F</kbd> utiliser l'objet</li>
        <li><kbd>Tab</kbd> journal</li>
        <li><kbd>Échap</kbd> pause</li>
      </ul>
    </div>
  );
}

/** Grande bannière quand on entre dans un lieu, comme « Lieu de grâce découvert ». */
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

/** Panneau de lore sur le côté : ce qu'on sait du lieu (et ce qu'il reste à découvrir). */
function PanneauLore() {
  const affiche = useJeu((s) => s.affiche);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!affiche) return;
    setVisible(true);
    const t = setTimeout(() => setVisible(false), 14000);
    return () => clearTimeout(t);
  }, [affiche]);
  if (!affiche) return null;
  const lieu = LIEUX.find((l) => l.id === affiche.id) ?? REGIONS.find((r) => r.id === affiche.id);
  if (!lieu) return null;
  return (
    <aside className={`panneau-lore ${visible ? "visible" : ""}`} key={affiche.cle}>
      <p className="sur-titre">{lieu.sousTitre}</p>
      <h3>{lieu.nom}</h3>
      <div className="filet gauche" />
      <Paragraphes lore={lieu.lore} />
      <EspecesDuLieu id={lieu.id} />
    </aside>
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

/** Barre d'objets : les objets du sac, celui en main est mis en avant. */
function BarreObjets() {
  const { objets, enMain } = useJeu();
  const liste = OBJETS.filter((o) => objets.includes(o.id)).slice(0, 8);
  if (!liste.length) return null;
  return (
    <div className="barre-objets">
      {liste.map((o, i) => (
        <div key={o.id} className={`case ${enMain === o.id ? "active" : ""}`} title={o.nom}>
          <kbd>{i + 1}</kbd>
          <span>{o.nom}</span>
        </div>
      ))}
    </div>
  );
}

function ATH() {
  const { cible, message, indices, succes, enMain, vol } = useJeu();
  let libelle: string | null = null;
  if (cible?.type === "indice") libelle = `${indices.includes(cible.id) ? "Relire" : "Examiner"} · ${indiceParId(cible.id).titre}`;
  if (cible?.type === "enigme") libelle = `Examiner · ${enigmeParId(cible.id).titre}`;
  if (cible?.type === "ramassable") libelle = `Ramasser · ${objetParId(cible.id).nom}`;
  if (cible?.type === "port") libelle = `Prendre le bateau · ${portParId(cible.id).nom}`;
  return (
    <>
      <div className="viseur" />
      {libelle && (
        <div className="invite">
          <kbd>E</kbd> {libelle}
        </div>
      )}
      {!libelle && message && <div className="message-barriere">{message}</div>}
      <MiniCarte />
      <BarreObjets />
      <div className="compteurs">
        <span>
          Indices {indices.length}/{INDICES.length}
        </span>
        <span>
          Succès {succes.length}/{SUCCES.length}
        </span>
        {enMain && (
          <span>
            <kbd>F</kbd> utiliser · {objetParId(enMain).nom}
          </span>
        )}
        {vol && <span>En vol · <kbd>C</kbd> pour se poser</span>}
        <span className="aide">Tab · journal</span>
      </div>
    </>
  );
}

function Panneau({ titre, children, large = false }: { titre: string; children: React.ReactNode; large?: boolean }) {
  return (
    <div className="voile-panneau">
      <div className={`panneau ${large ? "large" : ""}`}>
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

/** Voyage en bateau : choix de la destination depuis un port. */
function Voyage({ id }: { id: string }) {
  const etat = useJeu();
  const port = portParId(id);
  const partir = (dest: string) => {
    const arrivee = portParId(dest);
    etat.setFondu(true);
    etat.fermer();
    capturerSouris();
    const quai = lePlan().ports[dest];
    setTimeout(() => teleporterVers(quai.x, quai.z), 900);
    setTimeout(() => {
      etat.setFondu(false);
      etat.notifier(arrivee.nom, "Le bateau te dépose à quai.");
    }, 1900);
  };
  return (
    <Panneau titre={port.nom}>
      <p className="texte-indice">Un bateau attend à quai. Où veux-tu aller ?</p>
      <div className="destinations">
        {port.destinations.map((d) => {
          const dest = portParId(d);
          const ouvert = remplie(dest.quand, etat) && remplie(port.quand, etat);
          return (
            <button key={d} className="bouton" disabled={!ouvert} onClick={() => partir(d)}>
              {ouvert ? dest.nom : "Destination inconnue"}
            </button>
          );
        })}
      </div>
    </Panneau>
  );
}

/** Utiliser l'objet tenu en main là où l'on se trouve. */
function utiliserObjet() {
  const s = useJeu.getState();
  if (!s.enMain) return;
  const usage = USAGES.find((u) => {
    if (u.objet !== s.enMain) return false;
    const [x, z] = versMonde(u.position);
    return Math.hypot(positionJoueur.x - x, positionJoueur.z - z) < u.rayon;
  });
  if (usage) {
    s.notifier(objetParId(usage.objet).nom, usage.message);
    if (usage.resout) s.resoudre(usage.resout);
  } else {
    s.signaler("Rien ne se passe.");
  }
}

const TOUCHES_NAVIGATEUR = new Set(["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Quote", "Slash", "Backquote"]);

/** Raccourcis clavier de l'interface. */
function useRaccourcis() {
  useEffect(() => {
    const surTouche = (e: KeyboardEvent) => {
      const s = useJeu.getState();
      // Espace et les flèches font défiler, ' et / ouvrent la recherche rapide de Firefox.
      if (s.enJeu && !s.panneau && TOUCHES_NAVIGATEUR.has(e.code)) e.preventDefault();
      if (e.target instanceof HTMLInputElement) {
        if (e.key === "Escape") s.fermer();
        return;
      }
      const libre = s.enJeu && !s.panneau && !s.fondu;
      if (e.code === "KeyE" && libre && s.cible) {
        // Sans ça, le « e » s'écrirait dans le champ de réponse qui prend le focus.
        e.preventDefault();
        const c = s.cible;
        if (c.type === "ramassable") s.ramasser(c.id);
        else if (c.type === "port") s.ouvrir({ type: "voyage", id: c.id });
        else s.ouvrir({ type: c.type, id: c.id });
      } else if (e.code === "KeyF" && libre) {
        utiliserObjet();
      } else if (/^Digit[1-8]$/.test(e.code) && libre) {
        const liste = OBJETS.filter((o) => s.objets.includes(o.id));
        const objet = liste[Number(e.code.slice(5)) - 1];
        if (objet) s.tenir(objet.id);
      } else if (e.key === "Tab") {
        e.preventDefault();
        if (s.panneau?.type === "journal") reprendre();
        else if (!s.panneau) s.ouvrir({ type: "journal", onglet: "carte" });
      } else if (e.key === "Escape" && s.panneau) {
        // Échap ne permet pas de recapturer la souris : on passe par l'écran de pause.
        s.fermer();
        s.sortir();
      }
    };
    // Clic gauche en jeu : utiliser l'objet (la souris est capturée, le clic ne vise rien d'autre).
    const surClic = (e: MouseEvent) => {
      const s = useJeu.getState();
      if (e.button === 0 && s.enJeu && !s.panneau && document.pointerLockElement) utiliserObjet();
    };
    window.addEventListener("keydown", surTouche);
    window.addEventListener("mousedown", surClic);
    return () => {
      window.removeEventListener("keydown", surTouche);
      window.removeEventListener("mousedown", surClic);
    };
  }, []);
}

export function Interface() {
  useRaccourcis();
  const { enJeu, panneau, fondu } = useJeu();
  return (
    <div className="interface">
      {enJeu && !panneau && <ATH />}
      {!enJeu && !panneau && <EcranTitre />}
      <Banniere />
      {enJeu && <PanneauLore />}
      <Notifications />
      {panneau?.type === "indice" && <Lecture id={panneau.id} />}
      {panneau?.type === "enigme" && <PanneauEnigme id={panneau.id} />}
      {panneau?.type === "voyage" && <Voyage id={panneau.id} />}
      {panneau?.type === "journal" && (
        <Panneau titre="Journal de bord" large>
          <Journal onglet={panneau.onglet} />
        </Panneau>
      )}
      <div className={`fondu ${fondu ? "actif" : ""}`} />
    </div>
  );
}
