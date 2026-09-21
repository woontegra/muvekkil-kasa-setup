import { HashRouter } from "react-router-dom";
import { PremiumAuthProvider } from "./context/PremiumAuthContext";
import { UpdateStatusProvider } from "./context/UpdateStatusContext";
import { PremiumRouter } from "./app/PremiumRouter";
import { UpdatePromptHost } from "./components/UpdatePromptHost";

export default function App() {
  return (
    <PremiumAuthProvider>
      <UpdateStatusProvider>
        <HashRouter>
          <PremiumRouter />
          <UpdatePromptHost />
        </HashRouter>
      </UpdateStatusProvider>
    </PremiumAuthProvider>
  );
}
