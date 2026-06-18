import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerReady: Promise<void> | null = null;

export async function initPdfJs(): Promise<void> {
  if (workerReady) return workerReady;
  workerReady = (async () => {
    try {
      const res = await fetch(workerSrc);
      const blob = await res.blob();
      GlobalWorkerOptions.workerSrc = URL.createObjectURL(blob);
    } catch {
      GlobalWorkerOptions.workerSrc = workerSrc;
    }
  })();
  return workerReady;
}

export { getDocument };

export function pdfBase64ToUint8Array(pdfBase64: string): Uint8Array {
  const binary = atob(pdfBase64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function pdfBase64ToBlobUrl(pdfBase64: string): string {
  const bytes = pdfBase64ToUint8Array(pdfBase64);
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}
