import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";

const gate = document.querySelector("#authGate");
const form = document.querySelector("#authForm");
const message = document.querySelector("#authMessage");
const shell = document.querySelector(".shell");
const config = window.ORBIT_CONFIG || {};
let client;
let pendingConnection = null;
let resolveReady;
window.orbitReady = new Promise(resolve => { resolveReady = resolve; });

function showMessage(text) { message.textContent = text; }
function mapRow(row) {
  return { id: row.id, title: row.title, date: row.reminder_date, time: row.reminder_time || "", category: row.category,
    repeat: row.repeat_rule, notes: row.notes || "", done: row.done, ...(row.amount == null ? {} : { amount: Number(row.amount), paid: row.paid }) };
}
function toRow(item, userId) {
  return { id: item.id, user_id: userId, title: item.title, reminder_date: item.date, reminder_time: item.time || null,
    category: item.category, repeat_rule: item.repeat || "none", notes: item.notes || "", done: !!item.done,
    amount: item.amount ?? null, paid: !!item.paid, updated_at: new Date().toISOString() };
}
async function connect(session) {
  const { data: verifiedSession, error: sessionError } = await client.auth.getUser(session.access_token);
  if (sessionError || !verifiedSession.user) {
    await client.auth.signOut({ scope: "local" }).catch(() => {});
    throw new Error("Your session has expired or was signed out elsewhere. Please sign in again.");
  }
  session = { ...session, user: verifiedSession.user };
  const { data: accessStatus, error: accessError } = await client
    .from("orbit_blocked_users").select("user_id").maybeSingle();
  if (accessError) throw accessError;
  if (accessStatus) {
    await client.auth.signOut({ scope: "local" });
    throw new Error("This account's Orbit access is suspended. Contact the administrator.");
  }
  const { data, error } = await client.from("reminders").select("*").order("reminder_date");
  if (error) throw error;
  window.orbitSync = {
    userId: session.user.id,
    userEmail: (session.user.email || "").trim().toLowerCase(),
    items: data.map(mapRow),
    save: async items => {
      if (!items.length) return;
      const result = await client.from("reminders").upsert(items.map(item => toRow(item, session.user.id)), { onConflict: "id" });
      if (result.error) throw result.error;
    },
    remove: async id => {
      const result = await client.from("reminders").delete().eq("id", id);
      if (result.error) throw result.error;
    },
    savePushSubscription: async (subscription, timeZone) => {
      if (!subscription?.endpoint || !subscription.keys?.p256dh || !subscription.keys?.auth) throw new Error("The browser returned an invalid push subscription.");
      const result = await client.from("orbit_push_subscriptions").upsert({
        endpoint: subscription.endpoint, user_id: session.user.id,
        p256dh: subscription.keys.p256dh, auth: subscription.keys.auth,
        time_zone: timeZone || "UTC", updated_at: new Date().toISOString(),
      }, { onConflict: "endpoint" });
      if (result.error) throw result.error;
    },
    removePushSubscription: async endpoint => {
      const result = await client.from("orbit_push_subscriptions").delete()
        .eq("endpoint", endpoint).eq("user_id", session.user.id);
      if (result.error) throw result.error;
    },
    sendTestPush: async () => {
      const result = await client.functions.invoke("orbit-push", { body: { action: "test" } });
      if (result.error) {
        let message = result.error.message || "Could not send the test notification.";
        try {
          if (result.error.context instanceof Response) {
            const body = await result.error.context.clone().json();
            if (body.error) message = body.error;
          }
        } catch {}
        throw new Error(message);
      }
      if (result.data?.error) throw new Error(result.data.error);
      return result.data;
    },
    takeWelcome: async () => {
      const { data, error } = await client.functions.invoke("orbit-admin", { body: { action: "consume-welcome" } });
      if (error) throw error;
      return data?.welcome || null;
    },
    refresh: async () => {
      const result = await client.from("reminders").select("*").order("reminder_date");
      if (result.error) throw result.error;
      window.orbitSync.items = result.data.map(mapRow);
    }
  };
  gate.hidden = true;
  shell.hidden = false;
  document.querySelector("#accountEmail").textContent = session.user.email || "Signed in";
  window.orbitAdmin = {
    isAdmin: false,
    checkError: "",
    call: async payload => {
      const { data, error } = await client.functions.invoke("orbit-admin", { body: payload });
      if (error) {
        let message = error.message || "Administrator request failed.";
        let sessionExpired = false;
        try {
          const response = error.context;
          if (response instanceof Response) {
            sessionExpired = response.status === 401;
            const body = await response.clone().json();
            if (body.error) message = body.error;
          }
        } catch {}
        if (sessionExpired) {
          await client.auth.signOut({ scope: "local" }).catch(() => {});
          window.orbitSync = null;
          gate.hidden = false;
          shell.hidden = true;
          showMessage("Your session has expired or was signed out elsewhere. Please sign in again.");
        }
        throw new Error(message);
      }
      return data;
    }
  };
  resolveReady(window.orbitSync);
  window.orbitAdmin.call({ action: "status" })
    .then(result => { window.orbitAdmin.isAdmin = result?.admin === true; })
    .catch(error => { window.orbitAdmin.checkError = error.message || "Could not verify admin access."; })
    .finally(() => window.dispatchEvent(new Event("orbit-admin-ready")));
}

