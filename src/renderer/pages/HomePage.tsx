import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { MuvekkilInput, MuvekkilListItem, MuvekkilPagedResult } from "@shared/types/muvekkil";
import { MuvekkilFormModal } from "../components/MuvekkilFormModal";
import { formatTry } from "../lib/format";
import {
  MUVEKKIL_PAGE_SIZES,
  muvekkilGorunenAd,
  muvekkilListeEposta,
  muvekkilListeSayfaNumaralari,
  muvekkilListeTelefonu,
  muvekkilTurEtiket,
} from "../lib/muvekkil";

async function muvekkilListesiniSayfaliYukle(
  arama: string,
  page: number,
  pageSize: number
): Promise<MuvekkilPagedResult> {
  if (!window.api?.muvekkilAraPaged) {
    return { items: [], total: 0, page: 1, pageSize: 20, totalPages: 0 };
  }
  return window.api.muvekkilAraPaged(arama, page, pageSize);
}

export function HomePage() {
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(20);
  const [sonuc, setSonuc] = useState<MuvekkilListItem[]>([]);
  const [listeTotal, setListeTotal] = useState(0);
  const [listeTotalPages, setListeTotalPages] = useState(0);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);
  const [modal, setModal] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [kaydediyor, setKaydediyor] = useState(false);
  const [ofisOzet, setOfisOzet] = useState({ bugunGider: 0, buAyGider: 0, kasaBakiyesi: 0 });
  const [smmBekleyenSayisi, setSmmBekleyenSayisi] = useState(0);

  const yukleKayitListesi = useCallback(async () => {
    setListeYukleniyor(true);
    try {
      const r = await muvekkilListesiniSayfaliYukle(q, page, pageSize);
      setSonuc(r.items);
      setListeTotal(r.total);
      setListeTotalPages(r.totalPages);
      if (r.page !== page) setPage(r.page);
    } catch (e) {
      console.error("muvekkil sayfalı arama", e);
      setSonuc([]);
      setListeTotal(0);
      setListeTotalPages(0);
    } finally {
      setListeYukleniyor(false);
    }
  }, [q, page, pageSize]);

  useEffect(() => {
    void yukleKayitListesi();
  }, [yukleKayitListesi]);

  useEffect(() => {
    void (async () => {
      try {
        const oz = await window.api.ofisKasaAnaSayfaOzet();
        setOfisOzet({
          bugunGider: oz.bugunGider,
          buAyGider: oz.buAyGider,
          kasaBakiyesi: oz.kasaBakiyesi,
        });
      } catch {
        setOfisOzet({ bugunGider: 0, buAyGider: 0, kasaBakiyesi: 0 });
      }
      try {
        const smm = await window.api?.vekaletSmmBekleyenler?.();
        setSmmBekleyenSayisi(Array.isArray(smm) ? smm.length : 0);
      } catch {
        setSmmBekleyenSayisi(0);
      }
    })();
  }, []);

  async function yeniKaydet(input: MuvekkilInput) {
    setErr(null);
    if (!window.api?.muvekkilEkle) {
      setErr("Müvekkil kaydedilemedi.");
      return;
    }
    setKaydediyor(true);
    try {
      await window.api.muvekkilEkle(input);
      setModal(false);
      const guncel = await muvekkilListesiniSayfaliYukle(q, 1, pageSize);
      setPage(1);
      setSonuc(guncel.items);
      setListeTotal(guncel.total);
      setListeTotalPages(guncel.totalPages);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Müvekkil kaydedilemedi.");
      throw e;
    } finally {
      setKaydediyor(false);
    }
  }

  return (
    <div className="desk-page desk-page--home-simple">
      <h1 className="desk-page-title">Ana sayfa</h1>
      <p className="desk-page-sub">Müvekkil arama ve taksit takibi.</p>

      <div className="desk-home-ofis-ozet" role="region" aria-label="Ofis kasası özeti">
        <div className="desk-home-ofis-ozet-head">
          <span className="desk-home-ofis-ozet-title">OFİS KASASI</span>
        </div>
        <div className="desk-home-ofis-ozet-row">
          <div className="desk-home-ofis-ozet-grid">
            <div className="desk-home-ofis-kv">
              <span className="k">Bugünkü gider</span>
              <span className="v desk-num">{formatTry(ofisOzet.bugunGider)}</span>
            </div>
            <div className="desk-home-ofis-kv">
              <span className="k">Bu ay gider</span>
              <span className="v desk-num">{formatTry(ofisOzet.buAyGider)}</span>
            </div>
            <div className="desk-home-ofis-kv">
              <span className="k">Ofis kasa bakiyesi</span>
              <span className="v desk-num">{formatTry(ofisOzet.kasaBakiyesi)}</span>
            </div>
          </div>
          <div className="desk-home-ofis-ozet-action">
            <Link to="/ofis-kasasi" className="btn btn-sm btn-primary">
              Ofis kasasına git
            </Link>
          </div>
        </div>
      </div>

      <div className="desk-toolbar desk-toolbar--tight desk-home-toolbar">
        <div className="desk-field-inline" style={{ flex: "1 1 280px" }}>
          <label htmlFor="home-ara">Ara</label>
          <input
            id="home-ara"
            className="desk-input"
            placeholder="Müvekkil adı, şirket adı veya telefon ara..."
            value={q}
            onChange={(e) => {
              setPage(1);
              setQ(e.target.value);
            }}
          />
        </div>
        <button type="button" className="btn btn-primary btn-sm" onClick={() => setModal(true)}>
          + Yeni müvekkil
        </button>
      </div>

      <div className="desk-panel desk-panel--home-taksit-uyari">
        <div className="desk-panel-head">
          <span>Taksit uyarıları</span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          <div className="desk-taksit-alert-metrics desk-taksit-alert-metrics--three">
            <div className="desk-taksit-alert-metric desk-taksit-alert-metric--gecmis">
              <span className="l">Vadesi geçmiş</span>
              <span className="v">0</span>
            </div>
            <div className="desk-taksit-alert-metric desk-taksit-alert-metric--bugun">
              <span className="l">Bugün ödenecek</span>
              <span className="v">0</span>
            </div>
            <div className="desk-taksit-alert-metric desk-taksit-alert-metric--odenmemis">
              <span className="l">Toplam ödenmemiş taksit</span>
              <span className="v">0</span>
            </div>
          </div>
          <button type="button" className="desk-home-smm-compact" aria-label="SMM bekleyen tahsilatlar">
            <span className="desk-home-smm-compact-title">SMM bekleyen tahsilatlar</span>
            <span className="desk-home-smm-compact-num" aria-live="polite">
              {smmBekleyenSayisi}
            </span>
          </button>
          <div className="desk-home-taksit-list-bar">
            <p className="desk-home-taksit-list-caption">Vadesi geçmiş taksitler</p>
          </div>
          <div className="desk-table-wrap desk-home-taksit-table-wrap">
            <p className="desk-muted-compact desk-home-taksit-empty">Vadesi geçmiş taksit yok.</p>
          </div>
        </div>
      </div>

      <div className="desk-panel">
        <div className="desk-panel-head desk-panel-head--mvk-liste">
          <span>Kayıt listesi</span>
          <span className="desk-panel-meta">
            {listeYukleniyor ? "Yükleniyor…" : listeTotal === 1 ? "1 kayıt" : `Toplam ${listeTotal} kayıt`}
          </span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-0 desk-home-mvk-liste-body">
          <div className="desk-table-wrap desk-home-muvekkil-table-wrap">
            {sonuc.length === 0 && !listeYukleniyor ? (
              <p className="desk-muted-compact desk-home-mvk-liste-empty">Kayıt bulunamadı.</p>
            ) : sonuc.length === 0 && listeYukleniyor ? (
              <p className="desk-muted-compact desk-home-mvk-liste-empty">Yükleniyor…</p>
            ) : (
              <table className="desk-table desk-table--striped desk-table--compact">
                <thead>
                  <tr>
                    <th style={{ width: "44px" }}>#</th>
                    <th style={{ width: "92px" }}>Tür</th>
                    <th>Müvekkil</th>
                    <th style={{ width: "110px" }}>Telefon</th>
                    <th>E-posta</th>
                    <th style={{ width: "72px" }}>Not</th>
                    <th style={{ width: "72px" }}>İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  {sonuc.map((m) => (
                    <tr key={m.id}>
                      <td>{m.id}</td>
                      <td>{muvekkilTurEtiket(m.muvekkilTuru)}</td>
                      <td>{muvekkilGorunenAd(m)}</td>
                      <td>{muvekkilListeTelefonu(m)}</td>
                      <td className="desk-home-cell-ellipsis" style={{ maxWidth: "180px" }}>
                        {muvekkilListeEposta(m)}
                      </td>
                      <td className="desk-home-cell-ellipsis">{(m.not ?? "").trim() || "—"}</td>
                      <td>
                        <Link to={`/muvekkil/${m.id}`} className="btn btn-sm btn-primary">
                          Aç
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          {listeTotal > 0 ? (
            <div className="desk-mvk-pagination" aria-label="Kayıt listesi sayfalama">
              <div className="desk-mvk-pagination-top">
                <span className="desk-mvk-pagination-summary">
                  {listeTotalPages > 0
                    ? `Sayfa ${page} / ${listeTotalPages} — Toplam ${listeTotal} kayıt`
                    : `Toplam ${listeTotal} kayıt`}
                </span>
                <label className="desk-mvk-pagination-pagesize">
                  <span className="desk-mvk-pagination-pagesize-lbl">Sayfa başına</span>
                  <select
                    className="desk-input desk-input--tiny"
                    value={pageSize}
                    onChange={(e) => {
                      setPage(1);
                      setPageSize(Number(e.target.value));
                    }}
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
              <div className="desk-mvk-pagination-bar">
                <button
                  type="button"
                  className="btn btn-sm desk-mvk-page-btn"
                  disabled={page <= 1 || listeYukleniyor}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Önceki
                </button>
                <div className="desk-mvk-page-nums" role="group">
                  {muvekkilListeSayfaNumaralari(page, listeTotalPages).map((n) => (
                    <button
                      key={n}
                      type="button"
                      className={`btn btn-sm desk-mvk-page-num${n === page ? " desk-mvk-page-num--aktif" : ""}`}
                      disabled={listeYukleniyor}
                      onClick={() => setPage(n)}
                      aria-current={n === page ? "page" : undefined}
                    >
                      {n}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="btn btn-sm desk-mvk-page-btn"
                  disabled={listeTotalPages <= 0 || page >= listeTotalPages || listeYukleniyor}
                  onClick={() => setPage((p) => Math.min(listeTotalPages, p + 1))}
                >
                  Sonraki
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <MuvekkilFormModal
        title="Yeni müvekkil"
        open={modal}
        saving={kaydediyor}
        error={err}
        onClose={() => !kaydediyor && setModal(false)}
        onSave={yeniKaydet}
      />
    </div>
  );
}
