// Icônes du jeu (onglet du navigateur, écran d'accueil de l'iPhone et d'Android) depuis une image carrée :
//
//   node scripts/icones.mjs ~/Images/icone.png
//
// L'image est recadrée au centre si elle n'est pas carrée. Sorties dans public/ : icone-180.png
// (iPhone), icone-192.png et icone-512.png (Android, onglet).
import sharp from "sharp";

const source = process.argv[2];
if (!source) {
  console.error("Usage : node scripts/icones.mjs <image>");
  process.exit(1);
}
for (const taille of [180, 192, 512]) {
  // Fond plein (l'iPhone met du noir sous la transparence) et coins carrés : l'iPhone les arrondit lui-même.
  await sharp(source).resize(taille, taille, { fit: "cover" }).flatten({ background: "#1a1510" }).png().toFile(`public/icone-${taille}.png`);
  console.log(`public/icone-${taille}.png`);
}
