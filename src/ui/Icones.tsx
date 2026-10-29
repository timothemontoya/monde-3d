// Petites icônes au trait doré pour les boutons ronds du téléphone.

const trait = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

export const IconeJournal = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...trait}>
    <path d="M4 5.5C6.5 4.5 9.5 4.5 12 6c2.5-1.5 5.5-1.5 8-.5V19c-2.5-1-5.5-1-8 .5-2.5-1.5-5.5-1.5-8-.5z" />
    <path d="M12 6v13.5" />
  </svg>
);

export const IconePause = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...trait}>
    <path d="M9 6v12M15 6v12" />
  </svg>
);

export const IconeReglages = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...trait}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" />
  </svg>
);

export const IconeOeil = ({ barre = false }: { barre?: boolean }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" {...trait}>
    <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
    <circle cx="12" cy="12" r="2.8" />
    {barre && <path d="M4 20 20 4" />}
  </svg>
);
