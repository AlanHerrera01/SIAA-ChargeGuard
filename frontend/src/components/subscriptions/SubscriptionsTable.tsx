import { ArrowRight, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useLanguage } from "@/i18n/LanguageContext";
import type { SubscriptionViewModel } from "@/types/chargeguard";
import { StatusBadge } from "./StatusBadge";

type SubscriptionsTableProps = {
  subscriptions: SubscriptionViewModel[];
  onAnalyzeCharge: (id: string) => void | Promise<void>;
};

function SubscriptionCard({
  subscription,
  onAnalyzeCharge,
}: {
  subscription: SubscriptionViewModel;
  onAnalyzeCharge: (id: string) => void | Promise<void>;
}) {
  const { t } = useLanguage();

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
            {subscription.merchant_logo}
          </div>
          <div>
            <div className="font-semibold text-slate-950">{subscription.merchant_name}</div>
            <div className="text-sm text-slate-500">{subscription.plan_name}</div>
          </div>
        </div>
        <StatusBadge status={subscription.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-slate-500">{t.common.currentPrice}</p>
          <p className="font-semibold">${subscription.current_amount_usd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500">{t.common.previousPrice}</p>
          <p>${subscription.previous_amount_usd.toFixed(2)}</p>
        </div>
        <div>
          <p className="text-slate-500">{t.common.variation}</p>
          <p className={subscription.current_amount_usd > subscription.previous_amount_usd ? "font-semibold text-amber-600" : "text-slate-500"}>
            ${(subscription.current_amount_usd - subscription.previous_amount_usd).toFixed(2)}
          </p>
        </div>
      </div>

      <div className="flex gap-2 pt-1">
        {subscription.case_id ? (
          <Button asChild size="sm" variant="ghost" className="flex-1">
            <Link to={`/disputes/${subscription.case_id}`}>
              <ArrowRight />
              {subscription.status === "in_dispute" ? t.subscriptions.viewDispute : t.subscriptions.viewAnalysis}
            </Link>
          </Button>
        ) : null}
        <Button
          className="flex-1"
          disabled={subscription.status === "in_dispute"}
          onClick={() => onAnalyzeCharge(subscription.subscription_id)}
          size="sm"
          variant="outline"
        >
          <Sparkles />
          {t.subscriptions.analyzeCharge}
        </Button>
      </div>
    </div>
  );
}

export function SubscriptionsTable({ subscriptions, onAnalyzeCharge }: SubscriptionsTableProps) {
  const { t } = useLanguage();

  return (
    <>
      {/* Desktop table */}
      <div className="hidden md:block">
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
                    {subscription.case_id ? (
                      <Button asChild size="sm" variant="ghost">
                        <Link to={`/disputes/${subscription.case_id}`}>
                          <ArrowRight />
                          {subscription.status === "in_dispute" ? t.subscriptions.viewDispute : t.subscriptions.viewAnalysis}
                        </Link>
                      </Button>
                    ) : null}
                    <Button
                      disabled={subscription.status === "in_dispute"}
                      onClick={() => onAnalyzeCharge(subscription.subscription_id)}
                      size="sm"
                      variant="outline"
                    >
                      <Sparkles />
                      {t.subscriptions.analyzeCharge}
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Mobile cards */}
      <div className="md:hidden space-y-3">
        {subscriptions.map((subscription) => (
          <SubscriptionCard
            key={subscription.subscription_id}
            onAnalyzeCharge={onAnalyzeCharge}
            subscription={subscription}
          />
        ))}
      </div>
    </>
  );
}
