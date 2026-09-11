import * as React from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  className?: string;
  children: React.ReactNode;
};

function Dialog({ open, onOpenChange, className, children }: DialogProps) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 sm:p-6 backdrop-blur-xs">
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          "relative z-10 flex max-h-[90vh] w-full max-w-3xl flex-col rounded-xl border border-slate-200 bg-white shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200",
          className,
        )}
      >
        {children}
        <Button
          aria-label="Close dialog"
          className="absolute right-3 top-3 z-20 h-8 px-2.5 text-xs text-slate-500 hover:text-slate-900"
          size="sm"
          variant="ghost"
          onClick={() => onOpenChange(false)}
        >
          {t.app.close}
        </Button>
      </div>
    </div>
  );
}

function DialogContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-1 flex-col overflow-y-auto p-6 sm:p-7", className)} {...props} />;
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pr-12", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-xl font-bold tracking-tight text-slate-950", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-1.5 text-sm text-slate-500", className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
