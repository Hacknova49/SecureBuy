# SecureBuy: Full Stack Identity-Bound Ticketing

A production-ready implementation of SecureBuy using the MERN stack (MongoDB, Express, React, Node.js).

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
