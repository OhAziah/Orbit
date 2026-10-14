self.addEventListener("push", (event) => {
  let payload = {};
  try { payload = event.data ? event.data.json() : {}; } catch { payload = { body: event.data?.text() || "You have a reminder due." }; }
  const title = typeof payload.title === "string" ? payload.title : "Orbit reminder";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "You have a reminder due.",
    icon: "./orbit-icon-neutral.svg?v=orbit-20",
    badge: "./orbit-icon-neutral.svg?v=orbit-20",
    tag: typeof payload.tag === "string" ? payload.tag : "orbit-reminder",
    data: { url: typeof payload.url === "string" ? payload.url : "./" },
    renotify: false,
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || "./", self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
    const existing = windows.find((window) => window.url.startsWith(self.registration.scope));
    if (existing) return existing.focus();
    return self.clients.openWindow(target);
  }));
});

