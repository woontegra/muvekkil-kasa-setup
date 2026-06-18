import { useEffect, useState } from "react";
import type { YaziciInfo } from "@shared/types/print";

export function useBelgeYazicilar(active: boolean) {
  const [yazicilar, setYazicilar] = useState<YaziciInfo[]>([]);
  const [seciliYazici, setSeciliYazici] = useState("");

  useEffect(() => {
    if (!active || !window.api?.printGetPrinters) return;
    let cancelled = false;
    void window.api.printGetPrinters().then((list) => {
      if (cancelled) return;
      setYazicilar(list);
      const varsayilan = list.find((p) => p.isDefault)?.name ?? list[0]?.name ?? "";
      setSeciliYazici(varsayilan);
    });
    return () => {
      cancelled = true;
    };
  }, [active]);

  return { yazicilar, seciliYazici, setSeciliYazici };
}
