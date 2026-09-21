import "./styles/index.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { installBrowserPreviewApi } from "./dev/installBrowserPreview";
import App from "./App";

installBrowserPreviewApi();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
