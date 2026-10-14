import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const allowedOrigin = "https://ohaziah.github.io";
const baseHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...baseHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
});

function secretKey(): string {
  const legacy = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (legacy) return legacy;
  const keys = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys);
    if (parsed.default) return parsed.default;
  }
  throw new Error("No Supabase backend secret is configured.");
}
function publishableKey(): string {
  const keys = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (keys) {
    const parsed = JSON.parse(keys);
    if (parsed.default) return parsed.default;
  }
  const legacy = Deno.env.get("SUPABASE_ANON_KEY");
  if (legacy) return legacy;
  throw new Error("No Supabase publishable key is configured.");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: baseHeaders });
  if (request.method !== "POST") return reply({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return reply({ error: "Origin not allowed." }, 403);

  try {
    const authorization = request.headers.get("Authorization") || "";
    const token = authorization.match(/^Bearer\s+(.+)$/i)?.[1];
    if (!token) return reply({ error: "Sign-in required." }, 401);

    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("Supabase URL is not configured.");
    const callerClient = createClient(url, publishableKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: { user }, error: userError } = await callerClient.auth.getUser(token);
    if (userError || !user) return reply({ error: "Your session could not be verified." }, 401);

    const adminClient = createClient(url, secretKey(), {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: adminRow, error: adminError } = await adminClient
      .from("orbit_admins").select("user_id").eq("user_id", user.id).maybeSingle();
    if (adminError) throw adminError;
    if (!adminRow) return reply({ error: "Administrator access required." }, 403);

    const payload = await request.json().catch(() => ({}));
    if (payload.action === "status") return reply({ admin: true });

    if (payload.action === "set-access") {
      if (typeof payload.userId !== "string" || typeof payload.blocked !== "boolean") {
        return reply({ error: "A user and access state are required." }, 400);
      }
      if (payload.userId === user.id) return reply({ error: "You cannot suspend your own administrator account." }, 400);
      if (payload.blocked) {
        const { error: blockError } = await adminClient.from("orbit_blocked_users")
          .upsert({ user_id: payload.userId }, { onConflict: "user_id" });
        if (blockError) return reply({ error: blockError.message }, 400);
        const { error: banError } = await adminClient.auth.admin.updateUserById(payload.userId, {
          ban_duration: "876000h",
        });
        if (banError) {
          await adminClient.from("orbit_blocked_users").delete().eq("user_id", payload.userId);
          return reply({ error: banError.message }, 400);
        }
      } else {
        const { error: unbanError } = await adminClient.auth.admin.updateUserById(payload.userId, {
          ban_duration: "none",
        });
        if (unbanError) return reply({ error: unbanError.message }, 400);
        const { error: unblockError } = await adminClient.from("orbit_blocked_users")
          .delete().eq("user_id", payload.userId);
        if (unblockError) return reply({ error: unblockError.message }, 500);
      }
      return reply({ ok: true });
    }

    if (payload.action !== "overview") return reply({ error: "Unknown administrator action." }, 400);

    const users: Array<Record<string, unknown>> = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw error;
      const batch = data.users;
      users.push(...batch.map((entry) => ({
        id: entry.id,
        email: entry.email || "No email address",
        createdAt: entry.created_at,
        lastSignInAt: entry.last_sign_in_at,
        bannedUntil: entry.banned_until,
      })));
      if (batch.length < 200) break;
    }
    const { data: blockedRows, error: blockedError } = await adminClient
      .from("orbit_blocked_users").select("user_id");
    if (blockedError) throw blockedError;
    const blockedIds = new Set((blockedRows || []).map((row) => row.user_id));
    const { count: reminderCount, error: countError } = await adminClient
      .from("reminders").select("id", { count: "exact", head: true });
    if (countError) throw countError;
    return reply({
      users: users.map((entry) => ({ ...entry, blocked: blockedIds.has(entry.id) })),
      reminderCount: reminderCount ?? 0,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Orbit administrator request failed:", error);
    return reply({ error: "The administrator request could not be completed." }, 500);
  }
});

