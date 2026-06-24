import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  DIGER_GELIR_KOD,
  DIGER_GIDER_KOD,
  OFIS_GELIR_KATEGORI_KODLARI,
  OFIS_GELIR_KATEGORI_ETIKET,
  OFIS_GIDER_KATEGORI_KODLARI,
  OFIS_GIDER_KATEGORI_ETIKET,
  OFIS_ODEME_YONTEMI_KODLARI,
  OFIS_ODEME_YONTEMI_ETIKET,
} from "@shared/constants/ofisKasa";
import type { OfisKasaHareketListeSatir, OfisKasaUstOzet } from "@shared/types/ofisKasa";
import { bugunYmd, formatDateTr, formatTry } from "../lib/format";
import {
  ayBasiSonu,
  duzeltmeListeTutar,
  formatSignedTry,
  hesaplaOfisKasaDuzeltme,
  islemTipiEtiket,
  ofisKasaAciklamaMetni,
  ofisKasaKategoriListeEtiketi,
  ofisKasaSatirSinifi,
  ofisKasaTurEkMetni,
  onayBadgeClass,
  onayBadgeMetni,
  parseTutar,
  satirAuditTitle,
  tumKategoriSecenekleri,
} from "../lib/ofisKasa";
import { DeskModalPortal } from "../components/DeskModalPortal";

