import { useState } from "react";
import { Download, Smartphone, Share, PlusSquare, X, CheckCircle2 } from "lucide-react";
import { usePWAInstall } from "@/lib/usePWAInstall";

export function PWAInstallButton() {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already installed, show small verified indicator
  if (isInstalled) {
    return (
      <span className="hidden sm:inline-flex items-center gap-1 rounded-xl bg-success/10 border border-success/20 px-2.5 py-1 text-xs font-bold text-success">
        <CheckCircle2 className="size-3.5 text-success" />
        <span>التطبيق مثبت</span>
      </span>
    );
  }

  const handleClick = async () => {
    if (isInstallable) {
      const ok = await install();
      if (!ok) {
        setShowGuide(true);
      }
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <button
        onClick={handleClick}
        className="flex items-center gap-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 px-3 py-1.5 text-xs font-extrabold transition-all shadow-xs active:scale-95"
        title="تثبيت التطبيق على هاتفك أو جهازك"
      >
        <Smartphone className="size-3.5 shrink-0" />
        <span>تثبيت التطبيق</span>
      </button>

      {/* Modern Installation Instruction Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="relative w-full max-w-sm rounded-2xl bg-card border border-border p-5 shadow-2xl text-foreground space-y-4">
            <button
              onClick={() => setShowGuide(false)}
              className="absolute left-4 top-4 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
              aria-label="إغلاق"
            >
              <X className="size-4" />
            </button>

            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
                <Smartphone className="size-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">تثبيت تطبيق «أهل الصنعة»</h3>
                <p className="text-xs text-muted-foreground">على شاشة هاتفك للوصول السريع</p>
              </div>
            </div>

            {isIOS ? (
              <div className="space-y-3 rounded-xl bg-secondary/50 p-3.5 text-xs">
                <p className="font-bold text-primary">خطوات التثبيت على آيفون / آيباد (Safari):</p>
                <div className="flex items-start gap-2.5">
                  <div className="grid size-6 place-items-center rounded-lg bg-card border border-border text-foreground shrink-0 font-bold">
                    ١
                  </div>
                  <p>
                    اضغط على زر المشاركة <Share className="inline size-3.5 mx-0.5 text-primary" /> في شريط متصفح سفاري بالأسفل.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="grid size-6 place-items-center rounded-lg bg-card border border-border text-foreground shrink-0 font-bold">
                    ٢
                  </div>
                  <p>
                    مرر للأسفل واضغط على <strong className="text-foreground">«إضافة إلى الشاشة الرئيسية»</strong> (Add to Home Screen) <PlusSquare className="inline size-3.5 mx-0.5 text-primary" />.
                  </p>
                </div>
                <div className="flex items-start gap-2.5">
                  <div className="grid size-6 place-items-center rounded-lg bg-card border border-border text-foreground shrink-0 font-bold">
                    ٣
                  </div>
                  <p>
                    اضغط <strong className="text-foreground">«إضافة» (Add)</strong> في أعلى الشاشة وسيظهر التطبيق على هاتفك فوراً!
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl bg-secondary/50 p-3.5 text-xs">
                <p className="font-bold text-primary">خطوات التثبيت على أندرويد والمتصفحات:</p>
                <p className="text-muted-foreground leading-relaxed">
                  اضغط على خيارات المتصفح (⋮) في أعلى أو أسفل الصفحة، ثم اختر <strong className="text-foreground">«تثبيت التطبيق» (Install App)</strong> أو <strong className="text-foreground">«إضافة إلى الشاشة الرئيسية»</strong> لتثبيت أيقونة التطبيق واستخدامه في أي وقت دون فتح المتصفح.
                </p>
              </div>
            )}

            <button
              onClick={() => setShowGuide(false)}
              className="w-full rounded-xl bg-secondary hover:bg-secondary/80 py-2.5 text-xs font-bold text-foreground transition-colors"
            >
              فهمت، حسناً
            </button>
          </div>
        </div>
      )}
    </>
  );
}
