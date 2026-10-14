await window.orbitReady;
(async () => {
const sync = window.orbitSync;
if (!sync) return;

const enableButton = document.querySelector("#enablePush");
const disableButton = document.querySelector("#disablePush");
const testButton = document.querySelector("#testPush");
const status = document.querySelector("#pushStatus");
const config = window.ORBIT_CONFIG || {};
const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
const isInstalled = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;

function base64ToBytes(value) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(raw, character => character.charCodeAt(0));
}
function setStatus(message, kind = "") {
  status.textContent = message;
  status.dataset.state = kind;
}
async function currentSubscription() {
  if (!supported) return null;
  const registration = await navigator.serviceWorker.getRegistration("./");
  return registration?.pushManager.getSubscription() || null;
}
async function refreshPushSettings() {
  if (!supported) {
    enableButton.hidden = true;
    disableButton.hidden = true;
    testButton.hidden = true;
    setStatus(isIOS && !isInstalled
      ? "On iPhone or iPad, add Orbit to your Home Screen first, then enable notifications here."
      : "Push notifications aren’t supported by this browser.");
    return;
  }
  const subscription = await currentSubscription().catch(() => null);
  const enabled = Notification.permission === "granted" && !!subscription;
  enableButton.hidden = enabled;
  disableButton.hidden = !enabled;
  testButton.hidden = !enabled;
  if (enabled) setStatus("Notifications are enabled on this device. Reminders without a time arrive at 9:00 am local time.", "enabled");
  else if (Notification.permission === "denied") setStatus("Notifications are blocked by your browser. Allow them in the site’s browser settings, then try again.", "blocked");
  else if (isIOS && !isInstalled) setStatus("On iPhone or iPad, use Share → Add to Home Screen before enabling push notifications.");
  else setStatus("Notifications are off on this device.");
}

enableButton.addEventListener("click", async () => {
  if (!supported || !config.vapidPublicKey) {
    setStatus("Push notifications are not configured for this Orbit site yet.", "blocked");
    return;
  }
  enableButton.disabled = true;
  try {
    const permission = Notification.permission === "default" ? await Notification.requestPermission() : Notification.permission;
    if (permission !== "granted") throw new Error(permission === "denied" ? "Notifications are blocked by your browser. Allow them in site settings and try again." : "Notification permission was not granted.");
    const registration = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    await navigator.serviceWorker.ready;
    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: base64ToBytes(config.vapidPublicKey),
    });
    await sync.savePushSubscription(subscription.toJSON(), Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    await refreshPushSettings();
  } catch (error) {
    setStatus(error.message || "Could not enable notifications. Please try again.", "blocked");
  } finally { enableButton.disabled = false; }
});

disableButton.addEventListener("click", async () => {
  disableButton.disabled = true;
  try {
    const subscription = await currentSubscription();
    if (subscription) {
      await sync.removePushSubscription(subscription.endpoint);
      await subscription.unsubscribe();
    }
    await refreshPushSettings();
  } catch (error) {
    setStatus(error.message || "Could not turn off notifications. Please try again.", "blocked");
  } finally { disableButton.disabled = false; }
});

testButton.addEventListener("click", async () => {
  testButton.disabled = true;
  setStatus("Sending a test notification…");
  try {
    await sync.sendTestPush();
    setStatus("Test notification sent. Check your device’s notification centre.", "enabled");
  } catch (error) {
    setStatus(error.message || "Could not send the test notification.", "blocked");
  } finally { testButton.disabled = false; }
});

document.querySelector("#settingsBtn")?.addEventListener("click", refreshPushSettings);
await refreshPushSettings();
})();

