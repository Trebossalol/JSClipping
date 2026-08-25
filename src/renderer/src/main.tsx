import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CutterApp, isCutterRoute } from "./CutterApp";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

createRoot(root).render(
  <StrictMode>
    {isCutterRoute() ? <CutterApp /> : <App />}
  </StrictMode>,
);
