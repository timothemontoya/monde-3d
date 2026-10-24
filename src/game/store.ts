import { create } from "zustand";
import { persist } from "zustand/middleware";
import { BARRIERES, ENIGMES, INDICES, SUCCES, ZONES } from "../content/monde";
import type { Barriere, Succes } from "../content/types";

/** Progression du joueur, sauvegardée dans le navigateur. */
type Progression = {
  zones: string[];
  indices: string[];
  enigmes: string[];
  succes: string[];
};

/** Ce que le joueur regarde ou peut activer en ce moment. */
export type Cible = { type: "indice" | "enigme"; id: string } | null;

type Panneau = { type: "indice" | "enigme"; id: string } | { type: "carnet" } | null;

type Etat = Progression & {
  enJeu: boolean;
  zoneActuelle: string | null;
  cible: Cible;
  /** Message d'une barrière fermée proche. */
  messageBarriere: string | null;
  panneau: Panneau;
  /** Bannière « zone découverte » en cours d'affichage. */
  banniere: { titre: string; sousTitre: string; cle: number } | null;
  notifications: { id: string; titre: string; texte: string }[];

  entrer: () => void;
  sortir: () => void;
  entrerDansZone: (id: string | null) => void;
  viser: (c: Cible) => void;
  signalerBarriere: (message: string | null) => void;
  ouvrir: (p: Panneau) => void;
  fermer: () => void;
  trouverIndice: (id: string) => void;
  resoudre: (id: string) => void;
  retirerNotification: (id: string) => void;
  /** Message ponctuel (ex : « La tempête se dissipe… »). */
  notifier: (titre: string, texte: string) => void;
  reinitialiser: () => void;
};

const vide: Progression = { zones: [], indices: [], enigmes: [], succes: [] };

/** Une barrière est ouverte quand toutes les conditions de son contenu sont remplies. */
export function estOuverte(b: Barriere, p: Progression) {
  const { indices = [], enigme } = b.condition;
  return indices.every((i) => p.indices.includes(i)) && (!enigme || p.enigmes.includes(enigme));
}

function succesObtenu(s: Succes, p: Progression) {
  const q = s.quand;
  const indices = q.indices === "tous" ? INDICES.map((i) => i.id) : (q.indices ?? []);
  const barrieres = (q.barrieres ?? []).map((id) => BARRIERES.find((b) => b.id === id)!);
  return (
    (q.zones ?? []).every((z) => p.zones.includes(z)) &&
    indices.every((i) => p.indices.includes(i)) &&
    (q.enigmes ?? []).every((e) => p.enigmes.includes(e)) &&
    barrieres.every((b) => b && estOuverte(b, p))
  );
}

/** Ajoute les succès nouvellement obtenus et prépare leurs notifications. */
function verifierSucces(etat: Etat): Partial<Etat> {
  const nouveaux = SUCCES.filter((s) => !etat.succes.includes(s.id) && succesObtenu(s, etat));
  if (!nouveaux.length) return {};
  return {
    succes: [...etat.succes, ...nouveaux.map((s) => s.id)],
    notifications: [...etat.notifications, ...nouveaux.map((s) => ({ id: s.id, titre: s.titre, texte: s.description }))],
  };
}

/** Normalise une réponse : sans accents, sans espaces, en majuscules. */
export const normaliser = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toUpperCase();

export const useJeu = create<Etat>()(
  persist(
    (set, get) => ({
      ...vide,
      enJeu: false,
      zoneActuelle: null,
      cible: null,
      messageBarriere: null,
      panneau: null,
      banniere: null,
      notifications: [],

      entrer: () => set({ enJeu: true }),
      sortir: () => set({ enJeu: false }),

      entrerDansZone: (id) => {
        const e = get();
        if (id === e.zoneActuelle) return;
        if (!id) return set({ zoneActuelle: null });
        const zone = ZONES.find((z) => z.id === id)!;
        const premiereFois = !e.zones.includes(id);
        const next: Partial<Etat> = {
          zoneActuelle: id,
          banniere: { titre: zone.nom, sousTitre: premiereFois ? "Lieu découvert" : zone.sousTitre, cle: Date.now() },
        };
        if (premiereFois) next.zones = [...e.zones, id];
        set(next);
        set(verifierSucces(get()));
      },

      viser: (c) => {
        const cur = get().cible;
        if (cur?.id === c?.id && cur?.type === c?.type) return;
        set({ cible: c });
      },

      signalerBarriere: (message) => {
        if (get().messageBarriere !== message) set({ messageBarriere: message });
      },

      ouvrir: (p) => set({ panneau: p }),
      fermer: () => set({ panneau: null }),

      trouverIndice: (id) => {
        const e = get();
        if (e.indices.includes(id)) return;
        set({ indices: [...e.indices, id] });
        set(verifierSucces(get()));
      },

      resoudre: (id) => {
        const e = get();
        if (e.enigmes.includes(id)) return;
        set({ enigmes: [...e.enigmes, id] });
        set(verifierSucces(get()));
      },

      retirerNotification: (id) => set({ notifications: get().notifications.filter((n) => n.id !== id) }),

      notifier: (titre, texte) =>
        set({ notifications: [...get().notifications, { id: `msg-${Date.now()}`, titre, texte }] }),

      reinitialiser: () => set({ ...vide, zoneActuelle: null, panneau: null, notifications: [] }),
    }),
    {
      name: "monde-progression",
      // Seule la progression est sauvegardée, pas l'état de l'interface.
      partialize: (e) => ({ zones: e.zones, indices: e.indices, enigmes: e.enigmes, succes: e.succes }),
    },
  ),
);

/** Liste utile pour l'interface. */
export const indiceParId = (id: string) => INDICES.find((i) => i.id === id)!;
export const enigmeParId = (id: string) => ENIGMES.find((e) => e.id === id)!;
