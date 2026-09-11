import { chargeguardData } from "@/mocks/chargeguardData";
import type {
  ActivityLog,
  BackendCase,
  Case,
  ChargeGuardData,
  Decision,
  Merchant,
  MerchantDispute,
  Metrics,
  Subscription,
  Transaction,
} from "@/types/chargeguard";

type BackendSnapshot = {
  merchants: Merchant[];
  subscriptions: Subscription[];
  transactions: Transaction[];
  cases: BackendCase[];
};

const anomalyTypeMap: Record<BackendCase["anomaly"]["type"], Case["anomaly_type"]> = {
  PRICE_INCREASE: "price_hike",
  DUPLICATE_CHARGE: "duplicate_charge",
  POST_CANCELLATION: "charge_after_cancellation",
  NONE: "other",
};

const statusMap: Record<BackendCase["status"], Case["status"]> = {
  analyzing: "detected",
  analyzed: "detected",
  awaiting_human: "awaiting_human",
  awaiting_merchant: "awaiting_merchant",
  resolved: "resolved",
  dismissed: "dismissed",
  failed: "dismissed",
};

export function adaptBackendData(snapshot: BackendSnapshot): ChargeGuardData {
  const cases = snapshot.cases.map((backendCase) => adaptCase(backendCase, snapshot.subscriptions));
  const merchantDisputes = snapshot.cases.flatMap(adaptMerchantDispute);
  const decisions = snapshot.cases.flatMap(adaptDecision);

  return {
    metrics: buildMetrics(snapshot.subscriptions, cases, merchantDisputes),
    merchants: snapshot.merchants,
    subscriptions: snapshot.subscriptions,
    transactions: snapshot.transactions,
    cases,
    merchant_disputes: merchantDisputes,
    decisions,
    activity: buildActivity(snapshot.cases),
  };
}

function adaptCase(backendCase: BackendCase, subscriptions: Subscription[]): Case {
  const transaction = backendCase.transaction;
  const subscription = subscriptions.find((item) => item.subscription_id === transaction.subscription_id);
  const anomaly = backendCase.anomaly;
  const dispute = backendCase.dispute;

  return {
    case_id: backendCase.case_id,
    user_id: subscription?.user_id ?? "usr_demo",
    subscription_id: transaction.subscription_id,
    merchant_id: transaction.merchant_id,
    transaction_id: transaction.transaction_id,
    anomaly_type: dispute?.claim_type ?? anomalyTypeMap[anomaly.type],
    confidence: anomaly.confidence,
    claimed_amount_usd: dispute?.requested_amount_usd ?? anomaly.claimed_amount_usd,
    status: statusMap[backendCase.status],
    dispute_id: dispute?.dispute_id ?? null,
    created_at: backendCase.created_at,
    updated_at: backendCase.updated_at,
    timeline: backendCase.timeline,
  };
}

function adaptMerchantDispute(backendCase: BackendCase): MerchantDispute[] {
  if (!backendCase.dispute?.dispute_id || !backendCase.merchant.status) return [];

  return [
    {
      dispute_id: backendCase.dispute.dispute_id,
      case_id: backendCase.case_id,
      merchant_id: backendCase.transaction.merchant_id,
      transaction_id: backendCase.transaction.transaction_id,
      status: backendCase.merchant.status,
      requested_amount_usd: backendCase.dispute.requested_amount_usd,
      created_at: backendCase.created_at,
      updated_at: backendCase.updated_at,
      offer: backendCase.merchant.offer,
      resolution: backendCase.merchant.resolution,
      history: backendCase.timeline
        .filter((event) => event.actor === "merchant_api")
        .map((event) => ({ at: event.at, status: backendCase.merchant.status!, note: event.detail })),
    },
  ];
}

function adaptDecision(backendCase: BackendCase): Decision[] {
  if (backendCase.status !== "awaiting_human") return [];

  const offer = backendCase.merchant.offer;
  const recommendation = backendCase.decision.recommendation;
  const rationale = backendCase.decision.reason;

  return [
    {
      decision_id: `dec_${backendCase.case_id}`,
      case_id: backendCase.case_id,
      question: "Accept merchant counter-offer?",
      context: [recommendation, rationale].filter(Boolean).join(" ") || "The merchant sent a counter-offer and the agent needs a user decision.",
      options: [
        { option_id: "reject_continue", label: "Reject and Continue", detail: "Continue the dispute and request a full refund." },
        { option_id: "accept_offer", label: "Accept Offer", detail: offer ? `Accept merchant offer of $${offer.amount_usd.toFixed(2)}.` : "Accept the merchant offer." },
      ],
      status: "pending",
      chosen_option_id: null,
      created_at: backendCase.updated_at,
      resolved_at: null,
    },
  ];
}

function buildMetrics(subscriptions: Subscription[], cases: Case[], disputes: MerchantDispute[]): Metrics {
  const resolvedDisputes = disputes.filter((item) => item.resolution);
  const recovered = resolvedDisputes.reduce((total, dispute) => total + (dispute.resolution?.refund_amount_usd ?? 0), 0);
  const activeCases = cases.filter((caseData) => !["resolved", "dismissed"].includes(caseData.status));

  return {
    ...chargeguardData.metrics,
    total_recovered_usd: Number(recovered.toFixed(2)),
    active_disputes: activeCases.length,
    money_at_risk_usd: activeCases.reduce((total, caseData) => Number((total + caseData.claimed_amount_usd).toFixed(2)), 0),
    monitored_subscriptions: subscriptions.length,
    autonomous_disputes_resolved: resolvedDisputes.length,
    autonomous_disputes_total: disputes.length,
  };
}

function buildActivity(cases: BackendCase[]): ActivityLog[] {
  return cases.slice(-6).reverse().map((backendCase) => ({
    id: `log_${backendCase.case_id}`,
    message: backendCase.anomaly.reason ?? `Case ${backendCase.case_id} processed by ChargeGuard.`,
    timestamp: backendCase.updated_at,
  }));
}
