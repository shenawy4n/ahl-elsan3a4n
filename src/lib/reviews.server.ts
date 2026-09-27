import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

export interface ReviewRecord {
  id: string;
  provider_id: string;
  rating: number; // 1-5
  comment: string;
  reviewer_name: string | null;
  status: "pending" | "approved" | "rejected";
  created_at: string;
  reviewed_at?: string | null;
  reviewed_by?: string | null;
}

export interface PublicReview {
  id: string;
  provider_id: string;
  rating: number;
  comment: string;
  reviewer_name: string | null;
  created_at: string;
}

export interface ProviderRatingSummary {
  average: number;
  count: number;
}

const DATA_DIR = path.resolve(process.cwd(), "data");
const STORE_FILE = path.join(DATA_DIR, "reviews-store.json");

function ensureStore(): ReviewRecord[] {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_FILE)) {
      fs.writeFileSync(STORE_FILE, JSON.stringify([]), "utf-8");
      return [];
    }
    const raw = fs.readFileSync(STORE_FILE, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("[reviews.server] Error reading local store:", err);
    return [];
  }
}

function saveStore(records: ReviewRecord[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${STORE_FILE}.${Date.now()}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(records, null, 2), "utf-8");
    fs.renameSync(tmp, STORE_FILE);
  } catch (err) {
    console.error("[reviews.server] Error saving local store:", err);
  }
}

/** Insert a new review (defaults to pending) */
export async function createReview(data: {
  provider_id: string;
  rating: number;
  comment: string;
  reviewer_name?: string | null;
}): Promise<{ ok: boolean; id: string }> {
  const newId = crypto.randomUUID();
  const record: ReviewRecord = {
    id: newId,
    provider_id: data.provider_id,
    rating: data.rating,
    comment: data.comment,
    reviewer_name: data.reviewer_name?.trim() || null,
    status: "pending",
    created_at: new Date().toISOString(),
  };

  // 1. Try Supabase
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("reviews" as never).insert(record as never);
    if (!error) {
      return { ok: true, id: newId };
    }
  } catch (e) {
    // Supabase table may not exist yet, fallback to store
  }

  // 2. Fallback to resilient persistent store
  const store = ensureStore();
  store.unshift(record);
  saveStore(store);
  return { ok: true, id: newId };
}

/**
 * Get public reviews for a provider.
 * Strictly returns only APPROVED reviews.
 * Does not expose status, reviewed_at, or any moderation metadata.
 */
export async function getProviderApprovedReviews(providerId: string): Promise<PublicReview[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reviews" as never)
      .select("id, provider_id, rating, comment, reviewer_name, created_at" as never)
      .eq("provider_id" as never, providerId as never)
      .eq("status" as never, "approved" as never)
      .order("created_at" as never, { ascending: false } as never);

    if (!error && Array.isArray(data)) {
      return data as unknown as PublicReview[];
    }
  } catch (e) {
    // Fallback
  }

  const store = ensureStore();
  return store
    .filter((r) => r.provider_id === providerId && r.status === "approved")
    .map((r) => ({
      id: r.id,
      provider_id: r.provider_id,
      rating: r.rating,
      comment: r.comment,
      reviewer_name: r.reviewer_name,
      created_at: r.created_at,
    }));
}

/**
 * Get provider rating summary (average & count).
 * Strictly calculates based on approved reviews only.
 * Pending & rejected are NEVER included.
 */
export async function getProviderRatingSummary(providerId: string): Promise<ProviderRatingSummary> {
  const reviews = await getProviderApprovedReviews(providerId);
  if (!reviews.length) {
    return { average: 0, count: 0 };
  }

  const sum = reviews.reduce((acc, r) => acc + r.rating, 0);
  const average = Math.round((sum / reviews.length) * 10) / 10;
  return { average, count: reviews.length };
}

/**
 * Get all providers' rating summaries in a single batch.
 * Strictly based on approved reviews only.
 */
export async function getAllRatingSummaries(): Promise<Record<string, ProviderRatingSummary>> {
  let approvedReviews: { provider_id: string; rating: number }[] = [];

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("reviews" as never)
      .select("provider_id, rating" as never)
      .eq("status" as never, "approved" as never);

    if (!error && Array.isArray(data)) {
      approvedReviews = data as unknown as { provider_id: string; rating: number }[];
    } else {
      approvedReviews = ensureStore().filter((r) => r.status === "approved");
    }
  } catch (e) {
    approvedReviews = ensureStore().filter((r) => r.status === "approved");
  }

  const map: Record<string, { sum: number; count: number }> = {};
  for (const r of approvedReviews) {
    const entry = map[r.provider_id] ?? { sum: 0, count: 0 };
    entry.sum += r.rating;
    entry.count += 1;
    map[r.provider_id] = entry;
  }

  const result: Record<string, ProviderRatingSummary> = {};
  for (const [id, stats] of Object.entries(map)) {
    result[id] = {
      count: stats.count,
      average: Math.round((stats.sum / stats.count) * 10) / 10,
    };
  }

  return result;
}

/**
 * Admin: list reviews with status filtering.
 */
export async function adminGetReviews(status?: "pending" | "approved" | "rejected" | "all"): Promise<ReviewRecord[]> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin.from("reviews" as never).select("*" as never).order("created_at" as never, { ascending: false } as never);
    if (status && status !== "all") {
      q = q.eq("status" as never, status as never);
    }
    const { data, error } = await q;
    if (!error && Array.isArray(data)) {
      return data as unknown as ReviewRecord[];
    }
  } catch (e) {
    // Fallback
  }

  const store = ensureStore();
  if (!status || status === "all") return store;
  return store.filter((r) => r.status === status);
}

/**
 * Admin: moderate review (approve, reject, or delete).
 */
export async function adminModerateReview(
  reviewId: string,
  action: "approve" | "reject" | "delete",
  adminId?: string
): Promise<{ ok: boolean }> {
  // 1. Try Supabase
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (action === "delete") {
      const { error } = await supabaseAdmin.from("reviews" as never).delete().eq("id" as never, reviewId as never);
      if (!error) return { ok: true };
    } else {
      const newStatus = action === "approve" ? "approved" : "rejected";
      const { error } = await supabaseAdmin
        .from("reviews" as never)
        .update({
          status: newStatus,
          reviewed_at: new Date().toISOString(),
          reviewed_by: adminId || null,
        } as never)
        .eq("id" as never, reviewId as never);
      if (!error) return { ok: true };
    }
  } catch (e) {
    // Fallback
  }

  // 2. Fallback to store
  const store = ensureStore();
  const idx = store.findIndex((r) => r.id === reviewId);
  if (idx === -1) return { ok: false };

  if (action === "delete") {
    store.splice(idx, 1);
  } else {
    const target = store[idx];
    if (!target) return { ok: false };
    target.status = action === "approve" ? "approved" : "rejected";
    target.reviewed_at = new Date().toISOString();
    target.reviewed_by = adminId || null;
  }
  saveStore(store);
  return { ok: true };
}
