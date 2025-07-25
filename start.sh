#!/bin/bash

echo "🚀 Starting Open Source Growth Tracker..."

# Check if dependencies are installed
if [ ! -d "backend/node_modules" ] || [ ! -d "frontend/node_modules" ]; then
    echo "📦 Installing dependencies..."
    bash setup.sh
fi

# Start the app
echo "🌟 Starting the app..."
npm start 