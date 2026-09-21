import { HashRouter } from "react-router-dom";
import { PremiumAuthProvider } from "./context/PremiumAuthContext";
import { PremiumRouter } from "./app/PremiumRouter";

export default function App() {
  return (
    <PremiumAuthProvider>
      <HashRouter>
        <PremiumRouter />
      </HashRouter>
    </PremiumAuthProvider>
  );
}
