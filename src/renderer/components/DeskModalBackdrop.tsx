import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  /** API uyumluluğu için tutulur; backdrop tıklaması asla kapatmaz. */
  onClose?: () => void;
  /** true ise (eski kullanım) — kapatma yine yalnızca açık kontrollerle yapılır */
  disabled?: boolean;
  /**
   * @deprecated Backdrop tıklamasıyla kapatma kaldırıldı; bu prop yok sayılır.
   */
  closeOnBackdrop?: boolean;
  className?: string;
};

/**
 * Modal arka planı — karartılmış zemine veya modal içi boş alana tıklayınca
 * kapanmaz. Kapatma yalnızca X / İptal / Kapat / Tamam / Daha sonra /
 * başarılı Kaydet ile yapılmalıdır.
 */
export function DeskModalBackdrop({
  children,
  className = "modal-backdrop",
}: Props) {
  return (
    <div className={className} role="presentation">
      {children}
    </div>
  );
}
