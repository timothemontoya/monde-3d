// Photographie le monde avec une caméra libre, dans un Chrome sans fenêtre.
// Le jeu doit tourner (npm run dev). Chaque vue : nom:px,py:distance,hauteur[,azimut]
//   - px,py : le point visé, en pixels de la carte (comme dans src/content/monde.ts)
//   - distance, hauteur : où se tient la caméra, en m (à l'horizontale, et au-dessus du sol visé)
//   - azimut : d'où l'on regarde, en degrés (0 = depuis l'est, 90 = depuis le sud…) ;
//     par défaut depuis le nord-ouest, dos au soleil.
//
//   node scripts/photos.mjs /tmp/photos "village:998,635:110,55" "place:998,635:25,6,200"
//
// Variables : URL (défaut http://localhost:5173/), CHROME (défaut google-chrome).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";

const [, , sortie, ...vues] = process.argv;
if (!sortie || !vues.length) {
  console.error('Usage : node scripts/photos.mjs <dossier> "nom:px,py:distance,hauteur[,azimut]" …');
  process.exit(1);
}
mkdirSync(sortie, { recursive: true });
const URL_JEU = process.env.URL ?? "http://localhost:5173/";
// La carte graphique (des centaines de fois plus rapide) ; LOGICIEL=1 pour le rendu sans carte graphique.
const RENDU = process.env.LOGICIEL
  ? ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"]
  : ["--use-angle=gl", "--enable-gpu", "--ignore-gpu-blocklist"];
const PORT = 9333;
const pause = (ms) => new Promise((ok) => setTimeout(ok, ms));

const chrome = spawn(
  process.env.CHROME ?? "google-chrome",
  ["--headless=new", "--no-sandbox", ...RENDU, `--remote-debugging-port=${PORT}`, `--user-data-dir=${sortie}/.chrome`, "--window-size=1600,900", "about:blank"],
  { stdio: "ignore" },
);
try {
  let cible;
  for (let i = 0; i < 30 && !cible; i++) {
    await pause(500);
    cible = await fetch(`http://127.0.0.1:${PORT}/json/new?${encodeURIComponent(URL_JEU)}`, { method: "PUT" })
      .then((r) => r.json())
      .catch(() => null);
  }
  if (!cible) throw new Error("Chrome ne répond pas.");
  const ws = new WebSocket(cible.webSocketDebuggerUrl);
  let id = 0;
  const attentes = new Map();
  const envoyer = (method, params = {}) =>
    new Promise((ok) => {
      const n = ++id;
      attentes.set(n, ok);
      ws.send(JSON.stringify({ id: n, method, params }));
    });
  const erreurs = [];
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && attentes.has(m.id)) attentes.get(m.id)(m.result ?? m.error);
    if (m.method === "Runtime.exceptionThrown") erreurs.push(m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text);
    if (m.method === "Runtime.consoleAPICalled" && m.params.type === "error") erreurs.push(m.params.args.map((a) => a.value ?? a.description).join(" "));
  };
  await new Promise((ok) => (ws.onopen = ok));
  await envoyer("Runtime.enable");
  await envoyer("Page.enable");
  await envoyer("Page.reload");
  // Le monde met quelques secondes à se construire (rendu logiciel, sans carte graphique).
  for (let i = 0; i < 60; i++) {
    await pause(1000);
    const r = await envoyer("Runtime.evaluate", { expression: "!!(window.scene && window.scene.__r3f && window.versMonde)", returnByValue: true });
    if (r.result?.value) break;
  }
  await pause(4000);
  // Sans interface, et la caméra figée : l'écran titre ne la pilote plus.
  await envoyer("Runtime.evaluate", {
    expression: `(() => {
      document.head.insertAdjacentHTML("beforeend", "<style>body * { visibility: hidden } canvas { visibility: visible }</style>");
      const cam = window.scene.__r3f.root.getState().camera;
      cam.position.set = cam.position.copy = function () { return this; };
      cam.lookAt = () => {};
      cam.quaternion.copy = cam.quaternion.set = function () { return this; };
      cam.far = 9000; cam.updateProjectionMatrix();
    })()`,
  });
  for (const v of vues) {
    const [nom, p, d] = v.split(":");
    const [px, py] = p.split(",").map(Number);
    const [distance, hauteur, azimut = 235] = d.split(",").map(Number);
    await envoyer("Runtime.evaluate", {
      expression: `(() => {
        const cam = window.scene.__r3f.root.getState().camera;
        // L'ambiance (brume, lumière) suit la région photographiée, comme si le joueur y était.
        const region = regionEn(${px}, ${py});
        // (le joueur ne la remet pas à jour pendant la photo)
        jeu.setState({ entrerDans: () => {}, regionActuelle: region === "mer" ? null : region });
        const [x, z] = versMonde([${px}, ${py}]);
        const y = hauteurEn(${px}, ${py});
        // Ce qui ne se dessine qu'autour du joueur (moutons, oiseaux…) : autour du point visé.
        if (window.positionJoueur) Object.assign(window.positionJoueur, { x, z });
        const a = ${azimut} * Math.PI / 180;
        cam.position.x = x + Math.cos(a) * ${distance};
        cam.position.y = y + ${hauteur};
        cam.position.z = z + Math.sin(a) * ${distance};
        const m = new cam.matrix.constructor().lookAt(cam.position, new cam.position.constructor(x, y + 2, z), cam.up);
        const q = new cam.quaternion.constructor().setFromRotationMatrix(m);
        cam.quaternion.x = q.x; cam.quaternion.y = q.y; cam.quaternion.z = q.z; cam.quaternion.w = q.w;
      })()`,
    });
    // Sans fenêtre, une image n'est calculée qu'à chaque capture : quelques captures jetables
    // laissent le temps à la brume et à la lumière de glisser vers celles de la région.
    for (let i = 0; i < 3; i++) (await envoyer("Page.captureScreenshot", { format: "png" }), await pause(1500));
    const c = await envoyer("Page.captureScreenshot", { format: "png" });
    writeFileSync(`${sortie}/${nom}.png`, Buffer.from(c.data, "base64"));
    console.log(`${sortie}/${nom}.png`);
  }
  if (erreurs.length) console.log("Erreurs de la page :\n" + erreurs.slice(0, 20).join("\n"));
  ws.close();
} finally {
  chrome.kill();
}
process.exit(0);
