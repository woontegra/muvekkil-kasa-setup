export const MKD_MUVEKKIL_CHANGED = "mkd:muvekkil-changed";
export const MKD_OVERVIEW_REFRESH = "mkd:overview-refresh";

export function notifyMuvekkilChanged(): void {
  window.dispatchEvent(new CustomEvent(MKD_MUVEKKIL_CHANGED));
}

export function notifyOverviewRefresh(): void {
  window.dispatchEvent(new CustomEvent(MKD_OVERVIEW_REFRESH));
}
