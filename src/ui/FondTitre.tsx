import { useMemo } from "react";
import { graine } from "../world/relief";

// Le fond de l'écran d'accueil : le paysage peint d'Aurelith au crépuscule (public/accueil.jpg,
// une version plus légère pour les petits écrans), qui s'approche lentement, et des braises qui montent.

const IMAGE = `${import.meta.env.BASE_URL}accueil.jpg`;
const IMAGE_PETITE = `${import.meta.env.BASE_URL}accueil-petit.jpg`;

export function FondTitre() {
  const braises = useMemo(() => {
    const hasard = graine(1312);
    return Array.from({ length: 26 }, () => ({ x: hasard() * 100, d: hasard() * 12, v: 9 + hasard() * 10, t: 2 + hasard() * 3 }));
  }, []);

  return (
    <div className="fond-titre" aria-hidden>
      <img className="ft-image" src={IMAGE} srcSet={`${IMAGE_PETITE} 1280w, ${IMAGE} 2576w`} sizes="100vw" alt="" />
      <div className="ft-braises">
        {braises.map((b, i) => (
          <span key={i} style={{ left: `${b.x}%`, animationDelay: `${b.d}s`, animationDuration: `${b.v}s`, width: b.t, height: b.t }} />
        ))}
      </div>
      <div className="ft-voile" />
    </div>
  );
}
