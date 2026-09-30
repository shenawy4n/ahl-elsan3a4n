import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72).optional().or(z.literal("")),
  is_owner: z.boolean().default(false),
});

/** Owner-only: authorize an email as admin or owner, and optionally create its login. */
export const addAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caller = (context as any)?.user;
    if (!caller) return { ok: false as const, code: "unauthorized" };

    // Verify caller is owner
    const { data: callerAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("is_owner")
      .eq("email", caller.email?.toLowerCase())
      .single();

    if (!callerAdmin?.is_owner) {
      return { ok: false as const, code: "not_owner" };
    }

    // Check if email already in admin_users
    const { data: existing } = await supabaseAdmin
      .from("admin_users")
      .select("id")
      .eq("email", data.email)
      .maybeSingle();

    if (existing) {
      return { ok: false as const, code: "already_admin" };
    }

    // Insert admin user
    const { data: created, error: insertError } = await supabaseAdmin
      .from("admin_users")
      .insert({
        email: data.email,
        is_owner: data.is_owner,
        active: true,
        added_by_email: caller.email,
      })
      .select()
      .single();

    if (insertError) {
      return { ok: false as const, code: insertError.message };
    }

    // Audit log
    await supabaseAdmin.from("audit_log").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action: data.is_owner ? "admin_added_as_owner" : "admin_added",
      target: data.email,
    });

    // Create auth login user if password provided
    let warning: string | undefined = undefined;
    if (data.password) {
      const { error: e2 } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });
      if (e2 && !/already|registered|exists/i.test(e2.message)) {
        warning = e2.message;
      }
    }

    return { ok: true as const, warning };
  });

/** Owner-only: change admin role between Admin and Owner. */
export const updateAdminRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        is_owner: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caller = (context as any)?.user;
    if (!caller) return { ok: false as const, code: "unauthorized" };

    const { data: callerAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("is_owner")
      .eq("email", caller.email?.toLowerCase())
      .single();

    if (!callerAdmin?.is_owner) {
      return { ok: false as const, code: "not_owner" };
    }

    const { data: target } = await supabaseAdmin
      .from("admin_users")
      .select("email, is_owner")
      .eq("id", data.id)
      .single();

    if (!target) return { ok: false as const, code: "not_found" };

    // Prevent demoting yourself if you are an owner
    if (target.email === caller.email?.toLowerCase() && !data.is_owner) {
      return { ok: false as const, code: "cannot_demote_self" };
    }

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({ is_owner: data.is_owner })
      .eq("id", data.id);

    if (error) return { ok: false as const, code: error.message };

    await supabaseAdmin.from("audit_log").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action: data.is_owner ? "admin_promoted_to_owner" : "owner_demoted_to_admin",
      target: target.email,
    });

    return { ok: true as const };
  });

/** Owner-only: activate or deactivate an admin account. */
export const setAdminActiveStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
        active: z.boolean(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caller = (context as any)?.user;
    if (!caller) return { ok: false as const, code: "unauthorized" };

    const { data: callerAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("is_owner")
      .eq("email", caller.email?.toLowerCase())
      .single();

    if (!callerAdmin?.is_owner) {
      return { ok: false as const, code: "not_owner" };
    }

    const { data: target } = await supabaseAdmin
      .from("admin_users")
      .select("email, is_owner")
      .eq("id", data.id)
      .single();

    if (!target) return { ok: false as const, code: "not_found" };

    if (target.is_owner && !data.active) {
      return { ok: false as const, code: "cannot_suspend_owner" };
    }

    const { error } = await supabaseAdmin
      .from("admin_users")
      .update({ active: data.active })
      .eq("id", data.id);

    if (error) return { ok: false as const, code: error.message };

    await supabaseAdmin.from("audit_log").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action: data.active ? "admin_activated" : "admin_suspended",
      target: target.email,
    });

    return { ok: true as const };
  });

/** Owner-only: revoke and permanently remove an admin. */
export const revokeAdminAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        id: z.string().uuid(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caller = (context as any)?.user;
    if (!caller) return { ok: false as const, code: "unauthorized" };

    const { data: callerAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("is_owner")
      .eq("email", caller.email?.toLowerCase())
      .single();

    if (!callerAdmin?.is_owner) {
      return { ok: false as const, code: "not_owner" };
    }

    const { data: target } = await supabaseAdmin
      .from("admin_users")
      .select("email, is_owner")
      .eq("id", data.id)
      .single();

    if (!target) return { ok: false as const, code: "not_found" };

    if (target.email === caller.email?.toLowerCase()) {
      return { ok: false as const, code: "cannot_revoke_self" };
    }

    const { error } = await supabaseAdmin.from("admin_users").delete().eq("id", data.id);

    if (error) return { ok: false as const, code: error.message };

    await supabaseAdmin.from("audit_log").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action: "admin_revoked",
      target: target.email,
    });

    return { ok: true as const };
  });

/** Owner-only: reset or update password for an admin user. */
export const setAdminPassword = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        email: z.string().trim().toLowerCase().email(),
        password: z.string().min(8).max(72),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caller = (context as any)?.user;
    if (!caller) return { ok: false as const, code: "unauthorized" };

    const { data: callerAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("is_owner")
      .eq("email", caller.email?.toLowerCase())
      .single();

    if (!callerAdmin?.is_owner) {
      return { ok: false as const, code: "not_owner" };
    }

    // Find auth user
    const { data: users, error: listErr } = await supabaseAdmin.auth.admin.listUsers();
    if (listErr) return { ok: false as const, code: listErr.message };

    const targetAuth = users.users.find((u) => u.email?.toLowerCase() === data.email);
    if (!targetAuth) {
      // Create auth user if not found
      const { error: createErr } = await supabaseAdmin.auth.admin.createUser({
        email: data.email,
        password: data.password,
        email_confirm: true,
      });
      if (createErr) return { ok: false as const, code: createErr.message };
    } else {
      const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(targetAuth.id, {
        password: data.password,
      });
      if (updateErr) return { ok: false as const, code: updateErr.message };
    }

    await supabaseAdmin.from("audit_log").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action: "admin_password_reset_by_owner",
      target: data.email,
    });

    return { ok: true as const };
  });
