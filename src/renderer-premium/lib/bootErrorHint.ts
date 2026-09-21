export function premiumRestartHint(): string {
  return import.meta.env.DEV
    ? "Uygulamayı tamamen kapatıp npm run dev:premium ile yeniden açın."
    : "Uygulamayı kapatıp yeniden açın. Sorun sürerse Woontegra destek ile iletişime geçin.";
}
