import { useState } from "react";
import { AlertTriangle, ArrowRight, Clock, FileText, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import type { CaseTimelineEvent } from "@/types/chargeguard";
import { cn } from "@/lib/utils";

const iconMap = [AlertTriangle, FileText, ShieldCheck, Clock];

type TimelineProps = {
  events: CaseTimelineEvent[];
};

export function Timeline({ events }: TimelineProps) {
  const [openEvent, setOpenEvent] = useState<string | null>(events[0]?.event ?? null);
  const { t } = useLanguage();

  return (
    <div className="relative pl-4">
      <div className="absolute left-[31px] top-6 h-[calc(100%-48px)] w-px bg-slate-200" />
      <div className="space-y-0">
        {events.map((event, index) => {
          const Icon = iconMap[index] ?? AlertTriangle;
          const isOpen = openEvent === event.event;

          return (
            <div className="relative flex gap-4 pb-8 last:pb-0" key={`${event.event}-${event.at}`}>
              <div className="z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white">
                <Icon className={index === events.length - 1 ? "size-4 text-amber-600" : "size-4 text-emerald-600"} />
              </div>
              <div className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">
                      {index + 1}. {event.event}
                    </p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{event.detail}</p>
                  </div>
                  <span className="text-xs font-semibold text-slate-500">
                    {new Intl.DateTimeFormat("es-CO", { hour: "2-digit", minute: "2-digit" }).format(new Date(event.at))}
                  </span>
                </div>
                <div className="mt-4">
                  <Button onClick={() => setOpenEvent(isOpen ? null : event.event)} size="sm" variant="ghost">
                    <ArrowRight className={cn("transition-transform", isOpen && "rotate-90")} />
                    {t.dispute.agentLogs}
                  </Button>
                  {isOpen ? (
                    <div className="mt-3 rounded-md border border-slate-800 bg-slate-950 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-400">{t.dispute.trace}</p>
                      <p className="mt-2 text-sm leading-6 text-emerald-100">
                        actor={event.actor}; at={event.at}; event={event.event}; detail={event.detail}
                      </p>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
