import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "@/config/env";
import { getActiveCases, getCaseViewModels, getRuntimeMetrics, getSubscriptionViewModels } from "@/lib/chargeguardSelectors";
import { chargeguardData } from "@/mocks/chargeguardData";
import { AppRoutes } from "@/routes/AppRoutes";
import { adaptBackendData } from "@/services/backendDataAdapter";
import { backendApi } from "@/services/chargeguardApi";
import type { BackendCase, CaseStepName, ChargeGuardData } from "@/types/chargeguard";

/** Safety valve: a case never needs more advances than this to settle. */
const MAX_ADVANCES = 40;
/** How long to wait before asking the merchant again while it reviews. */
const MERCHANT_RETRY_MS = 1000;

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function App() {
  const navigate = useNavigate();
  const [data, setData] = useState<ChargeGuardData>(chargeguardData);
  const [isLoadingData, setIsLoadingData] = useState(env.dataSource === "api");
  const [apiError, setApiError] = useState<string | null>(null);
  const [simulatedAnomalySubscriptionIds, setSimulatedAnomalySubscriptionIds] = useState<string[]>([]);
  const [generatedCaseId, setGeneratedCaseId] = useState<string | null>(null);
  const [liveCase, setLiveCase] = useState<BackendCase | null>(null);
  const [liveStep, setLiveStep] = useState<CaseStepName | null>(null);
  const runningCaseId = useRef<string | null>(null);

  const loadBackendData = useCallback(async () => {
    if (env.dataSource !== "api") return;

    setIsLoadingData(true);

    try {
      const [merchants, subscriptions, transactions, caseList] = await Promise.all([
        backendApi.getMerchants(),
        backendApi.getSubscriptions(),
        backendApi.getTransactions(),
        backendApi.getCases(),
      ]);
      const cases = await Promise.all(caseList.items.map((caseSummary) => backendApi.getCase(caseSummary.case_id)));

      setData(adaptBackendData({ merchants, subscriptions, transactions, cases }));
      // Only a successful load clears the banner, so a stale failure never
      // keeps the header stuck on "Mock (API down)".
      setApiError(null);
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

  /**
   * Drive one case forward, one agent step per request.
   *
   * This lives in App (not in the dispute page) so the case keeps advancing
   * no matter which screen the user is on. Each request is short, which is
   * also what keeps it under the API Gateway timeout.
   */
  const runCase = useCallback(
    async (caseId: string) => {
      runningCaseId.current = caseId;
      setLiveStep("analyze");

      try {
        for (let attempt = 0; attempt < MAX_ADVANCES; attempt += 1) {
          if (runningCaseId.current !== caseId) return;

          const progress = await backendApi.advanceCase(caseId);
          setLiveCase(progress.case);
          setLiveStep(progress.done ? null : progress.next_step);

          if (progress.done) break;
          if (progress.retry) await wait(MERCHANT_RETRY_MS);
        }
      } catch (error) {
        setApiError(error instanceof Error ? error.message : "Case analysis failed");
      } finally {
        if (runningCaseId.current === caseId) {
          runningCaseId.current = null;
          setLiveStep(null);
        }
        await loadBackendData();
      }
    },
    [loadBackendData],
  );

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

    if (env.dataSource !== "api") return;

    const latestTransaction = data.transactions
      .filter((transaction) => transaction.subscription_id === id)
      .sort((left, right) => right.posted_at.localeCompare(left.posted_at))[0];

    if (!latestTransaction) return;

    try {
      // Creating the case is instant: no agent has run yet. We navigate
      // straight to it so the user watches the timeline fill up live.
      const started = await backendApi.startCase(latestTransaction.transaction_id);

      setGeneratedCaseId(started.case_id);
      setLiveCase(started);
      await loadBackendData();
      navigate(`/disputes/${started.case_id}`);

      void runCase(started.case_id);
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Case analysis failed");
    }
  }

  return (
<<<<<<< Updated upstream
    <>
      <AppRoutes
        activeCaseId={primaryCaseId}
        activeCases={activeCases}
        activity={apiError ? [{ id: "api_error", message: apiError, timestamp: new Date().toISOString() }, ...data.activity] : data.activity}
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
=======
    <AppRoutes
      activeCaseId={primaryCaseId}
      activeCases={activeCases}
      activity={apiError ? [{ id: "api_error", message: apiError, timestamp: new Date().toISOString() }, ...data.activity] : data.activity}
      apiError={apiError}
      caseViewModels={caseViewModels}
      isLoadingData={isLoadingData}
      liveCase={liveCase}
      liveStep={liveStep}
      metrics={metrics}
      onDecisionResolved={loadBackendData}
      onSimulateIncrease={handleSimulateIncrease}
      subscriptions={subscriptions}
    />
>>>>>>> Stashed changes
  );
}

export default App;
