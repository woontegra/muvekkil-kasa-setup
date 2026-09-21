import { useCallback, useState } from "react";
import type { MuvekkilListItem } from "@shared/types/muvekkil";
import { MuvekkilListPanel } from "../components/muvekkil/MuvekkilListPanel";
import { PremiumMuvekkilFormModal } from "../components/muvekkil/PremiumMuvekkilFormModal";
import { useMuvekkilPagedList } from "../hooks/useMuvekkilPagedList";

export function MuvekkillerPage() {
  const list = useMuvekkilPagedList();
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<MuvekkilListItem | null>(null);

  const openCreate = useCallback(() => {
    setEditItem(null);
    setModalOpen(true);
  }, []);

  const openEdit = useCallback((item: MuvekkilListItem) => {
    setEditItem(item);
    setModalOpen(true);
  }, []);

  const closeModal = useCallback(() => {
    if (!modalOpen) return;
    setModalOpen(false);
    setEditItem(null);
  }, [modalOpen]);

  return (
    <div className="pm-muvekkiller-page pm-page-enter">
      <MuvekkilListPanel
        variant="page"
        showEdit
        items={list.items}
        loading={list.loading}
        total={list.total}
        totalPages={list.totalPages}
        page={list.page}
        pageSize={list.pageSize}
        query={list.q}
        error={list.error}
        onPageChange={list.setPage}
        onPageSizeChange={list.handlePageSizeChange}
        onNewMuvekkil={openCreate}
        onQueryChange={list.handleQueryChange}
        onEdit={openEdit}
        onRetry={() => void list.reload()}
      />

      <PremiumMuvekkilFormModal
        open={modalOpen}
        initial={editItem}
        onClose={closeModal}
        onSuccess={() => void list.reload()}
      />
    </div>
  );
}
