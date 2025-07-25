#!/bin/bash

echo "🚀 Starting Open Source Growth Tracker..."

# Check if dependencies are installed
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    bash setup.sh
fi

# Ensure concurrently is installed in the root
if [ ! -d "node_modules" ]; then
    echo "📦 Installing root dependencies..."
    npm install
fi

# Start the app
echo "🌟 Starting the app..."
npm start 