import * as React from "react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/i18n/LanguageContext";
import { cn } from "@/lib/utils";

type DialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
};

function Dialog({ open, onOpenChange, children }: DialogProps) {
  const { t } = useLanguage();
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
      <div className="absolute inset-0" onClick={() => onOpenChange(false)} />
      <div className="relative z-10 w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
        {children}
        <Button
          aria-label="Close dialog"
          className="absolute right-3 top-3 h-8 px-2 text-xs"
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
  return <div className={cn("p-6", className)} {...props} />;
}

function DialogHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("pr-8", className)} {...props} />;
}

function DialogTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn("text-lg font-semibold text-slate-950", className)} {...props} />;
}

function DialogDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("mt-2 text-sm text-slate-500", className)} {...props} />;
}

export { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription };
