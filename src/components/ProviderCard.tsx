import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Star, MapPin, BadgeCheck, Award, Zap, Building2 } from "lucide-react";
import { isPremiumActive, type PublicProvider as ProviderWithRefs } from "@/lib/directory";
import { ContactButtons } from "@/components/ContactButtons";
import { supabase } from "@/integrations/supabase/client";
import { parseWorkingHours, getOpenStatus } from "@/lib/working-hours";

export const allRatingSummariesQuery = {
  queryKey: ["all-rating-summaries"],
  staleTime: 1000 * 60 * 5, // 5 minutes cache
  queryFn: async (): Promise<Record<string, { average: number; count: number }>> => {
    try {
      const { data, error } = await supabase
        .from("reviews")
        .select("provider_id, rating")
        .eq("status", "approved");

      if (error || !data) return {};

      const map: Record<string, { sum: number; count: number }> = {};
      for (const r of data as { provider_id: string; rating: number }[]) {
        if (!r.provider_id) continue;
        const entry = map[r.provider_id] ?? { sum: 0, count: 0 };
        entry.sum += r.rating;
        entry.count += 1;
        map[r.provider_id] = entry;
      }

      const result: Record<string, { average: number; count: number }> = {};
      for (const [id, stats] of Object.entries(map)) {
        result[id] = {
          count: stats.count,
          average: Math.round((stats.sum / stats.count) * 10) / 10,
        };
      }
      return result;
    } catch {
      return {};
    }
  },
};

export function ProviderRatingBadge({
  providerId,
  summary,
}: {
  providerId: string;
  summary?: { average: number; count: number };
}) {
  const isValid = Boolean(
    providerId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(providerId)
  );

  const { data: allRatings } = useQuery({
    ...allRatingSummariesQuery,
    enabled: !summary && isValid,
  });

  const rating = summary ?? (providerId && allRatings ? allRatings[providerId] : undefined);
  if (!rating || rating.count === 0) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-md bg-secondary/80 px-2 py-0.5 text-xs font-extrabold text-foreground" dir="ltr">
      <Star className="size-3.5 fill-amber-400 text-amber-400 inline" />
      <span>{rating.average.toFixed(1)}</span>
      <span className="text-[11px] font-medium text-muted-foreground">({rating.count})</span>
    </span>
  );
}

export function PremiumBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-premium/12 px-2.5 py-1 text-xs font-bold text-premium ring-1 ring-premium/30">
      <Star className="size-3.5 fill-current" /> مميز
    </span>
  );
}

export function VerifiedBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-bold text-primary ring-1 ring-primary/30">
      <BadgeCheck className="size-3.5" /> موثّق
    </span>
  );
}

export function EmergencyBadge() {
  return (
    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-500/15 px-2.5 py-1 text-xs font-black text-amber-700 dark:text-amber-300 ring-1 ring-amber-500/40">
      <Zap className="size-3.5 fill-current text-amber-500" /> طوارئ 24H
    </span>
  );
}

export function ProviderCard({
  provider,
  ratingSummary,
}: {
  provider: ProviderWithRefs;
  ratingSummary?: { average: number; count: number };
}) {
  const premium = isPremiumActive(provider);
  const hoursData = parseWorkingHours(provider.working_hours);
  const openStatus = hoursData ? getOpenStatus(hoursData) : null;
  const computedRating =
    ratingSummary ??
    ((provider as any).average_rating
      ? {
          average: Number((provider as any).average_rating),
          count: Number((provider as any).review_count ?? 1),
        }
      : undefined);

  return (
    <article className={`surface p-4 ${premium ? "ring-2 ring-premium/40" : ""}`}>
      <Link to="/provider/$id" params={{ id: provider.id }} className="block">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-lg font-extrabold text-foreground">{provider.name}</h3>
          <div className="flex flex-wrap justify-end gap-1">
            {hoursData?.isEmergency24h ? <EmergencyBadge /> : null}
            {provider.is_verified ? <VerifiedBadge /> : null}
            {premium ? <PremiumBadge /> : null}
          </div>
        </div>
        <div className="mt-1 flex items-center justify-between gap-2">
          <p className="text-sm text-muted-foreground">
            <span className="font-bold text-primary">{provider.categories?.name}</span>
            <span className="mx-1.5">·</span>
            <MapPin className="inline size-3.5 align-[-2px]" /> {provider.areas?.name}
          </p>
          <div className="flex items-center gap-1.5">
            {openStatus && openStatus.isOpen !== null && !hoursData?.isEmergency24h && (
              <span
                className={`inline-flex items-center gap-1 text-[11px] font-bold ${
                  openStatus.isOpen
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-muted-foreground"
                }`}
              >
                <span
                  className={`size-1.5 rounded-full ${
                    openStatus.isOpen ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground/60"
                  }`}
                />
                {openStatus.isOpen ? "مفتوح" : "مغلق"}
              </span>
            )}
            <ProviderRatingBadge providerId={provider.id} summary={computedRating} />
          </div>
        </div>
        {hoursData?.workshop?.hasWorkshop ? (
          <p className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
            <Building2 className="inline size-3.5 text-primary" />
            <span>ورشة: {hoursData.workshop.workshopName || "مقر عمل ثابت"}</span>
          </p>
        ) : null}
        {provider.experience_options ? (
          <p className="mt-1 text-sm text-muted-foreground">
            <Award className="inline size-3.5 align-[-2px]" /> خبرة: {provider.experience_options.label}
          </p>
        ) : null}
        {provider.description ? (
          <p className="mt-2 line-clamp-2 text-sm text-foreground/75">{provider.description}</p>
        ) : null}
      </Link>

      <div className="mt-3">
        <ContactButtons
          providerId={provider.id}
          hasWhatsapp={provider.has_whatsapp}
          providerInfo={{
            name: provider.name,
            categoryName: provider.categories?.name,
            areaName: provider.areas?.name,
            isEmergency24h: hoursData?.isEmergency24h,
          }}
        />
      </div>
    </article>
  );
}
