import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const messageSchema = z.object({
  name: z.string().trim().min(2, "يرجى كتابة الاسم").max(100),
  phone: z
    .string()
    .trim()
    .min(10, "يرجى إدخال رقم هاتف صحيح للتواصل")
    .max(20),
  subject: z.string().trim().max(150).optional().default(""),
  message: z
    .string()
    .trim()
    .min(5, "يرجى كتابة نص الرسالة (٥ أحرف على الأقل)")
    .max(2000),
});

/** Public: Send a contact message directly to admin requests & inbox. */
export const sendContactMessage = createServerFn({ method: "POST" })
  .inputValidator((d) => messageSchema.parse(d))
  .handler(async ({ data }) => {
    // Sanitize phone
    const cleanPhone = data.phone.replace(/[^\d+]/g, "");

    const titlePrefix = data.subject ? `${data.subject} — ` : "";
    const fullName = `[رسالة تواصل] ${titlePrefix}${data.name}`;

    const { data: inserted, error } = await supabaseAdmin
      .from("service_suggestions")
      .insert({
        name: fullName,
        phone: cleanPhone,
        note: data.message,
        status: "new",
      })
      .select()
      .single();

    if (error) {
      console.error("[Messages] Error saving contact message:", error);
      return { ok: false as const, error: error.message };
    }

    return { ok: true as const, id: inserted.id };
  });

/** Admin-only: update message status (new, contacted, resolved, archived). */
export const updateMessageStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        status: z.enum(["new", "contacted", "resolved", "archived"]),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("service_suggestions")
      .update({ status: data.status })
      .eq("id", data.id);

    if (error) return { ok: false as const, code: error.message };
    return { ok: true as const };
  });

/** Admin-only: delete message. */
export const deleteMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(d)
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("service_suggestions")
      .delete()
      .eq("id", data.id);

    if (error) return { ok: false as const, code: error.message };
    return { ok: true as const };
  });
