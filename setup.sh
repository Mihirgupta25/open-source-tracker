#!/bin/bash

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install

cd ..
echo "All dependencies installed!" 