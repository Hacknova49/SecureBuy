# SecureBuy: Identity-Bound Ticketing System

**SecureBuy** is a next-generation ticketing platform designed to eliminate ticket scalping, fraud, and unauthorized transfers. Unlike traditional static QR codes, SecureBuy binds every ticket to the user's specific hardware device and generates dynamic, rotating QR codes that cannot be screenshotted or shared.

Powered by **React**, **Tailwind CSS**, and **Google Gemini 2.5**.

---

## 🚀 Key Features

### For Attendees (Users)
*   **Device Binding:** Your account and tickets are strictly locked to your physical device. You cannot login on a different phone without a recovery key.
*   **Dynamic QR Codes:** Tickets use TOTP (Time-based One-Time Password) logic. The QR code changes every 15 seconds. Old screenshots are invalid.
*   **AI Concierge ("Nexus"):** A cyberpunk-themed AI assistant powered by Google Gemini 2.5 Flash. It helps you find events, checks availability, and provides Google Maps locations.
*   **Secure Wallet:** View your purchased tickets in a secure, holographic interface.

### For Organizers (Managers)
*   **Gatekeeper Scanner:** A dedicated scanning interface that verifies dynamic tokens.
*   **AI Risk Assessment:** When a ticket is scanned, the AI analyzes metadata (scan time, user history) to provide a one-sentence risk assessment to security staff.
*   **Live Dashboard:** Real-time stats on revenue (in INR) and tickets sold.
*   **Smart Event Creation:** AI-powered "Auto-Hype" generates exciting event descriptions automatically.

---

## 🛡️ Security Architecture

1.  **Hardware Fingerprinting:**
    *   Upon registration, a unique `deviceId` is generated and stored in the browser's local storage.
    *   The user's account is cryptographically bound to this ID in the database.
    *   Login attempts from a mismatched `deviceId` are blocked immediately.

2.  **TOTP (Time-based One-Time Password):**
    *   When a ticket is purchased, a unique `seedSecret` is generated.
    *   The App generates a 6-digit token based on the current time (15-second window) and the secret.
    *   The QR code contains `TicketID::Token`.
    *   The Scanner validates if `HMAC-SHA1(Secret, Time) == Token`.

3.  **Anti-Screenshot UI:**
    *   The ticket view detects if the application goes into the background or if the user switches tabs, blurring the screen to discourage screen recording.

---

## 🛠️ Tech Stack

*   **Frontend:** React 19, TypeScript, Vite
*   **Styling:** Tailwind CSS (Cyberpunk/Neon aesthetic)
*   **AI & Intelligence:** Google Gemini API (`gemini-2.5-flash`)
    *   Used for: Chat Concierge, Event Description Generation, Security Risk Analysis, Maps Grounding.
*   **Icons:** Lucide React
*   **Persistence:** LocalStorage (Mock Database for demonstration)

---

## ⚙️ Installation & Setup

### 1. Prerequisites
*   Node.js (v18 or higher)
*   A Google Gemini API Key (Get it from [Google AI Studio](https://aistudio.google.com/))

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure API Key
Create a `.env` file in the root directory (or set it in your environment variables):
```env
API_KEY=your_google_gemini_api_key_here
```
*Note: The application uses `process.env.API_KEY`. Ensure your bundler (Vite/Webpack) is configured to expose this, or hardcode it for local testing (not recommended for production).*

### 4. Run the Application
```bash
npm start
```

---

## 📖 User Guide

### Account Creation
1.  Open the app.
2.  Select **Attendee** or **Organizer**.
3.  Enter an email and name.
4.  **Important:** If registering as an Attendee, save the **Recovery Code** presented. This is the *only* way to recover your tickets if you clear your browser cache or lose your device.

### Buying a Ticket (Attendee)
1.  Browse events (Default location: India).
2.  Chat with **Nexus AI** to find specific vibes or ask for directions.
3.  Add tickets to cart and checkout.
4.  Go to "My Tickets" to view your Secure QR.

### Scanning a Ticket (Organizer)
1.  Log out and log back in as an **Organizer**.
2.  Go to the **Scan** tab.
3.  Use the camera (or manual entry `TICK-ID::TOKEN`) to scan a user's QR code.
4.  The system validates the dynamic token and the AI assesses the risk.

---

## ⚠️ Limitations (Demo Version)
*   **Data Persistence:** This demo uses `localStorage`. Clearing browser data will wipe accounts and tickets.
*   **Time Sync:** The TOTP implementation relies on the device clock. In production, this should sync with a server time endpoint (NTP).
*   **Cryptography:** The TOTP implementation is a lightweight simulation for the frontend demo. Production apps should use the Web Crypto API.

---

## 📄 License
MIT
