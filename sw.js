self.addEventListener('push', function(event) {
    const data = event.data ? event.data.json() : {};
    const title = data.title || "Incoming Call";
    const options = {
        body: data.body || "URGENT: Someone is trying to reach you!",
        icon: "https://cdn-icons-png.flaticon.com/512/3616/3616215.png",
        tag: "call-notification",
        renotify: true,
        // Intense SOS-style vibration for background
        vibrate: [500, 100, 500, 100, 500, 300, 1000, 100, 1000, 100, 1000, 300, 500, 100, 500, 100, 500],
        requireInteraction: true,
        priority: 2, 
        silent: false,
        actions: [
            { action: 'dismiss', title: 'Dismiss' }
        ]
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

self.addEventListener('notificationclick', function(event) {
    event.notification.close();
    
    if (event.action === 'dismiss') {
        self.clients.matchAll().then(clients => {
            clients.forEach(client => client.postMessage('STOP_ALARM'));
        });
        return;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windowClients => {
            for (var i = 0; i < windowClients.length; i++) {
                var client = windowClients[i];
                if ('focus' in client) return client.focus();
            }
            if (clients.openWindow) return clients.openWindow('/');
        })
    );
});
