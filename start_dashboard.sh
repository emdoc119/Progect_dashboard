#!/bin/bash
cd ~/.gemini/antigravity/scratch/Progect_dashboard

echo "Installing pm2 locally..."
npm install pm2

echo "Starting Dashboard with PM2..."
npx pm2 delete progect_dashboard 2>/dev/null || true
DASHBOARD_ALLOW_LAN=true npx pm2 start server.js --name "progect_dashboard"
npx pm2 save

echo "Dashboard is now running in the background! You can close this terminal."
