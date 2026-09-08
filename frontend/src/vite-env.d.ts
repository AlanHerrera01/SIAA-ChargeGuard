/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_CHARGEGUARD_DATA_SOURCE?: "mock" | "api";
  readonly VITE_BACKEND_API_URL?: string;
  readonly VITE_MOCK_BANK_API_URL?: string;
  readonly VITE_MOCK_MERCHANT_API_URL?: string;
  readonly VITE_DEMO_USER_ID?: "usr_demo" | string;
  readonly VITE_DEFAULT_CASE_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