export function OfisKasaPage() {
  const navigate = useNavigate();
  const { bas: ayBas, bit: ayBit } = useMemo(() => ayBasiSonu(), []);
  const [tb, setTb] = useState(ayBas);
  const [te, setTe] = useState(ayBit);
  const [tip, setTip] = useState("TUMU");
  const [katSel, setKatSel] = useState("");
  const [q, setQ] = useState("");
  const [hareketler, setHareketler] = useState<OfisKasaHareketListeSatir[]>([]);
  const [ust, setUst] = useState<OfisKasaUstOzet | null>(null);
  const [listeYukleniyor, setListeYukleniyor] = useState(false);

  const filtre = useMemo(
    () => ({
      tarihBas: tb,
      tarihBit: te,
      islemTipi: tip,
      kategori: katSel,
      q: q.trim(),
    }),
    [tb, te, tip, katSel, q]
  );

  const kategoriSecenekleri = useMemo(() => tumKategoriSecenekleri(), []);

  const yukleUst = useCallback(async () => {
    try {
      const r = await window.api.ofisKasaUstOzet();
      setUst(r);
    } catch (e) {
      console.error("[ofisKasaUstOzet]", e);
      setUst(null);
    }
  }, []);

  const yukleListe = useCallback(async () => {
    setListeYukleniyor(true);
    try {
      const rows = await window.api.ofisKasaList(filtre);
      setHareketler(Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.error("[ofisKasaList]", e);
      setHareketler([]);
    } finally {
      setListeYukleniyor(false);
    }
  }, [filtre]);

  useEffect(() => {
    void yukleUst();
  }, [yukleUst]);

  useEffect(() => {
    void yukleListe();
  }, [yukleListe]);

  async function tumunuYenile() {
    await Promise.all([yukleUst(), yukleListe()]);
  }

  const [modalAcik, setModalAcik] = useState(false);
  const [duzenleId, setDuzenleId] = useState<number | null>(null);
  const [fTip, setFTip] = useState<"GELIR" | "GIDER">("GIDER");
  const [fTarih, setFTarih] = useState(bugunYmd());
  const [fKat, setFKat] = useState<string>(OFIS_GIDER_KATEGORI_KODLARI[0]);
  const [fOzelKat, setFOzelKat] = useState("");
  const [fAciklama, setFAciklama] = useState("");
  const [fTutar, setFTutar] = useState("");
  const [fOdeme, setFOdeme] = useState<string>(OFIS_ODEME_YONTEMI_KODLARI[0]);
  const [fBelge, setFBelge] = useState("");
  const [fNot, setFNot] = useState("");
  const [formErr, setFormErr] = useState<string | null>(null);
  const [formKaydediyor, setFormKaydediyor] = useState(false);
  const digerSecili = fKat === DIGER_GELIR_KOD || fKat === DIGER_GIDER_KOD;

  function modalSifirlaYeni() {
    setDuzenleId(null);
    setFormErr(null);
    setFTip("GIDER");
    setFTarih(bugunYmd());
    setFKat(OFIS_GIDER_KATEGORI_KODLARI[0]);
    setFOzelKat("");
    setFAciklama("");
    setFTutar("");
    setFOdeme(OFIS_ODEME_YONTEMI_KODLARI[0]);
    setFBelge("");
    setFNot("");
  }

  function modalAcYeni() {
    modalSifirlaYeni();
    setModalAcik(true);
  }

  function modalKapat() {
    if (formKaydediyor) return;
    setModalAcik(false);
    setFormErr(null);
  }

  function modalAcDuzenle(h: OfisKasaHareketListeSatir) {
    if (h.islemTipi === "DUZELTME") return;
    setFormErr(null);
    setDuzenleId(h.id);
    setFTip(h.islemTipi === "GELIR" ? "GELIR" : "GIDER");
    setFTarih(h.tarih.slice(0, 10));
    setFKat(h.kategori);
    setFOzelKat(h.ozelKategoriAdi?.trim() ?? "");
    setFAciklama(h.aciklama ?? "");
    setFTutar(String(h.tutar));
    setFOdeme(h.odemeYontemi);
    setFBelge(h.belgeNo ?? "");
    setFNot(h.not ?? "");
    setModalAcik(true);
  }

  async function formKaydet() {
    setFormErr(null);
    const tutar = parseTutar(fTutar);
    if (!Number.isFinite(tutar) || tutar <= 0) {
      setFormErr("Tutar sıfırdan büyük ve geçerli olmalıdır.");
      return;
    }
    if (digerSecili && !fOzelKat.trim()) {
      setFormErr("Özel kategori adı zorunludur.");
      return;
    }
    setFormKaydediyor(true);
    try {
      if (duzenleId != null) {
        const res = await window.api.ofisKasaGuncelle(duzenleId, {
          tarih: fTarih,
          kategori: fKat,
          ozelKategoriAdi: digerSecili ? fOzelKat.trim() : null,
          aciklama: fAciklama.trim() || null,
          tutar,
          odemeYontemi: fOdeme,
          belgeNo: fBelge.trim() || null,
          not: fNot.trim() || null,
        });
        if (!res.ok) {
          setFormErr(res.error);
          return;
        }
      } else {
        const res = await window.api.ofisKasaEkle({
          islemTipi: fTip,
          tarih: fTarih,
          kategori: fKat,
          ozelKategoriAdi: digerSecili ? fOzelKat.trim() : null,
          aciklama: fAciklama.trim() || null,
          tutar,
          odemeYontemi: fOdeme,
          belgeNo: fBelge.trim() || null,
          not: fNot.trim() || null,
        });
        if (!res.ok) {
          setFormErr(res.error);
          return;
        }
      }
      setModalAcik(false);
      await tumunuYenile();
    } catch (e) {
      console.error("[ofisKasa formKaydet]", e);
      setFormErr("Kayıt sırasında hata oluştu.");
    } finally {
      setFormKaydediyor(false);
    }
  }

  async function onaylaHareket(id: number) {
    if (!confirm("Bu işlemi onaylamak istediğinize emin misiniz? Onaylanan işlem silinemez.")) {
      return;
    }
    const r = await window.api.ofisKasaOnayla(id);
    if (!r.ok) {
      alert(r.error ?? "Onaylanamadı");
      return;
    }
    await tumunuYenile();
  }

  async function silHareket(id: number) {
    if (!confirm("Bu işlemi silmek istediğinize emin misiniz?")) return;
    const r = await window.api.ofisKasaSil(id);
    if (!r.ok) {
      alert(r.error ?? "Silinemedi");
      return;
    }
    await tumunuYenile();
  }

  const [duzeltmeHedef, setDuzeltmeHedef] = useState<OfisKasaHareketListeSatir | null>(null);
  const [dDogruTutar, setDDogruTutar] = useState("");
  const [dTarih, setDTarih] = useState(bugunYmd());
  const [dNot, setDNot] = useState("");
  const [dErr, setDErr] = useState<string | null>(null);
  const [dKaydediyor, setDKaydediyor] = useState(false);

  const duzeltmeOnizleme = useMemo(() => {
    if (!duzeltmeHedef) return null;
    const dogru = parseTutar(dDogruTutar);
    if (!Number.isFinite(dogru) || dDogruTutar.trim() === "") return null;
    const refTip = duzeltmeHedef.islemTipi === "GELIR" ? "GELIR" : "GIDER";
    return hesaplaOfisKasaDuzeltme(refTip, duzeltmeHedef.tutar, dogru);
  }, [duzeltmeHedef, dDogruTutar]);

  function acDuzeltme(h: OfisKasaHareketListeSatir) {
    if (h.hasCorrection) {
      alert("Bu kayıt için zaten düzeltme yapılmış.");
      return;
    }
    setDErr(null);
    setDuzeltmeHedef(h);
    setDDogruTutar("");
    setDTarih(bugunYmd());
    setDNot("");
  }

  function kapatDuzeltme() {
    if (dKaydediyor) return;
    setDuzeltmeHedef(null);
    setDErr(null);
  }

  async function duzeltmeKaydet() {
    if (!duzeltmeHedef) return;
    setDErr(null);
    const dogruTutar = parseTutar(dDogruTutar);
    if (!Number.isFinite(dogruTutar) || dDogruTutar.trim() === "") {
      setDErr("Doğru tutar girin.");
      return;
    }
    const refTip = duzeltmeHedef.islemTipi === "GELIR" ? "GELIR" : "GIDER";
    const oniz = hesaplaOfisKasaDuzeltme(refTip, duzeltmeHedef.tutar, dogruTutar);
    if (!oniz.ok) {
      setDErr(oniz.error);
      return;
    }
    setDKaydediyor(true);
    try {
      const res = await window.api.ofisKasaDuzeltmeEkle({
        orijinalHareketId: duzeltmeHedef.id,
        dogruTutar,
        tarih: dTarih,
        not: dNot.trim() || null,
      });
      if (!res.ok) {
        setDErr(res.error);
        return;
      }
      setDuzeltmeHedef(null);
      await tumunuYenile();
    } catch (e) {
      console.error("[ofisKasa duzeltmeKaydet]", e);
      setDErr("Düzeltme kaydedilemedi.");
    } finally {
      setDKaydediyor(false);
    }
  }

  function islemRowActions(h: OfisKasaHareketListeSatir) {
    if (h.onayDurumu === "ONAYSIZ") {
      return (
        <>
          {h.islemTipi !== "DUZELTME" ? (
            <button type="button" className="btn btn-sm" onClick={() => modalAcDuzenle(h)}>
              Düzenle
            </button>
          ) : null}
          <button type="button" className="btn btn-sm" onClick={() => void onaylaHareket(h.id)}>
            Onayla
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={() => void silHareket(h.id)}>
            Sil
          </button>
        </>
      );
    }
    if (h.onayDurumu === "ONAYLI") {
      if (h.islemTipi === "DUZELTME") {
        return <span className="muted">—</span>;
      }
      if (h.hasCorrection) {
        return (
          <span className="muted" title="Bu kayıt için zaten düzeltme yapılmış">
            Düzeltildi
          </span>
        );
      }
      return (
        <button type="button" className="btn btn-sm" onClick={() => acDuzeltme(h)}>
          Düzeltme ekle
        </button>
      );
    }
    return null;
  }

  function islemTipiHucre(h: OfisKasaHareketListeSatir) {
    const ana = h.islemTipi === "DUZELTME" ? "Düzeltme" : islemTipiEtiket(h.islemTipi);
    return (
      <div className="desk-kasa-tip-cell">
        <span>{ana}</span>
        {h.islemTipi !== "DUZELTME" && h.hasCorrection ? (
          <span className="desk-badge-duzeltildi" title="Bu işlem için düzeltme kaydı var">
            Düzeltildi
          </span>
        ) : null}
      </div>
    );
  }

  function raporYazdir() {
    const { bas: ayBas, bit: ayBit } = ayBasiSonu();
    const bas = (tb || ayBas).trim().slice(0, 10);
    const bit = (te || ayBit).trim().slice(0, 10);
    navigate(`/print/ofis-kasa-raporu?bas=${encodeURIComponent(bas)}&bit=${encodeURIComponent(bit)}`);
  }

  return (
    <div className="desk-page desk-page-shell desk-page--ofis-kasa">
      <div className="desk-toolbar desk-toolbar--tight">
        <div className="desk-toolbar-left">
          <Link className="desk-link-back" to="/">
            ← Ana sayfa
          </Link>
          <span className="desk-toolbar-title">Ofis kasası</span>
        </div>
        <div className="desk-toolbar-actions">
          <button type="button" className="btn btn-primary btn-sm" onClick={() => modalAcYeni()}>
            Yeni Ofis Kasa Hareketi
          </button>
          <button type="button" className="btn btn-sm" onClick={() => raporYazdir()}>
            Ofis Kasa Raporu Yazdır
          </button>
        </div>
      </div>

      <p className="desk-muted-compact desk-page-intro">
        Bu modül müvekkil dosya kasasından tamamen ayrıdır; vekalet taksit tahsilatı buraya otomatik düşmez.
      </p>

      {ust ? (
        <div className="desk-file-strip desk-ofis-ust-ozet">
          <div className="desk-file-kvgrid desk-file-kvgrid--ofis-ozet">
            <div className="desk-kv">
              <span className="desk-kv-k">Devreden bakiye</span>
              <span className="desk-kv-v desk-num">{formatTry(ust.devredenBakiye)}</span>
            </div>
            <div className="desk-kv">
              <span className="desk-kv-k">Bu ay gelir</span>
              <span className="desk-kv-v desk-num">{formatTry(ust.buAyGelir)}</span>
            </div>
            <div className="desk-kv">
              <span className="desk-kv-k">Bu ay gider</span>
              <span className="desk-kv-v desk-num">{formatTry(ust.buAyGider)}</span>
            </div>
            <div className="desk-kv">
              <span className="desk-kv-k">Bu ay düzeltme etkisi</span>
              <span className="desk-kv-v desk-num">{formatSignedTry(ust.buAyDuzeltmeEtkisi)}</span>
            </div>
            <div className="desk-kv desk-kv--emphasis">
              <span className="desk-kv-k">Güncel kasa bakiyesi</span>
              <span className="desk-kv-v desk-num">{formatTry(ust.kasaBakiyesi)}</span>
            </div>
          </div>
        </div>
      ) : null}

      <section className="desk-panel">
        <div className="desk-panel-head">
          <span>Filtreler</span>
          <span className="desk-panel-meta">
            {listeYukleniyor ? "Yükleniyor…" : `${hareketler.length} kayıt`}
          </span>
        </div>
        <div className="desk-panel-body desk-panel-body--pad-sm">
          <div className="desk-form-grid desk-ofis-filtre-grid">
            <div className="field">
              <label htmlFor="ofk-tb">Tarih başı</label>
              <input id="ofk-tb" className="desk-input" type="date" value={tb} onChange={(e) => setTb(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ofk-te">Tarih sonu</label>
              <input id="ofk-te" className="desk-input" type="date" value={te} onChange={(e) => setTe(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="ofk-tip">İşlem tipi</label>
              <select id="ofk-tip" value={tip} onChange={(e) => setTip(e.target.value)}>
                <option value="TUMU">Tümü</option>
                <option value="GELIR">Gelir</option>
                <option value="GIDER">Gider</option>
                <option value="DUZELTME">Düzeltme</option>
              </select>
            </div>
            <div className="field">
              <label htmlFor="ofk-kat">Kategori</label>
              <select id="ofk-kat" value={katSel} onChange={(e) => setKatSel(e.target.value)}>
                <option value="">Tümü</option>
                {kategoriSecenekleri.map((x) => (
                  <option key={x.kod} value={x.kod}>
                    {x.etiket}
                  </option>
                ))}
              </select>
            </div>
            <div className="field desk-form-span2">
              <label htmlFor="ofk-q">Arama</label>
              <input
                id="ofk-q"
                className="desk-input"
                placeholder="Açıklama, belge, not veya özel kategori…"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="desk-panel desk-panel--grow desk-panel--ofis-liste">
        <div className="desk-panel-head">
          <span>İşlem listesi</span>
          <span className="desk-panel-meta">
            {listeYukleniyor
              ? "Yükleniyor…"
              : hareketler.length === 1
                ? "1 kayıt"
                : `${hareketler.length} kayıt`}
          </span>
        </div>
        <div className="desk-panel-body desk-table-wrap desk-ofis-kasa-table-wrap">
          {hareketler.length === 0 ? (
            <p className="desk-muted-compact">Bu filtrelere uygun kayıt yok.</p>
          ) : (
            <table className="desk-table desk-table--striped desk-table--compact desk-table--ofis-kasa">
              <thead>
                <tr>
                  <th className="desk-col-id">#</th>
                  <th>Tarih</th>
                  <th>Tip</th>
                  <th className="desk-num">Tutar</th>
                  <th>Tür / Ek</th>
                  <th>Açıklama</th>
                  <th>Belge</th>
                  <th>Onay</th>
                  <th style={{ minWidth: "120px" }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {hareketler.map((h) => (
                  <tr key={h.id} className={ofisKasaSatirSinifi(h)} title={satirAuditTitle(h)}>
                    <td className="desk-col-id">{h.id}</td>
                    <td>{formatDateTr(h.tarih)}</td>
                    <td>{islemTipiHucre(h)}</td>
                    <td className="desk-num">{formatTry(duzeltmeListeTutar(h))}</td>
                    <td className="desk-ofis-tur-ek-cell">{ofisKasaTurEkMetni(h)}</td>
                    <td className={h.islemTipi === "DUZELTME" ? "desk-kasa-aciklama-correction" : undefined}>
                      {ofisKasaAciklamaMetni(h)}
                    </td>
                    <td>{h.belgeNo?.trim() ? h.belgeNo : "—"}</td>
                    <td>
                      <span className={`badge ${onayBadgeClass(h)}`}>{onayBadgeMetni(h)}</span>
                    </td>
                    <td>
                      <div className="row-actions">{islemRowActions(h)}</div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      {modalAcik ? (
        <DeskModalPortal>
          <div className="modal-backdrop" onClick={() => modalKapat()} role="presentation">
            <div className="modal modal-desk modal-desk--wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
              <div className="modal-head">
                <h2>{duzenleId != null ? "Ofis kasa hareketini düzenle" : "Yeni Ofis Kasa Hareketi"}</h2>
              </div>
              <div className="modal-body">
                {formErr ? <p className="form-error modal-form-error">{formErr}</p> : null}
                <div className="desk-form-grid">
                  <div className="field">
                    <label htmlFor="ofk-ftip">İşlem tipi</label>
                    <select
                      id="ofk-ftip"
                      className="desk-input"
                      value={fTip}
                      disabled={duzenleId != null}
                      onChange={(e) => {
                        const t = e.target.value as "GELIR" | "GIDER";
                        setFTip(t);
                        if (t === "GELIR") {
                          setFKat(OFIS_GELIR_KATEGORI_KODLARI[0]);
                        } else {
                          setFKat(OFIS_GIDER_KATEGORI_KODLARI[0]);
                        }
                        setFOzelKat("");
                      }}
                    >
                      <option value="GELIR">Gelir</option>
                      <option value="GIDER">Gider</option>
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="ofk-ftar">Tarih</label>
                    <input
                      id="ofk-ftar"
                      className="desk-input"
                      type="date"
                      value={fTarih}
                      onChange={(e) => setFTarih(e.target.value)}
                    />
                  </div>
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fkat">Kategori</label>
                    <select
                      id="ofk-fkat"
                      className="desk-input"
                      value={fKat}
                      onChange={(e) => {
                        setFKat(e.target.value);
                        if (e.target.value !== DIGER_GELIR_KOD && e.target.value !== DIGER_GIDER_KOD) {
                          setFOzelKat("");
                        }
                      }}
                    >
                      {fTip === "GELIR"
                        ? OFIS_GELIR_KATEGORI_KODLARI.map((k) => (
                            <option key={k} value={k}>
                              {OFIS_GELIR_KATEGORI_ETIKET[k]}
                            </option>
                          ))
                        : OFIS_GIDER_KATEGORI_KODLARI.map((k) => (
                            <option key={k} value={k}>
                              {OFIS_GIDER_KATEGORI_ETIKET[k]}
                            </option>
                          ))}
                    </select>
                  </div>
                  {digerSecili ? (
                    <div className="field desk-form-span2">
                      <label htmlFor="ofk-fozel">Özel kategori adı</label>
                      <input
                        id="ofk-fozel"
                        className="desk-input"
                        value={fOzelKat}
                        onChange={(e) => setFOzelKat(e.target.value)}
                        placeholder="Listede görünecek ad"
                        maxLength={200}
                      />
                    </div>
                  ) : null}
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fac">Açıklama</label>
                    <textarea
                      id="ofk-fac"
                      className="desk-input"
                      value={fAciklama}
                      onChange={(e) => setFAciklama(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ofk-ftut">Tutar</label>
                    <input
                      id="ofk-ftut"
                      className="desk-input desk-num"
                      value={fTutar}
                      onChange={(e) => setFTutar(e.target.value)}
                      inputMode="decimal"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="ofk-fod">Ödeme yöntemi</label>
                    <select id="ofk-fod" className="desk-input" value={fOdeme} onChange={(e) => setFOdeme(e.target.value)}>
                      {OFIS_ODEME_YONTEMI_KODLARI.map((k) => (
                        <option key={k} value={k}>
                          {OFIS_ODEME_YONTEMI_ETIKET[k]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fbel">Belge no / fiş no / dekont no</label>
                    <input id="ofk-fbel" className="desk-input" value={fBelge} onChange={(e) => setFBelge(e.target.value)} />
                  </div>
                  <div className="field desk-form-span2">
                    <label htmlFor="ofk-fnot">Not</label>
                    <textarea id="ofk-fnot" className="desk-input" value={fNot} onChange={(e) => setFNot(e.target.value)} rows={2} />
                  </div>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn" onClick={() => modalKapat()}>
                  Vazgeç
                </button>
                <button type="button" className="btn btn-primary" disabled={formKaydediyor} onClick={() => void formKaydet()}>
                  Kaydet
                </button>
              </div>
            </div>
          </div>
        </DeskModalPortal>
      ) : null}

      {duzeltmeHedef ? (
        <DeskModalPortal>
          <div className="modal-backdrop" role="presentation" onClick={() => kapatDuzeltme()}>
            <div className="modal modal-desk modal-desk--wide" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>Düzeltme ekle</h2>
            </div>
            <div className="modal-body">
              {dErr ? <p className="form-error modal-form-error">{dErr}</p> : null}
              <fieldset className="desk-duzeltme-readonly">
                <legend>Orijinal işlem</legend>
                <div className="desk-form-grid">
                  <div className="field">
                    <label>Tarih</label>
                    <input readOnly value={formatDateTr(duzeltmeHedef.tarih)} />
                  </div>
                  <div className="field">
                    <label>Tip</label>
                    <input readOnly value={duzeltmeHedef.islemTipi === "GELIR" ? "Gelir" : "Gider"} />
                  </div>
                  <div className="field desk-form-span2">
                    <label>Kategori</label>
                    <input
                      readOnly
                      value={ofisKasaKategoriListeEtiketi(duzeltmeHedef.kategori, duzeltmeHedef.ozelKategoriAdi)}
                    />
                  </div>
                  <div className="field desk-form-span2">
                    <label>Açıklama</label>
                    <input readOnly value={duzeltmeHedef.aciklama?.trim() ? duzeltmeHedef.aciklama : "—"} />
                  </div>
                  <div className="field">
                    <label>Eski tutar</label>
                    <input readOnly value={formatTry(duzeltmeHedef.tutar)} />
                  </div>
                </div>
              </fieldset>
              <div className="desk-form-grid" style={{ marginTop: 12 }}>
                <div className="field">
                  <label>Düzeltme tarihi</label>
                  <input className="desk-input" type="date" value={dTarih} onChange={(e) => setDTarih(e.target.value)} />
                </div>
                <div className="field">
                  <label>Doğru tutar</label>
                  <input
                    className="desk-input desk-num"
                    value={dDogruTutar}
                    onChange={(e) => setDDogruTutar(e.target.value)}
                    placeholder="Orijinal tutardan farklı tutar"
                    inputMode="decimal"
                  />
                </div>
                <div className="field desk-form-span2">
                  <label>Not</label>
                  <textarea className="desk-input" value={dNot} onChange={(e) => setDNot(e.target.value)} rows={2} />
                </div>
                {duzeltmeOnizleme?.ok ? (
                  <div className="field desk-form-span2 desk-duzeltme-onizleme">
                    <label>Hesaplanan düzeltme</label>
                    <div className="desk-duzeltme-onizleme-body">
                      <span className="desk-badge-duzeltme-tur">{duzeltmeOnizleme.turEtiket}</span>
                      <span>
                        Fark: {formatTry(duzeltmeOnizleme.farkTutar)} · Kasa etkisi:{" "}
                        {formatSignedTry(duzeltmeOnizleme.kasaEtkisi)}
                      </span>
                    </div>
                  </div>
                ) : duzeltmeOnizleme && !duzeltmeOnizleme.ok ? (
                  <p className="form-error desk-form-span2">{duzeltmeOnizleme.error}</p>
                ) : null}
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="btn" onClick={() => kapatDuzeltme()}>
                Vazgeç
              </button>
              <button type="button" className="btn btn-primary" disabled={dKaydediyor} onClick={() => void duzeltmeKaydet()}>
                Düzeltmeyi kaydet
              </button>
            </div>
          </div>
        </div>
        </DeskModalPortal>
      ) : null}
    </div>
  );
}
