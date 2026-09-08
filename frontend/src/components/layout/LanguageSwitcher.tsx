import type { Language } from "@/i18n/translations";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

const options: Array<{ value: Language; label: string }> = [
  { value: "es", label: "ES" },
  { value: "en", label: "EN" },
];

export function LanguageSwitcher() {
  const { language, setLanguage } = useLanguage();

  return (
    <div className="flex rounded-md border border-slate-200 bg-slate-50 p-1">
      {options.map((option) => (
        <Button
          className={cn("h-8 px-3 text-xs", language === option.value && "bg-slate-900 text-white hover:bg-slate-900")}
          key={option.value}
          onClick={() => setLanguage(option.value)}
          size="sm"
          variant={language === option.value ? "secondary" : "ghost"}
        >
          {option.label}
        </Button>
      ))}
    </div>
  );
}
