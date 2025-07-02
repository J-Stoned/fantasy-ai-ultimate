#!/bin/bash
# Simple web app starter that ignores dependency warnings

cd apps/web

# Build Next.js app
echo "Building Next.js app..."
npx next build

# Start the server
echo "Starting server on port 3000..."
NODE_ENV=production npx tsx server.ts