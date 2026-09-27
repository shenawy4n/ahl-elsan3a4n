import { useState } from "react";
import { toast } from "sonner";
import { Share2 } from "lucide-react";
import { callProvider, revealProvider, whatsappProvider, shareProviderViaWhatsapp } from "@/lib/contact";

export interface ProviderShareInfo {
  name: string;
  categoryName?: string | null | undefined;
  areaName?: string | null | undefined;
  isEmergency24h?: boolean | undefined;
}

export function ContactButtons({
  providerId,
  hasWhatsapp,
  big = false,
  providerInfo,
}: {
  providerId: string;
  hasWhatsapp: boolean;
  big?: boolean;
  providerInfo?: ProviderShareInfo;
}) {
  const [revealed, setRevealed] = useState<{ phone: string | null; secondary_phone: string | null } | null>(null);
  const [busy, setBusy] = useState(false);
  const [noPhone, setNoPhone] = useState(false);
  const h = big ? "min-h-14 text-lg" : "min-h-13 text-base";

  async function run(fn: () => Promise<unknown>, isPhone = true) {
    if (busy) return;
    setBusy(true);
    try {
      await fn();
    } catch {
      if (isPhone) setNoPhone(true);
      toast.error(isPhone ? "رقم الهاتف غير متاح حالياً" : "واتساب غير متاح حالياً");
    } finally {
      setBusy(false);
    }
  }

  async function handleShare() {
    if (busy) return;
    setBusy(true);
    try {
      await shareProviderViaWhatsapp({
        id: providerId,
        name: providerInfo?.name || "صنايعي",
        categoryName: providerInfo?.categoryName,
        areaName: providerInfo?.areaName,
        isEmergency24h: providerInfo?.isEmergency24h,
      });
    } catch {
      toast.error("تعذر تجهيز رابط المشاركة");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className={`grid gap-2.5 ${hasWhatsapp ? "grid-cols-2" : "grid-cols-1"}`}>
        <button
          type="button"
          disabled={busy || noPhone}
          onClick={() => run(() => callProvider(providerId))}
          className={`flex ${h} items-center justify-center gap-2 rounded-xl bg-primary py-3.5 font-extrabold text-primary-foreground active:brightness-95 disabled:opacity-60`}
        >
          {busy ? "جاري الاتصال..." : "📞 اتصال"}
        </button>
        {hasWhatsapp ? (
          <button
            type="button"
            disabled={busy}
            onClick={() => run(() => whatsappProvider(providerId), false)}
            className={`flex ${h} items-center justify-center gap-2 rounded-xl bg-whatsapp py-3.5 font-extrabold text-whatsapp-foreground active:brightness-95 disabled:opacity-60`}
          >
            💬 WhatsApp
          </button>
        ) : null}
      </div>

      {noPhone ? (
        <p className="text-center text-sm font-bold text-destructive">رقم الهاتف غير متاح حالياً</p>
      ) : revealed ? (
        <p dir="ltr" className="select-all rounded-xl border border-border bg-secondary py-2.5 text-center text-lg font-extrabold text-secondary-foreground">
          {revealed.phone}{revealed.secondary_phone ? ` · ${revealed.secondary_phone}` : ""}
        </p>
      ) : (
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            disabled={busy}
            onClick={() => run(async () => { setRevealed(await revealProvider(providerId)); })}
            className="min-h-10 py-1 text-sm font-bold text-primary underline-offset-4 hover:underline"
          >
            إظهار الرقم
          </button>

          <button
            type="button"
            disabled={busy}
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 rounded-lg border border-whatsapp/30 bg-whatsapp/10 px-3 py-1.5 text-xs font-extrabold text-whatsapp hover:bg-whatsapp/15 active:brightness-95 transition-colors"
          >
            <Share2 className="size-3.5" /> مشاركة عبر واتساب
          </button>
        </div>
      )}
    </div>
  );
}
