import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowRight, FileText } from "lucide-react";
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
import type { CaseViewModel } from "@/types/chargeguard";

type DisputeDetailProps = {
  caseViewModels: CaseViewModel[];
  onDecisionResolved: () => void;
};

export function DisputeDetail({ caseViewModels, onDecisionResolved }: DisputeDetailProps) {
  const { id } = useParams();
  const [decisionOpen, setDecisionOpen] = useState(false);
  const [decision, setDecision] = useState<"accepted" | "rejected" | null>(null);
  const { isPending, run } = useDelayedAction(400);
  const { t } = useLanguage();

  const caseView = useMemo(() => caseViewModels.find((item) => item.caseData.case_id === id), [caseViewModels, id]);

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
                <span className="text-slate-500">{t.dispute.disputedAmount}</span>
                <span className="font-semibold text-amber-600">${caseData.claimed_amount_usd.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-slate-500">{t.dispute.detectedChange}</span>
                <span className="font-semibold text-slate-900">
                  ${subscription.base_amount_usd.toFixed(2)} a ${transaction.amount_usd.toFixed(2)}
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
                <CardTitle>{merchant.name} {caseData.anomaly_type} case</CardTitle>
                <CardDescription>
                  {t.dispute.claimFor} ${caseData.claimed_amount_usd.toFixed(2)} {t.dispute.withConfidence} {(caseData.confidence * 100).toFixed(0)}%.
                </CardDescription>
              </div>
              <StatusBadge status="in_dispute" />
            </div>
          </CardHeader>
          <CardContent>
            <Timeline events={caseData.timeline} />
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
