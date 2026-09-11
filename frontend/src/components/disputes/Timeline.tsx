import { useState } from "react";
import { AlertTriangle, ArrowRight, Clock, FileText, Loader2, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { localizeText } from "@/i18n/localizeEvent";
import type { CaseTimelineEvent } from "@/types/chargeguard";
import { cn } from "@/lib/utils";

const iconMap = [AlertTriangle, FileText, ShieldCheck, Clock];

type TimelineProps = {
  events: CaseTimelineEvent[];
  /** Label of the step running right now; renders a live placeholder row. */
  pendingLabel?: string | null;
};

function formatEventTime(dateStr: string, language: string): string {
  try {
    const d = new Date(dateStr);
    const locale = language === "es" ? "es-CO" : "en-US";
    return new Intl.DateTimeFormat(locale, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    })
      .format(d)
      .toLowerCase();
  } catch {
    return dateStr;
  }
}

function getEventLabel(eventKey: string, eventMap: Record<string, string>): string {
  if (eventMap[eventKey]) return eventMap[eventKey];
  return eventKey
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export function Timeline({ events, pendingLabel }: TimelineProps) {
  const [openEvent, setOpenEvent] = useState<string | null>(events[0]?.event ?? null);
  const { language, t } = useLanguage();

  return (
    <div className="relative pl-4">
      <div className="absolute left-[31px] top-6 h-[calc(100%-48px)] w-px bg-slate-200" />
      <div className="space-y-0">
        {events.map((event, index) => {
          const isLastSettled = index === events.length - 1 && !pendingLabel;
          const Icon = iconMap[index % iconMap.length] ?? AlertTriangle;
          const isOpen = openEvent === `${event.event}-${index}`;
          const eventLabel = getEventLabel(event.event, (t.dispute.events ?? {}) as Record<string, string>);
          const localizedDetail = localizeText(event.detail, language);

          return (
            <div
              className="relative flex animate-in gap-4 pb-8 duration-500 fade-in slide-in-from-bottom-2 last:pb-0"
              key={`${event.event}-${event.at}-${index}`}
            >
              <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm">
                <Icon className={isLastSettled ? "size-4 text-amber-600" : "size-4 text-emerald-600"} />
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {index + 1}. {eventLabel}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600 whitespace-pre-line">{localizedDetail}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {formatEventTime(event.at, language)}
                  </span>
                </div>
                <div className="mt-4">
                  <Button
                    onClick={() => setOpenEvent(isOpen ? null : `${event.event}-${index}`)}
                    size="sm"
                    variant="ghost"
                  >
                    <ArrowRight className={cn("transition-transform", isOpen && "rotate-90")} />
                    {t.dispute.agentLogs}
                  </Button>
                  {isOpen ? (
                    <div className="mt-3 rounded-md border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">{t.dispute.trace}</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-100 whitespace-pre-line">
                        actor={event.actor}; at={event.at}; event={event.event}; detail={localizedDetail}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}

        {pendingLabel ? (
          <div className="relative flex animate-in gap-4 pb-8 duration-500 fade-in last:pb-0">
            <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-amber-300 bg-amber-50 shadow-sm">
              <Loader2 className="size-4 animate-spin text-amber-600" />
            </div>
            <div className="min-w-0 flex-1 rounded-lg border border-dashed border-amber-300 bg-amber-50/60 p-4">
              <p className="font-semibold text-amber-900">
                {events.length + 1}. {pendingLabel}
              </p>
              <p className="mt-1 text-sm leading-6 text-amber-700">{t.dispute.stepRunning}</p>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
