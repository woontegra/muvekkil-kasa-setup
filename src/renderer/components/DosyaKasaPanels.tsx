import { useEffect, useMemo, useState } from "react";
import type { KasaHareket } from "@shared/types/kasa";
import type { AccountingPeriodMode } from "@shared/types/accountingPeriod";
import {
  getAccountingPeriod,
  getPreviousAccountingPeriod,
} from "@shared/lib/accountingPeriod";
import { formatDateTr, formatTry } from "../lib/format";
import {
  hareketAciklamaMasraf,
  kasaHareketSatirSinifi,
  odemeEtiket,
  onayBadgeClass,
  onayBadgeMetni,
  tipEtiket,
} from "../lib/kasa";
import type { useDosyaKasa } from "../hooks/useDosyaKasa";
import { KasaAvansModal } from "./KasaAvansModal";
import { KasaDuzeltmeModal } from "./KasaDuzeltmeModal";
import { KasaMasrafModal } from "./KasaMasrafModal";
import { DeskConfirmDialog } from "./DeskConfirmDialog";
import { DeskTableIconBtn } from "./DeskTableIconBtn";
import { IconDuzenle, IconDuzeltme, IconMakbuz, IconOnayla, IconReddet, IconSil } from "./DeskTableIcons";
import { canShowDosyaKasaGuvenliSil } from "@shared/lib/guvenliSil";
import { DeskGuvenliSilModal } from "./DeskGuvenliSilModal";

type KasaApi = ReturnType<typeof useDosyaKasa>;

type PeriodFilter = "ALL" | "CURRENT" | "PREVIOUS";

function kasaTipHucre(h: KasaHareket) {
  const ana = h.islemTipi === "DUZELTME" ? "Düzeltme" : tipEtiket(h.islemTipi);
  return (
    <div className="desk-kasa-tip-cell">
      <span>{ana}</span>
      {!h.duzeltmeMi && h.hasCorrection ? (
        <span className="desk-badge-duzeltildi" title="Bu işlem için düzeltme kaydı var">
          Düzeltildi
        </span>
      ) : null}
    </div>
  );
}

function turEkHucre(h: KasaHareket): string {
  if (h.islemTipi === "MASRAF") return (h.masrafTuru ?? "").trim() || "—";
  if (h.islemTipi === "AVANS_GIRISI") return odemeEtiket(h.odemeYontemi);
  return "—";
}

function islemRowActions(h: KasaHareket, kasa: KasaApi) {
  if (h.onayDurumu === "ONAYSIZ") {
    return (
      <>
        {h.islemTipi === "MASRAF" ? (
          <DeskTableIconBtn title="Düzenle" onClick={() => kasa.openMasrafDuzenle(h)}>
            <IconDuzenle />
          </DeskTableIconBtn>
        ) : null}
        <DeskTableIconBtn title="Onayla" variant="primary" onClick={() => void kasa.onaylaHareket(h.id)}>
          <IconOnayla />
        </DeskTableIconBtn>
        <DeskTableIconBtn title="Reddet" onClick={() => void kasa.reddetHareket(h.id)}>
          <IconReddet />
        </DeskTableIconBtn>
        <DeskTableIconBtn title="Sil" variant="danger" onClick={() => void kasa.silHareket(h.id)}>
          <IconSil />
        </DeskTableIconBtn>
      </>
    );
  }
  if (h.onayDurumu === "ONAYLI" && h.islemTipi !== "DUZELTME") {
    const guvenliMode = canShowDosyaKasaGuvenliSil(h);
    return (
      <>
        <DeskTableIconBtn title="Makbuz" onClick={() => void kasa.makbuzAc(h.id)}>
          <IconMakbuz />
        </DeskTableIconBtn>
        <DeskTableIconBtn title="Düzeltme ekle" onClick={() => kasa.setDuzeltmeHedef(h)}>
          <IconDuzeltme />
        </DeskTableIconBtn>
        {guvenliMode ? (
          <DeskTableIconBtn title="Güvenli sil" variant="danger" onClick={() => kasa.acGuvenliSil(h, guvenliMode)}>
            <IconSil />
          </DeskTableIconBtn>
        ) : null}
      </>
    );
  }
  if (h.onayDurumu === "ONAYLI" && h.islemTipi === "DUZELTME" && kasa.makbuzGosterilebilir(h)) {
    return (
      <DeskTableIconBtn title="Makbuz" onClick={() => void kasa.makbuzAc(h.id)}>
        <IconMakbuz />
      </DeskTableIconBtn>
    );
  }
  if (h.onayDurumu === "REDDEDILDI") {
    return (
      <DeskTableIconBtn title="Sil" variant="danger" onClick={() => void kasa.silHareket(h.id)}>
        <IconSil />
      </DeskTableIconBtn>
    );
  }
  return <span className="muted">—</span>;
}

