import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.117.3/+esm";

const gate = document.querySelector("#authGate");
const form = document.querySelector("#authForm");
const message = document.querySelector("#authMessage");
const shell = document.querySelector(".shell");
const config = window.ORBIT_CONFIG || {};
let client;
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
  const { data, error } = await client.from("reminders").select("*").order("reminder_date");
  if (error) throw error;
  window.orbitSync = {
    userId: session.user.id,
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
    refresh: async () => {
      const result = await client.from("reminders").select("*").order("reminder_date");
      if (result.error) throw result.error;
      window.orbitSync.items = result.data.map(mapRow);
    }
  };
  gate.hidden = true;
  shell.hidden = false;
  document.querySelector("#accountEmail").textContent = session.user.email || "Signed in";
  resolveReady(window.orbitSync);
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
      else if (result.data.session) await connect(result.data.session);
    } catch (error) { showMessage(error.message || "Could not sign in. Please try again."); }
    finally { button.disabled = false; }
  });
  document.querySelector("#authMode").addEventListener("click", () => {
    const signup = form.dataset.mode !== "signup";
    form.dataset.mode = signup ? "signup" : "login";
    document.querySelector("#authSubmit").textContent = signup ? "Create account" : "Sign in";
    document.querySelector("#authMode").textContent = signup ? "Already have an account? Sign in" : "Create an account";
    showMessage("");
  });
  document.querySelector("#signOut").addEventListener("click", async () => { await client.auth.signOut(); location.reload(); });
  client.auth.getSession().then(async ({ data, error }) => {
    if (error) { gate.hidden = false; shell.hidden = true; return showMessage(error.message); }
    if (data.session) {
      try { await connect(data.session); } catch (e) { gate.hidden = false; shell.hidden = true; showMessage(e.message); resolveReady(null); }
    } else { gate.hidden = false; shell.hidden = true; }
  });
  client.auth.onAuthStateChange((_event, session) => {
    if (!session) { gate.hidden = false; shell.hidden = true; }
  });
  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && window.orbitSync) {
      try { await window.orbitSync.refresh(); window.dispatchEvent(new Event("orbit-refresh")); } catch (e) { showMessage(e.message); }
    }
  });
}

