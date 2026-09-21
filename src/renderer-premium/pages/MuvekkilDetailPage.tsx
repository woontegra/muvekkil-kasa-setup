import { useCallback, useEffect, useMemo, useState } from "react";

import { Link, useParams } from "react-router-dom";

import type { Dosya } from "@shared/types/dosya";

import type { Muvekkil } from "@shared/types/muvekkil";

import { PremiumDosyaFormModal } from "../components/dosya/PremiumDosyaFormModal";

import { MuvekkilDetailDosyaTable } from "../components/muvekkil/MuvekkilDetailDosyaTable";
import { MuvekkilKarlilikSection } from "../components/muvekkil/MuvekkilKarlilikSection";
import { MuvekkilRandevularSection } from "../components/randevu/MuvekkilRandevularSection";

import { MuvekkilDetailInfoAside } from "../components/muvekkil/MuvekkilDetailInfoAside";

import { PremiumMuvekkilFormModal } from "../components/muvekkil/PremiumMuvekkilFormModal";

import { PremiumButton } from "../components/PremiumButton";

import { StatusBadge } from "../components/StatusBadge";

import { usePremiumPageMeta } from "../context/PremiumPageMetaContext";

import { formatDateTr } from "../lib/format";

import { MKD_MUVEKKIL_CHANGED } from "../lib/events";

import { muvekkilBasHarfleri, muvekkilGorunenAd, muvekkilTurEtiket } from "../lib/muvekkil";



function dosyaDurumSay(dosyalar: Dosya[], durum: Dosya["durum"]): number {

  return dosyalar.filter((d) => d.durum === durum).length;

}



