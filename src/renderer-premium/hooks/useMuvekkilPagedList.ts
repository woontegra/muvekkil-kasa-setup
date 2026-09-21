import { useCallback, useEffect, useRef, useState } from "react";
import type { MuvekkilListItem, MuvekkilPagedResult } from "@shared/types/muvekkil";
import { useDebouncedValue } from "./useDebouncedValue";
import { MKD_MUVEKKIL_CHANGED } from "../lib/events";

export function useMuvekkilPagedList(debounceMs = 350) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, debounceMs);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [items, setItems] = useState<MuvekkilListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reqIdRef = useRef(0);

  const load = useCallback(async () => {
    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const r: MuvekkilPagedResult = await window.api.muvekkilAraPaged(debouncedQ, page, pageSize);
      if (reqId !== reqIdRef.current) return;
      setItems(r.items);
      setTotal(r.total);
      setTotalPages(r.totalPages);
      if (r.page !== page) setPage(r.page);
    } catch {
      if (reqId !== reqIdRef.current) return;
      setItems([]);
      setTotal(0);
      setTotalPages(0);
      setError("Müvekkil listesi yüklenemedi.");
    } finally {
      if (reqId === reqIdRef.current) setLoading(false);
    }
  }, [debouncedQ, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    const onChanged = () => void load();
    window.addEventListener(MKD_MUVEKKIL_CHANGED, onChanged);
    return () => window.removeEventListener(MKD_MUVEKKIL_CHANGED, onChanged);
  }, [load]);

  const handleQueryChange = useCallback((value: string) => {
    setPage(1);
    setQ(value);
  }, []);

  const handlePageSizeChange = useCallback((size: number) => {
    setPage(1);
    setPageSize(size);
  }, []);

  return {
    q,
    page,
    pageSize,
    items,
    total,
    totalPages,
    loading,
    error,
    setPage,
    handleQueryChange,
    handlePageSizeChange,
    reload: load,
  };
}
