// Affiche la taille (en m, X × Y × Z glTF) et les matières de modèles .glb.
//   node scripts/inspecter-modeles.mjs dossier/a.glb dossier/b.glb …
import { NodeIO } from "@gltf-transform/core";
import { getBounds } from "@gltf-transform/functions";

const io = new NodeIO();
for (const f of process.argv.slice(2)) {
  const doc = await io.read(f);
  const b = getBounds(doc.getRoot().listScenes()[0]);
  const taille = b.max.map((v, i) => (v - b.min[i]).toFixed(2)).join(" × ");
  const matieres = doc
    .getRoot()
    .listMaterials()
    .map((m) => `${m.getName()} (${m.getBaseColorFactor().slice(0, 3).map((x) => x.toFixed(2)).join(", ")})`);
  console.log(`${f.split("/").pop()} : ${taille} · bas ${b.min[1].toFixed(2)} · ${matieres.join(" | ")}`);
}
