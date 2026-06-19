#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# KangPOS — Auto-deploy script
# Runs on EC2 after each git push (e.g. triggered by GitHub Actions or webhook)
#
# One-time EC2 setup: run ec2-setup.sh first.
# Usage: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/var/www/html"
REPO_DIR="/home/ubuntu/project1"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_ROOT="$REPO_DIR/frontend"
FRONTEND_DIST="$FRONTEND_ROOT/dist/public"

echo "── Pulling latest code ─────────────────────────────────────"
cd "$REPO_DIR"
git pull origin main

echo "── Installing backend dependencies ─────────────────────────"
cd "$BACKEND_DIR"
npm ci --omit=dev

echo "── Building frontend ────────────────────────────────────────"
cd "$FRONTEND_ROOT"
npm ci
npm run build

echo "── Deploying frontend static files ─────────────────────────"
sudo rm -rf "$APP_DIR"/*
sudo cp -r "$FRONTEND_DIST"/. "$APP_DIR"/

echo "── Restarting backend via PM2 ───────────────────────────────"
cd "$BACKEND_DIR"
pm2 reload kangpos --update-env || pm2 start src/index.js --name kangpos

echo "── Reloading nginx ──────────────────────────────────────────"
sudo nginx -t && sudo systemctl reload nginx

echo "✓ Deploy complete"
