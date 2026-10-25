import { create } from "zustand";
import { persist } from "zustand/middleware";
import { ENIGMES, ESPECES, FEUX, INDICES, LIEUX, OBJETS, PORTS, REGIONS, SUCCES } from "../content/monde";
import type { Condition, Succes } from "../content/types";

/** Progression du joueur, sauvegardée dans le navigateur. */
type Progression = {
  /** Régions et lieux-dits découverts (identifiants). */
  lieux: string[];
  indices: string[];
  enigmes: string[];
  /** Objets dans le sac. */
  objets: string[];
  /** Objet tenu en main. */
  enMain: string | null;
  /** Feux de camp découverts (voyage rapide). */
  feux: string[];
  succes: string[];
  /** Cellules de carte explorées (brouillard de la mini-carte), encodées en base64. */
  explore: string;
  /** Barrières déjà ouvertes : une fois ouverte, une barrière le reste. */
  barrieres: string[];
};

export type Cible =
  | { type: "indice" | "enigme" | "port" | "ramassable"; id: string }
  | null;

export type Onglet = "carte" | "lieux" | "indices" | "especes" | "sac" | "succes";

type Panneau =
  | { type: "indice" | "enigme" | "voyage"; id: string }
  | { type: "journal"; onglet: Onglet }
  | null;

/** Lieu affiché sur le côté (lore) quand on y entre. */
type Affiche = { id: string; cle: number } | null;

type Etat = Progression & {
  enJeu: boolean;
  regionActuelle: string | null;
  lieuActuel: string | null;
  cible: Cible;
  message: string | null;
  panneau: Panneau;
  banniere: { titre: string; sousTitre: string; cle: number } | null;
  affiche: Affiche;
  notifications: { id: string; titre: string; texte: string }[];
  /** Écran noir pendant un voyage. */
  fondu: boolean;
  /** En vol (double Espace), sinon à pied. */
  vol: boolean;

  entrer: () => void;
  sortir: () => void;
  entrerDans: (region: string | null, lieu: string | null) => void;
  viser: (c: Cible) => void;
  signaler: (message: string | null) => void;
  ouvrir: (p: Panneau) => void;
  fermer: () => void;
  trouverIndice: (id: string) => void;
  resoudre: (id: string) => void;
  ramasser: (objet: string) => void;
  tenir: (objet: string | null) => void;
  decouvrirFeu: (id: string) => void;
  /** Mémorise l'ouverture d'une barrière (définitive). */
  ouvrirBarriere: (id: string) => void;
  marquerExplore: (cellules: number[]) => void;
  setFondu: (v: boolean) => void;
  setVol: (v: boolean) => void;
  notifier: (titre: string, texte: string) => void;
  retirerNotification: (id: string) => void;
  reinitialiser: () => void;
};

const vide: Progression = { lieux: [], indices: [], enigmes: [], objets: [], enMain: null, feux: [], succes: [], explore: "", barrieres: [] };

/** Une barrière est ouverte si elle l'a déjà été, ou si sa condition est remplie maintenant. */
export const barriereOuverte = (b: { id: string; condition: Condition }, p: Progression) => p.barrieres.includes(b.id) || remplie(b.condition, p);

/** Une condition est remplie quand tous ses éléments le sont. */
export function remplie(c: Condition | undefined, p: Progression) {
  if (!c) return true;
  return (
    (c.indices ?? []).every((i) => p.indices.includes(i)) &&
    (c.enigmes ?? []).every((e) => p.enigmes.includes(e)) &&
    (c.lieux ?? []).every((l) => p.lieux.includes(l)) &&
    (!c.objet || p.objets.includes(c.objet)) &&
    (!c.objetEnMain || p.enMain === c.objetEnMain)
  );
}

function succesObtenu(s: Succes, p: Progression) {
  const q = s.quand;
  if (q.indicesTous && !INDICES.every((i) => p.indices.includes(i.id))) return false;
  if (q.especesToutes && !ESPECES.every((e) => remplie(e.quand, p))) return false;
  return remplie(q, p);
}

function verifierSucces(etat: Etat): Partial<Etat> {
  const nouveaux = SUCCES.filter((s) => !etat.succes.includes(s.id) && succesObtenu(s, etat));
  if (!nouveaux.length) return {};
  return {
    succes: [...etat.succes, ...nouveaux.map((s) => s.id)],
    notifications: [...etat.notifications, ...nouveaux.map((s) => ({ id: s.id, titre: s.titre, texte: s.description }))],
  };
}

export const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

// Bitset des cellules explorées.
let bits: Uint8Array | null = null;
const decoder = (s: string, taille: number) => {
  const b = new Uint8Array(taille);
  if (s) {
    const bin = atob(s);
    for (let i = 0; i < Math.min(bin.length, taille); i++) b[i] = bin.charCodeAt(i);
  }
  return b;
};
const encoder = (b: Uint8Array) => {
  let s = "";
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};

/** Cellules explorées (pour la mini-carte et la carte du journal). */
export function lesExplorees(nbCellules: number) {
  const taille = Math.ceil(nbCellules / 8);
  if (!bits || bits.length !== taille) bits = decoder(useJeu.getState().explore, taille);
  return bits;
}

