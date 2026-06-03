#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# KangPOS — Auto-deploy script
# Runs on EC2 after each git push (e.g. triggered by GitHub Actions or webhook)
#
# One-time EC2 setup: run ec2-setup.sh first.
# Usage: bash deploy.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

APP_DIR="/var/www/kangpos"
REPO_DIR="$APP_DIR/repo"
FRONTEND_DIST="$APP_DIR/frontend"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_SRC="$REPO_DIR/frontend/client"

echo "── Pulling latest code ─────────────────────────────────────"
cd "$REPO_DIR"
git pull origin main

echo "── Installing backend dependencies ─────────────────────────"
cd "$BACKEND_DIR"
npm ci --omit=dev

echo "── Building frontend ────────────────────────────────────────"
cd "$FRONTEND_SRC"
npm ci
npm run build

echo "── Deploying frontend static files ─────────────────────────"
rm -rf "$FRONTEND_DIST"
cp -r "$FRONTEND_SRC/dist" "$FRONTEND_DIST"

echo "── Restarting backend via PM2 ───────────────────────────────"
cd "$BACKEND_DIR"
pm2 reload kangpos-api --update-env || pm2 start src/index.js --name kangpos-api

echo "── Reloading nginx ──────────────────────────────────────────"
sudo nginx -t && sudo systemctl reload nginx

echo "✓ Deploy complete"
