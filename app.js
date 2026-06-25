// Firebase Configuration Template
// Users will need to replace this with their own Firebase project config
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const database = firebase.database();

let currentRoom = "";
let deviceRole = "";

function setupDevice(role) {
    const roomId = document.getElementById('room-id').value.trim();
    if (!roomId) {
        alert("Please enter a Room ID");
        return;
    }

    currentRoom = roomId;
    deviceRole = role;

    document.getElementById('setup-view').classList.add('hidden');
    if (role === 'caller') {
        document.getElementById('caller-view').classList.remove('hidden');
        document.getElementById('caller-room-display').innerText = `Room: ${currentRoom}`;
    } else {
        document.getElementById('receiver-view').classList.remove('hidden');
        document.getElementById('receiver-room-display').innerText = `Room: ${currentRoom}`;
        requestNotificationPermission();
        listenForCalls();
    }
}

function resetView() {
    document.getElementById('setup-view').classList.remove('hidden');
    document.getElementById('caller-view').classList.add('hidden');
    document.getElementById('receiver-view').classList.add('hidden');
    
    // Stop listening if receiver
    if (deviceRole === 'receiver' && currentRoom) {
        database.ref(`rooms/${currentRoom}/call`).off();
    }
}

function triggerCall() {
    if (!currentRoom) return;
    
    const statusMsg = document.getElementById('status-msg');
    statusMsg.innerText = "Calling...";
    statusMsg.classList.remove('text-gray-400');
    statusMsg.classList.add('text-red-500', 'font-bold');

    // Push a call event to Firebase with a timestamp
    database.ref(`rooms/${currentRoom}/call`).set({
        timestamp: Date.now(),
        caller: "Device A" // Can be randomized or set
    }).then(() => {
        setTimeout(() => {
            statusMsg.innerText = "Ready to call";
            statusMsg.classList.remove('text-red-500', 'font-bold');
            statusMsg.classList.add('text-gray-400');
        }, 2000);
    });
}

function listenForCalls() {
    database.ref(`rooms/${currentRoom}/call`).on('value', (snapshot) => {
        const data = snapshot.val();
        if (data && data.timestamp) {
            // Check if call is fresh (within last 5 seconds)
            if (Date.now() - data.timestamp < 5000) {
                handleIncomingCall();
            }
        }
    });
}

function handleIncomingCall() {
    console.log("Incoming call detected!");
    
    // 1. Play sound if tab is active
    const alarm = document.getElementById('alarm-sound');
    alarm.currentTime = 0;
    alarm.play().catch(e => console.log("Audio play blocked: ", e));

    // 2. Show notification (works in background if SW is registered)
    if (Notification.permission === "granted") {
        showNotification();
    }
}

function requestNotificationPermission() {
    if ("Notification" in window) {
        Notification.requestPermission().then(permission => {
            if (permission !== "granted") {
                alert("Please enable notifications to receive calls in the background.");
            }
        });
    }
}

function showNotification() {
    const options = {
        body: "Someone is calling you!",
        icon: "https://cdn-icons-png.flaticon.com/512/3616/3616215.png",
        tag: "call-notification",
        renotify: true,
        silent: false 
    };

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification("Incoming Call", options);
            
            // Auto-dismiss after 10 seconds
            setTimeout(() => {
                registration.getNotifications({ tag: 'call-notification' }).then(notifications => {
                    notifications.forEach(notification => notification.close());
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
            .then(reg => console.log('SW Registered', reg))
            .catch(err => console.log('SW Registration Failed', err));
    });
}
