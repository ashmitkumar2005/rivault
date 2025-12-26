#!/bin/bash

# Kill any existing processes
pkill -f "wrangler" || true
pkill -f "next-server" || true
pkill -f "rivault-backend" || true

echo "🚀 Starting Rivault Local Production..."

# 1. Start Cloudflare Worker (Backend)
echo "📦 Starting Worker (Port 8787)..."
cd worker
npm run dev > ../worker.log 2>&1 &
WORKER_PID=$!
cd ..

# Wait for worker to be ready
sleep 3

# 2. Start Frontend
echo "💻 Starting Frontend (Port 3000)..."
# Next.js start command
npm run dev > frontend.log 2>&1 &
FRONTEND_PID=$!

echo "✅ Rivault is running!"
echo "   - Frontend: http://localhost:3000"
echo "   - Worker:   http://localhost:8787"
echo ""
echo "Press [CTRL+C] to stop both servers."

# Handle shutdown
trap "kill $WORKER_PID $FRONTEND_PID; exit" SIGINT SIGTERM

# Keep script running
wait
