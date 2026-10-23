import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/figtree/wght.css";
import "@fontsource/orbitron/latin-500.css";
import "@fontsource/orbitron/latin-700.css";
import "@fontsource/exo-2/latin-400.css";
import "@fontsource/exo-2/latin-400-italic.css";
import "@fontsource/exo-2/latin-600.css";
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/libre-baskerville/latin-400.css";
import "@fontsource/libre-baskerville/latin-400-italic.css";
import "@fontsource/libre-baskerville/latin-700.css";
import "@fontsource/cinzel/latin-600.css";
import "@fontsource/eb-garamond/latin-400.css";
import "@fontsource/eb-garamond/latin-400-italic.css";
import "@fontsource/eb-garamond/latin-600.css";
import "@fontsource/bree-serif/latin-400.css";
import "@fontsource/nunito/latin-400.css";
import "@fontsource/nunito/latin-400-italic.css";
import "@fontsource/nunito/latin-700.css";
import "@fontsource/medievalsharp/latin-400.css";
import "@fontsource/alegreya/latin-400.css";
import "@fontsource/alegreya/latin-400-italic.css";
import "@fontsource/alegreya/latin-700.css";
import "@fontsource/atkinson-hyperlegible/latin-400.css";
import "@fontsource/atkinson-hyperlegible/latin-400-italic.css";
import "@fontsource/atkinson-hyperlegible/latin-700.css";
import "./styles.css";
import "./estilos/estilos.css";
import { iniciarEstilo } from "./estilos/armazenamento";
import { iniciarLargura } from "./leitura";
import { iniciarTema } from "./tema";

// antes de renderizar, para não piscar no tema errado
iniciarEstilo();
iniciarTema();
iniciarLargura();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
