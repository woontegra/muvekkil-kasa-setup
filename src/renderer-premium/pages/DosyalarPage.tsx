import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { DosyaListeSatir } from "@shared/types/dosyaListe";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { EmptyState } from "../components/EmptyState";
import { PremiumButton } from "../components/PremiumButton";
import { formatDateTr } from "../lib/format";

export function DosyalarPage() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<DosyaListeSatir[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.api.dosyaListAll({ q: debouncedQ, page, pageSize: 20 });
      setItems(r.items);
      setTotal(r.total);
      setTotalPages(r.totalPages);
    } catch {
      setItems([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  }, [debouncedQ, page]);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const hasQuery = debouncedQ.trim().length > 0;

  return (
    <div className="pm-page-enter">
      <div className="pm-section-head">
        <h2 className="pm-section-title">Dosyalar</h2>
        <span className="pm-section-meta">{loading ? "Yükleniyor…" : `${total} dosya`}</span>
      </div>

      <div className="pm-filter-bar">
        <div className="pm-field">
          <label htmlFor="pm-dosya-search">Ara</label>
          <input
            id="pm-dosya-search"
            className="pm-input"
            placeholder="Dosya, müvekkil veya dosya no…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={() => navigate("/muvekkiller")}>
          Müvekkilden yeni dosya
        </PremiumButton>
      </div>

      {items.length === 0 && !loading ? (
        <EmptyState
          title={hasQuery ? "Sonuç bulunamadı" : "Henüz dosya yok"}
          description={
            hasQuery
              ? "Aramanıza uygun dosya bulunamadı. Farklı bir terim deneyin."
              : "Müvekkil kaydından yeni dosya oluşturabilirsiniz."
          }
          action={
            <PremiumButton type="button" onClick={() => navigate("/muvekkiller")}>
              Müvekkillere git
            </PremiumButton>
          }
        />
      ) : (
        <div className="pm-ofis-table-wrap">
          <table className="pm-ofis-table">
            <thead>
              <tr>
                <th>Konu</th>
                <th>Müvekkil</th>
                <th>Dosya no</th>
                <th>Mahkeme</th>
                <th>Durum</th>
                <th>Güncelleme</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((d) => (
                <tr key={d.id}>
                  <td>{d.konuBasligi?.trim() || "—"}</td>
                  <td>{d.muvekkilAd}</td>
                  <td>{d.dosyaNumarasi ?? "—"}</td>
                  <td>{d.mahkemeAdi ?? "—"}</td>
                  <td>{d.durum}</td>
                  <td>{formatDateTr(d.guncellemeTarihi)}</td>
                  <td>
                    <Link className="pm-btn pm-btn--sm pm-btn--ghost" to={`/muvekkil/${d.muvekkilId}/dosya/${d.id}`}>
                      Aç
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 ? (
        <div className="pm-page-toolbar">
          <button type="button" className="pm-btn pm-btn--sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            Önceki
          </button>
          <span className="pm-muted">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            className="pm-btn pm-btn--sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Sonraki
          </button>
        </div>
      ) : null}
    </div>
  );
}
