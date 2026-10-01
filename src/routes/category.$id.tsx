import React, { useState, useEffect, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { track } from "@/lib/track";
import { ArrowRight, Search as SearchIcon, Loader2, X, AlertCircle } from "lucide-react";
import {
  areasQuery,
  categoriesQuery,
  experienceQuery,
  providersQuery,
  getCategoryUnit,
} from "@/lib/directory";
import { ProviderCard } from "@/components/ProviderCard";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AvailabilityFilter, type AvailabilityFilterMode } from "@/components/AvailabilityFilter";
import { isProviderAvailableNow, isProviderEmergency24h } from "@/lib/working-hours";
import { ZeroSearchResults } from "@/components/ZeroSearchResults";

function CategoryErrorComponent() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col justify-between">
      <SiteHeader />
      <main className="mx-auto w-full max-w-md p-6 text-center space-y-4">
        <div className="mx-auto grid size-12 place-items-center rounded-2xl bg-destructive/10 text-destructive">
          <AlertCircle className="size-6" />
        </div>
        <h1 className="text-xl font-extrabold">تعذر تحميل بيانات الخدمة</h1>
        <p className="text-sm text-muted-foreground">
          ربما تم تغيير معرف الخدمة أو حدث خطأ أثناء التحميل.
        </p>
        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-primary-foreground hover:bg-primary/90 transition-all"
        >
          <ArrowRight className="size-3.5" />
          <span>الرجوع للرئيسية</span>
        </Link>
      </main>
      <SiteFooter />
    </div>
  );
}

export const Route = createFileRoute("/category/$id")({
  head: () => ({
    meta: [
      { title: "خدمة — أهل الصنعة" },
      { name: "description", content: "قائمة العمال والمهنيين المتاحين في هذه الخدمة داخل قريتك." },
      { property: "og:title", content: "خدمة — أهل الصنعة" },
      { property: "og:description", content: "قائمة العمال والمهنيين المتاحين في هذه الخدمة." },
    ],
  }),
  errorComponent: CategoryErrorComponent,
  component: CategoryPage,
});

function CategoryPage() {
  const { id } = Route.useParams();

  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [area, setArea] = useState("");
  const [exp, setExp] = useState("");
  const [filterMode, setFilterMode] = useState<AvailabilityFilterMode>("all");

  // Inlined safe debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQ(q);
    }, 350);
    return () => clearTimeout(timer);
  }, [q]);

  const experience = useQuery(experienceQuery);
  const categories = useQuery(categoriesQuery);
  const areas = useQuery(areasQuery);

  useEffect(() => {
    if (id) {
      track("category_view", { category_id: id });
    }
  }, [id]);

  const results = useQuery(
    providersQuery({
      categoryId: id || undefined,
      search: debouncedQ || undefined,
      areaId: area || undefined,
      experienceId: exp || undefined,
    })
  );

  const category = useMemo(() => {
    return (categories.data ?? []).find((c) => c.id === id);
  }, [categories.data, id]);

  const isDebouncing = q !== debouncedQ;
  const isSearching = isDebouncing || results.isFetching;

  const counts = useMemo(() => {
    const list = results.data ?? [];
    return {
      all: list.length,
      availableNow: list.filter((p) => isProviderAvailableNow(p.working_hours)).length,
      emergencyNow: list.filter((p) => isProviderEmergency24h(p.working_hours)).length,
    };
  }, [results.data]);

  const filteredProviders = useMemo(() => {
    const list = results.data ?? [];
    if (filterMode === "available_now") {
      return list.filter((p) => isProviderAvailableNow(p.working_hours));
    }
    if (filterMode === "emergency_now") {
      return list.filter((p) => isProviderEmergency24h(p.working_hours));
    }
    return list;
  }, [results.data, filterMode]);

  return (
    <div className="min-h-screen bg-background pb-12 text-foreground">
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl px-4 pt-5">
        <Link
          to="/"
          className="mb-3 inline-flex items-center gap-1.5 text-sm font-bold text-primary hover:underline"
        >
          <ArrowRight className="size-4" /> الرئيسية
        </Link>

        <h1 className="text-2xl font-extrabold">{category?.name ?? "الخدمة"}</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          {results.data
            ? `${filteredProviders.length} ${getCategoryUnit(category?.name ?? "", category?.unit_title)} معروض`
            : "جاري التحميل…"}
        </p>

        <div className="surface mb-3 flex items-center gap-3 px-4 py-3.5 rounded-2xl border border-border">
          {isSearching ? (
            <Loader2 className="size-5 shrink-0 animate-spin text-primary" />
          ) : (
            <SearchIcon className="size-5 shrink-0 text-muted-foreground" />
          )}
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            maxLength={60}
            className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
            placeholder="ابحث داخل الخدمة"
          />
          {q.trim() && (
            <button
              type="button"
              onClick={() => setQ("")}
              className="text-muted-foreground hover:text-foreground p-0.5"
              aria-label="مسح البحث"
            >
              <X className="size-4" />
            </button>
          )}
        </div>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <div className="surface px-4 py-2.5 rounded-2xl border border-border">
            <select
              value={area}
              onChange={(e) => setArea(e.target.value)}
              className="w-full bg-transparent py-1 text-base outline-none"
            >
              <option value="">كل القرى والمناطق</option>
              {(areas.data ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="surface px-4 py-2.5 rounded-2xl border border-border">
            <select
              value={exp}
              onChange={(e) => setExp(e.target.value)}
              className="w-full bg-transparent py-1 text-base outline-none"
            >
              <option value="">أي خبرة</option>
              {(experience.data ?? []).map((x) => (
                <option key={x.id} value={x.id}>
                  {x.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Availability / Emergency Filters */}
        <div className="mb-5">
          <AvailabilityFilter
            currentMode={filterMode}
            onModeChange={setFilterMode}
            counts={counts}
          />
        </div>

        {results.isLoading ? (
          <div className="py-12 text-center text-muted-foreground">
            <Loader2 className="mx-auto size-6 animate-spin text-primary mb-2" />
            <p className="text-sm font-bold">جاري البحث عن العمال والمهنيين…</p>
          </div>
        ) : filteredProviders.length === 0 ? (
          <ZeroSearchResults
            query={debouncedQ}
            areaId={area}
            filterMode={filterMode}
            onClearArea={() => setArea("")}
            onClearFilter={() => setFilterMode("all")}
            onClearQuery={() => setQ("")}
            categories={categories.data ?? []}
            areas={areas.data ?? []}
          />
        ) : (
          <div className="space-y-3">
            {filteredProviders.map((p) => (
              <ProviderCard key={p.id} provider={p} />
            ))}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
