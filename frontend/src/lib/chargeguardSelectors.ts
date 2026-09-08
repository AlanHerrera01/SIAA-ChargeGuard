import type {
  Case,
  CaseViewModel,
  ChargeGuardData,
  Metrics,
  SubscriptionViewModel,
  SubscriptionViewStatus,
} from "@/types/chargeguard";

const activeCaseStatuses = new Set<Case["status"]>(["detected", "investigating", "dispute_filed", "awaiting_merchant", "awaiting_human"]);

export function getActiveCases(cases: Case[]) {
  return cases.filter((caseData) => activeCaseStatuses.has(caseData.status));
}

export function getCaseViewModels(data: ChargeGuardData): CaseViewModel[] {
  return data.cases.flatMap((caseData) => {
    const merchant = data.merchants.find((item) => item.merchant_id === caseData.merchant_id);
    const subscription = data.subscriptions.find((item) => item.subscription_id === caseData.subscription_id);
    const transaction = data.transactions.find((item) => item.transaction_id === caseData.transaction_id);

    if (!merchant || !subscription || !transaction) return [];

    return [
      {
        caseData,
        merchant,
        subscription,
        transaction,
        merchantDispute: data.merchant_disputes.find((item) => item.case_id === caseData.case_id) ?? null,
        decision: data.decisions.find((item) => item.case_id === caseData.case_id) ?? null,
      },
    ];
  });
}

export function getSubscriptionViewModels(data: ChargeGuardData, simulatedAnomalySubscriptionIds: string[]): SubscriptionViewModel[] {
  return data.subscriptions.map((subscription) => {
    const merchant = data.merchants.find((item) => item.merchant_id === subscription.merchant_id);
    const latestTransaction = data.transactions.find((transaction) => transaction.subscription_id === subscription.subscription_id);
    const relatedCase = data.cases.find((caseData) => caseData.subscription_id === subscription.subscription_id && activeCaseStatuses.has(caseData.status));
    const hasSimulatedAnomaly = simulatedAnomalySubscriptionIds.includes(subscription.subscription_id);
    const status = getSubscriptionViewStatus(Boolean(relatedCase), hasSimulatedAnomaly);
    const baselineAmount = latestTransaction?.amount_usd ?? subscription.base_amount_usd;

    return {
      subscription_id: subscription.subscription_id,
      merchant_name: merchant?.name ?? subscription.merchant_id,
      merchant_logo: merchant?.name.slice(0, 1).toUpperCase() ?? "?",
      plan_name: subscription.plan_name,
      billing_cycle: subscription.billing_cycle,
      current_amount_usd: hasSimulatedAnomaly ? Number((baselineAmount + 5).toFixed(2)) : baselineAmount,
      previous_amount_usd: subscription.base_amount_usd,
      status,
      case_id: relatedCase?.case_id ?? null,
    };
  });
}

export function getRuntimeMetrics(baseMetrics: Metrics, subscriptions: SubscriptionViewModel[], activeCases: Case[]) {
  return {
    ...baseMetrics,
    active_disputes: activeCases.length,
    monitored_subscriptions: subscriptions.length,
    money_at_risk_usd: subscriptions.reduce((total, subscription) => {
      const increase = Math.max(subscription.current_amount_usd - subscription.previous_amount_usd, 0);
      return Number((total + increase).toFixed(2));
    }, 0),
  };
}

function getSubscriptionViewStatus(hasActiveCase: boolean, hasSimulatedAnomaly: boolean): SubscriptionViewStatus {
  if (hasActiveCase) return "in_dispute";
  if (hasSimulatedAnomaly) return "anomaly_detected";
  return "healthy";
}
