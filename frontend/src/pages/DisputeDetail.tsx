import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { DecisionBanner } from "@/components/disputes/DecisionBanner";
import { DecisionModal } from "@/components/DecisionModal";
import { Timeline } from "@/components/disputes/Timeline";
import { EmptyState } from "@/components/shared/EmptyState";
import { PageHeader } from "@/components/shared/PageHeader";
import { StatusBadge } from "@/components/subscriptions/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { env } from "@/config/env";
import { useDelayedAction } from "@/hooks/useDelayedAction";
import { useLanguage } from "@/i18n/LanguageContext";
import { backendApi } from "@/services/chargeguardApi";
import type { BackendCase, CaseStepName, CaseViewModel } from "@/types/chargeguard";

type DisputeDetailProps = {
  caseViewModels: CaseViewModel[];
  liveCase?: BackendCase | null;
  liveStep?: CaseStepName | null;
  onDecisionResolved: () => void;
};

export function DisputeDetail({ caseViewModels, liveCase, liveStep, onDecisionResolved }: DisputeDetailProps) {
  const { id } = useParams();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null);
  const { isPending, run } = useDelayedAction(400);
  const { t } = useLanguage();

  const caseView = useMemo(() => {
    if (id) {
      return caseViewModels.find((item) => item.caseData.case_id === id) ?? null;
    }
    return null;
  }, [caseViewModels, id]);

  // When visiting /disputes without an ID, show the list of cases or empty state
  if (!id) {
    if (caseViewModels.length === 0) {
      return (
        <div>
          <PageHeader title={t.dispute.title} description={t.dispute.description} />
          <Button asChild className="mb-5" variant="outline">
            <Link to="/subscriptions">
              <ArrowRight className="rotate-180" />
              {t.common.backToSubscriptions}
            </Link>
          </Button>
          <EmptyState
            description={t.dispute.noCasesDescription}
            icon={FileText}
            title={t.dispute.noCasesTitle}
          />
        </div>
      );
    }

    return (
      <div>
        <PageHeader title={t.dispute.allCasesTitle} description={t.dispute.allCasesDescription} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {caseViewModels.map((item) => {
            const isDismissedItem = item.caseData.status === "dismissed";
            return (
              <Card key={item.caseData.case_id} className="flex flex-col justify-between p-5 space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-slate-900 text-sm font-bold text-white">
                        {item.merchant.name.slice(0, 1).toUpperCase()}
                      </div>
                      <div>
                        <div className="font-semibold text-slate-950">{item.merchant.name}</div>
                        <div className="text-xs text-slate-500">{item.subscription.plan_name}</div>
                      </div>
                    </div>
                    <StatusBadge status={isDismissedItem ? "healthy" : "in_dispute"} />
                  </div>
                  <div className="text-sm text-slate-600">
                    {isDismissedItem ? (
                      <p className="font-medium text-emerald-700">
                        {t.dispute.legitimateStatus}: ${item.transaction.amount_usd.toFixed(2)}
                      </p>
                    ) : (
                      <p className="font-medium text-amber-700">
                        {t.dispute.disputedAmount}: ${item.caseData.claimed_amount_usd.toFixed(2)}
                      </p>
                    )}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="w-full">
                  <Link to={`/disputes/${item.caseData.case_id}`}>
                    <ArrowRight />
                    {t.dispute.viewCaseDetails}
                  </Link>
                </Button>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  // When visiting /disputes/:id with an ID that doesn't exist
  if (!caseView) {
    return (
      <div>
        <Button asChild className="mb-5" variant="outline">
          <Link to="/subscriptions">
            <ArrowRight className="rotate-180" />
            {t.common.backToSubscriptions}
          </Link>
        </Button>
        <EmptyState
          description={t.dispute.notFoundDescription}
          icon={FileText}
          title={t.dispute.notFoundTitle}
        />
      </div>
    );
  }

  // While a case is running, its freshest timeline lives in `liveCase`:
  // the periodic reload is slower than the step-by-step advances.
  const isLive = Boolean(liveCase && liveCase.case_id === caseView.caseData.case_id);
  const timelineEvents = isLive && liveCase ? liveCase.timeline : caseView.caseData.timeline ?? [];
  const pendingLabel = isLive && liveStep ? t.dispute.steps[liveStep] : null;

  function handleDecision(nextDecision: "accepted" | "rejected") {
    run(async () => {
      if (env.dataSource === "api" && caseView) {
        await backendApi.resolveDecision(
          caseView.caseData.case_id,
          nextDecision === "accepted" ? "accept_offer" : "reject_and_request_full_refund",
          nextDecision === "rejected" ? "User requested a full refund" : undefined,
        );
        onDecisionResolved();
      }

      setDecision(nextDecision);
    });
  }

  const { caseData, merchant, subscription, transaction, decision: pendingDecision } = caseView;
  const isDismissed = caseData.status === "dismissed";

  const caseTitlePrefix =
    t.dispute.caseTitles[caseData.anomaly_type as keyof typeof t.dispute.caseTitles] ??
    t.dispute.caseTitles.other;
  const anomalyLabel =
    t.dispute.anomalyRowLabels[caseData.anomaly_type as keyof typeof t.dispute.anomalyRowLabels] ??
    t.dispute.detectedChange;

  const detectedChangeText =
    caseData.anomaly_type === "duplicate_charge"
      ? `$${transaction.amount_usd.toFixed(2)} (2x)`
      : `$${subscription.base_amount_usd.toFixed(2)} → $${transaction.amount_usd.toFixed(2)}`;

  return (
    <div>
      <PageHeader
        title={t.dispute.title}
        description={t.dispute.description}
      />

      <section className="grid gap-6 lg:grid-cols-[390px_1fr]">
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t.dispute.summaryTitle}</CardTitle>
              <CardDescription>{t.dispute.summaryDescription}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{t.common.service}</span>
                <span className="font-semibold text-slate-900">{merchant.name}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{isDismissed ? t.dispute.evaluatedAmount : t.dispute.disputedAmount}</span>
                <span className={`font-semibold ${isDismissed ? "text-slate-900" : "text-amber-600"}`}>
                  ${(isDismissed ? transaction.amount_usd : caseData.claimed_amount_usd).toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{isDismissed ? t.common.variation : anomalyLabel}</span>
                <span className="font-semibold text-slate-900">
                  {isDismissed ? `${t.dispute.noVariation} ($0.00)` : detectedChangeText}
                </span>
              </div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 font-semibold text-slate-900">
                  <FileText className="size-4" />
                  {t.dispute.attachedContract}
                </div>
                <p className="mt-2 break-all text-sm text-slate-500">{`s3://chargeguard-evidence-demo/${subscription.terms_key}`}</p>
              </div>
            </CardContent>
          </Card>
          <DecisionBanner caseView={caseView} onReview={() => setDecisionOpen(true)} />
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <CardTitle>
                  {isDismissed ? `${t.dispute.analysisTitle} ${merchant.name}` : `${caseTitlePrefix} ${merchant.name}`}
                </CardTitle>
                <CardDescription>
                  {isDismissed
                    ? t.dispute.dismissedSubtitle
                    : `${t.dispute.claimFor} $${caseData.claimed_amount_usd.toFixed(2)} ${t.dispute.withConfidence} ${(caseData.confidence * 100).toFixed(0)}%.`}
                </CardDescription>
              </div>
              <StatusBadge status={isDismissed ? "healthy" : "in_dispute"} />
            </div>
          </CardHeader>
          <CardContent>
            {isDismissed && (
              <div className="mb-6 rounded-lg border border-emerald-200 bg-emerald-50/80 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div className="space-y-1">
                    <p className="font-semibold text-emerald-950">
                      {t.dispute.noAnomalyTitle}
                    </p>
                    <p className="text-sm leading-relaxed text-emerald-800">
                      {t.dispute.noAnomalyDescription}
                    </p>
                  </div>
                </div>
              </div>
            )}
            <Timeline events={timelineEvents} pendingLabel={pendingLabel} />
          </CardContent>
        </Card>

      </section>

      <DecisionModal
        decision={decision}
        caseView={caseView}
        isPending={isPending}
        pendingDecision={pendingDecision}
        onDecision={handleDecision}
        onOpenChange={setDecisionOpen}
        open={decisionOpen}
      />
    </div>
  );
}
