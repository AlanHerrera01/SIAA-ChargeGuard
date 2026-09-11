import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { SubscriptionFilters, type SubscriptionFilter } from "@/components/subscriptions/SubscriptionFilters";
import { SubscriptionsTable } from "@/components/subscriptions/SubscriptionsTable";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import type { SubscriptionViewModel } from "@/types/chargeguard";

type SubscriptionsProps = {
  subscriptions: SubscriptionViewModel[];
  onAnalyzeCharge: (id: string) => void | Promise<void>;
};

export function Subscriptions({ subscriptions, onAnalyzeCharge }: SubscriptionsProps) {
  const [filter, setFilter] = useState<SubscriptionFilter>("all");
  const { t } = useLanguage();

  const filteredSubscriptions = useMemo(() => {
    if (filter === "all") return subscriptions;
    return subscriptions.filter((subscription) => subscription.status === filter);
  }, [filter, subscriptions]);

  return (
    <div>
      <PageHeader
        title={t.subscriptions.title}
        description={t.subscriptions.description}
      />

      <Card>
        <CardHeader className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{t.subscriptions.monitoredServices}</CardTitle>
            <CardDescription>{t.subscriptions.monitoredDescription}</CardDescription>
          </div>
          <SubscriptionFilters onChange={setFilter} value={filter} />
        </CardHeader>
        <CardContent>
          {filteredSubscriptions.length > 0 ? (
            <SubscriptionsTable subscriptions={filteredSubscriptions} onAnalyzeCharge={onAnalyzeCharge} />
          ) : (
            <EmptyState
              description={t.subscriptions.emptyDescription}
              icon={FileText}
              title={t.subscriptions.emptyTitle}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
