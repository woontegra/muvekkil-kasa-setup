import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ODEME_YONTEMI_ETIKET, ODEME_YONTEMI_KODLARI } from "@shared/constants/kasa";
import type { OdemeYontemiKodu } from "@shared/constants/kasa";
import type {
  TaksitEkleInput,
  VekaletTaksit,
  VekaletTaksitOdeme,
  VekaletUcreti,
} from "@shared/types/vekalet";
import { bugunYmd, formatDateTr, formatTry, parsePosTutar } from "../lib/format";
import { taksitDurumBadgeClass, taksitDurumEtiket, taksitSmmHucre, vekaletOzetFromTaksitler } from "../lib/vekalet";
import { odemeEtiket } from "../lib/kasa";

type Props = {
  dosyaId: number;
  muvekkilId: number;
  onSmmChange?: () => void;
  /** Dosya detay alt paneli: özet çubuğu ve üst araç çubuğu gizlenir */
  compact?: boolean;
  onTaksitSayisi?: (n: number) => void;
};

export function VekaletTaksitlerTab({ dosyaId, muvekkilId, onSmmChange, compact, onTaksitSayisi }: Props) {
  const navigate = useNavigate();
  const [vekalet, setVekalet] = useState<VekaletUcreti | null>(null);
  const [taksitler, setTaksitler] = useState<VekaletTaksit[]>([]);
  const [ucretOpen, setUcretOpen] = useState(false);
  const [taksitOpen, setTaksitOpen] = useState(false);
  const [esitOpen, setEsitOpen] = useState(false);
  const [odemeTaksit, setOdemeTaksit] = useState<VekaletTaksit | null>(null);
  const [gecmisTaksit, setGecmisTaksit] = useState<VekaletTaksit | null>(null);
  const [gecmis, setGecmis] = useState<VekaletTaksitOdeme[]>([]);
  const [formErr, setFormErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function vekaletMakbuzAc(odemeId: number) {
    if (!window.api) return;
    const r = await window.api.getVekaletPrintPackageByOdemeId(odemeId);
    if (!r.ok) {
      alert(r.mesaj ?? r.error ?? "Makbuz açılamadı");
      return;
    }
    navigate(`/print/makbuz/vekalet/${odemeId}`);
  }

  const onSmmChangeRef = useRef(onSmmChange);
  onSmmChangeRef.current = onSmmChange;

  const yukle = useCallback(async () => {
    if (!window.api) return;
    const v = await window.api.vekaletGetOrCreate(dosyaId, muvekkilId);
    setVekalet(v);
    const t = await window.api.vekaletTaksitList(v.id);
    setTaksitler(t);
    onSmmChangeRef.current?.();
  }, [dosyaId, muvekkilId]);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  useEffect(() => {
    onTaksitSayisi?.(taksitler.length);
  }, [taksitler.length, onTaksitSayisi]);

  const ozet = useMemo(
    () => vekaletOzetFromTaksitler(vekalet?.anlasilanTutar ?? 0, taksitler),
    [vekalet, taksitler]
  );

  async function kaydetUcret(anlasilanTutar: number, aciklama: string | null) {
    setFormErr(null);
    setSaving(true);
    try {
      const res = await window.api.vekaletKaydet(dosyaId, muvekkilId, { anlasilanTutar, aciklama });
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setUcretOpen(false);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetTaksit(input: TaksitEkleInput) {
    if (!vekalet) return;
    setFormErr(null);
    setSaving(true);
    try {
      const res = await window.api.vekaletTaksitEkle(vekalet.id, input);
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setTaksitOpen(false);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetEsitTaksit(adet: number, ilkVade: string) {
    if (!vekalet) return;
    setFormErr(null);
    setSaving(true);
    try {
      const mevcutToplam = taksitler.reduce((s, t) => s + t.tutar, 0);
      const kalan = Math.max(0, vekalet.anlasilanTutar - mevcutToplam);
      if (kalan <= 0) {
        setFormErr("Taksitlendirilecek kalan tutar yok");
        throw new Error("Taksitlendirilecek kalan tutar yok");
      }
      const parca = Math.floor((kalan / adet) * 100) / 100;
      let dagitilan = 0;
      for (let i = 0; i < adet; i++) {
        const tutar = i === adet - 1 ? Math.round((kalan - dagitilan) * 100) / 100 : parca;
        dagitilan += tutar;
        const vade = vadeEkleAy(ilkVade, i);
        const res = await window.api.vekaletTaksitEkle(vekalet.id, { tutar, vadeTarihi: vade });
        if (!res.ok) {
          setFormErr(res.error);
          throw new Error(res.error);
        }
      }
      setEsitOpen(false);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function kaydetOdeme(data: {
    tutar: number;
    odemeTarihi: string;
    odemeYontemi: OdemeYontemiKodu;
    aciklama: string | null;
  }) {
    if (!odemeTaksit) return;
    setFormErr(null);
    setSaving(true);
    try {
      const res = await window.api.vekaletTaksitOdemeAl(odemeTaksit.id, data);
      if (!res.ok) {
        setFormErr(res.error);
        throw new Error(res.error);
      }
      setOdemeTaksit(null);
      void yukle();
    } finally {
      setSaving(false);
    }
  }

  async function acGecmis(t: VekaletTaksit) {
    setGecmisTaksit(t);
    const list = await window.api.vekaletTaksitOdemeGecmisi(t.id);
    setGecmis(list);
  }

  async function smmKes(odemeId: number) {
    const res = await window.api.vekaletSmmKesildi(odemeId);
    if (!res.ok) {
      alert(res.error ?? "SMM güncellenemedi");
      return;
    }
    if (gecmisTaksit) {
      const list = await window.api.vekaletTaksitOdemeGecmisi(gecmisTaksit.id);
      setGecmis(list);
    }
    void yukle();
  }

  async function silTaksit(id: number) {
    if (!confirm("Bu taksiti silmek istediğinize emin misiniz?")) return;
    const res = await window.api.vekaletTaksitSil(id);
    if (!res.ok) alert(res.error ?? "Silinemedi");
    void yukle();
  }

  function renderTaksitTableBody() {
    return taksitler.map((t) => {
      const smm = taksitSmmHucre(t.smmDurumu);
      return (
        <tr key={t.id}>
          <td>{t.taksitNo}</td>
          <td>{formatDateTr(t.vadeTarihi)}</td>
          <td className="num">{formatTry(t.tutar)}</td>
          <td className="num">{formatTry(t.odenenToplam)}</td>
          <td className="num">{formatTry(t.kalanTutar)}</td>
          <td>
            <span className={taksitDurumBadgeClass(t.durum)}>{taksitDurumEtiket(t.durum)}</span>
          </td>
          <td>{formatDateTr(t.sonOdemeTarihi)}</td>
          <td>
            {t.sonOdemeId ? (
              <button type="button" className="btn btn-sm" onClick={() => void vekaletMakbuzAc(t.sonOdemeId!)}>
                {t.sonMakbuzNo ?? "Makbuz"}
              </button>
            ) : (
              t.sonMakbuzNo ?? "—"
            )}
          </td>
          <td className="desk-smm-warn-cell">
            {smm.blink ? (
              <span className={smm.className}>{smm.label}</span>
            ) : t.smmDurumu === "KESILDI" ? (
              <span className="desk-smm-ok-badge">{smm.label}</span>
            ) : (
              "—"
            )}
          </td>
          <td>
            <div className="row-actions">
              {t.kalanTutar > 0 ? (
                <button type="button" className="btn btn-sm btn-primary" onClick={() => { setFormErr(null); setOdemeTaksit(t); }}>
                  Ödeme al
                </button>
              ) : null}
              {t.smmDurumu === "BEKLIYOR" && t.smmBekleyenOdemeId ? (
                <button type="button" className="btn btn-sm" onClick={() => void smmKes(t.smmBekleyenOdemeId!)}>
                  SMM Kesildi
                </button>
              ) : null}
              <button type="button" className="btn btn-sm" onClick={() => void acGecmis(t)}>
                Ödeme geçmişi
              </button>
              {t.odenenToplam <= 0 ? (
                <button type="button" className="btn btn-sm btn-danger" onClick={() => void silTaksit(t.id)}>
                  Sil
                </button>
              ) : null}
            </div>
          </td>
        </tr>
      );
    });
  }

  function renderTaksitTable(showEmptyRow: boolean) {
    return (
      <div className={compact ? "desk-table-wrap desk-vekalet-taksit-wrap" : "desk-table-wrap"}>
        <table className="desk-table desk-table--striped desk-table--compact">
          <thead>
            <tr>
              <th>Taksit no</th>
              <th>Vade tarihi</th>
              <th className="num">Taksit tutarı</th>
              <th className="num">Ödenen</th>
              <th className="num">Kalan</th>
              <th>Durum</th>
              <th>Son ödeme</th>
              <th>Makbuz son</th>
              <th>SMM</th>
              <th>İşlem</th>
            </tr>
          </thead>
          <tbody>
            {showEmptyRow ? (
              <tr>
                <td colSpan={10} className="desk-muted-compact">
                  Henüz taksit tanımlanmadı.
                </td>
              </tr>
            ) : (
              renderTaksitTableBody()
            )}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className={compact ? "desk-vekalet-compact" : "desk-vekalet-tab"}>
      {!compact ? (
        <>
          <div className="desk-summary-bar">
            <div className="desk-metric desk-metric--accent-vekalet">
              <span className="l">Vekalet anlaşılmış toplam</span>
              <span className="v">{formatTry(ozet.anlasilanTutar)}</span>
            </div>
            <div className="desk-metric desk-metric--accent-vekalet-odenen">
              <span className="l">Ödenen toplam</span>
              <span className="v">{formatTry(ozet.odenenToplam)}</span>
            </div>
            <div className="desk-metric desk-metric--accent-vekalet-kalan">
              <span className="l">Kalan vekalet</span>
              <span className="v">{formatTry(ozet.kalanVekalet)}</span>
            </div>
          </div>

          <div className="desk-toolbar desk-toolbar--tight" style={{ marginBottom: 8 }}>
            <div className="desk-toolbar-actions">
              <button type="button" className="btn btn-sm" onClick={() => { setFormErr(null); setUcretOpen(true); }}>
                Vekalet ücreti düzenle
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!vekalet || vekalet.anlasilanTutar <= 0}
                onClick={() => { setFormErr(null); setTaksitOpen(true); }}
              >
                Taksit ekle
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={!vekalet || vekalet.anlasilanTutar <= 0}
                onClick={() => { setFormErr(null); setEsitOpen(true); }}
              >
                Eşit taksit oluştur
              </button>
            </div>
          </div>

          {renderTaksitTable(taksitler.length === 0)}
        </>
      ) : (
        <>
          <p className="desk-vekalet-compact-desc">
            Vekalet ücreti avans kasasından ayrıdır; avans bakiyesini etkilemez.
          </p>

          {vekalet && vekalet.anlasilanTutar <= 0 ? (
            <div className="desk-vekalet-empty">
              <p className="desk-muted-compact">Henüz vekalet ücreti tanımlanmadı.</p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setFormErr(null);
                  setUcretOpen(true);
                }}
              >
                Vekalet ücreti tanımla
              </button>
            </div>
          ) : (
            <>
              <div className="desk-vekalet-ozet-wrap">
                <table className="desk-vekalet-ozet-table">
                  <thead>
                    <tr>
                      <th>ANLAŞILAN</th>
                      <th>ÖDENEN TOPLAM</th>
                      <th>KALAN VEKALET</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="num">{formatTry(ozet.anlasilanTutar)}</td>
                      <td className="num">{formatTry(ozet.odenenToplam)}</td>
                      <td className="num">{formatTry(ozet.kalanVekalet)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="desk-vekalet-compact-actions">
                <button type="button" className="btn btn-sm" onClick={() => { setFormErr(null); setUcretOpen(true); }}>
                  Düzenle
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!vekalet || vekalet.anlasilanTutar <= 0}
                  onClick={() => { setFormErr(null); setTaksitOpen(true); }}
                >
                  Taksit ekle
                </button>
              </div>

              {taksitler.length === 0 ? (
                <div className="desk-vekalet-empty-taksit">Henüz taksit yok. Taksit ekleyin.</div>
              ) : (
                renderTaksitTable(false)
              )}
            </>
          )}
        </>
      )}

      {ucretOpen && vekalet ? (
        <VekaletUcretiModal
          open
          saving={saving}
          error={formErr}
          initial={vekalet}
          onClose={() => !saving && setUcretOpen(false)}
          onSave={kaydetUcret}
        />
      ) : null}

      {taksitOpen ? (
        <TaksitEkleModal
          open
          saving={saving}
          error={formErr}
          onClose={() => !saving && setTaksitOpen(false)}
          onSave={kaydetTaksit}
        />
      ) : null}

      {esitOpen ? (
        <EsitTaksitModal
          open
          saving={saving}
          error={formErr}
          onClose={() => !saving && setEsitOpen(false)}
          onSave={kaydetEsitTaksit}
        />
      ) : null}

      {odemeTaksit ? (
        <OdemeAlModal
          open
          saving={saving}
          error={formErr}
          taksit={odemeTaksit}
          onClose={() => !saving && setOdemeTaksit(null)}
          onSave={kaydetOdeme}
        />
      ) : null}

      {gecmisTaksit ? (
        <OdemeGecmisiModal
          open
          taksit={gecmisTaksit}
          odemeler={gecmis}
          onClose={() => setGecmisTaksit(null)}
          onSmmKes={(id) => void smmKes(id)}
          onMakbuz={(id) => void vekaletMakbuzAc(id)}
        />
      ) : null}
    </div>
  );
}

function vadeEkleAy(ymd: string, ay: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1 + ay, d);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function VekaletUcretiModal({
  open,
  saving,
  error,
  initial,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  initial: VekaletUcreti;
  onClose: () => void;
  onSave: (tutar: number, aciklama: string | null) => Promise<void>;
}) {
  const [tutar, setTutar] = useState(String(initial.anlasilanTutar || ""));
  const [aciklama, setAciklama] = useState(initial.aciklama ?? "");

  useEffect(() => {
    if (!open) return;
    setTutar(initial.anlasilanTutar > 0 ? String(initial.anlasilanTutar) : "");
    setAciklama(initial.aciklama ?? "");
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave(t, aciklama.trim() || null);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div className="modal modal-desk" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Vekalet ücreti</h2>
        </div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-vekalet-ucret" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="vu-tutar">Anlaşılan tutar *</label>
              <input id="vu-tutar" className="desk-input desk-num" value={tutar} onChange={(e) => setTutar(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="vu-aciklama">Açıklama</label>
              <textarea id="vu-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>İptal</button>
          <button type="submit" form="form-vekalet-ucret" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TaksitEkleModal({
  open,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (input: TaksitEkleInput) => Promise<void>;
}) {
  const [tutar, setTutar] = useState("");
  const [vade, setVade] = useState(bugunYmd());
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!open) return;
    setTutar("");
    setVade(bugunYmd());
    setAciklama("");
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave({ tutar: t, vadeTarihi: vade, aciklama: aciklama.trim() || null });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div className="modal modal-desk" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Taksit ekle</h2></div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-taksit-ekle" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="te-tutar">Taksit tutarı *</label>
              <input id="te-tutar" className="desk-input desk-num" value={tutar} onChange={(e) => setTutar(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="te-vade">Vade tarihi</label>
              <input id="te-vade" type="date" className="desk-input" value={vade} onChange={(e) => setVade(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="te-aciklama">Açıklama</label>
              <textarea id="te-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>İptal</button>
          <button type="submit" form="form-taksit-ekle" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EsitTaksitModal({
  open,
  saving,
  error,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: (adet: number, ilkVade: string) => Promise<void>;
}) {
  const [adet, setAdet] = useState("3");
  const [ilkVade, setIlkVade] = useState(bugunYmd());

  useEffect(() => {
    if (!open) return;
    setAdet("3");
    setIlkVade(bugunYmd());
  }, [open]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Math.floor(Number(adet));
    if (!Number.isFinite(n) || n < 1) return;
    await onSave(n, ilkVade);
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div className="modal modal-desk" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head"><h2>Eşit taksit oluştur</h2></div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-esit-taksit" onSubmit={(e) => void handleSubmit(e)}>
            <div className="field">
              <label htmlFor="et-adet">Taksit sayısı *</label>
              <input id="et-adet" className="desk-input desk-num" value={adet} onChange={(e) => setAdet(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="et-vade">İlk vade tarihi</label>
              <input id="et-vade" type="date" className="desk-input" value={ilkVade} onChange={(e) => setIlkVade(e.target.value)} />
            </div>
            <p className="desk-muted-compact">Kalan vekalet tutarı eşit parçalara bölünür; son taksitte yuvarlama farkı düzeltilir.</p>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>İptal</button>
          <button type="submit" form="form-esit-taksit" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Oluşturuluyor…" : "Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OdemeAlModal({
  open,
  saving,
  error,
  taksit,
  onClose,
  onSave,
}: {
  open: boolean;
  saving: boolean;
  error: string | null;
  taksit: VekaletTaksit;
  onClose: () => void;
  onSave: (data: {
    tutar: number;
    odemeTarihi: string;
    odemeYontemi: OdemeYontemiKodu;
    aciklama: string | null;
  }) => Promise<void>;
}) {
  const [tutar, setTutar] = useState("");
  const [tarih, setTarih] = useState(bugunYmd());
  const [odeme, setOdeme] = useState<OdemeYontemiKodu>("NAKIT");
  const [aciklama, setAciklama] = useState("");

  useEffect(() => {
    if (!open) return;
    setTutar("");
    setTarih(bugunYmd());
    setOdeme("NAKIT");
    setAciklama("");
  }, [open, taksit.id]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const t = parsePosTutar(tutar);
    if (t == null) return;
    await onSave({
      tutar: t,
      odemeTarihi: tarih,
      odemeYontemi: odeme,
      aciklama: aciklama.trim() || null,
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={() => !saving && onClose()}>
      <div className="modal modal-desk" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Taksit #{taksit.taksitNo} — ödeme al</h2>
        </div>
        <div className="modal-body">
          {error ? <p className="form-error">{error}</p> : null}
          <form id="form-odeme-al" onSubmit={(e) => void handleSubmit(e)}>
            <div className="desk-kvgrid" style={{ marginBottom: 12 }}>
              <div className="desk-kv">
                <span className="desk-kv-k">Taksit tutarı</span>
                <span className="desk-kv-v">{formatTry(taksit.tutar)}</span>
              </div>
              <div className="desk-kv">
                <span className="desk-kv-k">Şimdiye kadar ödenen</span>
                <span className="desk-kv-v">{formatTry(taksit.odenenToplam)}</span>
              </div>
              <div className="desk-kv">
                <span className="desk-kv-k">Ödenmesi gereken kalan</span>
                <span className="desk-kv-v">{formatTry(taksit.kalanTutar)}</span>
              </div>
            </div>
            <div className="field">
              <label htmlFor="oa-tutar">Bugün tahsil edilen tutar *</label>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <input id="oa-tutar" className="desk-input desk-num" value={tutar} onChange={(e) => setTutar(e.target.value)} />
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => setTutar(String(taksit.kalanTutar))}
                >
                  Kalanın tamamını al
                </button>
              </div>
            </div>
            <div className="field">
              <label htmlFor="oa-tarih">Ödeme tarihi</label>
              <input id="oa-tarih" type="date" className="desk-input" value={tarih} onChange={(e) => setTarih(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="oa-odeme">Ödeme yöntemi</label>
              <select id="oa-odeme" className="desk-input" value={odeme} onChange={(e) => setOdeme(e.target.value as OdemeYontemiKodu)}>
                {ODEME_YONTEMI_KODLARI.map((k) => (
                  <option key={k} value={k}>{ODEME_YONTEMI_ETIKET[k]}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="oa-aciklama">Açıklama</label>
              <textarea id="oa-aciklama" className="desk-input" rows={2} value={aciklama} onChange={(e) => setAciklama(e.target.value)} />
            </div>
          </form>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" disabled={saving} onClick={onClose}>İptal</button>
          <button type="submit" form="form-odeme-al" className="btn btn-primary btn-sm" disabled={saving}>
            {saving ? "Kaydediliyor…" : "Tahsilat kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

function OdemeGecmisiModal({
  open,
  taksit,
  odemeler,
  onClose,
  onSmmKes,
  onMakbuz,
}: {
  open: boolean;
  taksit: VekaletTaksit;
  odemeler: VekaletTaksitOdeme[];
  onClose: () => void;
  onSmmKes: (odemeId: number) => void;
  onMakbuz: (odemeId: number) => void;
}) {
  if (!open) return null;

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div className="modal modal-desk modal-desk--wide modal-desk--odeme-gecmisi" role="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>Taksit #{taksit.taksitNo} — ödeme geçmişi</h2>
        </div>
        <div className="modal-body">
          <div className="desk-table-wrap">
            <table className="desk-table desk-table--striped desk-table--compact">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th className="desk-num">Tutar</th>
                  <th>Ödeme yöntemi</th>
                  <th>Açıklama</th>
                  <th>Makbuz no</th>
                  <th>SMM durumu</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {odemeler.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="desk-muted-compact">Ödeme kaydı yok.</td>
                  </tr>
                ) : (
                  odemeler.map((o) => (
                    <tr key={o.id}>
                      <td>{formatDateTr(o.odemeTarihi)}</td>
                      <td className="desk-num">{formatTry(o.tutar)}</td>
                      <td>{odemeEtiket(o.odemeYontemi)}</td>
                      <td>{o.aciklama ?? "—"}</td>
                      <td>{o.makbuzNo ?? "—"}</td>
                      <td>
                        {o.smmKesildiMi ? (
                          <span className="desk-smm-ok-badge">SMM kesildi</span>
                        ) : (
                          <span className="desk-blink-warning">SMM bekliyor</span>
                        )}
                      </td>
                      <td>
                        <div className="row-actions">
                          <button type="button" className="btn btn-sm" onClick={() => onMakbuz(o.id)}>
                            Makbuz
                          </button>
                          {!o.smmKesildiMi ? (
                            <button type="button" className="btn btn-sm" onClick={() => onSmmKes(o.id)}>
                              SMM Kesildi
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="btn btn-sm" onClick={onClose}>Kapat</button>
        </div>
      </div>
    </div>
  );
}
