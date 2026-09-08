export type MerchantCategory =
  | "streaming"
  | "cloud_storage"
  | "saas"
  | "fitness"
  | "music"
  | "news"
  | "gaming"
  | "delivery"
  | "education"
  | "security";

export type SubscriptionContractStatus = "active" | "cancelled";
export type CaseStatus = "detected" | "investigating" | "dispute_filed" | "awaiting_merchant" | "awaiting_human" | "resolved" | "dismissed";
export type BackendCaseStatus = "analyzed" | "awaiting_merchant" | "awaiting_human" | "resolved" | "dismissed" | "failed";
export type BackendAnomalyType = "PRICE_INCREASE" | "DUPLICATE_CHARGE" | "POST_CANCELLATION" | "NONE";
export type MerchantDisputeStatus =
  | "submitted"
  | "under_review"
  | "counter_offer"
  | "resolved_accepted"
  | "escalated"
  | "resolved_full"
  | "denied";
export type SubscriptionViewStatus = "healthy" | "anomaly_detected" | "in_dispute";

export type Merchant = {
  merchant_id: string;
  name: string;
  category: MerchantCategory;
  support_channel: "api" | "email";
};

export type Subscription = {
  subscription_id: string;
  user_id: string;
  merchant_id: string;
  plan_name: string;
  billing_cycle: "monthly" | "annual";
  billing_day: number;
  base_amount_usd: number;
  currency: "USD";
  status: SubscriptionContractStatus;
  started_at: string;
  cancelled_at: string | null;
  terms_key: string;
};

export type Transaction = {
  transaction_id: string;
  user_id: string;
  subscription_id: string;
  merchant_id: string;
  merchant_name: string;
  amount_usd: number;
  currency: "USD";
  posted_at: string;
  description: string;
  status: "posted";
  invoice_key: string;
};

export type CaseTimelineEvent = {
  at: string;
  actor: "agent" | "chargeguard" | "merchant_api" | "user" | "system";
  event: string;
  detail: string;
};

export type Case = {
  case_id: string;
  user_id: string;
  subscription_id: string;
  merchant_id: string;
  transaction_id: string;
  anomaly_type: "price_hike" | "duplicate_charge" | "charge_after_cancellation" | "other";
  confidence: number;
  claimed_amount_usd: number;
  status: CaseStatus;
  dispute_id: string | null;
  created_at: string;
  updated_at: string;
  timeline: CaseTimelineEvent[];
};

export type MerchantOffer = {
  amount_usd: number;
  message: string;
  expires_at: string;
};

export type MerchantDispute = {
  dispute_id: string;
  case_id: string;
  merchant_id: string;
  transaction_id: string;
  status: MerchantDisputeStatus;
  requested_amount_usd: number;
  created_at: string;
  updated_at: string;
  offer: MerchantOffer | null;
  resolution: null | {
    outcome: "accepted" | "full_refund" | "denied";
    refund_amount_usd: number;
    refund_eta_days: number;
    closed_at: string;
  };
  history: Array<{ at: string; status: MerchantDisputeStatus; note: string }>;
};

export type Decision = {
  decision_id: string;
  case_id: string;
  question: string;
  context: string;
  options: Array<{ option_id: string; label: string; detail: string }>;
  status: "pending" | "resolved" | "expired";
  chosen_option_id: string | null;
  created_at: string;
  resolved_at: string | null;
};

export type Metrics = {
  total_recovered_usd: number;
  active_disputes: number;
  money_at_risk_usd: number;
  monitored_subscriptions: number;
  autonomous_disputes_resolved: number;
  autonomous_disputes_total: number;
};

export type ActivityLog = {
  id: string;
  message: string;
  timestamp: string;
};

export type BackendCase = {
  case_id: string;
  transaction: Pick<Transaction, "transaction_id" | "subscription_id" | "merchant_id" | "merchant_name" | "amount_usd" | "currency" | "posted_at" | "description">;
  anomaly: {
    is_anomaly: boolean;
    type: BackendAnomalyType;
    expected_amount_usd: number;
    actual_amount_usd: number;
    claimed_amount_usd: number;
    confidence: number;
    reason: string;
  };
  evidence: Array<{ type: string; uri: string | null; description: string }>;
  dispute: {
    dispute_id: string | null;
    claim_type: Case["anomaly_type"];
    requested_amount_usd: number;
    message: string;
  } | null;
  merchant: {
    status: MerchantDisputeStatus | null;
    offer: MerchantOffer | null;
    resolution: MerchantDispute["resolution"];
  };
  decision: {
    required: boolean;
    recommendation: "accept_offer" | "reject_and_request_full_refund" | null;
    reason: string | null;
  };
  status: BackendCaseStatus;
  timeline: CaseTimelineEvent[];
  created_at: string;
  updated_at: string;
};

export type CaseSummary = {
  case_id: string;
  transaction_id: string;
  merchant_id: string;
  merchant_name: string;
  anomaly_type: BackendAnomalyType;
  claimed_amount_usd: number;
  currency: "USD";
  status: BackendCaseStatus;
  created_at: string;
  updated_at: string;
};

export type SubscriptionViewModel = {
  subscription_id: string;
  merchant_name: string;
  merchant_logo: string;
  plan_name: string;
  billing_cycle: string;
  current_amount_usd: number;
  previous_amount_usd: number;
  status: SubscriptionViewStatus;
  case_id: string | null;
};

export type CaseViewModel = {
  caseData: Case;
  merchant: Merchant;
  subscription: Subscription;
  transaction: Transaction;
  merchantDispute: MerchantDispute | null;
  decision: Decision | null;
};

export type ChargeGuardData = {
  metrics: Metrics;
  merchants: Merchant[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  cases: Case[];
  merchant_disputes: MerchantDispute[];
  decisions: Decision[];
  activity: ActivityLog[];
};
