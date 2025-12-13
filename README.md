# SecureBuy: Full Stack Identity-Bound Ticketing
SecureBuy is a next-generation event ticketing platform designed to eliminate ticket fraud, bot purchases, and unauthorized ticket sharing. By combining device-bound tickets, rotating QR codes, and AI-powered verification, SecureBuy ensures that every ticket is used only by its rightful owner.

#🚨 Problem Statement
A production-ready implementation of SecureBuy using the MERN stack (MongoDB, Express, React, Node.js).
Traditional ticketing systems rely on static QR codes or PDFs, which can be:

Screenshotted and shared

`Resold illegally`

`Used by bots for mass purchasing`

`Difficult to verify in real time`

This results in revenue loss for organizers, overcrowding at venues, and a poor experience for genuine attendees.
## 📂 Project Structure

*   **`backend/`**: Node.js/Express server, MongoDB connection, Gemini AI integration.
*   **`frontend/`**: React application (Vite).

## 🚀 Setup Instructions

### 1. Prerequisites
*   Node.js (v18+)
*   MongoDB (Local or Atlas URL)
*   Google Gemini API Key

### 2. Backend Setup
1.  Navigate to `backend`:
    ```bash
    cd backend
    npm install
    ```
2.  Create a `.env` file in `backend/`:
    ```env
    PORT=5000
    MONGODB_URI=mongodb://localhost:27017/securebuy
    API_KEY=your_google_gemini_key_here
    JWT_SECRET=super_secret_key_change_this
    ```
3.  Start Server:
    ```bash
    cd backend
    cd src
    npm run dev
    ```

### 3. Frontend Setup
1.  Navigate to `frontend`:
    ```bash
    cd frontend
    npm install
    ```
2.  Start Client:
    ```bash
    npm run dev
    ```

## 🛡️ Security Notes
*   **API Keys**: The Gemini API key is now stored on the **Backend**. The frontend calls the backend, which proxies the request to Google. This prevents key leakage.
*   **Database**: All users, tickets, and events are stored in MongoDB.
