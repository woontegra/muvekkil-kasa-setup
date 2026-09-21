import { useState } from "react";
import { RaporNav } from "../components/rapor/RaporNav";
import { RaporHesapOzetSection } from "../components/rapor/RaporHesapOzetSection";
import { RaporIcraSection } from "../components/rapor/RaporIcraSection";
import { RaporKasaMakbuzSection } from "../components/rapor/RaporKasaMakbuzSection";
import { RaporOfisKasaSection } from "../components/rapor/RaporOfisKasaSection";
import { RaporVekaletMakbuzSection } from "../components/rapor/RaporVekaletMakbuzSection";
import type { RaporCategoryId } from "../lib/raporTypes";

function renderSection(id: RaporCategoryId) {
  switch (id) {
    case "ofis-kasa":
      return <RaporOfisKasaSection />;
    case "icra-tahsilat":
      return <RaporIcraSection />;
    case "hesap-ozeti":
      return <RaporHesapOzetSection />;
    case "kasa-makbuz":
      return <RaporKasaMakbuzSection />;
    case "vekalet-makbuz":
      return <RaporVekaletMakbuzSection />;
    default:
      return null;
  }
}

export function RaporlarPage() {
  const [category, setCategory] = useState<RaporCategoryId>("ofis-kasa");

  return (
    <div className="pm-rapor-page pm-page-enter">
      <div className="pm-rapor-layout">
        <RaporNav active={category} onChange={setCategory} />
        <div key={category} className="pm-rapor-content pm-rapor-content--enter">
          {renderSection(category)}
        </div>
      </div>
    </div>
  );
}