function makbuzHucre(h: KasaHareket, kasa: KasaApi) {
  if (kasa.makbuzGosterilebilir(h)) {
    const no = h.makbuzNo?.trim();
    return (
      <DeskTableIconBtn title={no ? `Makbuz: ${no}` : "Makbuz"} onClick={() => void kasa.makbuzAc(h.id)}>
        <IconMakbuz />
      </DeskTableIconBtn>
    );
  }
  return h.makbuzNo?.trim() || "—";
}

function useAccountingPeriodFilter() {
  const [mode, setMode] = useState<AccountingPeriodMode>("YEARLY");
  const [filter, setFilter] = useState<PeriodFilter>("CURRENT");

  useEffect(() => {
    const loadMode = async () => {
      try {
        const m = await window.api.getAccountingPeriodMode?.();
        setMode(m === "MONTHLY" ? "MONTHLY" : "YEARLY");
      } catch {
        setMode("YEARLY");
      }
    };
    void loadMode();
    const onPeriodChanged = () => void loadMode();
    window.addEventListener("mkd:accounting-period-changed", onPeriodChanged);
    return () => window.removeEventListener("mkd:accounting-period-changed", onPeriodChanged);
  }, []);

  const range = useMemo(() => {
    if (filter === "ALL") return null;
    const current = getAccountingPeriod(mode);
    if (filter === "CURRENT") return { bas: current.bas, bit: current.bit };
    const prev = getPreviousAccountingPeriod(current);
    return { bas: prev.bas, bit: prev.bit };
  }, [filter, mode]);

  function filterByPeriod<T extends { tarih: string }>(rows: T[]): T[] {
    if (!range) return rows;
    return rows.filter((h) => {
      const t = (h.tarih ?? "").slice(0, 10);
      return t >= range.bas && t <= range.bit;
    });
  }

  const select = (
    <label className="desk-kasa-period-filter">
      <span className="desk-muted-compact">Dönem</span>
      <select
        className="desk-input desk-input--tiny form-input"
        value={filter}
        onChange={(e) => setFilter(e.target.value as PeriodFilter)}
        aria-label="Hesap dönemi filtresi"
      >
        <option value="ALL">Tüm zamanlar</option>
        <option value="CURRENT">Güncel dönem</option>
        <option value="PREVIOUS">Önceki dönem</option>
      </select>
    </label>
  );

  return { filterByPeriod, select, rangeKey: range ? `${range.bas}|${range.bit}` : "ALL" };
}

