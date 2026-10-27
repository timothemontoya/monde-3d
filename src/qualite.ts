const PARAMS = new URLSearchParams(window.location.search);

/** Écran tactile : téléphone ou tablette. */
const TACTILE_PROBABLE = window.matchMedia("(pointer: coarse)").matches && "ontouchstart" in window;

/**
 * Mode léger : sans ombres, effets ni petites plantes, pour les machines modestes. Par défaut sur
 * téléphone ; ?leger le force, ?complet l'enlève.
 */
export const LEGER = PARAMS.has("leger") || (TACTILE_PROBABLE && !PARAMS.has("complet"));