export const useJeu = create<Etat>()(
  persist(
    (set, get) => ({
      ...vide,
      enJeu: false,
      regionActuelle: null,
      lieuActuel: null,
      cible: null,
      message: null,
      panneau: null,
      banniere: null,
      affiche: null,
      notifications: [],
      fondu: false,
      vol: false,

      entrer: () => set({ enJeu: true }),
      sortir: () => set({ enJeu: false }),

      entrerDans: (region, lieu) => {
        const e = get();
        if (region === e.regionActuelle && lieu === e.lieuActuel) return;
        const next: Partial<Etat> = { regionActuelle: region, lieuActuel: lieu };
        // Le plus précis gagne : un lieu-dit prime sur la région.
        const nouveau = lieu !== e.lieuActuel && lieu ? lieu : region !== e.regionActuelle && region ? region : null;
        if (nouveau) {
          const def = LIEUX.find((l) => l.id === nouveau) ?? REGIONS.find((r) => r.id === nouveau)!;
          const premiereFois = !e.lieux.includes(nouveau);
          next.banniere = { titre: def.nom, sousTitre: premiereFois ? "Lieu découvert" : def.sousTitre, cle: Date.now() };
          next.affiche = { id: nouveau, cle: Date.now() };
        }
        const decouverts = [region, lieu].filter((x): x is string => !!x && !e.lieux.includes(x));
        if (decouverts.length) next.lieux = [...e.lieux, ...decouverts];
        set(next);
        set(verifierSucces(get()));
      },

      viser: (c) => {
        const cur = get().cible;
        if (cur?.id === c?.id && cur?.type === c?.type) return;
        set({ cible: c });
      },

      signaler: (message) => {
        if (get().message !== message) set({ message });
      },

      ouvrir: (p) => set({ panneau: p }),
      fermer: () => set({ panneau: null }),

      trouverIndice: (id) => {
        const e = get();
        if (e.indices.includes(id)) return;
        const indice = INDICES.find((i) => i.id === id);
        const next: Partial<Etat> = { indices: [...e.indices, id] };
        if (indice?.donne && !e.objets.includes(indice.donne)) {
          next.objets = [...e.objets, indice.donne];
          const objet = OBJETS.find((o) => o.id === indice.donne)!;
          next.notifications = [...e.notifications, { id: `obj-${objet.id}`, titre: `Obtenu · ${objet.nom}`, texte: objet.description }];
        }
        set(next);
        set(verifierSucces(get()));
      },

      resoudre: (id) => {
        const e = get();
        if (e.enigmes.includes(id)) return;
        set({ enigmes: [...e.enigmes, id] });
        set(verifierSucces(get()));
      },

      ramasser: (id) => {
        const e = get();
        if (e.objets.includes(id)) return;
        const objet = OBJETS.find((o) => o.id === id)!;
        set({
          objets: [...e.objets, id],
          notifications: [...e.notifications, { id: `obj-${id}`, titre: `Obtenu · ${objet.nom}`, texte: objet.description }],
        });
        set(verifierSucces(get()));
      },

      tenir: (objet) => {
        set({ enMain: objet && get().enMain !== objet ? objet : null });
        set(verifierSucces(get()));
      },

      decouvrirFeu: (id) => {
        const e = get();
        if (e.feux.includes(id)) return;
        const feu = FEUX.find((f) => f.id === id)!;
        set({
          feux: [...e.feux, id],
          notifications: [...e.notifications, { id: `feu-${id}`, titre: "Feu de camp découvert", texte: `${feu.nom} · voyage rapide depuis le journal` }],
        });
      },

      ouvrirBarriere: (id) => {
        const e = get();
        if (!e.barrieres.includes(id)) set({ barrieres: [...e.barrieres, id] });
      },

      marquerExplore: (cellules) => {
        if (!bits) return;
        let change = false;
        for (const c of cellules) {
          const octet = c >> 3;
          const masque = 1 << (c & 7);
          if (!(bits[octet] & masque)) {
            bits[octet] |= masque;
            change = true;
          }
        }
        if (change) set({ explore: encoder(bits) });
      },

      setFondu: (v) => set({ fondu: v }),
      setVol: (v) => {
        if (get().vol !== v) set({ vol: v });
      },

      notifier: (titre, texte) => set({ notifications: [...get().notifications, { id: `msg-${Date.now()}`, titre, texte }] }),
      retirerNotification: (id) => set({ notifications: get().notifications.filter((n) => n.id !== id) }),

      reinitialiser: () => {
        if (bits) bits.fill(0);
        set({ ...vide, regionActuelle: null, lieuActuel: null, panneau: null, notifications: [] });
      },
    }),
    {
      name: "monde-progression-v2",
      partialize: (e) => ({
        lieux: e.lieux,
        indices: e.indices,
        enigmes: e.enigmes,
        objets: e.objets,
        enMain: e.enMain,
        feux: e.feux,
        succes: e.succes,
        explore: e.explore,
        barrieres: e.barrieres,
      }),
    },
  ),
);

export const indiceParId = (id: string) => INDICES.find((i) => i.id === id)!;
export const enigmeParId = (id: string) => ENIGMES.find((e) => e.id === id)!;
export const objetParId = (id: string) => OBJETS.find((o) => o.id === id)!;
export const portParId = (id: string) => PORTS.find((p) => p.id === id)!;
