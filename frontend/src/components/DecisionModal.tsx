import { useMemo } from "react";
import { AlertTriangle, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeText } from "@/i18n/localizeEvent";
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
  const { language, t } = useLanguage();
  const offerAmount = offer?.amount_usd ? `$${offer.amount_usd.toFixed(2)}` : "$0.00";

  const recommendationText = useMemo(() => {
    let raw = pendingDecision?.context ?? "";
    raw = raw.replace(/^(reject_and_request_full_refund|accept_offer)\s*/i, "").trim();
    if (!raw) {
      return `${t.decision.reviewRequest} ${caseView.caseData.anomaly_type} ${t.common.confidence.toLowerCase()} ${(caseView.caseData.confidence * 100).toFixed(0)}%.`;
    }
    return localizeText(raw, language);
  }, [pendingDecision, caseView, t, language]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="mb-2 flex items-center gap-2">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-amber-500" />
            </span>
            <Badge variant="warning">{t.decision.humanLoop}</Badge>
          </div>
          <DialogTitle>{caseView.merchant.name} {t.decision.titleSuffix}</DialogTitle>
          <DialogDescription>{pendingDecision?.question ?? t.decision.paused}</DialogDescription>
        </DialogHeader>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {/* Columna Izquierda: Oferta del comercio */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-slate-50/80 p-5">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.decision.merchantOffer}</p>
              <p className="mt-2 text-lg font-bold leading-snug text-slate-950">
                {offer?.message ? localizeText(offer.message, language) : t.decision.noOffer}
              </p>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-200/80">
              <span className="text-xs text-slate-500 block">{t.decision.proposedCredit}</span>
              <span className="text-xl font-extrabold text-emerald-600">{offerAmount}</span>
            </div>
          </div>

          {/* Columna Derecha: Recomendación de la IA */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-500">{t.decision.agentRecommendation}</p>
              <div className="mt-2 max-h-56 overflow-y-auto pr-1">
                <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line">
                  {recommendationText}
                </p>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
              <span className="text-xs text-slate-500">{t.common.confidence}:</span>
              <Badge variant="slate">
                {(caseView.caseData.confidence * 100).toFixed(0)}%
              </Badge>
            </div>
          </div>
        </div>

        {decision ? (
          <div className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="size-5 text-emerald-600 shrink-0" />
              <p className="font-semibold text-emerald-900">
                {decision === "accepted" ? t.decision.accepted : t.decision.rejected}
              </p>
            </div>
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 pt-2 border-t border-slate-100">
          <Button
            disabled={isPending || Boolean(decision)}
            onClick={() => onDecision("rejected")}
            size="lg"
            variant="outline"
            className="w-full font-semibold"
          >
            {isPending ? <Sparkles className="animate-spin" /> : <AlertTriangle className="text-amber-600" />}
            {t.decision.rejectAndContinue}
          </Button>
          <Button
            disabled={isPending || Boolean(decision)}
            onClick={() => onDecision("accepted")}
            size="lg"
            className="w-full font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isPending ? <Sparkles className="animate-spin" /> : <ShieldCheck />}
            {t.decision.acceptOfferAmount} ({offerAmount})
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
