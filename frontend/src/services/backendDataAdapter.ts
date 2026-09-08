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

const anomalyTypeMap: Record<NonNullable<BackendCase["charge_analysis"]>["type"], Case["anomaly_type"]> = {
  PRICE_INCREASE: "price_hike",
  DUPLICATE_CHARGE: "duplicate_charge",
  POST_CANCELLATION: "charge_after_cancellation",
  NONE: "other",
};

const statusMap: Record<BackendCase["status"], Case["status"]> = {
  analyzed: "detected",
  awaiting_human: "awaiting_human",
  awaiting_merchant: "awaiting_merchant",
  completed: "resolved",
};

export function adaptBackendData(snapshot: BackendSnapshot): ChargeGuardData {
  const cases = snapshot.cases.map((backendCase) => adaptCase(backendCase, snapshot.transactions, snapshot.subscriptions));
  const merchantDisputes = snapshot.cases.flatMap((backendCase) => (backendCase.merchant_response ? [backendCase.merchant_response] : []));
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

function adaptCase(backendCase: BackendCase, transactions: Transaction[], subscriptions: Subscription[]): Case {
  const transaction = transactions.find((item) => item.transaction_id === backendCase.transaction_id);
  const subscription = transaction
    ? subscriptions.find((item) => item.subscription_id === transaction.subscription_id)
    : undefined;
  const analysis = backendCase.charge_analysis;
  const dispute = backendCase.dispute;
  const merchantResponse = backendCase.merchant_response;
  const createdAt = merchantResponse?.created_at ?? transaction?.posted_at ?? new Date().toISOString();
  const updatedAt = merchantResponse?.updated_at ?? createdAt;

  return {
    case_id: backendCase.case_id,
    user_id: dispute?.user_id ?? transaction?.user_id ?? "usr_demo",
    subscription_id: transaction?.subscription_id ?? subscription?.subscription_id ?? "",
    merchant_id: dispute?.merchant_id ?? transaction?.merchant_id ?? merchantResponse?.merchant_id ?? "",
    transaction_id: backendCase.transaction_id,
    anomaly_type: dispute?.claim_type ?? (analysis ? anomalyTypeMap[analysis.type] : "other"),
    confidence: analysis?.confidence ?? 0,
    claimed_amount_usd: dispute?.requested_amount_usd ?? analysis?.difference ?? merchantResponse?.requested_amount_usd ?? 0,
    status: analysis?.is_anomaly === false ? "dismissed" : statusMap[backendCase.status],
    dispute_id: backendCase.dispute_id ?? merchantResponse?.dispute_id ?? null,
    created_at: createdAt,
    updated_at: updatedAt,
    timeline: [
      {
        at: transaction?.posted_at ?? createdAt,
        actor: "agent",
        event: "Detection",
        detail: analysis?.reason ?? "Transaction analyzed by ChargeGuard.",
      },
      ...(backendCase.evidence?.summary
        ? [
            {
              at: createdAt,
              actor: "agent" as const,
              event: "Evidence",
              detail: backendCase.evidence.summary,
            },
          ]
        : []),
      ...(dispute
        ? [
            {
              at: createdAt,
              actor: "merchant_api" as const,
              event: "Dispute filed",
              detail: dispute.message,
            },
          ]
        : []),
      ...(merchantResponse
        ? [
            {
              at: updatedAt,
              actor: "merchant_api" as const,
              event: "Merchant response",
              detail: merchantResponse.offer?.message ?? merchantResponse.status,
            },
          ]
        : []),
    ],
  };
}

function adaptDecision(backendCase: BackendCase): Decision[] {
  if (backendCase.status !== "awaiting_human") return [];

  const offer = backendCase.merchant_response?.offer;
  const recommendation = backendCase.negotiation?.recommendation;
  const rationale = backendCase.negotiation?.rationale;

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
      created_at: backendCase.merchant_response?.updated_at ?? new Date().toISOString(),
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
    message: backendCase.charge_analysis?.reason ?? `Case ${backendCase.case_id} processed by ChargeGuard.`,
    timestamp: backendCase.merchant_response?.updated_at ?? new Date().toISOString(),
  }));
}
