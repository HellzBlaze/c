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
    status.innerText = "Connecting...";

    // Receiver uses the exact ID, Caller uses ID + "-caller"
    const peerId = (role === 'receiver') ? sharedId : `${sharedId}-caller`;
    
    peer = new Peer(peerId);

    peer.on('open', (id) => {
        console.log('My peer ID is: ' + id);
        document.getElementById('setup-view').classList.add('hidden');
        
        if (role === 'caller') {
            document.getElementById('caller-view').classList.remove('hidden');
            document.getElementById('caller-id-display').innerText = `Your ID: ${id}`;
            connectToReceiver();
        } else {
            document.getElementById('receiver-view').classList.remove('hidden');
            document.getElementById('receiver-id-display').innerText = `Listening as: ${id}`;
            requestNotificationPermission();
        }
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnListeners();
    });

    peer.on('error', (err) => {
        console.error(err);
        if (err.type === 'unavailable-id') {
            alert("This ID is already taken. Please choose another one.");
        } else {
            alert("Connection error: " + err.message);
        }
        location.reload();
    });
}

function connectToReceiver() {
    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "Searching for receiver...";
    
    // Try to connect to the receiver's ID
    conn = peer.connect(sharedId);
    setupConnListeners();
}

function setupConnListeners() {
    conn.on('open', () => {
        console.log("Connected to " + conn.peer);
        if (deviceRole === 'caller') {
            document.getElementById('status-msg').innerText = "Connected to Receiver";
        }
    });

    conn.on('data', (data) => {
        if (data === 'RING') {
            handleIncomingCall();
        }
    });

    conn.on('close', () => {
        console.log("Connection closed");
        if (deviceRole === 'caller') {
            document.getElementById('status-msg').innerText = "Receiver disconnected. Reconnecting...";
            setTimeout(connectToReceiver, 3000);
        }
    });
}

function triggerCall() {
    if (conn && conn.open) {
        conn.send('RING');
        const statusMsg = document.getElementById('status-msg');
        statusMsg.innerText = "Calling...";
        statusMsg.classList.add('text-rose-500', 'font-bold');
        
        setTimeout(() => {
            statusMsg.innerText = "Connected to Receiver";
            statusMsg.classList.remove('text-rose-500', 'font-bold');
        }, 2000);
    } else {
        alert("Not connected to receiver yet. Please wait.");
        connectToReceiver();
    }
}

function handleIncomingCall() {
    console.log("Incoming call!");
    
    // 1. Play sound
    const alarm = document.getElementById('alarm-sound');
    alarm.currentTime = 0;
    alarm.play().catch(e => console.log("Audio play blocked: ", e));

    // 2. Show notification
    if (Notification.permission === "granted") {
        showNotification();
    }
}

function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission();
    }
}

function showNotification() {
    const options = {
        body: "Someone is calling you!",
        icon: "https://cdn-icons-png.flaticon.com/512/3616/3616215.png",
        tag: "call-notification",
        renotify: true
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
