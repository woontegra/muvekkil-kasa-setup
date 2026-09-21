export async function waitBelgeDomReady(): Promise<void> {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

export async function waitBelgeImages(root: ParentNode): Promise<void> {
  const imgs = Array.from(root.querySelectorAll("img"));
  await Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );
}

export async function extractBelgeHtml(
  root: HTMLDivElement,
  selector: string,
  buildHtml: (outer: string) => string,
): Promise<string | null> {
  await waitBelgeDomReady();
  await waitBelgeImages(root);
  const doc = root.querySelector(selector);
  if (!doc) return null;
  return buildHtml(doc.outerHTML);
}
