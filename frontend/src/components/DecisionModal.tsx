import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import type { CaseViewModel, Decision } from "@/types/chargeguard";

type DecisionModalProps = {
  caseView: CaseViewModel;
  pendingDecision: Decision | null;
  open: boolean;
  isPending: boolean;
  decision: "accepted" | "rejected" | null;
  onOpenChange: (open: boolean) => void;
  onDecision: (decision: "accepted" | "rejected") => void;
};

export function DecisionModal({
  caseView,
  pendingDecision,
  open,
  isPending,
  decision,
  onOpenChange,
  onDecision,
}: DecisionModalProps) {
  const offer = caseView.merchantDispute?.offer;
  const { t } = useLanguage();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <AlertTriangle className="size-4 text-amber-500" />
            <Badge variant="warning">{t.decision.humanLoop}</Badge>
          </div>
          <DialogTitle>{caseView.merchant.name} {t.decision.titleSuffix}</DialogTitle>
          <DialogDescription>{pendingDecision?.question ?? t.decision.paused}</DialogDescription>
        </DialogHeader>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-500">{t.decision.merchantOffer}</p>
            <p className="mt-2 text-xl font-bold text-slate-900">{offer?.message ?? t.decision.noOffer}</p>
            <p className="mt-3 text-sm font-semibold text-emerald-600">{t.decision.acceptOfferAmount}: ${offer?.amount_usd.toFixed(2) ?? "0.00"}</p>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-500">{t.decision.agentRecommendation}</p>
            <p className="mt-2 text-sm leading-6 text-slate-700">
              {pendingDecision?.context ??
                `${t.decision.reviewRequest} ${caseView.caseData.anomaly_type} ${t.common.confidence.toLowerCase()} ${(caseView.caseData.confidence * 100).toFixed(0)}%.`}
            </p>
            <Badge className="mt-3" variant="slate">
              {t.common.confidence} {(caseView.caseData.confidence * 100).toFixed(0)}%
            </Badge>
          </div>
        </div>

        {decision ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <p className="font-semibold text-emerald-800">
                {decision === "accepted" ? t.decision.accepted : t.decision.rejected}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Button disabled={isPending || Boolean(decision)} onClick={() => onDecision("rejected")} size="lg" variant="outline">
            {isPending ? <Sparkles className="animate-spin" /> : <AlertTriangle />}
            {t.decision.rejectAndContinue}
          </Button>
          <Button disabled={isPending || Boolean(decision)} onClick={() => onDecision("accepted")} size="lg">
            {isPending ? <Sparkles className="animate-spin" /> : <ShieldCheck />}
            {t.decision.acceptOffer}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
