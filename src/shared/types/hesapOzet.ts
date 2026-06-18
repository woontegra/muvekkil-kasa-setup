import type { Dosya } from "./dosya";
import type { KasaHareket } from "./kasa";
import type { Muvekkil } from "./muvekkil";
import type { OfficeSettings } from "./office";
import type { VekaletOzet, VekaletTaksit, VekaletUcreti } from "./vekalet";

export type DosyaHesapOzetKasaOzet = {
  toplamAlinanAvans: number;
  toplamYapilanMasraf: number;
  duzeltmelerNet: number;
  kalanAvans: number;
};

export type DosyaHesapOzetPaketi =
  | {
      ok: true;
      office: OfficeSettings;
      muvekkil: Muvekkil;
      dosya: Dosya;
      duzenlemeTarihi: string;
      kasaOzet: DosyaHesapOzetKasaOzet;
      hareketler: KasaHareket[];
      vekalet: VekaletUcreti;
      taksitler: VekaletTaksit[];
      vekaletOzet: VekaletOzet;
    }
  | { ok: false; error: string; mesaj?: string };
