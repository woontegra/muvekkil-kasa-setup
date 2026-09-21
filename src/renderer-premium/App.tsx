import { HashRouter } from "react-router-dom";
import { PremiumAuthProvider } from "./context/PremiumAuthContext";
import { PremiumToastProvider } from "./context/PremiumToastContext";
import { PremiumPageMetaProvider } from "./context/PremiumPageMetaContext";
import { UpdateStatusProvider } from "./context/UpdateStatusContext";
import { PremiumRouter } from "./app/PremiumRouter";
import { PremiumToastViewport } from "./components/toast/PremiumToastViewport";
import { UpdatePromptHost } from "./components/UpdatePromptHost";
import { PremiumErrorBoundary } from "./components/PremiumErrorBoundary";

export default function App() {
  return (
    <PremiumErrorBoundary>
      <PremiumAuthProvider>
        <PremiumToastProvider>
          <UpdateStatusProvider>
            <PremiumPageMetaProvider>
              <HashRouter>
                <PremiumRouter />
                <UpdatePromptHost />
                <PremiumToastViewport />
              </HashRouter>
            </PremiumPageMetaProvider>
          </UpdateStatusProvider>
        </PremiumToastProvider>
      </PremiumAuthProvider>
    </PremiumErrorBoundary>
  );
}
