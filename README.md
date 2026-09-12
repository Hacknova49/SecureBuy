# SecureBuy: Full Stack Identity-Bound Ticketing
SecureBuy is a next-generation event ticketing platform designed to eliminate ticket fraud, bot purchases, and unauthorized ticket sharing. By combining device-bound tickets, rotating QR codes, and AI-powered verification, SecureBuy ensures that every ticket is used only by its rightful owner.

# 🚨 Problem Statement
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
2.  Copy `backend/.env.example` to `backend/.env` and replace the placeholders:
    ```powershell
    Copy-Item backend/.env.example backend/.env
    ```
    - `PORT`: backend HTTP port; keep `5000` locally.
    - `MONGODB_URI`: current runtime database during migration, for example `mongodb://127.0.0.1:27017/securebuy`.
    - `DATABASE_URL`: Supabase transaction pooler URL, used by Prisma runtime after cutover.
    - `DIRECT_URL`: Supabase direct database URL, used by Prisma migrations.
    - `GEMINI_API_KEY`: server-only Google Gemini key; never put this in frontend env.
    - `JWT_SECRET`: long random signing secret; generate with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
    - `CORS_ORIGIN`: frontend origin, normally `http://localhost:3000`.
3.  Start Server:
    ```bash
    cd backend
    cd src
    npm run dev
    ```

The frontend uses `VITE_API_URL` when set; otherwise it targets the deployed API.

### 3. Frontend Setup
1.  Navigate to `frontend`:
    ```bash
    cd frontend
    npm install
    ```
2.  Copy `frontend/.env.example` to `frontend/.env`:
    ```powershell
    Copy-Item frontend/.env.example frontend/.env
    ```
    Set `VITE_API_URL=http://localhost:5000` for local development, or your deployed backend URL in production.
3.  Start Client:
    ```bash
    npm run dev
    ```

## 🛡️ Security Notes
*   **API Keys**: The Gemini API key is now stored on the **Backend**. The frontend calls the backend, which proxies the request to Google. This prevents key leakage.
*   **Database**: Supabase PostgreSQL is being introduced behind Prisma. MongoDB remains available during the migration/cutover phase.

### Supabase database migration

The backend now includes a versioned PostgreSQL schema in `backend/prisma/`. In Supabase, open **Project Settings → Database → Connection strings**. Copy the **transaction pooler** connection into `DATABASE_URL` and the **direct** connection into `DIRECT_URL`; replace the password placeholder and URL-encode special password characters. Keep both server-only.

```env
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:<password>@db.<project-ref>.supabase.co:5432/postgres
```

Apply migrations only after taking a Supabase backup:

```bash
cd backend
npm run db:status
npm run db:migrate
```

The application still uses MongoDB until the repository layer cutover is completed and verified. Running `npm run db:migrate` creates the Supabase tables but does not switch application traffic.
