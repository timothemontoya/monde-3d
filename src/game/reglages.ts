import { create } from "zustand";
import { persist } from "zustand/middleware";
import { fixerVolume } from "./son";

// Les réglages du joueur, retenus d'une partie à l'autre (le son coupé, lui, est gardé par son.ts).

type Reglages = {
  /** Mode performances : sans l'effet cartoon (les contours à l'encre). */
  performances: boolean;
  /** Volume général, de 0 à 1. */
  volume: number;
  /** Sensibilité du regard (souris ou doigt), multiplie la vitesse de base. */
  sensibilite: number;
  /** Textes des lieux : la bannière et le panneau de lore qui s'affichent quand on arrive quelque part. */
  textesLieux: boolean;
  /** Le panneau d'histoire du lieu, à gauche : déplié, ou replié contre le bord (la flèche). */
  loreOuvert: boolean;
  /** Interface cachée (touche H) : on ne voit plus que le monde. Pas retenue d'une partie à l'autre. */
  interfaceCachee: boolean;
  regler: (r: Partial<Omit<Reglages, "regler">>) => void;
};

export const useReglages = create<Reglages>()(
  persist(
    (set) => ({
      performances: false,
      volume: 0.8,
      sensibilite: 1,
      textesLieux: true,
      loreOuvert: true,
      interfaceCachee: false,
      regler: (r) => set(r),
    }),
    {
      name: "aurelith-reglages",
      partialize: ({ interfaceCachee: _, ...r }) => r,
      onRehydrateStorage: () => (r) => r && fixerVolume(r.volume),
    },
  ),
);

useReglages.subscribe((r, avant) => r.volume !== avant.volume && fixerVolume(r.volume));
