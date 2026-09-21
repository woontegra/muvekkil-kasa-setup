import { useMemo, useState } from "react";
import { PremiumTaksitTopluSilModal } from "./PremiumTaksitTopluSilModal";
import { PremiumTaksitSilModal } from "./PremiumTaksitSilModal";
import { PremiumVekaletGuvenliIptalModal } from "./PremiumVekaletGuvenliIptalModal";

type Props = {
  dosyaId: number;
  muvekkilId: number;
  vekalet: UseVekaletTaksitReturn;
};

export function PremiumVekaletTaksitPanel({ dosyaId: _dosyaId, muvekkilId: _muvekkilId, vekalet: v }: Props) {
  const [editOdeme, setEditOdeme] = useState<VekaletTaksitOdeme | null>(null);
  const vekaletTanimli = v.vekalet != null && v.vekalet.anlasilanTutar > 0;
  const pb = v.vekalet?.paraBirimi ?? "TRY";
  const showYaklasik = pb !== "TRY";
  const yaklasikItems = useMemo(() => {
    if (!showYaklasik || !vekaletTanimli) return [];
    const items = [
      { id: "ozet.anlasilan", tutar: v.ozet.anlasilanTutar, paraBirimi: pb },
      { id: "ozet.odenen", tutar: v.ozet.odenenToplam, paraBirimi: pb },
      { id: "ozet.kalan", tutar: v.ozet.kalanVekalet, paraBirimi: pb },
    ];
    for (const t of v.taksitler) {
      items.push(
        { id: `taksit.${t.id}.tutar`, tutar: t.tutar, paraBirimi: t.paraBirimi },
        { id: `taksit.${t.id}.kalan`, tutar: t.kalanTutar, paraBirimi: t.paraBirimi },
      );
    }
    return items;
  }, [showYaklasik, vekaletTanimli, v.ozet, v.taksitler, pb]);
  const yaklasikQ = useYaklasikTryBatch(pb, yaklasikItems, vekaletTanimli && showYaklasik);

  return (
    <section className="pm-dosya-section pm-vekalet-panel pm-vekalet-enter">
      <div className="pm-section-head">
        <h2 className="pm-section-title">Vekalet ücreti ve taksitler</h2>
        {v.smmBekleyenCount > 0 ? (
          <span className="pm-vekalet-smm-badge" title="SMM bekleyen ödeme">
            {v.smmBekleyenCount} SMM bekliyor
          </span>
        ) : null}
      </div>

      {v.loading ? (
        <div className="pm-vekalet-skeleton" aria-hidden>
          <div className="pm-vekalet-metrics-skeleton" />
          <div className="pm-vekalet-table-skeleton" />
        </div>
      ) : !vekaletTanimli ? (
        <div className="pm-vekalet-empty pm-vekalet-stagger">
          <p className="pm-muted">Henüz vekalet ücreti tanımlanmadı.</p>
          <PremiumButton type="button" className="pm-btn--sm" onClick={() => { v.setUcretOpen(true); }}>
            Vekalet ücreti tanımla
          </PremiumButton>
        </div>
      ) : (
        <>
          <div className="pm-vekalet-metrics pm-vekalet-stagger">
            <div className="pm-vekalet-metric">
              <span className="pm-vekalet-metric-l">Anlaşılan ({pb})</span>
              <span className="pm-vekalet-metric-v">{formatMoney(v.ozet.anlasilanTutar, pb)}</span>
              {showYaklasik ? (
                <BugunkuTlKarsilikCell
                  unavailable={yaklasikQ.unavailable}
                  value={
                    yaklasikQ.unavailable
                      ? null
                      : yaklasikByKey(yaklasikQ.data, "ozet.anlasilan").gosterim
                        ? `≈ ${yaklasikByKey(yaklasikQ.data, "ozet.anlasilan").gosterim}`
                        : null
                  }
                />
              ) : null}
            </div>
            <div className="pm-vekalet-metric">
              <span className="pm-vekalet-metric-l">Taksit toplamı</span>
              <span className="pm-vekalet-metric-v">{formatMoney(v.mevcutTaksitToplam, pb)}</span>
            </div>
            <div className="pm-vekalet-metric pm-vekalet-metric--odenen">
              <span className="pm-vekalet-metric-l">Ödenen</span>
              <span className="pm-vekalet-metric-v">{formatMoney(v.ozet.odenenToplam, pb)}</span>
              {showYaklasik ? (
                <BugunkuTlKarsilikCell
                  unavailable={yaklasikQ.unavailable}
                  value={
                    yaklasikQ.unavailable
                      ? null
                      : yaklasikByKey(yaklasikQ.data, "ozet.odenen").gosterim
                        ? `≈ ${yaklasikByKey(yaklasikQ.data, "ozet.odenen").gosterim}`
                        : null
                  }
                />
              ) : null}
            </div>
            <div className="pm-vekalet-metric pm-vekalet-metric--kalan">
              <span className="pm-vekalet-metric-l">Kalan vekalet</span>
              <span className="pm-vekalet-metric-v">{formatMoney(v.ozet.kalanVekalet, pb)}</span>
              {showYaklasik ? (
                <BugunkuTlKarsilikCell
                  unavailable={yaklasikQ.unavailable}
                  value={
                    yaklasikQ.unavailable
                      ? null
                      : yaklasikByKey(yaklasikQ.data, "ozet.kalan").gosterim
                        ? `≈ ${yaklasikByKey(yaklasikQ.data, "ozet.kalan").gosterim}`
                        : null
                  }
                />
              ) : null}
            </div>
            <div className="pm-vekalet-metric">
              <span className="pm-vekalet-metric-l">Taksitlendirilebilir kalan</span>
              <span className="pm-vekalet-metric-v">{formatMoney(v.kalanTaksitlendirme, pb)}</span>
            </div>
            <div className="pm-vekalet-metric">
              <span className="pm-vekalet-metric-l">Taksit sayısı</span>
              <span className="pm-vekalet-metric-v">{v.taksitler.length}</span>
            </div>
          </div>

          {showYaklasik && yaklasikQ.data?.kurBilgiSatiri ? (
            <p className="pm-vekalet-kur-hint pm-muted" title={BUGUNKU_TL_KUR_HINT}>
              {yaklasikQ.data.kurBilgiSatiri} · {BUGUNKU_TL_KUR_HINT}
            </p>
          ) : null}
          {showYaklasik && yaklasikQ.unavailable ? (
            <p className="pm-vekalet-kur-hint pm-form-error">TL karşılığı şu anda hesaplanamadı</p>
          ) : null}

          <div className="pm-vekalet-toolbar pm-vekalet-stagger">
            <div className="pm-vekalet-toolbar-left">
              <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={() => { v.setUcretOpen(true); }}>
                Vekalet ücreti düzenle
              </PremiumButton>
              <PremiumButton
                type="button"
                variant="ghost"
                className="pm-btn--sm"
                disabled={v.yeniTaksitEngeli || v.siliniyor}
                onClick={v.tekTaksitAc}
              >
                Tek taksit ekle
              </PremiumButton>
              <PremiumButton
                type="button"
                className="pm-btn--sm"
                disabled={v.yeniTaksitEngeli || v.siliniyor}
                onClick={() => { v.setPlanOpen(true); }}
              >
                Taksit planı oluştur
              </PremiumButton>
            </div>
            {v.taksitler.length > 0 ? (
              <PremiumButton type="button" variant="ghost" className="pm-btn--sm pm-btn--danger" onClick={v.topluSilAc}>
                Tüm taksitleri sil
              </PremiumButton>
            ) : null}
          </div>

          {!v.taksitAsimi && v.kalanTaksitlendirme <= 0 ? (
            <p className="pm-vekalet-kalan-yok pm-vekalet-stagger">Taksitlendirilebilir tutar kalmadı.</p>
          ) : null}

          {v.inlineErrGoster ? <p className="pm-form-error pm-vekalet-stagger">{v.formErr}</p> : null}

          {v.taksitAsimi ? (
            <div className="pm-vekalet-asimi-uyari pm-vekalet-stagger" role="alert">
              <strong>Uyarı: Taksit toplamı anlaşılan vekalet ücretini aşıyor.</strong>
              <div>Taksit toplamı: {formatMoney(v.taksitAsimi.mevcutTaksitToplam, v.vekalet?.paraBirimi ?? "TRY")}</div>
              <div>Anlaşılan vekalet: {formatMoney(v.taksitAsimi.anlasilan, v.vekalet?.paraBirimi ?? "TRY")}</div>
              <div>Aşan tutar: {formatMoney(v.taksitAsimi.asan, v.vekalet?.paraBirimi ?? "TRY")}</div>
            </div>
          ) : null}

          <div className="pm-vekalet-table-wrap pm-vekalet-stagger">
            {showYaklasik ? (
              <p className="pm-vekalet-tl-banner" title={BUGUNKU_TL_KUR_HINT}>
                <strong>Bugünkü TL karşılığı:</strong> {BUGUNKU_TL_KUR_HINT}
                {yaklasikQ.data?.kurBilgiSatiri ? ` · ${yaklasikQ.data.kurBilgiSatiri}` : null}
              </p>
            ) : null}
            <table className="pm-vekalet-table">
              <thead>
                <tr>
                  <th>Taksit no</th>
                  <th>Vade tarihi</th>
                  <th className="num">Taksit tutarı</th>
                  {showYaklasik ? <th className="num">Bugünkü TL karşılığı</th> : null}
                  <th className="num">Ödenen</th>
                  <th className="num">Kalan</th>
                  {showYaklasik ? <th className="num">Kalan TL karşılığı</th> : null}
                  <th>Durum</th>
                  <th>Son ödeme</th>
                  <th>Makbuz</th>
                  <th>SMM</th>
                  <th>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {v.taksitler.length === 0 ? (
                  <tr>
                    <td colSpan={showYaklasik ? 12 : 10} className="pm-muted">
                      Henüz taksit tanımlanmadı.
                    </td>
                  </tr>
                ) : (
                  v.taksitler.map((t) => {
                    const smm = taksitSmmHucre(t.smmDurumu);
                    const tlTutar = yaklasikByKey(yaklasikQ.data, `taksit.${t.id}.tutar`);
                    const tlKalan = yaklasikByKey(yaklasikQ.data, `taksit.${t.id}.kalan`);
                    return (
                      <tr key={t.id} className="pm-vekalet-row-enter">
                        <td>{t.taksitNo}</td>
                        <td>{formatDateTr(t.vadeTarihi)}</td>
                        <td className="num">{formatMoney(t.tutar, t.paraBirimi)}</td>
                        {showYaklasik ? (
                          <td className="num">
                            <BugunkuTlKarsilikCell unavailable={yaklasikQ.unavailable} value={tlTutar.gosterim} />
                          </td>
                        ) : null}
                        <td className="num">{formatMoney(t.odenenToplam, t.paraBirimi)}</td>
                        <td className="num">{formatMoney(t.kalanTutar, t.paraBirimi)}</td>
                        {showYaklasik ? (
                          <td className="num">
                            <BugunkuTlKarsilikCell unavailable={yaklasikQ.unavailable} value={tlKalan.gosterim} />
                          </td>
                        ) : null}
                        <td>
                          <StatusBadge tone={taksitDurumTone(t.durum)}>{taksitDurumEtiket(t.durum)}</StatusBadge>
                        </td>
                        <td>{formatDateTr(t.sonOdemeTarihi)}</td>
                        <td>
                          {t.sonOdemeId ? (
                            <button
                              type="button"
                              className="pm-vekalet-action"
                              title={t.sonMakbuzNo ? `Makbuz: ${t.sonMakbuzNo}` : "Makbuz"}
                              onClick={() => void v.vekaletMakbuzAc(t.sonOdemeId!)}
                            >
                              🧾
                            </button>
                          ) : (
                            (t.sonMakbuzNo ?? "—")
                          )}
                        </td>
                        <td>
                          {smm.tone !== "default" ? (
                            <StatusBadge tone={smm.tone === "success" ? "success" : "warning"}>{smm.label}</StatusBadge>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td>
                          <div className="pm-vekalet-actions">
                            {t.kalanTutar > 0 ? (
                              <button
                                type="button"
                                className="pm-vekalet-action pm-vekalet-action--primary"
                                title="Ödeme al"
                                onClick={() => {
                                  v.setOdemeTaksit(t);
                                }}
                              >
                                ₺
                              </button>
                            ) : null}
                            {t.smmDurumu === "BEKLIYOR" && t.smmBekleyenOdemeId ? (
                              <button
                                type="button"
                                className="pm-vekalet-action pm-vekalet-action--warning"
                                title="SMM Kesildi"
                                onClick={() => void v.smmKesTablodan(t.smmBekleyenOdemeId!)}
                              >
                                SMM
                              </button>
                            ) : null}
                            <button
                              type="button"
                              className="pm-vekalet-action"
                              title="Ödeme geçmişi"
                              onClick={() => void v.acGecmis(t)}
                            >
                              ⏱
                            </button>
                            <button
                              type="button"
                              className="pm-vekalet-action"
                              title="Düzenle"
                              onClick={() => v.setDuzenleTaksit(t)}
                            >
                              ✎
                            </button>
                            {t.odenenToplam <= 0 ? (
                              <button
                                type="button"
                                className="pm-vekalet-action pm-vekalet-action--danger"
                                title="Sil"
                                onClick={() => v.silTaksitIste(t)}
                              >
                                🗑
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="pm-vekalet-action pm-vekalet-action--danger"
                                title="Güvenli iptal"
                                onClick={() => void v.guvenliIptalAc(t)}
                              >
                                ⊘
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {v.ucretOpen && v.vekalet ? (
        <PremiumVekaletUcretModal
          open
          saving={v.saving}
          error={v.formErr}
          initial={v.vekalet}
          onClose={() => !v.saving && v.setUcretOpen(false)}
          onSave={v.kaydetUcret}
        />
      ) : null}

      {v.taksitOpen ? (
        <PremiumTaksitEkleModal
          key={v.taksitFormKey}
          open
          saving={v.saving}
          error={v.formErr}
          kalanTaksitlendirme={v.kalanTaksitlendirme}
          onClose={() => !v.saving && v.setTaksitOpen(false)}
          onSave={v.kaydetTaksit}
          onPlanOlustur={() => {
            v.setTaksitOpen(false);
            v.setPlanOpen(true);
          }}
        />
      ) : null}

      {v.planOpen ? (
        <PremiumTaksitPlaniModal
          open
          saving={v.saving}
          error={v.formErr}
          kalanTaksitlendirme={v.kalanTaksitlendirme}
          acikTaksitVar={v.acikTaksitVar}
          onClose={() => !v.saving && v.setPlanOpen(false)}
          onSave={v.taksitPlaniniKaydet}
        />
      ) : null}

      {v.duzenleTaksit && v.vekalet ? (
        <PremiumTaksitDuzenleModal
          open
          saving={v.saving}
          error={v.formErr}
          taksit={v.duzenleTaksit}
          anlasilanTutar={v.vekalet.anlasilanTutar}
          taksitler={v.taksitler}
          onClose={() => !v.saving && v.setDuzenleTaksit(null)}
          onSave={v.kaydetTaksitDuzenle}
        />
      ) : null}

      {v.odemeTaksit ? (
        <PremiumTaksitOdemeModal
          open
          saving={v.saving}
          error={v.formErr}
          taksit={v.odemeTaksit}
          onClose={() => !v.saving && v.setOdemeTaksit(null)}
          onSave={v.kaydetOdeme}
        />
      ) : null}

      {v.gecmisTaksit ? (
        <PremiumTaksitOdemeGecmisiModal
          open
          taksit={v.gecmisTaksit}
          odemeler={v.gecmis}
          onClose={() => v.setGecmisTaksit(null)}
          onSmmKes={(id) => void v.smmKes(id)}
          onMakbuz={(id) => void v.vekaletMakbuzAc(id)}
          onGuvenliIptal={(id) => void v.guvenliIptalAc(v.gecmisTaksit!, id)}
          onDuzenle={(o) => setEditOdeme(o)}
        />
      ) : null}

      <PremiumVekaletOdemeEditModal
        open={editOdeme != null}
        odeme={editOdeme}
        maxMahsup={
          editOdeme && v.gecmisTaksit
            ? Math.max(
                0,
                v.gecmisTaksit.tutar -
                  v.gecmis
                    .filter((x) => x.id !== editOdeme.id && x.makbuzDurumu !== "IPTAL" && !x.iptalTarihi)
                    .reduce((s, x) => s + x.tutar, 0),
              )
            : editOdeme?.tutar ?? 0
        }
        onClose={() => setEditOdeme(null)}
        onSaved={() => {
          if (v.gecmisTaksit) void v.acGecmis(v.gecmisTaksit);
          void v.yukle();
        }}
      />

      {v.guvenliIptalTaksit ? (
        <PremiumVekaletGuvenliIptalModal
          taksit={v.guvenliIptalTaksit}
          odemeler={v.guvenliIptalOdemeler}
          preselectedOdemeId={v.guvenliIptalOdemeId}
          loading={v.guvenliIptalSaving}
          error={v.formErr}
          onClose={v.guvenliIptalKapat}
          onSilTaksit={(p) => void v.guvenliIptalTaksitOnay(p)}
          onSilTahsilat={(id, p) => void v.guvenliIptalTahsilatOnay(id, p)}
        />
      ) : null}

      {v.topluSilOpen ? (
        <PremiumTaksitTopluSilModal
          open
          saving={v.saving}
          error={v.formErr}
          taksitSayisi={v.taksitler.length}
          taksitToplam={v.mevcutTaksitToplam}
          odenenToplam={v.ozet.odenenToplam}
          onClose={() => !v.saving && v.setTopluSilOpen(false)}
          onConfirm={() => void v.tumTaksitleriSil()}
        />
      ) : null}

      {v.silinecekTaksit ? (
        <PremiumTaksitSilModal
          open
          saving={v.siliniyor}
          error={v.formErr}
          taksit={v.silinecekTaksit}
          onClose={v.silTaksitIptal}
          onConfirm={() => void v.silTaksitOnayla()}
        />
      ) : null}
    </section>
  );
}
