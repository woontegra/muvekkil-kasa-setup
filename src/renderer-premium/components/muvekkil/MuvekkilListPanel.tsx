import type { CSSProperties } from "react";
import { Link, useNavigate } from "react-router-dom";
import type { MuvekkilListItem } from "@shared/types/muvekkil";
import { PremiumButton } from "../PremiumButton";
import { StatusBadge } from "../StatusBadge";
import { EmptyState } from "../EmptyState";
import {
  MUVEKKIL_PAGE_SIZES,
  muvekkilGorunenAd,
  muvekkilListeEposta,
  muvekkilListeSayfaNumaralari,
  muvekkilListeTelefonu,
  muvekkilTurEtiket,
} from "../../lib/muvekkil";

export type MuvekkilListPanelProps = {
  items: MuvekkilListItem[];
  loading: boolean;
  total: number;
  totalPages: number;
  page: number;
  pageSize: number;
  query: string;
  error?: string | null;
  variant?: "overview" | "page";
  showEdit?: boolean;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onNewMuvekkil: () => void;
  onQueryChange: (value: string) => void;
  onEdit?: (item: MuvekkilListItem) => void;
  onRetry?: () => void;
};

function MuvekkilRowActions({
  item,
  showEdit,
  onEdit,
}: {
  item: MuvekkilListItem;
  showEdit: boolean;
  onEdit?: (item: MuvekkilListItem) => void;
}) {
  return (
    <div className="pm-mvk-row-actions" onClick={(e) => e.stopPropagation()}>
      <Link to={`/muvekkil/${item.id}`} className="pm-mvk-icon-btn" title="Detayı aç" aria-label="Detayı aç">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
          <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </Link>
      {showEdit && onEdit ? (
        <button type="button" className="pm-mvk-icon-btn" title="Düzenle" aria-label="Düzenle" onClick={() => onEdit(item)}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

export function MuvekkilListPanel({
  items,
  loading,
  total,
  totalPages,
  page,
  pageSize,
  query,
  error,
  variant = "page",
  showEdit = false,
  onPageChange,
  onPageSizeChange,
  onNewMuvekkil,
  onQueryChange,
  onEdit,
  onRetry,
}: MuvekkilListPanelProps) {
  const navigate = useNavigate();
  const ilkKullanim = total === 0 && !loading && !query.trim();
  const aramaBos = total === 0 && !loading && query.trim().length > 0;
  const isPage = variant === "page";

  const rangeFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeTo = Math.min(page * pageSize, total);

  if (!isPage) {
    return (
      <section className="pm-mvk-panel pm-overview-panel" aria-label="Müvekkil listesi">
        <div className="pm-overview-panel-head">
          <p className="pm-overview-panel-meta">{loading ? "Yükleniyor…" : total === 1 ? "1 kayıt" : `Toplam ${total} kayıt`}</p>
          <PremiumButton onClick={onNewMuvekkil}>+ Yeni müvekkil</PremiumButton>
        </div>
        <div className="pm-mvk-search-row pm-search-enter">
          <div className="pm-mvk-search-field">
            <svg className="pm-mvk-search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.3-4.3" />
            </svg>
            <input
              className="pm-input pm-mvk-search-input"
              placeholder="Müvekkil adı, şirket adı veya telefon ara…"
              value={query}
              onChange={(e) => onQueryChange(e.target.value)}
              aria-label="Müvekkil ara"
            />
          </div>
        </div>
        {error ? (
          <div className="pm-overview-inline-error">
            <p>{error}</p>
            {onRetry ? (
              <button type="button" className="pm-btn pm-btn--ghost" onClick={onRetry}>
                Yeniden dene
              </button>
            ) : null}
          </div>
        ) : null}
        <div className="pm-mvk-table-wrap">
          {loading && items.length === 0 ? (
            <div className="pm-mvk-skeleton-list" aria-hidden>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="pm-skeleton pm-skeleton--row" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <EmptyState title="Kayıt yok" description="Gösterilecek müvekkil bulunamadı." />
          ) : (
            <table className="pm-mvk-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Tür</th>
                  <th>Müvekkil</th>
                  <th>Telefon</th>
                  <th>E-posta</th>
                  <th>Not</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((m, idx) => (
                  <tr key={m.id} className="pm-mvk-row-enter" style={{ "--pm-row-i": idx } as CSSProperties}>
                    <td>{m.id}</td>
                    <td>
                      <StatusBadge tone="info">{muvekkilTurEtiket(m.muvekkilTuru)}</StatusBadge>
                    </td>
                    <td className="pm-mvk-cell-name">{muvekkilGorunenAd(m)}</td>
                    <td>{muvekkilListeTelefonu(m)}</td>
                    <td className="pm-mvk-cell-ellipsis">{muvekkilListeEposta(m)}</td>
                    <td className="pm-mvk-cell-ellipsis">{(m.not ?? "").trim() || "—"}</td>
                    <td>
                      <Link to={`/muvekkil/${m.id}`} className="pm-mvk-detail-link">
                        Detay
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="pm-mvk-page" aria-label="Müvekkil listesi">
      <div className="pm-mvk-control-bar pm-mvk-control-bar--enter">
        <div className="pm-mvk-stat-chips">
          <div className="pm-mvk-stat-chip pm-mvk-stat-chip--primary">
            <span className="pm-mvk-stat-value">{loading && total === 0 ? "—" : total}</span>
            <span className="pm-mvk-stat-label">Toplam müvekkil</span>
          </div>
          {query.trim() ? (
            <div className="pm-mvk-stat-chip">
              <span className="pm-mvk-stat-value">{loading ? "…" : total}</span>
              <span className="pm-mvk-stat-label">Arama sonucu</span>
            </div>
          ) : null}
        </div>

        <div className="pm-mvk-control-actions">
          <PremiumButton onClick={onNewMuvekkil} className="pm-mvk-new-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M12 5v14M5 12h14" />
            </svg>
            Yeni Müvekkil
          </PremiumButton>
        </div>
      </div>

      <div className="pm-mvk-search-bar pm-mvk-search-bar--enter">
        <div className={`pm-mvk-search-box${query ? " pm-mvk-search-box--active" : ""}`}>
          <svg className="pm-mvk-search-box-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden>
            <circle cx="11" cy="11" r="8" />
            <path d="m21 21-4.3-4.3" />
          </svg>
          <input
            className="pm-mvk-search-box-input"
            placeholder="Ad, şirket unvanı veya telefon ile ara…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            aria-label="Müvekkil ara"
          />
          {query ? (
            <button type="button" className="pm-mvk-search-clear" onClick={() => onQueryChange("")} aria-label="Aramayı temizle">
              ×
            </button>
          ) : null}
          {loading ? <span className="pm-mvk-search-loading" aria-label="Aranıyor" /> : null}
        </div>
        <p className="pm-mvk-search-meta">
          {loading
            ? "Yükleniyor…"
            : query.trim()
              ? `"${query.trim()}" için ${total} sonuç`
              : total === 1
                ? "1 kayıt listeleniyor"
                : `${total} kayıt listeleniyor`}
        </p>
      </div>

      {error ? (
        <div className="pm-mvk-error-bar">
          <p>{error}</p>
          {onRetry ? (
            <button type="button" className="pm-btn pm-btn--ghost pm-btn--sm" onClick={onRetry}>
              Yeniden dene
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="pm-mvk-data-shell pm-mvk-data-shell--enter">
        {loading && items.length === 0 ? (
          <div className="pm-mvk-skeleton-table" aria-hidden>
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="pm-mvk-skeleton-row">
                <span className="pm-skeleton pm-svk-skel-badge" />
                <span className="pm-skeleton pm-svk-skel-name" />
                <span className="pm-skeleton pm-svk-skel-cell" />
                <span className="pm-skeleton pm-svk-skel-cell" />
                <span className="pm-skeleton pm-svk-skel-sm" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="pm-mvk-empty pm-mvk-empty--enter">
            {ilkKullanim ? (
              <EmptyState
                title="Henüz müvekkil kaydı yok"
                description="İlk müvekkilinizi ekleyerek dosya, kasa ve taksit takibine başlayabilirsiniz."
              />
            ) : aramaBos ? (
              <EmptyState
                title="Sonuç bulunamadı"
                description={`"${query.trim()}" aramasıyla eşleşen kayıt bulunamadı. Farklı bir terim deneyin.`}
              />
            ) : (
              <EmptyState title="Kayıt yok" description="Gösterilecek müvekkil bulunamadı." />
            )}
            <PremiumButton onClick={onNewMuvekkil} className="pm-mvk-empty-cta">
              + Yeni Müvekkil
            </PremiumButton>
          </div>
        ) : (
          <div className="pm-mvk-table-scroll">
            <table className="pm-mvk-data-table">
              <thead>
                <tr>
                  <th className="pm-mvk-col-type">Tür</th>
                  <th className="pm-mvk-col-name">Müvekkil</th>
                  <th className="pm-mvk-col-phone">Telefon</th>
                  <th className="pm-mvk-col-mail">E-posta</th>
                  <th className="pm-mvk-col-files num">Dosya</th>
                  <th className="pm-mvk-col-note">Not</th>
                  <th className="pm-mvk-col-actions">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {items.map((m, idx) => {
                  const not = (m.not ?? "").trim();
                  return (
                    <tr
                      key={m.id}
                      className="pm-mvk-data-row pm-mvk-row-enter"
                      style={{ "--pm-row-i": idx } as CSSProperties}
                      onClick={() => navigate(`/muvekkil/${m.id}`)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") navigate(`/muvekkil/${m.id}`);
                      }}
                    >
                      <td className="pm-mvk-col-type">
                        <StatusBadge tone={m.muvekkilTuru === "TUZEL_KISI" ? "default" : "info"}>
                          {muvekkilTurEtiket(m.muvekkilTuru)}
                        </StatusBadge>
                      </td>
                      <td className="pm-mvk-col-name">
                        <span className="pm-mvk-data-name">{muvekkilGorunenAd(m)}</span>
                        <span className="pm-mvk-data-id">#{m.id}</span>
                      </td>
                      <td className="pm-mvk-col-phone">{muvekkilListeTelefonu(m)}</td>
                      <td className="pm-mvk-col-mail pm-mvk-cell-ellipsis">{muvekkilListeEposta(m)}</td>
                      <td className="pm-mvk-col-files num">
                        <span className="pm-mvk-file-count">{m.aktifDosyaSayisi}</span>
                      </td>
                      <td className="pm-mvk-col-note pm-mvk-cell-ellipsis" title={not || undefined}>
                        {not || "—"}
                      </td>
                      <td className="pm-mvk-col-actions">
                        <MuvekkilRowActions item={m} showEdit={showEdit} onEdit={onEdit} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {total > 0 ? (
        <footer className="pm-mvk-pagination-bar pm-mvk-pagination-bar--enter" aria-label="Sayfalama">
          <div className="pm-mvk-pagination-left">
            <span className="pm-mvk-pagination-range">
              <strong>{rangeFrom}–{rangeTo}</strong> / {total} kayıt
            </span>
            <label className="pm-mvk-pagesize">
              <span>Sayfa başına</span>
              <select
                className="pm-mvk-pagesize-select"
                value={pageSize}
                onChange={(e) => onPageSizeChange(Number(e.target.value))}
                aria-label="Sayfa başına kayıt"
              >
                {MUVEKKIL_PAGE_SIZES.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="pm-mvk-pagination-center">
            <button
              type="button"
              className="pm-mvk-page-btn"
              disabled={page <= 1 || loading}
              onClick={() => onPageChange(Math.max(1, page - 1))}
            >
              Önceki
            </button>
            <div className="pm-mvk-page-nums">
              {muvekkilListeSayfaNumaralari(page, totalPages).map((n) => (
                <button
                  key={n}
                  type="button"
                  className={`pm-mvk-page-num${n === page ? " pm-mvk-page-num--active" : ""}`}
                  disabled={loading}
                  onClick={() => onPageChange(n)}
                  aria-current={n === page ? "page" : undefined}
                >
                  {n}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="pm-mvk-page-btn"
              disabled={totalPages <= 0 || page >= totalPages || loading}
              onClick={() => onPageChange(Math.min(totalPages, page + 1))}
            >
              Sonraki
            </button>
          </div>
        </footer>
      ) : null}
    </section>
  );
}
