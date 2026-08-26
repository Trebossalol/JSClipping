import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { CutterApp, isCutterRoute } from "./CutterApp";
import { QuickActionApp, isQuickActionRoute } from "./QuickActionApp";
import { TopLoadingBar } from "./components/TopLoadingBar";
import "./index.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Root element #root not found");
}

const overlay = isQuickActionRoute();

createRoot(root).render(
  <StrictMode>
    {overlay ? (
      <QuickActionApp />
    ) : (
      <TopLoadingBar>
        {isCutterRoute() ? <CutterApp /> : <App />}
      </TopLoadingBar>
    )}
  </StrictMode>,
);