export function DosyaKasaHareketleriPanel({ kasa }: { kasa: KasaApi }) {
  const { filterByPeriod, select, rangeKey } = useAccountingPeriodFilter();
  const filtered = useMemo(
    () => filterByPeriod(kasa.kasaHareketleri),
    // rangeKey captures filter/mode; filterByPeriod closes over range
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kasa.kasaHareketleri, rangeKey],
  );
  const kayitSayisi = filtered.length;
  const kayitMetni = kayitSayisi === 1 ? "1 kayıt" : `${kayitSayisi} kayıt`;

  return (
    <div className="desk-panel desk-panel--grow">
      <div className="desk-panel-head">
        <span>Kasa hareketleri</span>
        <div className="desk-panel-head-right desk-kasa-period-filter-wrap">
          {select}
          <span className="desk-panel-meta">{kayitMetni}</span>
        </div>
      </div>
      <div className="desk-panel-body desk-table-wrap desk-kasa-table-wrap">
        {kayitSayisi === 0 ? (
          <p className="desk-muted-compact">Henüz kasa hareketi yok.</p>
        ) : (
          <table className="desk-table desk-table--striped desk-table--compact">
            <thead>
              <tr>
                <th className="desk-col-id">#</th>
                <th>Tarih</th>
                <th>Tip</th>
                <th className="desk-num">Tutar</th>
                <th>Tür / Ek</th>
                <th>Açıklama</th>
                <th>Belge</th>
                <th>Makbuz</th>
                <th>Onay</th>
                <th style={{ minWidth: "120px" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id} className={kasaHareketSatirSinifi(h)}>
                  <td className="desk-col-id">{h.id}</td>
                  <td>{formatDateTr(h.tarih)}</td>
                  <td>{kasaTipHucre(h)}</td>
                  <td className="desk-num">{formatTry(h.tutar)}</td>
                  <td>{turEkHucre(h)}</td>
                  <td className={h.duzeltmeMi ? "desk-kasa-aciklama-correction" : undefined}>
                    {hareketAciklamaMasraf(h)}
                  </td>
                  <td>{h.belgeNo?.trim() || "—"}</td>
                  <td>{makbuzHucre(h, kasa)}</td>
                  <td>
                    <span className={`badge ${onayBadgeClass(h)}`}>{onayBadgeMetni(h)}</span>
                  </td>
                  <td>
                    <div className="row-actions">{islemRowActions(h, kasa)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function DosyaMasraflarPanel({ kasa }: { kasa: KasaApi }) {
  const { filterByPeriod, select, rangeKey } = useAccountingPeriodFilter();
  const filtered = useMemo(
    () => filterByPeriod(kasa.masraflar),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [kasa.masraflar, rangeKey],
  );
  const kayitSayisi = filtered.length;
  const kayitMetni = kayitSayisi === 1 ? "1 kayıt" : `${kayitSayisi} kayıt`;

  return (
    <div className="desk-panel desk-panel--masraflar">
      <div className="desk-panel-head desk-panel-head--masraflar">
        <div className="desk-panel-head-left">
          <span>Masraflar</span>
          <span className="desk-panel-meta">{kayitMetni}</span>
          {select}
        </div>
        <button type="button" className="btn btn-sm btn-primary" onClick={() => kasa.openMasrafEkle()}>
          + Masraf girişi
        </button>
      </div>
      <div className="desk-panel-body desk-panel-body--scroll">
        {kayitSayisi === 0 ? (
          <p className="desk-muted-compact">Masraf kaydı yok. Buradan veya “İşlem ekle” ile masraf girebilirsiniz.</p>
        ) : (
          <table className="desk-table desk-table--striped desk-table--compact">
            <thead>
              <tr>
                <th>Tarih</th>
                <th>Tür</th>
                <th className="desk-num">Tutar</th>
                <th>Açıklama</th>
                <th>Onay</th>
                <th>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((h) => (
                <tr key={h.id} className={kasaHareketSatirSinifi(h)}>
                  <td>{formatDateTr(h.tarih)}</td>
                  <td>{(h.masrafTuru ?? "").trim() || "—"}</td>
                  <td className="desk-num">{formatTry(h.tutar)}</td>
                  <td>{hareketAciklamaMasraf(h)}</td>
                  <td>
                    <span className={`badge ${onayBadgeClass(h)}`}>{onayBadgeMetni(h)}</span>
                  </td>
                  <td>
                    <div className="row-actions">{islemRowActions(h, kasa)}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export function DosyaKasaModals({ kasa }: { kasa: KasaApi }) {
  return (
    <>
      <DeskConfirmDialog
        open={kasa.confirm != null}
        title={kasa.confirm?.title ?? ""}
        message={kasa.confirm?.message ?? ""}
        variant={kasa.confirm?.variant}
        confirmLabel={kasa.confirm?.confirmLabel}
        busy={kasa.confirmBusy}
        onConfirm={() => void kasa.confirmOnayla()}
        onCancel={() => !kasa.confirmBusy && kasa.setConfirm(null)}
      />
      <KasaAvansModal
        key={kasa.avansFormKey}
        open={kasa.avansOpen}
        saving={kasa.saving}
        error={kasa.formErr}
        onClose={() => !kasa.saving && kasa.setAvansOpen(false)}
        onSave={kasa.kaydetAvans}
      />
      <KasaMasrafModal
        key={kasa.masrafFormKey}
        open={kasa.masrafOpen}
        saving={kasa.saving}
        error={kasa.formErr}
        masrafTurleri={kasa.masrafTurleri}
        editHareket={kasa.masrafEdit}
        onClose={() => {
          if (kasa.saving) return;
          kasa.setMasrafOpen(false);
          kasa.setMasrafEdit(null);
        }}
        onSave={kasa.kaydetMasraf}
      />
      <DeskGuvenliSilModal
        ozet={kasa.guvenliSilOzet}
        loading={kasa.guvenliSilBusy}
        error={kasa.guvenliSilErr}
        onClose={() => !kasa.guvenliSilBusy && kasa.setGuvenliSilOzet(null)}
        onSubmit={(p) => void kasa.guvenliSilGonder(p)}
      />
      <KasaDuzeltmeModal
        hedef={kasa.duzeltmeHedef}
        saving={kasa.duzeltmeSaving}
        error={kasa.duzeltmeErr}
        onClose={() => !kasa.duzeltmeSaving && kasa.setDuzeltmeHedef(null)}
        onSave={kasa.kaydetDuzeltme}
      />
    </>
  );
}