function ensureConnected(session) {
  if (window.orbitSync?.userId === session.user?.id) return Promise.resolve(window.orbitSync);
  if (pendingConnection) return pendingConnection;
  pendingConnection = connect(session).finally(() => { pendingConnection = null; });
  return pendingConnection;
}

if (!config.supabaseUrl || !config.publishableKey) {
  gate.hidden = false;
  shell.hidden = true;
  showMessage("Sync is not configured yet. Add the Supabase project URL and publishable key to config.js after project setup.");
  form.hidden = true;
} else {
  client = createClient(config.supabaseUrl, config.publishableKey);
  form.addEventListener("submit", async event => {
    event.preventDefault();
    const button = form.querySelector("button[type=submit]");
    button.disabled = true;
    try {
      const email = form.elements.email.value.trim(), password = form.elements.password.value;
      const result = form.dataset.mode === "signup"
        ? await client.auth.signUp({ email, password, options: { emailRedirectTo: location.href } })
        : await client.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (form.dataset.mode === "signup" && !result.data.session) showMessage("Check your email to confirm your account, then sign in.");
      else if (result.data.session) await ensureConnected(result.data.session);
    } catch (error) { showMessage(error.message || "Could not sign in. Please try again."); }
    finally { button.disabled = false; }
  });
  document.querySelector("#authMode").addEventListener("click", () => {
    const signup = form.dataset.mode !== "signup";
    form.dataset.mode = signup ? "signup" : "login";
    document.querySelector("#authSubmit").textContent = signup ? "Create account" : "Sign in";
    document.querySelector("#authTitle").textContent = signup ? "Create your account" : "Sign in to Orbit";
    document.querySelector("#authSubtitle").textContent = signup ? "A little more room for what matters." : "Pick up right where you left off.";
    document.querySelector("#authSwitchPrompt").textContent = signup ? "Already have an account?" : "New to Orbit?";
    document.querySelector("#authMode").textContent = signup ? "Sign in" : "Create an account";
    showMessage("");
  });
  document.querySelector("#signOut").addEventListener("click", async () => {
    try {
      const registration = await navigator.serviceWorker?.getRegistration("./");
      const subscription = await registration?.pushManager?.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
        await window.orbitSync?.removePushSubscription(subscription.endpoint);
      }
    } catch (error) { console.warn("Could not remove this device's push subscription while signing out.", error); }
    await client.auth.signOut();
    location.reload();
  });
  client.auth.getSession().then(async ({ data, error }) => {
    if (error) { gate.hidden = false; shell.hidden = true; return showMessage(error.message); }
    if (data.session) {
      try { await ensureConnected(data.session); } catch (e) { gate.hidden = false; shell.hidden = true; showMessage(e.message); resolveReady(null); }
    } else { gate.hidden = false; shell.hidden = true; }
  });
  client.auth.onAuthStateChange((event, session) => {
    if (!session) { gate.hidden = false; shell.hidden = true; return; }
    if (event === "SIGNED_IN" && window.orbitSync?.userId !== session.user.id) {
      Promise.resolve().then(() => ensureConnected(session)).catch(e => {
        gate.hidden = false; shell.hidden = true; showMessage(e.message || "Could not open your Orbit account.");
      });
    }
  });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && window.orbitSync) {
      try { await window.orbitSync.refresh(); window.dispatchEvent(new Event("orbit-refresh")); } catch (e) { showMessage(e.message); }
    }
  });
}

