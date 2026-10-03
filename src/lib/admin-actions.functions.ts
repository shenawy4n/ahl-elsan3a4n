import { createServerFn } from "@tanstack/react-start";

/** Delete one or multiple providers */
export const deleteProvidersAdminFn = createServerFn({ method: "POST" })
  .validator((d: { ids: string[] }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.ids || data.ids.length === 0) return { ok: false, message: "لا يوجد معرفات محددة" };

    // Delete reviews and reports associated with providers
    await Promise.all([
      supabaseAdmin.from("reviews").delete().in("provider_id", data.ids),
      supabaseAdmin.from("reports").delete().in("provider_id", data.ids),
    ]);

    const { error } = await supabaseAdmin.from("providers").delete().in("id", data.ids);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true, count: data.ids.length };
  });

/** Delete category with safety check on referenced providers */
export const deleteCategoryAdminFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Check if category has any providers
    const { count } = await supabaseAdmin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("category_id", data.id);

    if (count && count > 0) {
      return {
        ok: false,
        message: `لا يمكن حذف هذا القسم لأنه يحتوي على ${count} صنايعي مسجل. يرجى نقلهم لقسم آخر أو إخفاء القسم بدلاً من حذفه.`,
      };
    }

    // Clean up custom unit setting if exists
    await supabaseAdmin.from("app_settings").delete().eq("key", `cat_unit_${data.id}`);

    const { error } = await supabaseAdmin.from("categories").delete().eq("id", data.id);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  });

/** Delete area with safety check on referenced providers */
export const deleteAreaAdminFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { count } = await supabaseAdmin
      .from("providers")
      .select("id", { count: "exact", head: true })
      .eq("area_id", data.id);

    if (count && count > 0) {
      return {
        ok: false,
        message: `لا يمكن حذف هذه المنطقة لأنها تحتوي على ${count} صنايعي مسجل. يرجى نقلهم لمنطقة أخرى أو إخفاء المنطقة.`,
      };
    }

    const { error } = await supabaseAdmin.from("areas").delete().eq("id", data.id);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  });

/** Delete experience option safely by nullifying provider references first */
export const deleteExperienceAdminFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    await supabaseAdmin
      .from("providers")
      .update({ experience_id: null })
      .eq("experience_id", data.id);

    const { error } = await supabaseAdmin.from("experience_options").delete().eq("id", data.id);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  });

/** Delete review */
export const deleteReviewAdminFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("reviews").delete().eq("id", data.id);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  });

/** Delete contact message */
export const deleteMessageAdminFn = createServerFn({ method: "POST" })
  .validator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error } = await supabaseAdmin.from("service_suggestions").delete().eq("id", data.id);
    if (error) {
      return { ok: false, message: error.message };
    }
    return { ok: true };
  });
