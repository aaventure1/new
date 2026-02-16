#!/bin/bash
# AAVenture Quick Start Script

echo "🚀 Starting AAVenture..."

# Check if Docker is running
if ! docker info >/dev/null 2>&1; then
    echo "⚠️  Docker not running. Starting Docker..."
    open -a Docker
    echo "Waiting for Docker to start..."
    while ! docker info >/dev/null 2>&1; do
        sleep 2
    done
    echo "✅ Docker is ready"
fi

# Start MongoDB container
echo "📦 Starting MongoDB..."
docker-compose up -d

# Wait for MongoDB to be ready
echo "⏳ Waiting for MongoDB..."
sleep 3

# Start the server
echo "🌐 Starting AAVenture server..."
echo ""
echo "================================"
echo "  AAVenture is running at:"
echo "  http://localhost:3000"
echo ""
echo "  Admin Login:"
echo "  Email: admin@aaventure.com"
echo "  Password: AdminPass123!"
echo "================================"
echo ""

node server/index.js
