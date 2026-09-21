type Props = {
  message?: string;
};

export function PremiumLoadingScreen({ message = "Yükleniyor…" }: Props) {
  return (
    <div className="pm-auth-page pm-auth-page--loading" aria-busy="true" aria-live="polite">
      <div className="pm-auth-loading">
        <div className="pm-auth-loading-spinner" aria-hidden />
        <p>{message}</p>
      </div>
    </div>
  );
}
