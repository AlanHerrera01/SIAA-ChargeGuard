export type ChargeGuardDataSource = "mock" | "api";

function readUrl(value: string | undefined, fallback: string) {
  return (value ?? fallback).replace(/\/+$/, "");
}

function readDataSource(value: string | undefined): ChargeGuardDataSource {
  return value === "api" ? "api" : "mock";
}

export const env = {
  dataSource: readDataSource(import.meta.env.VITE_CHARGEGUARD_DATA_SOURCE),
  backendApiUrl: readUrl(import.meta.env.VITE_BACKEND_API_URL, "http://localhost:8000"),
  mockBankApiUrl: readUrl(import.meta.env.VITE_MOCK_BANK_API_URL, "http://localhost:8001"),
  mockMerchantApiUrl: readUrl(import.meta.env.VITE_MOCK_MERCHANT_API_URL, "http://localhost:8002"),
  demoUserId: import.meta.env.VITE_DEMO_USER_ID ?? "usr_demo",
  defaultCaseId: import.meta.env.VITE_DEFAULT_CASE_ID ?? "case_spotify_001",
} as const;
