# CallNotify - Dark Mode P2P Call Site

A self-contained, static HTML call site that uses PeerJS for direct peer-to-peer signaling. No external database or server setup required.

## Features
- **Dark Mode UI**: Sleek, modern interface designed for low-light environments.
- **P2P Signaling**: Uses PeerJS for direct connection between devices.
- **Background Notifications**: Service Worker support for background alerts.
- **Mild Alarm**: Custom-generated mild chime sound.
- **Auto-Dismiss**: Notifications disappear after 10 seconds.

## Setup Instructions

This site is fully self-contained. To deploy:

1. Push this repository to GitHub.
2. Go to **Settings > Pages**.
3. Select the **main** branch and click **Save**.
4. Access your site via the provided URL (must be `https://`).

## How to Use
1. Open the site on two devices.
2. Enter the **same unique ID** on both devices (e.g., `my-private-room-123`).
3. On one device, click **Be Receiver**.
4. On the other device, click **Be Caller**.
5. Once connected, press the **Call** button to trigger the notification and sound on the receiver.

## Technical Details
- **Signaling**: PeerJS (WebRTC)
- **Styling**: Tailwind CSS
- **Notifications**: Web Notifications API + Service Workers
- **Audio**: HTML5 Audio API
