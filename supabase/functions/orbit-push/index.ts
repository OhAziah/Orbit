import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.117.3";

const allowedOrigin = "https://ohaziah.github.io";
const appUrl = "https://ohaziah.github.io/Orbit/";
const headers = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...headers, "Content-Type": "application/json", "Cache-Control": "no-store" },
});
const encoder = new TextEncoder();

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
function b64url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function fromB64url(value: string): Uint8Array {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
function concat(...parts: Uint8Array[]): Uint8Array {
  const result = new Uint8Array(parts.reduce((size, part) => size + part.length, 0));
  let offset = 0;
  for (const part of parts) { result.set(part, offset); offset += part.length; }
  return result;
}
async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, key, length * 8));
}
function isSupportedPushHost(endpoint: string): boolean {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "fcm.googleapis.com" || host.endsWith(".push.services.mozilla.com") ||
      host === "updates.push.services.mozilla.com" || host === "web.push.apple.com" ||
      host.endsWith(".push.apple.com") || host.endsWith(".notify.windows.com") ||
      host.endsWith(".push.services.microsoft.com") || host === "push.services.opera.com";
  } catch { return false; }
}
async function makeVapidAuthorization(endpoint: string, publicKey: string, privateKey: string): Promise<string> {
  const publicBytes = fromB64url(publicKey);
  const d = fromB64url(privateKey);
  if (publicBytes.length !== 65 || d.length !== 32 || publicBytes[0] !== 4) throw new Error("Push signing keys are invalid.");
  const privateJwk: JsonWebKey = {
    kty: "EC", crv: "P-256", x: b64url(publicBytes.slice(1, 33)),
    y: b64url(publicBytes.slice(33, 65)), d: b64url(d), ext: true, key_ops: ["sign"],
  };
  const key = await crypto.subtle.importKey("jwk", privateJwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const audience = new URL(endpoint).origin;
  const jwtHeader = b64url(encoder.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const jwtPayload = b64url(encoder.encode(JSON.stringify({ aud: audience, exp: Math.floor(Date.now() / 1000) + 12 * 60 * 60, sub: appUrl })));
  const signingInput = `${jwtHeader}.${jwtPayload}`;
  const signature = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, encoder.encode(signingInput)));
  return `vapid t=${signingInput}.${b64url(signature)}, k=${publicKey}`;
}
async function encryptPayload(subscription: { p256dh: string; auth: string }, payload: unknown): Promise<Uint8Array> {
  const receiverKeyBytes = fromB64url(subscription.p256dh);
  const authSecret = fromB64url(subscription.auth);
  if (receiverKeyBytes.length !== 65 || authSecret.length !== 16) throw new Error("The browser push subscription is invalid.");
  const receiverKey = await crypto.subtle.importKey("raw", receiverKeyBytes, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const ephemeral = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const senderKeyBytes = new Uint8Array(await crypto.subtle.exportKey("raw", ephemeral.publicKey));
  const sharedSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: receiverKey }, ephemeral.privateKey, 256));
  const keyInfo = concat(encoder.encode("WebPush: info\0"), receiverKeyBytes, senderKeyBytes);
  const inputKeyMaterial = await hkdf(sharedSecret, authSecret, keyInfo, 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const contentKey = await hkdf(inputKeyMaterial, salt, encoder.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(inputKeyMaterial, salt, encoder.encode("Content-Encoding: nonce\0"), 12);
  const clear = concat(encoder.encode(JSON.stringify(payload)), new Uint8Array([2]));
  const aesKey = await crypto.subtle.importKey("raw", contentKey, "AES-GCM", false, ["encrypt"]);
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, clear));
  const recordSize = new Uint8Array([0, 0, 16, 0]);
  return concat(salt, recordSize, new Uint8Array([senderKeyBytes.length]), senderKeyBytes, ciphertext);
}
async function sendPush(config: Record<string, string>, subscription: { endpoint: string; p256dh: string; auth: string }, payload: unknown): Promise<Response> {
  if (!isSupportedPushHost(subscription.endpoint)) throw new Error("Unsupported push service.");
  const body = await encryptPayload(subscription, payload);
  const authorization = await makeVapidAuthorization(subscription.endpoint, config.vapid_public_key, config.vapid_private_key);
  return await fetch(subscription.endpoint, {
    method: "POST",
    headers: {
      Authorization: authorization,
      "Content-Type": "application/octet-stream",
      "Content-Encoding": "aes128gcm",
      TTL: "86400",
      Urgency: "high",
    },
    body,
  });
}
function localClock(timeZone: string, date = new Date()): { date: string; time: string; minuteOfDay: number } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const hour = Number(values.hour), minute = Number(values.minute);
  return { date: `${values.year}-${values.month}-${values.day}`, time: `${values.hour}:${values.minute}`, minuteOfDay: hour * 60 + minute };
}
function dayNumber(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  return Math.floor(Date.UTC(year, month - 1, day) / 86400000);
}
function dueWithinGrace(reminder: Record<string, unknown>, timeZone: string, now: Date): string | null {
  const current = localClock(timeZone, now);
  const dueDate = String(reminder.reminder_date || "");
  const dueTime = typeof reminder.reminder_time === "string" && reminder.reminder_time ? reminder.reminder_time.slice(0, 5) : "09:00";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || !/^\d{2}:\d{2}$/.test(dueTime)) return null;
  const [hour, minute] = dueTime.split(":").map(Number);
  const delta = (dayNumber(current.date) - dayNumber(dueDate)) * 1440 + current.minuteOfDay - (hour * 60 + minute);
  return delta >= 0 && delta <= 2 ? dueTime : null;
}
function safeTimeZone(value: string | null): string {
  if (!value || value.length > 64) return "UTC";
  try { new Intl.DateTimeFormat("en", { timeZone: value }); return value; }
  catch { return "UTC"; }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);
  const origin = request.headers.get("Origin");
  if (origin && origin !== allowedOrigin) return json({ error: "Origin not allowed." }, 403);

  try {
    const url = Deno.env.get("SUPABASE_URL");
    if (!url) throw new Error("Supabase URL is not configured.");
    const backend = createClient(url, secretKey(), { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: config, error: configError } = await backend.from("orbit_push_config").select("vapid_public_key,vapid_private_key,cron_secret").eq("singleton", true).single();
    if (configError || !config) throw new Error("Push service is not configured.");
    const body = await request.json().catch(() => ({}));
    const cronToken = request.headers.get("x-orbit-cron") || "";

    if (cronToken) {
      if (cronToken !== config.cron_secret || body.action !== "dispatch") return json({ error: "Not authorized." }, 401);
      const result = await dispatchReminders(backend, config);
      return json({ ok: true, ...result });
    }

    const bearer = (request.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/i)?.[1];
    if (!bearer) return json({ error: "Sign-in required." }, 401);
    const caller = createClient(url, publishableKey(), { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: { user }, error: userError } = await caller.auth.getUser(bearer);
    if (userError || !user) return json({ error: "Your session could not be verified." }, 401);
    if (body.action !== "test") return json({ error: "Unknown action." }, 400);
    const { data: subscriptions, error: subscriptionError } = await backend.from("orbit_push_subscriptions")
      .select("endpoint,p256dh,auth").eq("user_id", user.id).limit(10);
    if (subscriptionError) throw subscriptionError;
    if (!subscriptions?.length) return json({ error: "Enable push notifications on this device first." }, 400);
    let sent = 0;
    for (const subscription of subscriptions) {
      try {
        const response = await sendPush(config, subscription, { title: "Orbit is ready", body: "Push notifications are working on this device.", url: appUrl, tag: "orbit-test" });
        if (response.status === 404 || response.status === 410) {
          await backend.from("orbit_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
        } else if (response.ok) sent++;
      } catch (error) { console.error("Test push delivery failed:", error instanceof Error ? error.message : "unknown error"); }
    }
    return sent ? json({ ok: true, sent }) : json({ error: "The push service could not deliver the test notification. Please re-enable notifications and try again." }, 502);
  } catch (error) {
    console.error("Orbit push request failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "The push request could not be completed." }, 500);
  }
});

async function dispatchReminders(backend: ReturnType<typeof createClient>, config: Record<string, string>) {
  const { data: subscriptions, error: subscriptionError } = await backend.from("orbit_push_subscriptions")
    .select("endpoint,user_id,p256dh,auth,time_zone").limit(500);
  if (subscriptionError) throw subscriptionError;
  const byUser = new Map<string, typeof subscriptions>();
  for (const subscription of subscriptions || []) {
    const list = byUser.get(subscription.user_id) || [];
    list.push(subscription);
    byUser.set(subscription.user_id, list);
  }
  const now = new Date();
  const utcToday = now.toISOString().slice(0, 10);
  const yesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().slice(0, 10);
  let delivered = 0, expired = 0, skipped = 0;
  for (const [userId, userSubscriptions] of byUser) {
    const { data: reminders, error: reminderError } = await backend.from("reminders")
      .select("id,title,reminder_date,reminder_time,done").eq("user_id", userId).eq("done", false)
      .gte("reminder_date", yesterday).lte("reminder_date", tomorrow).limit(500);
    if (reminderError) throw reminderError;
    for (const subscription of userSubscriptions) {
      const timezone = safeTimeZone(subscription.time_zone);
      for (const reminder of reminders || []) {
        const dueTime = dueWithinGrace(reminder, timezone, now);
        if (!dueTime) continue;
        const { data: existing, error: deliveryError } = await backend.from("orbit_push_deliveries").select("id")
          .eq("endpoint", subscription.endpoint).eq("reminder_id", reminder.id)
          .eq("reminder_date", reminder.reminder_date).eq("target_time", dueTime).maybeSingle();
        if (deliveryError) throw deliveryError;
        if (existing) { skipped++; continue; }
        try {
          const response = await sendPush(config, subscription, {
            title: "Orbit reminder", body: reminder.title, url: appUrl,
            tag: `orbit-${reminder.id}-${reminder.reminder_date}-${dueTime}`,
          });
          if (response.status === 404 || response.status === 410) {
            await backend.from("orbit_push_subscriptions").delete().eq("endpoint", subscription.endpoint);
            expired++;
            break;
          }
          if (!response.ok) { console.error("Push service rejected a reminder:", response.status); continue; }
          const { error: recordError } = await backend.from("orbit_push_deliveries").insert({
            endpoint: subscription.endpoint, user_id: userId, reminder_id: reminder.id,
            reminder_date: reminder.reminder_date, target_time: dueTime,
          });
          if (recordError && recordError.code !== "23505") throw recordError;
          delivered++;
        } catch (error) { console.error("Reminder push delivery failed:", error instanceof Error ? error.message : "unknown error"); }
      }
    }
  }
  return { delivered, expired, skipped, users: byUser.size };
}

