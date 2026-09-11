import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { env } from "@/config/env";
import { getActiveCases, getCaseViewModels, getRuntimeMetrics, getSubscriptionViewModels } from "@/lib/chargeguardSelectors";
import { chargeguardData } from "@/mocks/chargeguardData";
import { AppRoutes } from "@/routes/AppRoutes";
import { adaptBackendData } from "@/services/backendDataAdapter";
import { backendApi } from "@/services/chargeguardApi";
import type { BackendCase, CaseStepName, CaseTimelineEvent, ChargeGuardData } from "@/types/chargeguard";

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

  /**
   * Stepped simulation for mock mode so rehearsals and offline demos
   * deliver the exact same interactive experience as the live AWS backend.
   */
  const runMockCase = useCallback(
    async (caseId: string) => {
      runningCaseId.current = caseId;
      const initialCase: BackendCase = {
        case_id: caseId,
        transaction: {
          transaction_id: "txn_0035",
          subscription_id: "sub_003",
          merchant_id: "mrc_spotify",
          merchant_name: "Spotify",
          amount_usd: 10.99,
          currency: "USD",
          posted_at: new Date().toISOString(),
          description: "SPOTIFY USA DUPLICATE",
        },
        status: "analyzing",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        anomaly: {
          is_anomaly: true,
          type: "DUPLICATE_CHARGE",
          confidence: 0.95,
          reason: "Se detectó un cargo duplicado: La suscripción se cobró dos veces en la misma fecha por el mismo importe ($10.99).",
          expected_amount_usd: 10.99,
          actual_amount_usd: 10.99,
          claimed_amount_usd: 10.99,
        },
        evidence: [
          {
            type: "subscription_terms",
            uri: "s3://chargeguard-evidence-demo/terms/sub_003.pdf",
            description: "Términos del contrato de Spotify y transacciones cruzadas txn_0034 y txn_0035.",
          },
        ],
        dispute: {
          dispute_id: "dsp_demo_001",
          claim_type: "duplicate_charge",
          requested_amount_usd: 10.99,
          message: "Disputa formal presentada a Spotify solicitando el reembolso de $10.99 por cargo duplicado con evidencia vinculada.",
        },
        merchant: {
          status: "submitted",
          offer: null,
          resolution: null,
        },
        decision: {
          required: false,
          recommendation: null,
          reason: null,
        },
        timeline: [],
      };

      setLiveCase(initialCase);
      setLiveStep("analyze");
      navigate(`/disputes/${caseId}`);

      // Segundo ~2.5: Paso 1 - Anomalía detectada
      await wait(2500);
      if (runningCaseId.current !== caseId) return;

      const ev1: CaseTimelineEvent = {
        at: new Date().toISOString(),
        actor: "chargeguard",
        event: "anomalía_detectada",
        detail: "Se detectó un cargo duplicado: La suscripción se cobró dos veces por $10.99 el día de hoy con tan solo 8 minutos de diferencia.",
      };
      setLiveCase((prev) => (prev ? { ...prev, timeline: [ev1] } : null));
      setLiveStep("evidence");

      // Segundo ~5.0: Paso 2 - Evidencia recopilada
      await wait(2500);
      if (runningCaseId.current !== caseId) return;

      const ev2: CaseTimelineEvent = {
        at: new Date().toISOString(),
        actor: "chargeguard",
        event: "evidencia_recopilada",
        detail: "Evidencia vinculada desde s3://chargeguard-evidence-demo/terms/sub_003.pdf y transacciones cruzadas txn_0034 y txn_0035.",
      };
      setLiveCase((prev) => (prev ? { ...prev, timeline: [...prev.timeline, ev2] } : null));
      setLiveStep("dispute");

      // Segundo ~8.0: Paso 3 - Disputa presentada
      await wait(3000);
      if (runningCaseId.current !== caseId) return;

      const ev3: CaseTimelineEvent = {
        at: new Date().toISOString(),
        actor: "chargeguard",
        event: "disputa_presentada",
        detail: "Carta formal de disputa presentada a Spotify con solicitud de reembolso total por $10.99.",
      };
      setLiveCase((prev) => (prev ? { ...prev, timeline: [...prev.timeline, ev3] } : null));
      setLiveStep("merchant");

      // Segundo ~11.5: Paso 4 - Respuesta del comerciante
      await wait(3500);
      if (runningCaseId.current !== caseId) return;

      const ev4: CaseTimelineEvent = {
        at: new Date().toISOString(),
        actor: "merchant_api",
        event: "Respuesta del comerciante",
        detail: "Spotify envió contraoferta: Podemos ofrecerle un crédito de cortesía único de 6,59 dólares.",
      };
      const updatedCase: BackendCase = {
        ...initialCase,
        status: "awaiting_human",
        updated_at: new Date().toISOString(),
        merchant: {
          status: "counter_offer",
          offer: {
            amount_usd: 6.59,
            message: "Podemos ofrecerle un crédito de cortesía único de 6,59 dólares.",
            expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
          },
          resolution: null,
        },
        decision: {
          required: true,
          recommendation: "accept_offer",
          reason: "El comercio ofrece $6.59 como crédito de cortesía. El agente recomienda aceptar.",
        },
        timeline: [ev1, ev2, ev3, ev4],
      };
      setLiveCase(updatedCase);
      setLiveStep("negotiate");

      // Segundo ~13.5: Finaliza evaluación y se ilumina el banner ámbar
      await wait(1800);
      if (runningCaseId.current !== caseId) return;

      setLiveStep(null);
      runningCaseId.current = null;
    },
    [navigate],
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

    if (env.dataSource !== "api") {
      const targetCase = caseViewModels.find((cv) => cv.subscription.subscription_id === id) ?? caseViewModels[0];
      const targetCaseId = targetCase?.caseData.case_id ?? "case_003";
      setGeneratedCaseId(targetCaseId);
      void runMockCase(targetCaseId);
      return;
    }

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
  );
}

export default App;
