import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

type PageMeta = { title: string; desc: string } | null;

type Ctx = {
  meta: PageMeta;
  setMeta: (meta: PageMeta) => void;
};

const PremiumPageMetaContext = createContext<Ctx | null>(null);

export function PremiumPageMetaProvider({ children }: { children: ReactNode }) {
  const [meta, setMeta] = useState<PageMeta>(null);
  const value = useMemo(() => ({ meta, setMeta }), [meta]);
  return <PremiumPageMetaContext.Provider value={value}>{children}</PremiumPageMetaContext.Provider>;
}

export function usePremiumPageMeta() {
  const ctx = useContext(PremiumPageMetaContext);
  if (!ctx) throw new Error("usePremiumPageMeta provider dışında kullanılamaz");
  return ctx;
}
