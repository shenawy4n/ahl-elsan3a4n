import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, MapPin, Lightbulb, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { submitPublicForm, publicFormError } from "@/lib/public-forms.functions";
import {
  categoriesQuery,
  areasQuery,
  providersQuery,
  categoryCountsQuery,
  getCategoryUnit,
} from "@/lib/directory";
import { ProviderCard } from "@/components/ProviderCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "أهل الصنعة — صنايعية وخدمات قريتك" },
      {
        name: "description",
        content:
          "دليل بسيط لأرقام الصنايعية وأصحاب الخدمات في القرية: كهربائي، سباك، نجار وغيرهم. اتصل أو كلّمهم على واتساب مباشرة.",
      },
      { property: "og:title", content: "أهل الصنعة — صنايعية وخدمات قريتك" },
      {
        property: "og:description",
        content: "ابحث عن صنايعي قريب منك واتصل بيه على طول.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [areaId, setAreaId] = useState("");
  const [topNominateOpen, setTopNominateOpen] = useState(false);

  const categories = useQuery(categoriesQuery);
  const areas = useQuery(areasQuery);
  const featured = useQuery(
    providersQuery({ premiumOnly: true, areaId: areaId || undefined, limit: 6 })
  );
  const catCounts = useQuery(categoryCountsQuery);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    navigate({ to: "/search", search: { q: search || undefined, area: areaId || undefined } });
  };

  return (
    <div className="min-h-screen bg-background pb-12">
      <SiteHeader />

      <main className="mx-auto w-full max-w-3xl px-4">
        {/* Hero Section */}
        <section className="pt-6">
          <h1 className="text-3xl font-extrabold text-foreground tracking-tight">محتاج صنايعي؟</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            كل أرقام الصنايعية والخدمات في مكان واحد. اتصل أو كلّمه واتساب مباشرة.
          </p>

          <form onSubmit={submit} className="mt-4 space-y-2.5" suppressHydrationWarning>
            <div className="surface flex items-center gap-3 px-4 py-3 rounded-2xl border border-border">
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={60}
                className="w-full bg-transparent text-sm sm:text-base outline-none placeholder:text-muted-foreground"
                placeholder="ابحث باسم الصنايعي أو المهنة (سباك، كهربائي...)"
                suppressHydrationWarning
              />
            </div>
            <div className="surface flex items-center gap-3 px-4 py-2.5 rounded-2xl border border-border">
              <MapPin className="size-5 shrink-0 text-primary" />
              <select
                value={areaId}
                onChange={(e) => setAreaId(e.target.value)}
                className="w-full bg-transparent py-1 text-sm sm:text-base outline-none cursor-pointer"
                suppressHydrationWarning
              >
                <option value="">كل القرى والمناطق</option>
                {(areas.data ?? []).map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="min-h-12 w-full rounded-2xl bg-accent text-base sm:text-lg font-extrabold text-accent-foreground hover:brightness-105 active:brightness-95 transition-all shadow-xs"
            >
              ابحث عن صنايعي
            </button>
          </form>

          {/* Quick Filter Badges */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            <Link
              to="/search"
              search={{ filter: "available_now", area: areaId || undefined }}
              className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3.5 py-1.5 text-xs font-extrabold text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/15 transition-all"
            >
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>متاح الآن فقط</span>
            </Link>

            <Link
              to="/search"
              search={{ filter: "emergency_now", area: areaId || undefined }}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/30 bg-amber-500/10 px-3.5 py-1.5 text-xs font-extrabold text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 transition-all"
            >
              <Zap className="size-3.5 fill-current" />
              <span>خدمة طوارئ ٢٤ ساعة</span>
            </Link>
          </div>

          {/* Top Nomination & Join Action Banner */}
          <div className="mt-4 overflow-hidden rounded-2xl border border-primary/25 bg-gradient-to-l from-primary/10 via-card to-card p-3 sm:p-4 shadow-xs transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-xs">
                  <UserPlus className="size-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-foreground truncate">تعرف صنايعي شاطر أو حابب تنضم للدليل؟</p>
                  <p className="text-xs text-muted-foreground truncate">رشّح صنايعي موثوق أو سجّل نفسك كصنايعي مجاناً في دقيقة</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setTopNominateOpen((prev) => !prev)}
                className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-xs font-extrabold text-primary-foreground hover:bg-primary/90 active:scale-95 transition-all shadow-xs"
              >
                <UserPlus className="size-4" />
                <span>{topNominateOpen ? "إغلاق نموذج الترشيح" : "رشّح صنايعي الآن"}</span>
              </button>
            </div>

            {/* Expandable Top Nomination Form */}
            {topNominateOpen && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-foreground">بيانات الصنايعي المرشح</h3>
                  <button
                    type="button"
                    onClick={() => setTopNominateOpen(false)}
                    className="text-xs font-bold text-muted-foreground hover:text-foreground"
                  >
                    إلغاء
                  </button>
                </div>
                <NominateForm
                  categories={categories.data ?? []}
                  areas={areas.data ?? []}
                  onSuccess={() => setTopNominateOpen(false)}
                  onCancel={() => setTopNominateOpen(false)}
                />
              </div>
            )}
          </div>
        </section>

        {/* Compact Services / Categories Section */}
        <section className="pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold text-foreground">الأقسام والخدمات</h2>
            <span className="text-xs font-bold text-muted-foreground">
              {categories.data?.length ?? 0} خدمة متوفرة
            </span>
          </div>

          {categories.isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 sm:gap-2.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="surface h-20 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 sm:gap-2.5">
              {(categories.data ?? []).map((c) => {
                const count = catCounts.data?.[c.id] ?? 0;
                const unit = getCategoryUnit(c.name, c.unit_title);
                return (
                  <Link
                    key={c.id}
                    to="/category/$id"
                    params={{ id: c.id }}
                    className="surface group relative flex flex-col items-center justify-center p-2.5 sm:p-3 text-center active:scale-[0.98] hover:border-primary/50 hover:shadow-xs transition-all rounded-2xl"
                  >
                    <span className="grid size-9 sm:size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                      <CategoryIcon name={c.icon} className="size-5" />
                    </span>
                    <span className="text-xs sm:text-sm font-extrabold leading-tight text-foreground truncate w-full mt-1.5">
                      {c.name}
                    </span>
                    <span className="text-[10px] sm:text-[11px] font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center justify-center gap-1 mt-0.5">
                      {count > 0 ? (
                        <>
                          <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                          <span>{count} {unit}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/60 font-normal">قريباً</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Featured Providers Section */}
        {(featured.data?.length ?? 0) > 0 ? (
          <section className="pt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground">صنايعية مميزين وموثقين</h2>
              <Link to="/search" className="text-xs font-bold text-primary hover:underline">
                عرض الكل
              </Link>
            </div>
            <div className="space-y-3">
              {featured.data!.map((p) => (
                <ProviderCard key={p.id} provider={p} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Bottom Helpers */}
        <SuggestService />
        <NominateProviderCard categories={categories.data ?? []} areas={areas.data ?? []} />
      </main>

      <SiteFooter />
    </div>
  );
}

function NominateForm({
  categories,
  areas,
  onSuccess,
  onCancel,
}: {
  categories: { id: string; name: string }[];
  areas: { id: string; name: string }[];
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const empty = {
    name: "",
    phone: "",
    whatsapp: "",
    category_id: "",
    area_id: "",
    description: "",
    services: "",
  };
  const [f, setF] = useState(empty);
  const [hp, setHp] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof empty) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => setF({ ...f, [k]: e.target.value });

  const cls = "rounded-xl border border-border bg-card px-3 py-2.5 text-sm text-foreground outline-none focus:border-primary";

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2 || !f.phone.trim() || !f.category_id || !f.area_id) {
      toast.error("يرجى ملء الاسم والتليفون والقسم والمنطقة");
      return;
    }
    setBusy(true);
    const res = await submitPublicForm({
      data: {
        form: "provider_application",
        website: hp,
        ...f,
        whatsapp: f.whatsapp || undefined,
        description: f.description || undefined,
        services: f.services || undefined,
      },
    }).catch(() => ({ ok: false as const, code: "error" as const }));
    setBusy(false);
    if (!res.ok) {
      toast.error(publicFormError(res.code));
      return;
    }
    toast.success("شكراً لك! سيتم مراجعة الطلب ونشر الصنايعي في الدليل");
    setF(empty);
    onSuccess?.();
  }

  return (
    <form onSubmit={send} className="grid gap-2.5" suppressHydrationWarning>
      <input
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
        suppressHydrationWarning
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <input
          value={f.name}
          onChange={set("name")}
          maxLength={80}
          placeholder="اسم الصنايعي أو الورشة *"
          className={cls}
          required
          suppressHydrationWarning
        />
        <input
          value={f.phone}
          onChange={set("phone")}
          maxLength={30}
          inputMode="tel"
          placeholder="رقم الهاتف الأساسي *"
          dir="ltr"
          className={cls}
          required
          suppressHydrationWarning
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <input
          value={f.whatsapp}
          onChange={set("whatsapp")}
          maxLength={30}
          inputMode="tel"
          placeholder="واتساب (اختياري)"
          dir="ltr"
          className={cls}
          suppressHydrationWarning
        />
        <select
          value={f.category_id}
          onChange={set("category_id")}
          className={cls}
          required
          suppressHydrationWarning
        >
          <option value="">اختر المهنة/القسم *</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={f.area_id}
          onChange={set("area_id")}
          className={cls}
          required
          suppressHydrationWarning
        >
          <option value="">اختر القرية/المنطقة *</option>
          {areas.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
      </div>
      <input
        value={f.services}
        onChange={set("services")}
        maxLength={300}
        placeholder="أبرز الخدمات التي يقدمها (اختياري)"
        className={cls}
        suppressHydrationWarning
      />
      <textarea
        value={f.description}
        onChange={set("description")}
        maxLength={500}
        rows={2}
        placeholder="نبذة أو ملاحظات إضافية (اختياري)"
        className={cls}
        suppressHydrationWarning
      />
      <div className="flex items-center gap-2 pt-1">
        <button
          disabled={busy}
          className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60 shadow-xs hover:bg-primary/90 transition-all"
        >
          {busy ? "جاري الإرسال..." : "إرسال بيانات الترشيح"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold hover:bg-secondary transition-colors"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}

function SuggestService() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [hp, setHp] = useState("");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const v = name.trim();
    if (v.length < 2) return;
    setBusy(true);
    const res = await submitPublicForm({
      data: { form: "service_suggestion", name: v.slice(0, 60), website: hp },
    }).catch(() => ({ ok: false as const, code: "error" as const }));
    setBusy(false);
    if (!res.ok) {
      toast.error(publicFormError(res.code));
      return;
    }
    toast.success("شكراً! تم استلام اقتراحك وسنعمل على توفيره");
    setName("");
    setOpen(false);
  }

  return (
    <section className="surface mt-8 p-4 rounded-2xl border border-border">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 py-2 font-bold text-sm text-primary hover:underline"
        >
          <Lightbulb className="size-4" /> مش لاقي الخدمة المطلوبة؟ اقترح خدمة جديدة
        </button>
      ) : (
        <form onSubmit={send} className="grid gap-2.5" suppressHydrationWarning>
          <div className="flex items-center justify-between">
            <p className="font-extrabold text-sm text-foreground">اقترح مهنة أو خدمة غير متوفرة في الدليل</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
          </div>
          <input
            value={hp}
            onChange={(e) => setHp(e.target.value)}
            name="website"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="hidden"
            suppressHydrationWarning
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={60}
            placeholder="مثال: تصليح غسالات، دكتور أطفال، كهربائي منازل..."
            className="rounded-xl border border-border bg-card px-3 py-2.5 text-sm"
            required
            suppressHydrationWarning
          />
          <div className="flex gap-2">
            <button
              disabled={busy}
              className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-extrabold text-primary-foreground disabled:opacity-60 shadow-xs"
            >
              {busy ? "جاري الإرسال..." : "إرسال الاقتراح"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-border px-4 py-2.5 text-sm font-bold"
            >
              إلغاء
            </button>
          </div>
        </form>
      )}
    </section>
  );
}

function NominateProviderCard({
  categories,
  areas,
}: {
  categories: { id: string; name: string }[];
  areas: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="surface mt-4 p-4 rounded-2xl border border-border">
      {!open ? (
        <button
          onClick={() => setOpen(true)}
          className="flex w-full items-center justify-center gap-2 py-2 font-bold text-sm text-primary hover:underline"
        >
          <UserPlus className="size-4" /> تعرف صنايعي مش مسجل؟ رشحه الآن
        </button>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between border-b border-border pb-2">
            <p className="font-extrabold text-sm text-foreground">ترشيح صنايعي للإضافة في الدليل</p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              إغلاق
            </button>
          </div>
          <NominateForm
            categories={categories}
            areas={areas}
            onSuccess={() => setOpen(false)}
            onCancel={() => setOpen(false)}
          />
        </div>
      )}
    </section>
  );
}
