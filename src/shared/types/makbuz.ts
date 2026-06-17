import type { Dosya } from "./dosya";
import type { KasaHareket } from "./kasa";
import type { Muvekkil } from "./muvekkil";
import type { OfficeSettings } from "./office";
import type { VekaletTaksit, VekaletTaksitOdeme, VekaletUcreti } from "./vekalet";

export type MakbuzEnsureSonuc = { ok: true; makbuzNo: string } | { ok: false; error: string };

export type KasaMakbuzPaketi =
  | {
      ok: true;
      office: OfficeSettings;
      muvekkil: Muvekkil;
      dosya: Dosya;
      hareket: KasaHareket;
    }
  | { ok: false; error: string; mesaj?: string };

export type VekaletMakbuzPaketi =
  | {
      ok: true;
      office: OfficeSettings;
      muvekkil: Muvekkil;
      dosya: Dosya;
      vekalet: VekaletUcreti;
      taksit: VekaletTaksit;
      odeme: VekaletTaksitOdeme;
      odenenToplam: number;
      kalanVekalet: number;
    }
  | { ok: false; error: string; mesaj?: string };
