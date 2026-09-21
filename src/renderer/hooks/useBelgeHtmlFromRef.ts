import { useLayoutEffect, type RefObject } from "react";
import { extractBelgeHtml } from "../lib/belgeHtmlBuild";

export function useBelgeHtmlFromRef(
  buildRef: RefObject<HTMLDivElement | null>,
  enabled: boolean,
  deps: unknown[],
  selector: string,
  buildHtml: (outer: string) => string,
  onHtml: (html: string) => void,
  onFail: (mesaj: string) => void,
) {
  useLayoutEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    void (async () => {
      const root = buildRef.current;
      if (!root) return;
      const html = await extractBelgeHtml(root, selector, buildHtml);
      if (cancelled) return;
      if (html) onHtml(html);
      else onFail("Belge şablonu oluşturulamadı.");
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- caller controls deps
  }, [enabled, selector, buildRef, ...deps]);
}
