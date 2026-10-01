import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const addSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  password: z.string().min(8).max(72).optional().or(z.literal("")),
  role: z.enum(["admin", "moderator"]).default("admin"),
});

/** Owner-only: authorize an email as admin, and optionally create its login. */
export const addAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => addSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caller = (context as any)?.user;
    if (!caller) return { ok: false as const, code: "unauthorized" };

    const callerEmail = caller.email?.toLowerCase();

    // Verify caller is owner
    const { data: callerAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("is_owner")
      .eq("email", callerEmail)
      .maybeSingle();

    if (!callerAdmin?.is_owner) {
      // Self-bootstrap safeguard: if there are no owners in admin_users, caller becomes owner
      const { count } = await supabaseAdmin
        .from("admin_users")
        .select("id", { count: "exact", head: true })
        .eq("is_owner", true);

      if (count === 0 && callerEmail) {
        await supabaseAdmin.from("admin_users").upsert({
          email: callerEmail,
          is_owner: true,
          active: true,
          added_by_email: "system",
        });
      } else {
        return { ok: false as const, code: "not_owner" };
      }
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

    // Insert new admin (is_owner is always false because of admin_users_single_owner constraint)
    const { data: created, error: insertError } = await supabaseAdmin
      .from("admin_users")
      .insert({
        email: data.email,
        is_owner: false,
        active: true,
        added_by_email: caller.email,
      })
      .select()
      .single();

    if (insertError) {
      console.error("[Admins] Error inserting admin:", insertError);
      return { ok: false as const, code: insertError.message };
    }

    // Audit log
    await supabaseAdmin.from("audit_log").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action: "admin_added",
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

/** Owner-only: transfer primary ownership to another admin. */
export const transferOwnership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        targetAdminId: z.string().uuid(),
      })
      .parse(d)
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const caller = (context as any)?.user;
    if (!caller) return { ok: false as const, code: "unauthorized" };

    const callerEmail = caller.email?.toLowerCase();
    const { data: callerAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("id, is_owner")
      .eq("email", callerEmail)
      .single();

    if (!callerAdmin?.is_owner) {
      return { ok: false as const, code: "not_owner" };
    }

    const { data: targetAdmin } = await supabaseAdmin
      .from("admin_users")
      .select("id, email, active")
      .eq("id", data.targetAdminId)
      .single();

    if (!targetAdmin) return { ok: false as const, code: "not_found" };
    if (!targetAdmin.active) return { ok: false as const, code: "target_inactive" };

    // 1. Demote current owner to false
    const { error: demoteErr } = await supabaseAdmin
      .from("admin_users")
      .update({ is_owner: false })
      .eq("id", callerAdmin.id);

    if (demoteErr) return { ok: false as const, code: demoteErr.message };

    // 2. Promote target to true
    const { error: promoteErr } = await supabaseAdmin
      .from("admin_users")
      .update({ is_owner: true })
      .eq("id", targetAdmin.id);

    if (promoteErr) {
      // Revert if error
      await supabaseAdmin.from("admin_users").update({ is_owner: true }).eq("id", callerAdmin.id);
      return { ok: false as const, code: promoteErr.message };
    }

    await supabaseAdmin.from("audit_log").insert({
      admin_id: caller.id,
      admin_email: caller.email,
      action: "ownership_transferred",
      target: targetAdmin.email,
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
