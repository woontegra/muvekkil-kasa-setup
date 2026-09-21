import { EmptyState } from "../components/EmptyState";
import { PremiumCard } from "../components/PremiumCard";
import type { ReactNode } from "react";

type Props = {
  apiSmoke?: ReactNode;
};

export function PlaceholderPage({ apiSmoke }: Props) {
  return (
    <PremiumCard>
      <EmptyState
        title="Yakında bağlanacak"
        description="Bu bölüm sonraki aşamada gerçek sisteme bağlanacaktır."
      />
      {apiSmoke}
    </PremiumCard>
  );
}
