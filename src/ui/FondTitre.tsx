import { useMemo } from "react";
import { graine } from "../world/relief";

// Le fond de l'écran d'accueil : un paysage peint au crépuscule (ciel, étoiles, soleil couchant,
// crêtes de montagnes en couches, brumes, sapins au premier plan) et des braises qui montent.
// Dessiné en SVG : rien à charger, net sur tous les écrans.

const L = 1600;
const H = 900;

/** Une crête : ligne de sommets irrégulière, fermée par le bas de l'image. */
function crete(hasard: () => number, base: number, amplitude: number, pics: number) {
  const pts: [number, number][] = [];
  const n = pics * 6;
  const phases = [hasard() * 6, hasard() * 6, hasard() * 6];
  for (let i = 0; i <= n; i++) {
    const x = -60 + (i / n) * (L + 120);
    const t = i / n;
    const y =
      base -
      amplitude *
        (0.55 * Math.abs(Math.sin(t * pics * Math.PI + phases[0])) +
          0.3 * Math.abs(Math.sin(t * pics * 2.3 * Math.PI + phases[1])) +
          0.15 * Math.sin(t * pics * 5.1 * Math.PI + phases[2])) +
      (hasard() - 0.5) * amplitude * 0.12;
    pts.push([x, y]);
  }
  return `M-60,${H} ` + pts.map(([x, y]) => `L${x.toFixed(1)},${y.toFixed(1)}`).join(" ") + ` L${L + 60},${H} Z`;
}

/** Sapins en silhouette posés le long du bas. */
function sapins(hasard: () => number) {
  const formes: string[] = [];
  for (let x = -20; x < L + 40; x += 18 + hasard() * 46) {
    const h = 60 + hasard() * 110;
    const pied = H - 40 + hasard() * 30 - (Math.abs(x - L / 2) < 260 ? 0 : 20);
    const l = h * 0.32;
    formes.push(`M${x - l},${pied} L${x},${pied - h} L${x + l},${pied} Z`);
  }
  return formes.join(" ");
}

export function FondTitre() {
  const dessin = useMemo(() => {
    const hasard = graine(1312);
    return {
      etoiles: Array.from({ length: 90 }, () => ({ x: hasard() * L, y: hasard() * H * 0.5, r: 0.6 + hasard() * 1.4, d: hasard() * 5 })),
      cretes: [crete(hasard, 600, 260, 3), crete(hasard, 660, 190, 4), crete(hasard, 740, 150, 5), crete(hasard, 820, 110, 7)],
      sapins: sapins(hasard),
      braises: Array.from({ length: 26 }, () => ({ x: hasard() * 100, d: hasard() * 12, v: 9 + hasard() * 10, t: 2 + hasard() * 3 })),
    };
  }, []);

  return (
    <div className="fond-titre" aria-hidden>
      <svg viewBox={`0 0 ${L} ${H}`} preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="ft-ciel" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0b0d1f" />
            <stop offset="0.35" stopColor="#2a2448" />
            <stop offset="0.6" stopColor="#7a4a52" />
            <stop offset="0.75" stopColor="#e09356" />
            <stop offset="0.85" stopColor="#f6cf86" />
          </linearGradient>
          <radialGradient id="ft-soleil" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#fff2c8" />
            <stop offset="0.18" stopColor="#ffd98a" stopOpacity="0.95" />
            <stop offset="0.45" stopColor="#ffb25a" stopOpacity="0.35" />
            <stop offset="1" stopColor="#ff9a40" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="ft-brume" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f3b878" stopOpacity="0" />
            <stop offset="1" stopColor="#f3b878" stopOpacity="0.45" />
          </linearGradient>
        </defs>
        <rect width={L} height={H} fill="url(#ft-ciel)" />
        <g className="ft-etoiles">
          {dessin.etoiles.map((e, i) => (
            <circle key={i} cx={e.x} cy={e.y} r={e.r} fill="#fff4dc" style={{ animationDelay: `${e.d}s` }} />
          ))}
        </g>
        <circle className="ft-soleil" cx={L / 2} cy={560} r={360} fill="url(#ft-soleil)" />
        <g className="ft-couche ft-loin">
          <path d={dessin.cretes[0]} fill="#8a5a6e" opacity="0.55" />
          <rect y={420} width={L} height={220} fill="url(#ft-brume)" />
        </g>
        <g className="ft-couche ft-milieu">
          <path d={dessin.cretes[1]} fill="#5a3c5c" opacity="0.85" />
          <rect y={520} width={L} height={180} fill="url(#ft-brume)" opacity="0.7" />
        </g>
        <g className="ft-couche ft-pres">
          <path d={dessin.cretes[2]} fill="#33233c" />
          <rect y={640} width={L} height={140} fill="url(#ft-brume)" opacity="0.35" />
        </g>
        <path d={dessin.cretes[3]} fill="#1b1322" />
        <path d={dessin.sapins} fill="#0f0a13" />
        <rect y={H - 60} width={L} height={60} fill="#0f0a13" />
      </svg>
      <div className="ft-braises">
        {dessin.braises.map((b, i) => (
          <span key={i} style={{ left: `${b.x}%`, animationDelay: `${b.d}s`, animationDuration: `${b.v}s`, width: b.t, height: b.t }} />
        ))}
      </div>
      <div className="ft-voile" />
    </div>
  );
}
