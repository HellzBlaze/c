let peer = null;
let conn = null;
let deviceRole = "";
let sharedId = "";
let dismissTimeout = null;
let countdownInterval = null;
let vibrationInterval = null;
let wakeLock = null;
let heartbeatInterval = null;

function addLog(msg) {
    const logContent = document.getElementById('log-content');
    const time = new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const entry = document.createElement('div');
    entry.innerText = `[${time}] ${msg}`;
    logContent.prepend(entry);
    console.log(msg);
}

function clearLog() {
    document.getElementById('log-content').innerHTML = '';
}

async function unlockAudio() {
    const alarm = document.getElementById('alarm-sound');
    addLog("Unlocking audio and wake lock...");
    alarm.play().then(() => {
        alarm.pause();
        alarm.currentTime = 0;
        document.getElementById('unlock-view').classList.add('hidden');
        document.getElementById('setup-view').classList.remove('hidden');
        document.getElementById('diag-bar').classList.remove('hidden');
        document.getElementById('log-view').classList.remove('hidden');
        document.getElementById('bottom-controls').classList.remove('hidden');
        requestWakeLock();
    }).catch(e => {
        addLog("Audio unlock failed: " + e.message);
        alert("Please tap again to enable the alarm.");
    });
}

async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            addLog("Screen Wake Lock active");
        } catch (err) {
            addLog("Wake Lock failed: " + err.message);
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
    addLog(`Initializing as ${role} for ID: ${sharedId}`);
    
    const peerId = (role === 'receiver') ? sharedId : null;
    
    if (peer) peer.destroy();
    
    peer = new Peer(peerId, {
        config: {
            'iceServers': [
                { url: 'stun:stun.l.google.com:19302' },
                { url: 'stun:stun1.l.google.com:19302' },
                { url: 'stun:stun2.l.google.com:19302' }
            ]
        },
        debug: 1
    });

    peer.on('open', (id) => {
        addLog("Signaling connected. My Peer ID: " + id);
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
        addLog("Incoming connection from: " + connection.peer);
        conn = connection;
        setupConnListeners();
    });

    peer.on('disconnected', () => {
        addLog("Signaling disconnected. Attempting reconnect...");
        updateStatus('sig', false);
        peer.reconnect();
    });

    peer.on('error', (err) => {
        addLog("PeerJS Error: " + err.type);
        if (err.type === 'peer-unavailable' && deviceRole === 'caller') {
            addLog("Target receiver not found online.");
            document.getElementById('status-msg').innerText = "Receiver not found. Retrying...";
            setTimeout(connectToReceiver, 5000);
        }
    });
}

function connectToReceiver() {
    if (!peer || peer.destroyed) {
        addLog("Cannot connect: Peer not initialized.");
        return;
    }
    addLog(`Attempting P2P link to: ${sharedId}`);
    if (conn) conn.close();
    
    conn = peer.connect(sharedId, { 
        reliable: true,
        metadata: { timestamp: Date.now() }
    });
    setupConnListeners();
}

function setupConnListeners() {
    if (!conn) return;
    
    conn.on('open', () => {
        addLog("P2P Link established ✅");
        updateStatus('p2p', true);
        const statusMsg = document.getElementById('status-msg');
        if (statusMsg) {
            statusMsg.innerText = "Connected ✅";
            statusMsg.classList.add('text-emerald-400');
        }
        
        if (heartbeatInterval) clearInterval(heartbeatInterval);
        heartbeatInterval = setInterval(() => {
            if (conn && conn.open) conn.send('PING');
        }, 5000);
    });

    conn.on('data', (data) => {
        if (data === 'RING') {
            addLog("Incoming RING signal received!");
            handleIncomingCall();
        }
        if (data === 'DISMISSED') {
            addLog("Call dismissed by other device.");
            stopAlarm();
        }
        if (data === 'PING') {
            // Heartbeat received
        }
    });

    conn.on('close', () => {
        addLog("P2P Link closed.");
        updateStatus('p2p', false);
        if (deviceRole === 'caller') {
            addLog("Auto-reconnecting in 5s...");
            setTimeout(connectToReceiver, 5000);
        }
    });

    conn.on('error', (err) => {
        addLog("Connection Error: " + err.message);
    });
}

function triggerCall() {
    if (conn && conn.open) {
        addLog("Sending RING signal...");
        conn.send('RING');
        const statusMsg = document.getElementById('status-msg');
        statusMsg.innerText = "Ringing...";
        setTimeout(() => { 
            if (conn && conn.open) statusMsg.innerText = "Connected ✅"; 
        }, 2000);
    } else {
        addLog("Call failed: No active P2P link.");
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
    alarm.play().catch(e => addLog("Audio blocked: " + e.message));

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
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data === 'STOP_ALARM') dismissCall();
    });
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}
