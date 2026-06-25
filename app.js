let peer = null;
let conn = null;
let deviceRole = "";
let sharedId = "";
let dismissTimeout = null;
let countdownInterval = null;
let vibrationInterval = null;
let wakeLock = null;
let heartbeatInterval = null;

async function unlockAudio() {
    const alarm = document.getElementById('alarm-sound');
    alarm.play().then(() => {
        alarm.pause();
        alarm.currentTime = 0;
        document.getElementById('unlock-view').classList.add('hidden');
        document.getElementById('setup-view').classList.remove('hidden');
        document.getElementById('diag-bar').classList.remove('hidden');
        requestWakeLock();
    }).catch(e => {
        alert("Please tap again to enable the alarm.");
    });
}

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log('Wake Lock active');
        } catch (err) {
            console.error(`${err.name}, ${err.message}`);
        }
    }
}

function updateStatus(type, active) {
    const dot = document.getElementById(`${type}-dot`);
    if (dot) {
        dot.classList.remove('bg-red-500', 'bg-emerald-500');
        dot.classList.add(active ? 'bg-emerald-500' : 'bg-red-500');
    }
}

function initPeer(role) {
    const idInput = document.getElementById('peer-id-input').value.trim();
    if (!idInput) {
        alert("Please enter a unique ID");
        return;
    }

    sharedId = idInput;
    deviceRole = role;
    const status = document.getElementById('init-status');
    status.innerText = "Connecting to signaling...";

    const peerId = (role === 'receiver') ? sharedId : null;
    
    if (peer) peer.destroy();
    
    // PeerJS configuration for better cross-network reliability
    peer = new Peer(peerId, {
        config: {
            'iceServers': [
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'stun:stun1.l.google.com:19302' }
            ]
        }
    });

    peer.on('open', (id) => {
        updateStatus('sig', true);
        document.getElementById('setup-view').classList.add('hidden');
        if (role === 'caller') {
            document.getElementById('caller-view').classList.remove('hidden');
            document.getElementById('caller-id-display').innerText = `Target: ${sharedId}`;
            connectToReceiver();
        } else {
            document.getElementById('receiver-view').classList.remove('hidden');
            document.getElementById('receiver-id-display').innerText = `ID: ${sharedId}`;
            requestNotificationPermission();
        }
    });

    peer.on('connection', (connection) => {
        conn = connection;
        setupConnListeners();
    });

    peer.on('disconnected', () => {
        updateStatus('sig', false);
        peer.reconnect();
    });

    peer.on('error', (err) => {
        console.error("Peer Error:", err);
        if (err.type === 'peer-unavailable' && deviceRole === 'caller') {
            document.getElementById('status-msg').innerText = "Receiver not found. Retrying...";
            setTimeout(connectToReceiver, 3000);
        }
    });
}

function connectToReceiver() {
    if (!peer || peer.destroyed) return;
    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "Linking devices...";
    if (conn) conn.close();
    
    conn = peer.connect(sharedId, { reliable: true });
    setupConnListeners();
}

function setupConnListeners() {
    if (!conn) return;
    
    conn.on('open', () => {
        updateStatus('p2p', true);
        const statusMsg = document.getElementById('status-msg');
        statusMsg.innerText = "Connected ✅";
        statusMsg.classList.add('text-emerald-400');
        
        // Start Heartbeat to keep mobile connection alive
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (conn && conn.open) conn.send('PING');
        }, 5000);
    });

    conn.on('data', (data) => {
        if (data === 'RING') handleIncomingCall();
        if (data === 'DISMISSED') stopAlarm();
        if (data === 'PING') console.log('Heartbeat received');
    });

    conn.on('close', () => {
        updateStatus('p2p', false);
        if (deviceRole === 'caller') {
            setTimeout(connectToReceiver, 3000);
        }
    });
}

function triggerCall() {
    if (conn && conn.open) {
        conn.send('RING');
        const statusMsg = document.getElementById('status-msg');
        statusMsg.innerText = "Ringing...";
        setTimeout(() => { 
            if (conn && conn.open) statusMsg.innerText = "Connected ✅"; 
        }, 2000);
    } else {
        connectToReceiver();
    }
}

function handleIncomingCall() {
    const alarm = document.getElementById('alarm-sound');
    const incomingUI = document.getElementById('incoming-call-ui');
    const timerDisplay = document.getElementById('auto-dismiss-timer');
    
    incomingUI.classList.remove('hidden');
    alarm.loop = true;
    alarm.volume = 1.0;
    alarm.currentTime = 0;
    alarm.play().catch(e => console.log("Audio blocked"));

    if ("vibrate" in navigator) {
        vibrationInterval = setInterval(() => {
            navigator.vibrate([500, 200, 500, 200, 500]);
        }, 1500);
    }

    showNotification();

    let secondsLeft = 10;
    timerDisplay.innerText = `Auto-dismissing in ${secondsLeft}s...`;
    
    if (countdownInterval) clearInterval(countdownInterval);
    countdownInterval = setInterval(() => {
        secondsLeft--;
        timerDisplay.innerText = `Auto-dismissing in ${secondsLeft}s...`;
        if (secondsLeft <= 0) dismissCall();
    }, 1000);

    if (dismissTimeout) clearTimeout(dismissTimeout);
    dismissTimeout = setTimeout(dismissCall, 10000);
}

function dismissCall() {
    stopAlarm();
    if (conn && conn.open) conn.send('DISMISSED');
}

function stopAlarm() {
    const alarm = document.getElementById('alarm-sound');
    const incomingUI = document.getElementById('incoming-call-ui');
    alarm.pause();
    incomingUI.classList.add('hidden');
    if (vibrationInterval) clearInterval(vibrationInterval);
    if (countdownInterval) clearInterval(countdownInterval);
    if (dismissTimeout) clearTimeout(dismissTimeout);
    if ("vibrate" in navigator) navigator.vibrate(0);
    
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => {
            reg.getNotifications({ tag: 'call-notification' }).then(ns => ns.forEach(n => n.close()));
        });
    }
}

function requestNotificationPermission() {
    if ("Notification" in window) Notification.requestPermission();
}

function showNotification() {
    const options = {
        body: "URGENT: Someone is calling you!",
        icon: "https://cdn-icons-png.flaticon.com/512/3616/3616215.png",
        tag: "call-notification",
        renotify: true,
        silent: false,
        requireInteraction: true,
        vibrate: [500, 100, 500, 100, 500, 100, 500]
    };
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification("CallNotify", options));
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible') {
        requestWakeLock();
    }
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}
