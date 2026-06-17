import type { KasaHareket } from "@shared/types/kasa";
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

type KasaApi = ReturnType<typeof useDosyaKasa>;

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
          <button type="button" className="btn btn-sm" onClick={() => kasa.openMasrafDuzenle(h)}>
            Düzenle
          </button>
        ) : null}
        <button type="button" className="btn btn-sm" onClick={() => void kasa.onaylaHareket(h.id)}>
          Onayla
        </button>
        <button type="button" className="btn btn-sm" onClick={() => void kasa.reddetHareket(h.id)}>
          Reddet
        </button>
        <button type="button" className="btn btn-sm btn-danger" onClick={() => void kasa.silHareket(h.id)}>
          Sil
        </button>
      </>
    );
  }
  if (h.onayDurumu === "ONAYLI" && h.islemTipi !== "DUZELTME") {
    return (
      <>
        <button type="button" className="btn btn-sm" onClick={() => void kasa.makbuzAc(h.id)}>
          Makbuz
        </button>
        <button type="button" className="btn btn-sm" onClick={() => kasa.setDuzeltmeHedef(h)}>
          Düzeltme ekle
        </button>
      </>
    );
  }
  if (h.onayDurumu === "ONAYLI" && h.islemTipi === "DUZELTME" && kasa.makbuzGosterilebilir(h)) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => void kasa.makbuzAc(h.id)}>
        Makbuz
      </button>
    );
  }
  if (h.onayDurumu === "REDDEDILDI") {
    return (
      <button type="button" className="btn btn-sm btn-danger" onClick={() => void kasa.silHareket(h.id)}>
        Sil
      </button>
    );
  }
  return <span className="muted">—</span>;
}

function makbuzHucre(h: KasaHareket, kasa: KasaApi) {
  if (kasa.makbuzGosterilebilir(h)) {
    return (
      <button type="button" className="btn btn-sm" onClick={() => void kasa.makbuzAc(h.id)}>
        {h.makbuzNo?.trim() || "Makbuz"}
      </button>
    );
  }
  return h.makbuzNo?.trim() || "—";
}

export function DosyaKasaHareketleriPanel({ kasa }: { kasa: KasaApi }) {
  const kayitSayisi = kasa.kasaHareketleri.length;
  const kayitMetni = kayitSayisi === 1 ? "1 kayıt" : `${kayitSayisi} kayıt`;

  return (
    <div className="desk-panel desk-panel--grow">
      <div className="desk-panel-head">
        <span>Kasa hareketleri</span>
        <span className="desk-panel-meta">{kayitMetni}</span>
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
              {kasa.kasaHareketleri.map((h) => (
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
  const kayitSayisi = kasa.masraflar.length;
  const kayitMetni = kayitSayisi === 1 ? "1 kayıt" : `${kayitSayisi} kayıt`;

  return (
    <div className="desk-panel">
      <div className="desk-panel-head">
        <span>Masraflar</span>
        <span className="desk-panel-meta">{kayitMetni}</span>
      </div>
      <div className="desk-panel-body desk-panel-body--scroll">
        {kayitSayisi === 0 ? (
          <p className="desk-muted-compact">Masraf kaydı yok.</p>
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
              {kasa.masraflar.map((h) => (
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
      <KasaAvansModal
        open={kasa.avansOpen}
        saving={kasa.saving}
        error={kasa.formErr}
        onClose={() => !kasa.saving && kasa.setAvansOpen(false)}
        onSave={kasa.kaydetAvans}
      />
      <KasaMasrafModal
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
