import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";

export type SubscriptionFilter = "all" | "in_dispute" | "healthy";

type SubscriptionFiltersProps = {
  value: SubscriptionFilter;
  onChange: (value: SubscriptionFilter) => void;
};

export function SubscriptionFilters({ value, onChange }: SubscriptionFiltersProps) {
  const { t } = useLanguage();
  const filters: Array<{ value: SubscriptionFilter; label: string }> = [
    { value: "all", label: t.subscriptions.all },
    { value: "in_dispute", label: t.subscriptions.inDispute },
    { value: "healthy", label: t.subscriptions.healthy },
  ];

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map((filter) => (
        <Button
          key={filter.value}
          onClick={() => onChange(filter.value)}
          size="sm"
          variant={value === filter.value ? "secondary" : "outline"}
        >
          {filter.label}
        </Button>
      ))}
    </div>
  );
}
