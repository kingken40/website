// Minimal service worker so notifications work on mobile browsers, which require registration.showNotification.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
        const open = windows.find(w => 'focus' in w);
        return open ? open.focus() : self.clients.openWindow ? self.clients.openWindow('./') : undefined;
    }));
});
