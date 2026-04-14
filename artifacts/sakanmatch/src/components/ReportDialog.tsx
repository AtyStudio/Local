import { useState } from "react";
import type { ReportReason } from "@/lib/api";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetLabel: string;
  onSubmit: (payload: { reason: ReportReason; details?: string }) => Promise<void>;
  isSubmitting?: boolean;
}

const REPORT_REASONS: ReportReason[] = [
  "scam",
  "fake_listing",
  "fake_profile",
  "spam",
  "harassment",
  "unsafe",
  "other",
];

export function ReportDialog({
  open,
  onOpenChange,
  targetLabel,
  onSubmit,
  isSubmitting = false,
}: ReportDialogProps) {
  const { t } = useTranslation();
  const [reason, setReason] = useState<ReportReason>("scam");
  const [details, setDetails] = useState("");

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen && !isSubmitting) {
      setReason("scam");
      setDetails("");
    }
    onOpenChange(nextOpen);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSubmit({
      reason,
      details: details.trim() || undefined,
    });
    setReason("scam");
    setDetails("");
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl border-border p-0 overflow-hidden">
        <form onSubmit={handleSubmit}>
          <DialogHeader className="px-6 pt-6 text-left">
            <DialogTitle>{t("reports.dialogTitle", { target: targetLabel })}</DialogTitle>
            <DialogDescription>
              {t("reports.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("reports.reasonLabel")}
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as ReportReason)}
                className="w-full rounded-xl border-2 border-border bg-background px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary"
              >
                {REPORT_REASONS.map((item) => (
                  <option key={item} value={item}>
                    {t(`reports.reasons.${item}`)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-foreground mb-2">
                {t("reports.detailsLabel")}
              </label>
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={4}
                maxLength={1000}
                placeholder={t("reports.detailsPlaceholder")}
                className="w-full resize-none rounded-xl border-2 border-border bg-background px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary"
              />
            </div>
          </div>

          <DialogFooter className="px-6 pb-6">
            <button
              type="button"
              onClick={() => handleClose(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground"
              disabled={isSubmitting}
            >
              {t("common.cancel")}
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-60"
            >
              {isSubmitting ? t("reports.submitting") : t("reports.submit")}
            </button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
