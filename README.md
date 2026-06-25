# CallNotify - GitHub Call Site

A simple, static HTML call site that allows you to trigger notifications across devices using Firebase.

## Features
- **Real-time Signaling**: Uses Firebase Realtime Database to sync calls between devices.
- **Background Notifications**: Service Worker support for background alerts on Desktop and Android.
- **Mild Alarm**: Custom-generated mild chime sound.
- **Auto-Dismiss**: Notifications disappear after 10 seconds if not dismissed.

## Setup Instructions

To make this site functional, you need to provide your own Firebase configuration:

1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Create a new project.
3. Add a "Web App" to your project.
4. Copy the `firebaseConfig` object.
5. Open `public/app.js` and replace the placeholder `firebaseConfig` with your own.
6. Enable **Realtime Database** in your Firebase project and set the rules to allow read/write for testing (or configure security rules).
7. Deploy the `public` folder to **GitHub Pages**.

## Usage
1. Open the site on two devices.
2. Enter the same **Room ID** on both.
3. Set one as **Receiver** and one as **Caller**.
4. Press the **Call** button on the Caller device.
5. The Receiver device will play a sound and show a notification (even in the background).

## Note on Background Notifications
For background notifications to work on Android/Chrome, the site must be served over **HTTPS** (GitHub Pages provides this) and the user must grant notification permissions.
