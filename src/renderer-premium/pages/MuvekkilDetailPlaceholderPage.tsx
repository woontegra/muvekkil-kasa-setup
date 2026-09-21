import { useParams } from "react-router-dom";
import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";

export function DosyaDetailPlaceholderPage() {
  const { muvekkilId, dosyaId } = useParams();

  return (
    <PremiumCard>
      <EmptyState
        title="Dosya detayı yakında"
        description={`Müvekkil #${muvekkilId ?? "—"}, Dosya #${dosyaId ?? "—"} — bu bölüm sonraki aşamada gerçek sisteme bağlanacaktır.`}
      />
    </PremiumCard>
  );
}
