import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CutterApp, parseCutClipId } from "./CutterApp";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

const cutId = parseCutClipId();

createRoot(root).render(
  <StrictMode>
    {cutId ? <CutterApp clipId={cutId} /> : <App />}
  </StrictMode>,
);
