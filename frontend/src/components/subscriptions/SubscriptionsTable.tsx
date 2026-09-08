import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { env } from "@/config/env";
import { useLanguage } from "@/i18n/LanguageContext";
import type { SubscriptionViewModel } from "@/types/chargeguard";
import { StatusBadge } from "./StatusBadge";

type SubscriptionsTableProps = {
  subscriptions: SubscriptionViewModel[];
  onSimulateIncrease: (id: string) => void | Promise<void>;
};

export function SubscriptionsTable({ subscriptions, onSimulateIncrease }: SubscriptionsTableProps) {
  const { t } = useLanguage();

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>{t.common.service}</TableHead>
          <TableHead>{t.common.currentPrice}</TableHead>
          <TableHead>{t.common.previousPrice}</TableHead>
          <TableHead>{t.common.variation}</TableHead>
          <TableHead>{t.common.status}</TableHead>
          <TableHead className="text-right">{t.common.demo}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {subscriptions.map((subscription) => (
          <TableRow key={subscription.subscription_id}>
            <TableCell>
              <div className="flex items-center gap-3">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
                  {subscription.merchant_logo}
                </div>
                <div>
                  <div className="font-semibold text-slate-950">{subscription.merchant_name}</div>
                  <div className="text-sm text-slate-500">{subscription.plan_name}</div>
                </div>
              </div>
            </TableCell>
            <TableCell className="font-semibold">${subscription.current_amount_usd.toFixed(2)}</TableCell>
            <TableCell>${subscription.previous_amount_usd.toFixed(2)}</TableCell>
            <TableCell>
              <span className={subscription.current_amount_usd > subscription.previous_amount_usd ? "font-semibold text-amber-600" : "text-slate-500"}>
                ${(subscription.current_amount_usd - subscription.previous_amount_usd).toFixed(2)}
              </span>
            </TableCell>
            <TableCell>
              <StatusBadge status={subscription.status} />
            </TableCell>
            <TableCell className="text-right">
              <div className="flex justify-end gap-2">
                {subscription.status === "in_dispute" || subscription.status === "anomaly_detected" ? (
                  <Button asChild size="sm" variant="ghost">
                    <Link to={`/disputes/${subscription.case_id ?? env.defaultCaseId}`}>
                      <ArrowRight />
                      {t.subscriptions.viewDispute}
                    </Link>
                  </Button>
                ) : null}
                <Button
                  disabled={subscription.status !== "healthy"}
                  onClick={() => onSimulateIncrease(subscription.subscription_id)}
                  size="sm"
                  variant="outline"
                >
                  <Sparkles />
                  {t.subscriptions.simulateIncrease}
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
