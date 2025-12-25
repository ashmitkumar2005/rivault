# Rivault Deployment Guide

Since Rivault uses a separate **Backend (Node.js)** and **Frontend (Next.js)**, you must deploy them as TWO separate services on Render (or use Docker).

## Option A: Render (Easiest)

### 1. Deploy Frontend (Web Service)
- **Repo**: Rivault (Same repo)
- **Root Directory**: `.` (Root)
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**:
  - `NEXT_PUBLIC_API_URL`: `https://your-backend-service.onrender.com` (Value from Step 2)

### 2. Deploy Backend (Web Service)
- **Repo**: Rivault (Same repo)
- **Root Directory**: `.` (Root)
- **Build Command**: `npm install && npx tsc --project backend/tsconfig.json`
- **Start Command**: `npx ts-node -r dotenv/config backend/api/server.ts`
- **Environment Variables**:
  - `ALLOWED_ORIGINS`: `https://your-frontend-service.onrender.com` (Value from Step 1)
  - `RIVAULT_MASTER_PASSWORD`: (Your secret password)
  - `RIVAULT_SALT`: (Random string, e.g. `somesRandomSalt123`)
  - `GITHUB_TOKEN`: (Optional, for persistent storage)
  - `GIST_ID`: (Optional, for persistent storage)

## Option B: Docker (All-in-One)
You can use a `Dockerfile` to run both, but scaling is harder. Recommended to stick to Option A.
