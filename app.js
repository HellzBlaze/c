let peer = null;
let conn = null;
let deviceRole = "";
let sharedId = "";
let dismissTimeout = null;
let countdownInterval = null;
let vibrationInterval = null;
let wakeLock = null;

async function unlockAudio() {
    // Play and immediately pause to unlock audio
    const alarm = document.getElementById('alarm-sound');
    alarm.play().then(() => {
        alarm.pause();
        alarm.currentTime = 0;
        document.getElementById('unlock-view').classList.add('hidden');
        document.getElementById('setup-view').classList.remove('hidden');
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

    const peerId = (role === 'receiver') ? sharedId : null;
    
    if (peer) peer.destroy();
    peer = new Peer(peerId);

    peer.on('open', (id) => {
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

    peer.on('error', (err) => {
        console.error("Peer Error:", err);
        if (err.type === 'peer-unavailable' && deviceRole === 'caller') {
            document.getElementById('status-msg').innerText = "Receiver offline. Retrying...";
            setTimeout(connectToReceiver, 3000);
        }
    });
}

function connectToReceiver() {
    if (!peer || peer.destroyed) return;
    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "Connecting...";
    if (conn) conn.close();
    conn = peer.connect(sharedId, { reliable: true });
    setupConnListeners();
}

function setupConnListeners() {
    if (!conn) return;
    conn.on('open', () => {
        const statusMsg = document.getElementById('status-msg');
        statusMsg.innerText = "Connected ✅";
        statusMsg.classList.add('text-emerald-400');
    });
    conn.on('data', (data) => {
        if (data === 'RING') handleIncomingCall();
        if (data === 'DISMISSED') stopAlarm();
    });
}

function triggerCall() {
    if (conn && conn.open) {
        conn.send('RING');
        const statusMsg = document.getElementById('status-msg');
        statusMsg.innerText = "Ringing...";
        setTimeout(() => { statusMsg.innerText = "Connected ✅"; }, 2000);
    } else {
        connectToReceiver();
    }
}

function handleIncomingCall() {
    const alarm = document.getElementById('alarm-sound');
    const incomingUI = document.getElementById('incoming-call-ui');
    const timerDisplay = document.getElementById('auto-dismiss-timer');
    
    incomingUI.classList.remove('hidden');
    
    // Continuous Alarm (Media Volume)
    alarm.loop = true;
    alarm.volume = 1.0;
    alarm.currentTime = 0;
    alarm.play().catch(e => console.log("Audio blocked. Interaction needed."));

    // Continuous Vibration
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
        vibrate: [500, 100, 500, 100, 500, 100, 500, 100, 500, 100, 500]
    };
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification("CallNotify", options));
    }
}

// Re-request wake lock if tab becomes visible again
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
