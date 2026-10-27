import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "@fontsource/alegreya/latin-400.css";
import "@fontsource/alegreya/latin-500.css";
import "@fontsource/alegreya-sc/latin-400.css";
import "./editeur.css";
import { Editeur } from "./Editeur";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Editeur />
  </StrictMode>,
);
