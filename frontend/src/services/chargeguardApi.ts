import { env } from "@/config/env";
import { createApiClient } from "@/services/apiClient";
import type { BackendCase, Merchant, MerchantDispute, Subscription, Transaction } from "@/types/chargeguard";

const backendClient = createApiClient(env.backendApiUrl);
const bankClient = createApiClient(env.mockBankApiUrl);
const merchantClient = createApiClient(env.mockMerchantApiUrl);

export type PaginatedTransactionsResponse = {
  items: Transaction[];
  next_cursor: string | null;
};

export type TransactionNotifyResponse = {
  delivered: boolean;
  status_code: number | null;
  error?: string;
};

export const bankApi = {
  health: () => bankClient.get<{ status: "ok"; dataset_version: string }>("/health"),
  getSubscriptions: (userId = env.demoUserId) => bankClient.get<Subscription[]>(`/users/${userId}/subscriptions`),
  getTransactions: (
    userId = env.demoUserId,
    query?: {
      since?: string;
      until?: string;
      merchant_id?: string;
      subscription_id?: string;
      limit?: number;
      cursor?: string;
    },
  ) => bankClient.get<PaginatedTransactionsResponse>(`/users/${userId}/transactions`, { query }),
  notifyTransaction: (transaction_id: string, webhook_url?: string) =>
    bankClient.post<TransactionNotifyResponse>("/transactions/notify", { transaction_id, webhook_url }),
};

export const merchantApi = {
  health: () => merchantClient.get<{ status: string }>("/health"),
  getDispute: (disputeId: string) => merchantClient.get<MerchantDispute>(`/disputes/${disputeId}`),
  acceptDispute: (disputeId: string) => merchantClient.post<MerchantDispute>(`/disputes/${disputeId}/accept`),
  rejectDispute: (disputeId: string, reason: string) => merchantClient.post<MerchantDispute>(`/disputes/${disputeId}/reject`, { reason }),
  listDisputes: (query?: { case_id?: string; status?: MerchantDispute["status"] }) =>
    merchantClient.get<MerchantDispute[]>("/disputes", { query }),
};

export const backendApi = {
  health: () => backendClient.get<{ status: string }>("/health"),
  getMerchants: () => backendClient.get<Merchant[]>("/merchants"),
  getSubscriptions: () => backendClient.get<Subscription[]>("/subscriptions"),
  getTransactions: () => backendClient.get<Transaction[]>("/transactions"),
  getCases: () => backendClient.get<BackendCase[]>("/cases"),
  analyzeCase: (transaction_id: string) => backendClient.post<BackendCase>("/cases/analyze", { transaction_id }),
  resolveDecision: (case_id: string, decision: "accept_offer" | "reject_and_request_full_refund", reason?: string) =>
    backendClient.post<BackendCase>(`/decisions/${case_id}/resolve`, { decision, reason }),
  resetDemo: () => backendClient.post<{ status: string; message: string }>("/demo/reset"),
};
