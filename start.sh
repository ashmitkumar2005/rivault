#!/bin/bash

# Kill any existing processes
pkill -f "rivault-backend" || true
pkill -f "next-server" || true

echo "🚀 Starting Rivault Local Production..."

# 1. Start Backend
echo "📦 Starting Backend (Port 3001)..."
# Use 'rivault-backend' as process name for easier killing later
export PROCESS_TITLE="rivault-backend"
npx ts-node -r dotenv/config backend/api/server.ts &
BACKEND_PID=$!

# Wait for backend to be ready
sleep 3

# 2. Start Frontend
echo "💻 Starting Frontend (Port 3000)..."
# Next.js start command
npm run dev &
FRONTEND_PID=$!

echo "✅ Rivault is running!"
echo "   - Frontend: http://localhost:3000"
echo "   - Backend:  http://localhost:3001"
echo ""
echo "Press [CTRL+C] to stop both servers."

# Handle shutdown
trap "kill $BACKEND_PID $FRONTEND_PID; exit" SIGINT SIGTERM

# Keep script running
wait
