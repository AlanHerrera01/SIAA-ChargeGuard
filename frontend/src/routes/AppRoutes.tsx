import type React from "react";
import { Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoadingView } from "@/components/shared/LoadingView";
import { useRouteLoading } from "@/hooks/useRouteLoading";
import { Dashboard } from "@/pages/Dashboard";
import { DisputeDetail } from "@/pages/DisputeDetail";
import { Subscriptions } from "@/pages/Subscriptions";
import type { ActivityLog, BackendCase, Case, CaseStepName, CaseViewModel, Metrics, SubscriptionViewModel } from "@/types/chargeguard";

type AppRoutesProps = {
  activeCaseId?: string | null;
  metrics: Metrics;
  subscriptions: SubscriptionViewModel[];
  caseViewModels: CaseViewModel[];
  activeCases: Case[];
  activity: ActivityLog[];
  isLoadingData: boolean;
<<<<<<< Updated upstream
=======
  apiError?: string | null;
  liveCase?: BackendCase | null;
  liveStep?: CaseStepName | null;
>>>>>>> Stashed changes
  onSimulateIncrease: (id: string) => void | Promise<void>;
  onDecisionResolved: () => void;
};

function WithRouteLoading({ children }: { children: React.ReactNode }) {
  const isLoading = useRouteLoading(400);
  return isLoading ? <LoadingView /> : children;
}

export function AppRoutes({
  activeCaseId,
  metrics,
  subscriptions,
  caseViewModels,
  activeCases,
  activity,
  isLoadingData,
<<<<<<< Updated upstream
=======
  apiError,
  liveCase,
  liveStep,
>>>>>>> Stashed changes
  onSimulateIncrease,
  onDecisionResolved,
}: AppRoutesProps) {
  return (
    <Routes>
      <Route element={<AppLayout activeCaseId={activeCaseId} />}>
        <Route
          index
          element={
            <WithRouteLoading>
              {isLoadingData ? <LoadingView /> : <Dashboard activeCases={activeCases} activity={activity} caseViewModels={caseViewModels} metrics={metrics} />}
            </WithRouteLoading>
          }
        />
        <Route
          path="/subscriptions"
          element={
            <WithRouteLoading>
              {isLoadingData ? <LoadingView /> : <Subscriptions onSimulateIncrease={onSimulateIncrease} subscriptions={subscriptions} />}
            </WithRouteLoading>
          }
        />
        <Route
          path="/disputes"
          element={
            <WithRouteLoading>
              <DisputeDetail caseViewModels={caseViewModels} liveCase={liveCase} liveStep={liveStep} onDecisionResolved={onDecisionResolved} />
            </WithRouteLoading>
          }
        />
        <Route
          path="/disputes/:id"
          element={
            <DisputeDetail caseViewModels={caseViewModels} liveCase={liveCase} liveStep={liveStep} onDecisionResolved={onDecisionResolved} />
          }
        />
      </Route>
    </Routes>
  );
}
