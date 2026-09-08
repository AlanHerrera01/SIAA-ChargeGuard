import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n/LanguageContext";
import type { SubscriptionViewStatus } from "@/types/chargeguard";

const variantMap: Record<SubscriptionViewStatus, "normal" | "warning" | "dispute"> = {
  healthy: "normal",
  anomaly_detected: "warning",
  in_dispute: "dispute",
};

export function StatusBadge({ status }: { status: SubscriptionViewStatus }) {
  const { t } = useLanguage();
  const labelMap: Record<SubscriptionViewStatus, string> = {
    healthy: t.subscriptions.normal,
    anomaly_detected: t.subscriptions.anomalyDetected,
    in_dispute: t.subscriptions.inDispute,
  };
  return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
}
