import { createServerFn } from "@tanstack/react-start";
import { PUBLIC_PROVIDER_SELECT, type Category, type Area, type HomepageData, type HomepageProvider } from "./directory";

export const getHomepageDataServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<HomepageData> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // 1. Try PostgreSQL RPC get_homepage_data()
    try {
      const { data, error } = await (supabaseAdmin.rpc as any)("get_homepage_data");
      if (!error && data && typeof data === "object") {
        const raw = data as any;
        const featured: HomepageProvider[] = (raw.featured_providers ?? []) as HomepageProvider[];
        const ratings: Record<string, { average: number; count: number }> = {};
        for (const p of featured) {
          if (p.id && (p.review_count ?? 0) > 0) {
            ratings[p.id] = {
              average: Number(p.average_rating ?? 0),
              count: Number(p.review_count ?? 0),
            };
          }
        }
        return {
          settings: (raw.settings ?? {}) as Record<string, string>,
          categories: (raw.categories ?? []) as Category[],
          areas: (raw.areas ?? []) as Area[],
          category_counts: (raw.category_counts ?? {}) as Record<string, number>,
          featured_providers: featured,
          ratings,
        };
      }
    } catch {
      // Fall through to server-side query batch
    }

    // 2. Fetch using supabaseAdmin on server (secure, bypassing disabled legacy anon key)
    const [catsRes, areasRes, settingsRes, featuredRes, countsRes] = await Promise.all([
      supabaseAdmin
        .from("categories")
        .select("id,name,icon,sort_order,status")
        .eq("status", "active")
        .order("sort_order"),
      supabaseAdmin
        .from("areas")
        .select("id,name,status")
        .eq("status", "active")
        .order("name"),
      supabaseAdmin
        .from("app_settings")
        .select("key,value"),
      supabaseAdmin
        .from("providers")
        .select(PUBLIC_PROVIDER_SELECT)
        .eq("status", "active")
        .eq("is_premium", true)
        .order("created_at", { ascending: false })
        .limit(6),
      supabaseAdmin
        .from("providers")
        .select("category_id")
        .eq("status", "active"),
    ]);

    const settings: Record<string, string> = {};
    for (const s of (settingsRes.data ?? []) as { key: string; value: string }[]) {
      settings[s.key] = s.value;
    }

    const category_counts: Record<string, number> = {};
    for (const r of (countsRes.data ?? []) as { category_id: string }[]) {
      if (r.category_id) {
        category_counts[r.category_id] = (category_counts[r.category_id] || 0) + 1;
      }
    }

    const featured_providers = (featuredRes.data ?? []) as HomepageProvider[];
    const featuredIds = featured_providers.map((p) => p.id).filter(Boolean);

    const ratings: Record<string, { average: number; count: number }> = {};
    if (featuredIds.length > 0) {
      const { data: revs } = await supabaseAdmin
        .from("reviews")
        .select("provider_id, rating")
        .eq("status", "approved")
        .in("provider_id", featuredIds);

      if (revs && revs.length > 0) {
        const sums: Record<string, { sum: number; count: number }> = {};
        for (const r of revs as { provider_id: string; rating: number }[]) {
          if (!r.provider_id) continue;
          const entry = sums[r.provider_id] ?? { sum: 0, count: 0 };
          entry.sum += r.rating;
          entry.count += 1;
          sums[r.provider_id] = entry;
        }
        for (const [id, stats] of Object.entries(sums)) {
          ratings[id] = {
            count: stats.count,
            average: Math.round((stats.sum / stats.count) * 10) / 10,
          };
        }
      }
    }

    for (const p of featured_providers) {
      if (ratings[p.id]) {
        p.average_rating = ratings[p.id].average;
        p.review_count = ratings[p.id].count;
      }
    }

    return {
      settings,
      categories: (catsRes.data ?? []) as Category[],
      areas: (areasRes.data ?? []) as Area[],
      category_counts,
      featured_providers,
      ratings,
    };
  }
);

export const getCategoriesServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Category[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("categories")
      .select("id,name,icon,sort_order,status")
      .eq("status", "active")
      .order("sort_order");
    return (data ?? []) as Category[];
  }
);

export const getAreasServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Area[]> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("areas")
      .select("id,name,status")
      .eq("status", "active")
      .order("name");
    return (data ?? []) as Area[];
  }
);

export const getSettingsServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, string>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin.from("app_settings").select("key,value");
    return Object.fromEntries(
      (data ?? []).map((r: { key: string; value: string }) => [r.key, r.value])
    );
  }
);

export const getCategoryCountsServerFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<Record<string, number>> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    try {
      const { data, error } = await (supabaseAdmin.rpc as any)("get_homepage_data");
      if (!error && data?.category_counts) {
        return data.category_counts as Record<string, number>;
      }
    } catch {
      // Fallback
    }
    return {};
  }
);

export const getProvidersServerFn = createServerFn({ method: "POST" })
  .validator((d: {
    categoryId?: string;
    areaId?: string;
    experienceId?: string;
    search?: string;
    premiumOnly?: boolean;
    limit?: number;
    offset?: number;
  }) => d)
  .handler(async ({ data: opts }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { arabicPattern, CARD_PROVIDER_SELECT } = await import("./directory");

    let q = supabaseAdmin.from("providers").select(CARD_PROVIDER_SELECT).eq("status", "active");
    if (opts.categoryId) q = q.eq("category_id", opts.categoryId);
    if (opts.areaId) q = q.eq("area_id", opts.areaId);
    if (opts.experienceId) q = q.eq("experience_id", opts.experienceId);
    if (opts.premiumOnly) q = q.eq("is_premium", true);
    if (opts.search && opts.search.trim()) {
      const s = arabicPattern(opts.search);
      const [cats, ars] = await Promise.all([
        supabaseAdmin.from("categories").select("id").ilike("name", `%${s}%`),
        supabaseAdmin.from("areas").select("id").ilike("name", `%${s}%`),
      ]);
      const parts = [`name.ilike.%${s}%`, `description.ilike.%${s}%`, `services.ilike.%${s}%`];
      const cIds = (cats.data ?? []).map((c: any) => c.id);
      const aIds = (ars.data ?? []).map((a: any) => a.id);
      if (cIds.length) parts.push(`category_id.in.(${cIds.join(",")})`);
      if (aIds.length) parts.push(`area_id.in.(${aIds.join(",")})`);
      q = q.or(parts.join(","));
    }
    q = q.order("is_premium", { ascending: false }).order("created_at", { ascending: false });
    const limit = opts.limit ?? 20;
    if (opts.offset) {
      q = q.range(opts.offset, opts.offset + limit - 1);
    } else {
      q = q.limit(limit);
    }
    const { data } = await q;
    return (data ?? []) as any[];
  });

export const getProviderDetailServerFn = createServerFn({ method: "POST" })
  .validator((id: string) => id)
  .handler(async ({ data: id }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data } = await supabaseAdmin
      .from("providers")
      .select(PUBLIC_PROVIDER_SELECT)
      .eq("id", id)
      .maybeSingle();
    return data ?? null;
  });

