import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "@fontsource-variable/fraunces/soft.css";
import "@fontsource-variable/figtree/wght.css";
import "./styles.css";
import { iniciarTema } from "./tema";

// antes de renderizar, para não piscar no tema errado
iniciarTema();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
