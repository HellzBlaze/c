let peer = null;
let conn = null;
let deviceRole = "";
let sharedId = "";
let dismissTimeout = null;
let countdownInterval = null;
let vibrationInterval = null;

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
    
    // 1. Show Visual UI
    incomingUI.classList.remove('hidden');
    
    // 2. Play Continuous Boosted Alarm (Media Volume)
    alarm.loop = true;
    alarm.volume = 1.0;
    alarm.currentTime = 0;
    alarm.play().catch(e => console.log("Audio blocked. Interaction needed."));

    // 3. Trigger Continuous Vibration
    if ("vibrate" in navigator) {
        vibrationInterval = setInterval(() => {
            navigator.vibrate([500, 200, 500]);
        }, 1200);
    }

    // 4. Show Notification
    showNotification();

    // 5. Auto-dismiss logic (10 seconds)
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
    
    // Close notifications
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
        body: "Someone is calling you!",
        icon: "https://cdn-icons-png.flaticon.com/512/3616/3616215.png",
        tag: "call-notification",
        renotify: true,
        silent: false,
        requireInteraction: true
    };
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(reg => reg.showNotification("CallNotify", options));
    }
}

if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
        if (event.data === 'STOP_ALARM') dismissCall();
    });
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js');
    });
}
