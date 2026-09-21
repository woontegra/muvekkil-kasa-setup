import { useCallback, useEffect, useState } from "react";
import { formatDateTr } from "../../lib/format";
import { PremiumButton } from "../PremiumButton";
import { SettingsSectionFrame } from "./SettingsSectionFrame";

type AuditRow = {
  id: number;
  olusturmaTarihi: string;
  kullaniciAdi: string | null;
  eylem: string;
  ozet: string | null;
  varlikTipi?: string | null;
  varlikId?: string | null;
};

export function SettingsDenetimSection() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");

  const yukle = useCallback(async () => {
    setLoading(true);
    try {
      const r = await window.api.auditList({ limit: 100, offset: 0 });
      setTotal(r.total);
      setRows(r.rows as AuditRow[]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void yukle();
  }, [yukle]);

  const filtered = q.trim()
    ? rows.filter((r) => {
        const hay = `${r.eylem} ${r.ozet ?? ""} ${r.kullaniciAdi ?? ""}`.toLocaleLowerCase("tr-TR");
        return hay.includes(q.trim().toLocaleLowerCase("tr-TR"));
      })
    : rows;

  return (
    <SettingsSectionFrame
      title="Denetim Kayıtları"
      description="Önemli yapılandırma, güvenli silme ve yönetim işlemlerinin salt okunur kaydı."
      loading={loading}
    >
      <div className="pm-audit-toolbar">
        <input
          className="pm-input"
          placeholder="Eylem, kullanıcı veya özet ara…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          aria-label="Denetim ara"
        />
        <PremiumButton type="button" variant="ghost" className="pm-btn--sm" onClick={() => void yukle()}>
          Yenile
        </PremiumButton>
        <span className="pm-section-meta">{total} kayıt</span>
      </div>

      {filtered.length === 0 ? (
        <div className="pm-mk-empty">
          <p className="pm-mk-empty-title">Kayıt yok</p>
          <p className="pm-muted">
            {rows.length === 0 ? "Henüz denetim kaydı oluşmadı." : "Aramanıza uygun kayıt bulunamadı."}
          </p>
        </div>
      ) : (
        <ul className="pm-kalem-rows">
          {filtered.map((r) => (
            <li key={r.id} className="pm-kalem-row pm-audit-row">
              <div className="pm-users-row-main">
                <div className="pm-users-badges">
                  <span className="pm-users-role-badge">{r.eylem}</span>
                  <span className="pm-muted">{formatDateTr(r.olusturmaTarihi.slice(0, 10))}</span>
                </div>
                <strong className="pm-kalem-row-name">{r.ozet ?? "—"}</strong>
                <span className="pm-muted">
                  {r.kullaniciAdi ?? "Sistem"}
                  {r.varlikTipi ? ` · ${r.varlikTipi}${r.varlikId ? ` #${r.varlikId}` : ""}` : ""}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </SettingsSectionFrame>
  );
}
