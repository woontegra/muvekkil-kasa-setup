import type { MuvekkilListItem } from "@shared/types/muvekkil";
import { MuvekkilListPanel } from "../muvekkil/MuvekkilListPanel";

type Props = {
  items: MuvekkilListItem[];
  loading: boolean;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  query: string;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onNewMuvekkil: () => void;
  onQueryChange: (q: string) => void;
  error?: string | null;
  onRetry?: () => void;
};

export function DashboardClientTable(props: Props) {
  return <MuvekkilListPanel {...props} variant="overview" />;
}