export function MuvekkilDetailPage() {

  const { id } = useParams();

  const mid = Number(id);

  const { setMeta } = usePremiumPageMeta();



  const [m, setM] = useState<Muvekkil | null>(null);

  const [dosyalar, setDosyalar] = useState<Dosya[]>([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);



  const [editOpen, setEditOpen] = useState(false);

  const [dosyaOpen, setDosyaOpen] = useState(false);

  const [editDosya, setEditDosya] = useState<Dosya | null>(null);



  const yukle = useCallback(async () => {

    if (!Number.isFinite(mid)) {

      setLoading(false);

      setError("Geçersiz müvekkil.");

      return;

    }

    setLoading(true);

    setError(null);

    try {

      const mu = await window.api.muvekkilGet(mid);

      if (!mu) {

        setM(null);

        setDosyalar([]);

        setError("Müvekkil bulunamadı.");

        return;

      }

      setM(mu);

      const list = await window.api.dosyaList(mid);

      setDosyalar(list);

    } catch {

      setM(null);

      setDosyalar([]);

      setError("Müvekkil bilgileri yüklenemedi.");

    } finally {

      setLoading(false);

    }

  }, [mid]);



  useEffect(() => {

    void yukle();

  }, [yukle]);



  useEffect(() => {

    const onChanged = () => void yukle();

    window.addEventListener(MKD_MUVEKKIL_CHANGED, onChanged);

    return () => window.removeEventListener(MKD_MUVEKKIL_CHANGED, onChanged);

  }, [yukle]);



  useEffect(() => {

    if (!m) {

      setMeta(null);

      return;

    }

    const ad = muvekkilGorunenAd(m);

    setMeta({ title: ad, desc: "İletişim bilgileri ve dosyalar" });

    return () => setMeta(null);

  }, [m, setMeta]);



  const istatistik = useMemo(

    () => ({

      aktif: dosyaDurumSay(dosyalar, "AKTIF"),

      pasif: dosyaDurumSay(dosyalar, "PASIF"),

      kapandi: dosyaDurumSay(dosyalar, "KAPANDI"),

    }),

    [dosyalar],

  );



  function openNewDosya() {

    setEditDosya(null);

    setDosyaOpen(true);

  }



  function openEditDosya(d: Dosya) {

    setEditDosya(d);

    setDosyaOpen(true);

  }



  if (!Number.isFinite(mid)) {

    return <p className="pm-muted">Geçersiz müvekkil.</p>;

  }



  if (loading) {

    return (

      <div className="pm-mvk-detail pm-page-enter">

        <div className="pm-mvk-detail-skeleton">

          <div className="pm-skeleton pm-skeleton--block" />

          <div className="pm-skeleton pm-skeleton--block pm-skeleton--kpi" />

          <div className="pm-skeleton pm-skeleton--block pm-skeleton--split" />

        </div>

      </div>

    );

  }



  if (error || !m) {

    return (

      <div className="pm-mvk-detail pm-page-enter">

        <div className="pm-overview-inline-error">

          <p>{error ?? "Kayıt bulunamadı."}</p>

          <button type="button" className="pm-btn pm-btn--ghost" onClick={() => void yukle()}>

            Yeniden dene

          </button>

        </div>

        <Link to="/muvekkiller" className="pm-link-back">

          ← Müvekkiller

        </Link>

      </div>

    );

  }



  const ad = muvekkilGorunenAd(m);



  return (

    <div className="pm-mvk-detail pm-page-enter">

      <nav className="pm-breadcrumb pm-toolbar-enter" aria-label="Konum">

        <Link to="/muvekkiller">Müvekkiller</Link>

        <span aria-hidden>/</span>

        <span className="pm-breadcrumb-current">{ad}</span>

      </nav>



      <header className="pm-mvk-detail-head pm-hero-enter">

        <div className="pm-mvk-detail-identity">

          <div className="pm-mvk-detail-avatar" aria-hidden>

            {muvekkilBasHarfleri(m)}

          </div>

          <div className="pm-mvk-detail-identity-text">

            <div className="pm-mvk-detail-badges">

              <StatusBadge tone="info">{muvekkilTurEtiket(m.muvekkilTuru)}</StatusBadge>

              <span className="pm-mvk-detail-id">#{m.id}</span>

              {m.kayitTarihi ? (

                <span className="pm-mvk-detail-since">Kayıt {formatDateTr(m.kayitTarihi)}</span>

              ) : null}

            </div>

            <h2 className="pm-mvk-detail-name">{ad}</h2>

          </div>

        </div>

        <div className="pm-mvk-detail-actions">

          <PremiumButton variant="ghost" type="button" onClick={() => setEditOpen(true)}>

            Düzenle

          </PremiumButton>

          <PremiumButton type="button" onClick={openNewDosya}>

            + Yeni dosya

          </PremiumButton>

        </div>

      </header>



      <div className="pm-mvk-detail-kpis pm-section-enter" aria-label="Özet">

        <div className="pm-mvk-stat-chip pm-mvk-stat-chip--primary">

          <span className="pm-mvk-stat-value">{dosyalar.length}</span>

          <span className="pm-mvk-stat-label">Toplam dosya</span>

        </div>

        <div className="pm-mvk-stat-chip">

          <span className="pm-mvk-stat-value">{istatistik.aktif}</span>

          <span className="pm-mvk-stat-label">Aktif</span>

        </div>

        <div className="pm-mvk-stat-chip">

          <span className="pm-mvk-stat-value">{istatistik.kapandi}</span>

          <span className="pm-mvk-stat-label">Kapandı</span>

        </div>

        <div className="pm-mvk-stat-chip">

          <span className="pm-mvk-stat-value">{istatistik.pasif}</span>

          <span className="pm-mvk-stat-label">Pasif</span>

        </div>

      </div>



      <div className="pm-mvk-detail-body pm-section-enter">

        <MuvekkilDetailInfoAside muvekkil={m} />

        <MuvekkilDetailDosyaTable

          muvekkilId={mid}

          dosyalar={dosyalar}

          onNewDosya={openNewDosya}

          onEditDosya={openEditDosya}

        />

        <MuvekkilKarlilikSection muvekkilId={mid} />

        <MuvekkilRandevularSection muvekkilId={mid} />

      </div>



      <PremiumMuvekkilFormModal

        open={editOpen}

        initial={m}

        onClose={() => setEditOpen(false)}

        onSuccess={() => void yukle()}

      />



      <PremiumDosyaFormModal

        open={dosyaOpen}

        muvekkilId={mid}

        initial={editDosya}

        onClose={() => {

          setDosyaOpen(false);

          setEditDosya(null);

        }}

        onSuccess={() => void yukle()}

      />

    </div>

  );

}

