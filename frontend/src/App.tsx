import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { env } from "@/config/env";
import { useLanguage } from "@/i18n/LanguageContext";
import { getActiveCases, getCaseViewModels, getRuntimeMetrics, getSubscriptionViewModels } from "@/lib/chargeguardSelectors";
import { chargeguardData } from "@/mocks/chargeguardData";
import { AppRoutes } from "@/routes/AppRoutes";
import { adaptBackendData } from "@/services/backendDataAdapter";
import { backendApi } from "@/services/chargeguardApi";
import type { ChargeGuardData } from "@/types/chargeguard";

function App() {
  const navigate = useNavigate();
  const [data, setData] = useState<ChargeGuardData>(chargeguardData);
  const [isLoadingData, setIsLoadingData] = useState(env.dataSource === "api");
  const [apiError, setApiError] = useState<string | null>(null);
  const [simulatedAnomalySubscriptionIds, setSimulatedAnomalySubscriptionIds] = useState<string[]>([]);
  const [simulationDialogOpen, setSimulationDialogOpen] = useState(false);
  const [simulatedSubscriptionId, setSimulatedSubscriptionId] = useState<string | null>(null);
  const [generatedCaseId, setGeneratedCaseId] = useState<string | null>(null);
  const { t } = useLanguage();

  const loadBackendData = useCallback(async () => {
    if (env.dataSource !== "api") return;

    setIsLoadingData(true);
    setApiError(null);

    try {
      const [merchants, subscriptions, transactions, caseList] = await Promise.all([
        backendApi.getMerchants(),
        backendApi.getSubscriptions(),
        backendApi.getTransactions(),
        backendApi.getCases(),
      ]);
      const cases = await Promise.all(caseList.items.map((caseSummary) => backendApi.getCase(caseSummary.case_id)));

      setData(adaptBackendData({ merchants, subscriptions, transactions, cases }));
      if (cases.length > 0) {
        setGeneratedCaseId((current) => current ?? cases[0].case_id);
      }
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Backend request failed");
      setData(chargeguardData);
    } finally {
      setIsLoadingData(false);
    }
  }, []);

  useEffect(() => {
    void loadBackendData();
  }, [loadBackendData]);

  const activeCases = useMemo(() => getActiveCases(data.cases), [data.cases]);
  const caseViewModels = useMemo(() => getCaseViewModels(data), [data]);
  const subscriptions = useMemo(
    () => getSubscriptionViewModels(data, simulatedAnomalySubscriptionIds),
    [data, simulatedAnomalySubscriptionIds],
  );
  const metrics = useMemo(() => getRuntimeMetrics(data.metrics, subscriptions, activeCases), [activeCases, data.metrics, subscriptions]);

  const primaryCaseId = useMemo(() => {
    return generatedCaseId ?? caseViewModels[0]?.caseData.case_id ?? data.cases[0]?.case_id ?? null;
  }, [generatedCaseId, caseViewModels, data.cases]);

  async function handleSimulateIncrease(id: string) {
    setSimulatedAnomalySubscriptionIds((currentIds) => (currentIds.includes(id) ? currentIds : [...currentIds, id]));
    setSimulatedSubscriptionId(id);

    if (env.dataSource === "api") {
      const latestTransaction = data.transactions
        .filter((transaction) => transaction.subscription_id === id)
        .sort((left, right) => right.posted_at.localeCompare(left.posted_at))[0];

      if (latestTransaction) {
        try {
          const backendCase = await backendApi.analyzeCase(latestTransaction.transaction_id);
          setGeneratedCaseId(backendCase.case_id);
          await loadBackendData();
        } catch (error) {
          setApiError(error instanceof Error ? error.message : "Case analysis failed");
        }
      }
    }

    setSimulationDialogOpen(true);
  }

  function handleOpenGeneratedCase() {
    setSimulationDialogOpen(false);
    if (primaryCaseId) {
      navigate(`/disputes/${primaryCaseId}`);
    } else {
      navigate("/disputes");
    }
  }

  const simulatedSubscription = subscriptions.find((subscription) => subscription.subscription_id === simulatedSubscriptionId);

  return (
    <>
      <AppRoutes
        activeCaseId={primaryCaseId}
        activeCases={activeCases}
        activity={apiError ? [{ id: "api_error", message: apiError, timestamp: new Date().toISOString() }, ...data.activity] : data.activity}
        apiError={apiError}
        caseViewModels={caseViewModels}
        isLoadingData={isLoadingData}
        onDecisionResolved={loadBackendData}
        metrics={metrics}
        onSimulateIncrease={handleSimulateIncrease}
        subscriptions={subscriptions}
      />

      <Dialog open={simulationDialogOpen} onOpenChange={setSimulationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t.simulation.title}</DialogTitle>
            <DialogDescription>
              {simulatedSubscription?.merchant_name ?? t.simulation.fallbackSubscription} {t.simulation.descriptionPrefix}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row">
            <Button onClick={handleOpenGeneratedCase}>{t.simulation.viewTimeline}</Button>
            <Button onClick={() => setSimulationDialogOpen(false)} variant="outline">
              {t.app.close}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default App;
