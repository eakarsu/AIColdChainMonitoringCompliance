#!/bin/bash

# ============================================
# ColdChain AI - Start Script
# ============================================
# This script:
# 1. Kills processes on used ports
# 2. Sets up PostgreSQL database
# 3. Seeds data (15+ items per feature)
# 4. Starts backend and frontend with hot reload
# ============================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# Load environment variables
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
else
    echo "❌ .env file not found! Please create one."
    exit 1
fi

BACKEND_PORT=${BACKEND_PORT:-3001}
FRONTEND_PORT=${FRONTEND_PORT:-3000}

echo "============================================"
echo "   🧊 ColdChain AI - Starting Application"
echo "============================================"
echo ""

# ---- Step 1: Kill processes on used ports ----
echo "🔧 Cleaning up ports $BACKEND_PORT and $FRONTEND_PORT..."

cleanup_port() {
    local port=$1
    local pids=$(lsof -ti :$port 2>/dev/null || true)
    if [ -n "$pids" ]; then
        echo "   Killing processes on port $port: $pids"
        echo "$pids" | xargs kill -9 2>/dev/null || true
        sleep 1
    else
        echo "   Port $port is free"
    fi
}

cleanup_port $BACKEND_PORT
cleanup_port $FRONTEND_PORT

# ---- Step 2: Install dependencies ----
echo ""
echo "📦 Installing backend dependencies..."
cd "$PROJECT_DIR/backend"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "   Backend dependencies already installed"
fi

echo ""
echo "📦 Installing frontend dependencies..."
cd "$PROJECT_DIR/frontend"
if [ ! -d "node_modules" ]; then
    npm install
else
    echo "   Frontend dependencies already installed"
fi

# ---- Step 3: Setup database and seed data ----
echo ""
echo "🗄️  Setting up PostgreSQL database..."
cd "$PROJECT_DIR"

# Check if PostgreSQL is running
if ! pg_isready -h $DB_HOST -p $DB_PORT > /dev/null 2>&1; then
    echo "   Starting PostgreSQL..."
    brew services start postgresql@14 2>/dev/null || brew services start postgresql 2>/dev/null || {
        echo "⚠️  Could not start PostgreSQL. Please start it manually."
    }
    sleep 2
fi

# Create database if it doesn't exist
echo "   Creating database '$DB_NAME' if not exists..."
createdb -h $DB_HOST -p $DB_PORT -U $DB_USER $DB_NAME 2>/dev/null || echo "   Database already exists"

# Run seed script
echo ""
echo "🌱 Seeding database with sample data..."
cd "$PROJECT_DIR/backend"
node seed.js

# ---- Step 4: Start services with hot reload ----
echo ""
echo "============================================"
echo "   🚀 Starting Services"
echo "============================================"
echo ""
echo "   Backend:  http://localhost:$BACKEND_PORT"
echo "   Frontend: http://localhost:$FRONTEND_PORT"
echo ""
echo "   Login: admin@coldchain.com / admin123"
echo ""
echo "============================================"
echo ""

# Start backend with --watch for hot reload (Node 18+)
cd "$PROJECT_DIR/backend"
node --watch server.js &
BACKEND_PID=$!
echo "   Backend started (PID: $BACKEND_PID)"

# Start frontend with Vite (has built-in HMR)
cd "$PROJECT_DIR/frontend"
npx vite --port $FRONTEND_PORT --host &
FRONTEND_PID=$!
echo "   Frontend started (PID: $FRONTEND_PID)"

# Trap to cleanup on exit
cleanup() {
    echo ""
    echo "🛑 Shutting down..."
    kill $BACKEND_PID 2>/dev/null || true
    kill $FRONTEND_PID 2>/dev/null || true
    echo "   Goodbye!"
    exit 0
}

trap cleanup SIGINT SIGTERM

# Wait for both processes
wait
