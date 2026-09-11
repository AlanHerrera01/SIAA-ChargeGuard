import type { LucideIcon } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type MetricCardProps = {
  title: string;
  value: string;
  detail: string;
  icon: LucideIcon;
  tone?: "emerald" | "amber" | "blue" | "slate";
};

const toneMap = {
  emerald: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  blue: "bg-blue-50 text-blue-700",
  slate: "bg-slate-100 text-slate-700",
};

export function MetricCard({ title, value, detail, icon: Icon, tone = "slate" }: MetricCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <CardTitle className="text-xs text-slate-500 sm:text-sm">{title}</CardTitle>
        <div className={`flex size-8 shrink-0 items-center justify-center rounded-md sm:size-9 ${toneMap[tone]}`}>
          <Icon className="size-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-extrabold tracking-normal text-slate-950 sm:text-3xl">{value}</div>
        <p className="mt-2 text-xs text-slate-500 sm:text-sm">{detail}</p>
      </CardContent>
    </Card>
  );
}
