import { Link } from "react-router-dom";
import { Bot, CheckCircle2, FileText, ShieldCheck, Sparkles } from "lucide-react";
import { MetricCard } from "@/components/dashboard/MetricCard";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeText } from "@/i18n/localizeEvent";
import type { ActivityLog, Case, CaseViewModel, Metrics } from "@/types/chargeguard";

type DashboardProps = {
  metrics: Metrics;
  activity: ActivityLog[];
  activeCases: Case[];
  caseViewModels: CaseViewModel[];
};

export function Dashboard({ metrics, activity, activeCases, caseViewModels }: DashboardProps) {
  const actionableCase = caseViewModels.find((caseView) => caseView.caseData.status === "awaiting_human");
  const { language, t } = useLanguage();

  return (
    <div>
      <PageHeader
        title={t.dashboard.title}
        description={t.dashboard.description}
      />

      <section className="grid gap-4 md:grid-cols-3">
        <MetricCard
          detail={t.dashboard.totalRecoveredDetail}
          icon={CheckCircle2}
          title={t.dashboard.totalRecovered}
          tone="emerald"
          value={`$${metrics.total_recovered_usd.toFixed(2)}`}
        />
        <MetricCard
          detail={t.dashboard.autonomousResolvedDetail}
          icon={ShieldCheck}
          title={t.dashboard.autonomousResolved}
          tone="emerald"
          value={`${metrics.autonomous_disputes_resolved}/${metrics.autonomous_disputes_total}`}
        />
        <MetricCard
          detail={t.dashboard.monitoredSubscriptionsDetail}
          icon={Bot}
          title={t.dashboard.monitoredSubscriptions}
          tone="blue"
          value={`${metrics.monitored_subscriptions}`}
        />
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader>
            <CardTitle>{t.dashboard.recentActivity}</CardTitle>
            <CardDescription>{t.dashboard.recentActivityDescription}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {activity.map((item) => (
              <div className="flex gap-4 rounded-lg border border-slate-200 bg-slate-50 p-4" key={item.id}>
                <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-white text-slate-700">
                  <ShieldCheck className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-slate-950">{localizeText(item.message, language)}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{item.timestamp}</p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {activeCases.length === 0 ? (
          <EmptyState
            description={t.dashboard.noPendingDescription}
            icon={FileText}
            title={t.dashboard.noPendingTitle}
          />
        ) : actionableCase ? (
          <Card className="border-amber-200">
            <CardHeader>
              <div className="flex items-center gap-2">
                <span className="relative flex size-3">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
                  <span className="relative inline-flex size-3 rounded-full bg-[#F59E0B]" />
                </span>
                <Badge variant="warning">{t.dashboard.actionRequired}</Badge>
              </div>
              <CardTitle>{actionableCase.merchant.name} {t.dashboard.awaitingDecision}</CardTitle>
              <CardDescription>{t.dashboard.counterOfferDescription}</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-extrabold text-[#10B981]">
                ${actionableCase.merchantDispute?.offer?.amount_usd.toFixed(2)}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {localizeText(actionableCase.merchantDispute?.offer?.message, language)}
              </p>
              <Button asChild className="mt-5 w-full">
                <Link to={`/disputes/${actionableCase.caseData.case_id}`}>
                  {t.common.openDispute}
                  <Sparkles />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>{activeCases.length} {t.dashboard.activeCasesTitle}</CardTitle>
              <CardDescription>{t.dashboard.activeCasesDescription}</CardDescription>
            </CardHeader>
          </Card>
        )}
      </section>
    </div>
  );
}
