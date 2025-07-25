#!/bin/bash

# Install root dependencies (including concurrently)
npm install

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

cd ..
echo "All dependencies installed!" 