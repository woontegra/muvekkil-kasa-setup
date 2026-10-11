/// <reference types="electron-vite/node" />

interface ImportMetaEnv {
  /** Yalnızca yerel test paketi derlemesinde "1"; üretimde tanımsız. */
  readonly MAIN_VITE_MKD_TEST_PACKAGE?: string;
}
