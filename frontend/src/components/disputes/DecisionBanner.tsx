import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useLanguage } from "@/i18n/LanguageContext";
import type { CaseViewModel } from "@/types/chargeguard";

type DecisionBannerProps = {
  caseView: CaseViewModel;
  onReview: () => void;
};

export function DecisionBanner({ caseView, onReview }: DecisionBannerProps) {
  const { t } = useLanguage();
  const offer = caseView.merchantDispute?.offer;
  if (!offer || caseView.caseData.status !== "awaiting_human") return null;

  return (
    <Card className="border-amber-200">
      <CardHeader className="border-b border-amber-100 bg-amber-50/70">
        <div className="flex items-center gap-2">
          <span className="relative flex size-3">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-amber-400 opacity-60" />
            <span className="relative inline-flex size-3 rounded-full bg-[#F59E0B]" />
          </span>
          <Badge variant="warning">{t.dispute.humanAction}</Badge>
        </div>
        <CardTitle>{t.dispute.pendingCounterOffer}</CardTitle>
        <CardDescription>{caseView.merchant.name} {t.dispute.merchantProposal}</CardDescription>
      </CardHeader>
      <CardContent className="pt-5">
        <p className="text-sm font-semibold text-slate-500">{t.dispute.currentOffer}</p>
        <p className="mt-2 text-xl font-bold text-slate-950">{offer.message}</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {t.dispute.offerAgainstClaim} ${offer.amount_usd.toFixed(2)} {t.dispute.againstClaim} ${caseView.caseData.claimed_amount_usd.toFixed(2)}.
        </p>
        <Button className="mt-5 w-full" onClick={onReview}>
          <Sparkles />
          {t.dispute.reviewDecision}
        </Button>
      </CardContent>
    </Card>
  );
}
