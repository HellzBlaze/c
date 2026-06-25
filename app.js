let peer = null;
let conn = null;
let deviceRole = "";
let sharedId = "";

function initPeer(role) {
    const idInput = document.getElementById('peer-id-input').value.trim();
    if (!idInput) {
        alert("Please enter a unique ID");
        return;
    }

    sharedId = idInput;
    deviceRole = role;
    const status = document.getElementById('init-status');
    status.innerText = "Initializing Peer...";

    // Strategy: 
    // Receiver MUST have the exact sharedId to be findable.
    // Caller can have any ID (we'll let PeerJS generate one).
    const peerId = (role === 'receiver') ? sharedId : null;
    
    if (peer) peer.destroy();
    peer = new Peer(peerId);

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        status.innerText = "Peer ready: " + id;
        
        document.getElementById('setup-view').classList.add('hidden');
        
        if (role === 'caller') {
            document.getElementById('caller-view').classList.remove('hidden');
            document.getElementById('caller-id-display').innerText = `Target Receiver: ${sharedId}`;
            connectToReceiver();
        } else {
            document.getElementById('receiver-view').classList.remove('hidden');
            document.getElementById('receiver-id-display').innerText = `Listening as: ${sharedId}`;
            requestNotificationPermission();
        }
    });

    peer.on('connection', (connection) => {
        console.log("Incoming connection from: " + connection.peer);
        conn = connection;
        setupConnListeners();
    });

    peer.on('error', (err) => {
        console.error("Peer Error:", err);
        status.innerText = "Error: " + err.type;
        if (err.type === 'unavailable-id') {
            alert("This ID is already in use by a receiver. If you are trying to be a caller, just wait or use a different ID for the pair.");
        } else if (err.type === 'peer-unavailable') {
            if (deviceRole === 'caller') {
                document.getElementById('status-msg').innerText = "Receiver not found. Make sure receiver is ready.";
            }
        } else {
            alert("PeerJS Error: " + err.message);
        }
    });
}

function connectToReceiver() {
    if (!peer || peer.destroyed) return;
    
    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "Connecting to receiver...";
    statusMsg.classList.add('animate-pulse');
    
    // Attempt connection to the sharedId (which the receiver is using)
    if (conn) conn.close();
    conn = peer.connect(sharedId, {
        reliable: true
    });
    
    setupConnListeners();
}

function setupConnListeners() {
    if (!conn) return;

    conn.on('open', () => {
        console.log("Connection established with " + conn.peer);
        const statusMsg = document.getElementById('status-msg');
        statusMsg.innerText = "Connected to Receiver ✅";
        statusMsg.classList.remove('animate-pulse', 'text-gray-500');
        statusMsg.classList.add('text-emerald-400');
    });

    conn.on('data', (data) => {
        console.log("Received data:", data);
        if (data === 'RING') {
            handleIncomingCall();
        }
    });

    conn.on('close', () => {
        console.log("Connection closed");
        if (deviceRole === 'caller') {
            const statusMsg = document.getElementById('status-msg');
            statusMsg.innerText = "Disconnected. Retrying in 5s...";
            statusMsg.classList.remove('text-emerald-400');
            statusMsg.classList.add('text-rose-400');
            setTimeout(connectToReceiver, 5000);
        }
    });

    conn.on('error', (err) => {
        console.error("Connection Error:", err);
        if (deviceRole === 'caller') {
            document.getElementById('status-msg').innerText = "Connection failed. Retrying...";
            setTimeout(connectToReceiver, 3000);
        }
    });
}

function triggerCall() {
    if (conn && conn.open) {
        console.log("Sending RING signal...");
        conn.send('RING');
        
        const statusMsg = document.getElementById('status-msg');
        const originalText = statusMsg.innerText;
        statusMsg.innerText = "Ringing Receiver...";
        statusMsg.classList.add('text-rose-500', 'font-bold');
        
        setTimeout(() => {
            statusMsg.innerText = originalText;
            statusMsg.classList.remove('text-rose-500', 'font-bold');
        }, 2000);
    } else {
        console.log("Cannot call: Connection not open");
        alert("Not connected to receiver. Attempting to reconnect...");
        connectToReceiver();
    }
}

function handleIncomingCall() {
    console.log("Incoming call event triggered!");
    
    // 1. Play sound
    const alarm = document.getElementById('alarm-sound');
    alarm.currentTime = 0;
    alarm.play().catch(e => {
        console.warn("Audio play blocked. Interaction might be needed.", e);
        // Fallback: simple alert if audio blocked
        if (!document.hasFocus()) {
            console.log("Tab backgrounded, relying on notification.");
        }
    });

    // 2. Show notification
    if (Notification.permission === "granted") {
        showNotification();
    } else {
        console.log("Notification permission not granted.");
        alert("Incoming Call!");
    }
}

function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            console.log("Notification permission:", permission);
        });
    }
}

function showNotification() {
    const options = {
        body: "Someone is calling you!",
        icon: "https://cdn-icons-png.flaticon.com/512/3616/3616215.png",
        tag: "call-notification",
        renotify: true,
        vibrate: [200, 100, 200]
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("Incoming Call", options);
            setTimeout(() => {
                registration.getNotifications({ tag: 'call-notification' }).then(notifications => {
                    notifications.forEach(n => n.close());
                });
            }, 10000);
        });
    } else {
        const n = new Notification("Incoming Call", options);
        setTimeout(() => n.close(), 10000);
    }
}

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('SW Registered'))
            .catch(err => console.log('SW Failed', err));
    });
}
