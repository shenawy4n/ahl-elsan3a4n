import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Search, MapPin, ChevronDown, Lightbulb, UserPlus, Zap } from "lucide-react";
import { toast } from "sonner";
import { submitPublicForm, publicFormError } from "@/lib/public-forms.functions";
import {
  categoriesQuery,
  areasQuery,
  settingsQuery,
  homepageDataQuery,
  getCategoryUnit,
} from "@/lib/directory";
import { ProviderCard } from "@/components/ProviderCard";
import { CategoryIcon } from "@/components/CategoryIcon";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const Route = createFileRoute("/")({
  loader: async ({ context }) => {
    try {
      const data = await context.queryClient.ensureQueryData(homepageDataQuery);
      if (data) {
        if (data.categories) context.queryClient.setQueryData(categoriesQuery.queryKey, data.categories);
        if (data.areas) context.queryClient.setQueryData(areasQuery.queryKey, data.areas);
        if (data.settings) context.queryClient.setQueryData(settingsQuery.queryKey, data.settings);
      }
    } catch {
      // Loader error must not crash the page: catch and fall through
    }
  },
  head: () => ({
    meta: [
      { title: "أهل الصنعة — صنايعية وخدمات قريتك" },
      {
        name: "description",
        content:
          "دليل بسيط لأرقام الخدمات والصنايعية في القرية: كهربائي، سباك، نجار وغيرهم. اتصل أو كلّمهم على واتساب مباشرة.",
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
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [areaId, setAreaId] = useState("");

  // Consolidated single query for homepage data
  const { data: homeData, isLoading } = useQuery(homepageDataQuery);

  // Synchronize React Query cache for subcomponents
  useEffect(() => {
    if (homeData) {
      if (homeData.categories) queryClient.setQueryData(categoriesQuery.queryKey, homeData.categories);
      if (homeData.areas) queryClient.setQueryData(areasQuery.queryKey, homeData.areas);
      if (homeData.settings) queryClient.setQueryData(settingsQuery.queryKey, homeData.settings);
    }
  }, [homeData, queryClient]);

  const categories = homeData?.categories ?? [];
  const areas = homeData?.areas ?? [];
  const catCounts = homeData?.category_counts ?? {};
  const ratings = homeData?.ratings ?? {};

  // Sort areas alphabetically in Arabic
  const sortedAreas = [...areas].sort((a, b) => a.name.localeCompare(b.name, "ar"));

  // Village persistence in localStorage (read after mount)
  useEffect(() => {
    try {
      const stored = localStorage.getItem("ahl_village");
      if (stored && areas.length > 0) {
        const exists = areas.some((a) => a.id === stored);
        if (exists) {
          setAreaId(stored);
        }
      }
    } catch {
      // Ignore read errors
    }
  }, [areas]);

  const handleAreaChange = (newAreaId: string) => {
    setAreaId(newAreaId);
    try {
      if (newAreaId) {
        localStorage.setItem("ahl_village", newAreaId);
      } else {
        localStorage.removeItem("ahl_village");
      }
    } catch {
      // Ignore write errors
    }
  };

  const featured = (homeData?.featured_providers ?? []).filter((p) =>
    areaId ? p.area_id === areaId : true
  );

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
          <h1 className="text-3xl sm:text-4xl font-extrabold text-foreground tracking-tight">
            محتاج خدمة في قريتك؟
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            كل أرقام الصنايعية والخدمات في مكان واحد. اتصل أو كلّمه واتساب مباشرة.
          </p>

          {/* Compact Search & Village Selector Row (48px high, gap-2) */}
          <form onSubmit={submit} className="mt-4 flex items-center gap-2">
            {/* Search Field (flex-1) */}
            <div className="surface flex-1 min-w-0 flex items-center h-12 rounded-2xl border border-border px-3 focus-within:border-primary transition-all">
              <Search className="size-5 shrink-0 text-muted-foreground ml-2" />
              <input
                type="search"
                inputMode="search"
                enterKeyHint="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                maxLength={60}
                className="w-full min-w-0 bg-transparent text-[15px] sm:text-base outline-none placeholder:text-[15px] placeholder:text-muted-foreground text-foreground"
                placeholder="ابحث عن خدمة أو اسم"
              />
              <button
                type="submit"
                aria-label="بحث"
                className="grid size-10 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground hover:brightness-105 active:scale-95 transition-all shadow-xs mr-0.5"
              >
                <Search className="size-4.5" />
              </button>
            </div>

            {/* Village Selector (native select styled as button) */}
            <div className="relative h-12 min-w-[7.5rem] max-w-[42%] shrink-0">
              <MapPin className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 size-4 text-primary shrink-0 z-10" />
              <select
                value={areaId}
                onChange={(e) => handleAreaChange(e.target.value)}
                aria-label="اختر القرية"
                className="surface h-12 w-full appearance-none rounded-2xl border border-border bg-card pr-8.5 pl-7 text-[15px] font-bold text-foreground outline-none focus:border-primary truncate cursor-pointer transition-all shadow-xs"
              >
                <option value="">كل القرى</option>
                {sortedAreas.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground shrink-0 z-10" />
            </div>
          </form>

          {/* Quick Filter Badges */}
          <div className="mt-3 flex flex-wrap items-center justify-center gap-2.5">
            <Link
              to="/search"
              search={{ filter: "available_now", area: areaId || undefined }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-success/30 bg-success/10 px-4 py-2 text-sm font-extrabold text-success hover:bg-success/20 transition-all"
            >
              <span className="size-2 rounded-full bg-success inline-block shrink-0" />
              <span>متاح الآن فقط</span>
            </Link>

            <Link
              to="/search"
              search={{ filter: "emergency_now", area: areaId || undefined }}
              className="inline-flex min-h-[48px] items-center gap-2 rounded-full border border-warning/30 bg-warning/10 px-4 py-2 text-sm font-extrabold text-warning hover:bg-warning/20 transition-all"
            >
              <Zap className="size-4 fill-current shrink-0" />
              <span>خدمة طوارئ ٢٤ ساعة</span>
            </Link>
          </div>
        </section>

        {/* Categories Section - positioned directly below search & filters */}
        <section className="pt-8">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg sm:text-xl font-extrabold text-foreground">الأقسام والخدمات</h2>
            <span className="text-[15px] font-bold text-muted-foreground">
              {categories.length} خدمة متوفرة
            </span>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 sm:gap-2.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="surface h-32 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6 sm:gap-2.5">
              {categories.map((c) => {
                const count = catCounts[c.id] ?? 0;
                const unit = getCategoryUnit(c.name, c.unit_title);
                return (
                  <Link
                    key={c.id}
                    to="/category/$id"
                    params={{ id: c.id }}
                    className="surface group relative flex flex-col items-center justify-between p-2.5 sm:p-3 text-center active:scale-[0.98] hover:border-primary/50 hover:shadow-xs transition-all rounded-2xl min-h-[140px]"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary transition-transform group-hover:scale-110">
                      <CategoryIcon name={c.icon} className="size-5" />
                    </span>
                    <span className="text-sm sm:text-base font-extrabold leading-tight text-foreground line-clamp-2 min-h-[2.5rem] flex items-center justify-center w-full mt-1 px-0.5">
                      {c.name}
                    </span>
                    <span className="text-[15px] font-bold text-muted-foreground group-hover:text-primary transition-colors flex items-center justify-center gap-1.5 mt-1">
                      {count > 0 ? (
                        <>
                          <span className="size-2 rounded-full bg-success inline-block shrink-0" />
                          <span>{count} {unit}</span>
                        </>
                      ) : (
                        <span className="text-muted-foreground/70 font-normal">قريباً</span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Featured Providers Section */}
        {featured.length > 0 ? (
          <section className="pt-8">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg sm:text-xl font-extrabold text-foreground">صنايعية مميزين وموثقين</h2>
              <Link to="/search" className="text-[15px] font-bold text-primary hover:underline">
                عرض الكل
              </Link>
            </div>
            <div className="space-y-3">
              {featured.map((p) => (
                <ProviderCard key={p.id} provider={p} ratingSummary={ratings[p.id]} />
              ))}
            </div>
          </section>
        ) : null}

        {/* Single Merged Join & Suggest Card */}
        <CommunityActionsCard categories={categories} areas={areas} />
      </main>

      <SiteFooter />
    </div>
  );
}

function CommunityActionsCard({
  categories,
  areas,
}: {
  categories: { id: string; name: string }[];
  areas: { id: string; name: string }[];
}) {
  const [activeTab, setActiveTab] = useState<"nominate" | "suggest" | null>(null);

  // Suggest state
  const [suggestName, setSuggestName] = useState("");
  const [suggestHp, setSuggestHp] = useState("");
  const [suggestBusy, setSuggestBusy] = useState(false);

  async function sendSuggest(e: React.FormEvent) {
    e.preventDefault();
    const v = suggestName.trim();
    if (v.length < 2) return;
    setSuggestBusy(true);
    const res = await submitPublicForm({
      data: { form: "service_suggestion", name: v.slice(0, 60), website: suggestHp },
    }).catch(() => ({ ok: false as const, code: "error" as const }));
    setSuggestBusy(false);
    if (!res.ok) {
      toast.error(publicFormError(res.code));
      return;
    }
    toast.success("شكراً! تم استلام اقتراحك وسنعمل على توفيره");
    setSuggestName("");
    setActiveTab(null);
  }

  return (
    <section className="surface mt-8 overflow-hidden rounded-2xl border border-border p-4 sm:p-6 shadow-xs transition-all">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-lg sm:text-xl font-extrabold text-foreground">
            تعرف حد شاطر بيقدّم خدمة؟
          </h3>
          <p className="mt-1 text-[15px] text-muted-foreground">
            رشّح صنايعي موثوق لقريتك أو اقترح مهنة جديدة غير متوفرة في الدليل.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab((prev) => (prev === "nominate" ? null : "nominate"))}
            className={`min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-base font-extrabold transition-all shadow-xs ${
              activeTab === "nominate"
                ? "bg-secondary text-foreground border border-border"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
            }`}
          >
            <UserPlus className="size-5" />
            <span>{activeTab === "nominate" ? "إغلاق الترشيح" : "رشّح صنايعي"}</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab((prev) => (prev === "suggest" ? null : "suggest"))}
            className={`min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl px-5 py-2.5 text-base font-extrabold transition-all shadow-xs ${
              activeTab === "suggest"
                ? "bg-secondary text-foreground border border-border"
                : "border border-border bg-card text-foreground hover:bg-secondary"
            }`}
          >
            <Lightbulb className="size-5 text-warning" />
            <span>{activeTab === "suggest" ? "إغلاق الاقتراح" : "اقترح خدمة"}</span>
          </button>
        </div>
      </div>

      {activeTab === "nominate" && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-base font-extrabold text-foreground">بيانات الصنايعي المرشح للإضافة</h4>
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="text-[15px] font-bold text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
          </div>
          <NominateForm
            categories={categories}
            areas={areas}
            onSuccess={() => setActiveTab(null)}
            onCancel={() => setActiveTab(null)}
          />
        </div>
      )}

      {activeTab === "suggest" && (
        <div className="mt-6 border-t border-border pt-5">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-base font-extrabold text-foreground">اقترح مهنة أو خدمة غير متوفرة في الدليل</h4>
            <button
              type="button"
              onClick={() => setActiveTab(null)}
              className="text-[15px] font-bold text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </button>
          </div>
          <form onSubmit={sendSuggest} className="grid gap-3">
            <input
              value={suggestHp}
              onChange={(e) => setSuggestHp(e.target.value)}
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              className="hidden"
            />
            <input
              value={suggestName}
              onChange={(e) => setSuggestName(e.target.value)}
              maxLength={60}
              placeholder="مثال: تصليح غسالات، دكتور أطفال، كهربائي منازل..."
              className="min-h-[48px] rounded-xl border border-border bg-card px-3.5 py-2.5 text-[15px] sm:text-base text-foreground placeholder:text-[15px] placeholder:text-muted-foreground outline-none focus:border-primary"
              required
            />
            <div className="flex gap-2.5">
              <button
                disabled={suggestBusy}
                className="min-h-[48px] flex-1 rounded-xl bg-primary px-5 py-2.5 text-base font-extrabold text-primary-foreground disabled:opacity-60 shadow-xs hover:bg-primary/90 transition-all"
              >
                {suggestBusy ? "جاري الإرسال..." : "إرسال الاقتراح"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab(null)}
                className="min-h-[48px] rounded-xl border border-border px-5 py-2.5 text-base font-bold hover:bg-secondary transition-colors"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
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

  const cls = "min-h-[48px] rounded-xl border border-border bg-card px-3.5 py-2.5 text-[15px] sm:text-base text-foreground outline-none focus:border-primary placeholder:text-[15px] placeholder:text-muted-foreground";

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
    <form onSubmit={send} className="grid gap-3">
      <input
        value={hp}
        onChange={(e) => setHp(e.target.value)}
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="hidden"
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <input
          value={f.name}
          onChange={set("name")}
          maxLength={80}
          placeholder="اسم الصنايعي أو الورشة *"
          className={cls}
          required
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
        />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        <input
          value={f.whatsapp}
          onChange={set("whatsapp")}
          maxLength={30}
          inputMode="tel"
          placeholder="واتساب (اختياري)"
          dir="ltr"
          className={cls}
        />
        <select
          value={f.category_id}
          onChange={set("category_id")}
          className={cls}
          required
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
      />
      <textarea
        value={f.description}
        onChange={set("description")}
        maxLength={500}
        rows={2}
        placeholder="نبذة أو ملاحظات إضافية (اختياري)"
        className={cls}
      />
      <div className="flex items-center gap-2.5 pt-1">
        <button
          disabled={busy}
          className="min-h-[48px] flex-1 rounded-xl bg-primary px-5 py-2.5 text-base font-extrabold text-primary-foreground disabled:opacity-60 shadow-xs hover:bg-primary/90 transition-all"
        >
          {busy ? "جاري الإرسال..." : "إرسال بيانات الترشيح"}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="min-h-[48px] rounded-xl border border-border px-5 py-2.5 text-base font-bold hover:bg-secondary transition-colors"
          >
            إلغاء
          </button>
        )}
      </div>
    </form>
  );
}
