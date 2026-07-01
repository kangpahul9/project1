#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# KangPOS — Staging deploy script
# Deploys the `new` branch to staging.kangpos.com
# Backend runs on port 3001 as PM2 process "kangpos-staging"
# Usage: bash deploy-staging.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_DIR="/home/ubuntu/project1"
BACKEND_DIR="$REPO_DIR/backend"
FRONTEND_ROOT="$REPO_DIR/frontend"
FRONTEND_DIST="$FRONTEND_ROOT/dist/public"
LANDING_ROOT="$REPO_DIR/landing"
LANDING_DIST="$LANDING_ROOT/dist"
STAGING_APP_DIR="/var/www/staging"
STAGING_LANDING_DIR="/var/www/staging-landing"

echo "── Switching to new branch ──────────────────────────────────"
cd "$REPO_DIR"
git fetch origin
git checkout new
git pull origin new

echo "── Installing backend dependencies ─────────────────────────"
cd "$BACKEND_DIR"
npm ci --omit=dev

echo "── Building frontend (staging) ──────────────────────────────"
cd "$FRONTEND_ROOT"
npm ci
VITE_API_URL=https://staging.kangpos.com npm run build

echo "── Building landing (staging) ───────────────────────────────"
cd "$LANDING_ROOT"
npm ci
VITE_API_URL=https://staging.kangpos.com VITE_STRIPE_PUBLISHABLE_KEY="${VITE_STRIPE_PUBLISHABLE_KEY:-}" npm run build

echo "── Deploying staging static files ───────────────────────────"
sudo mkdir -p "$STAGING_APP_DIR"
sudo rm -rf "$STAGING_APP_DIR"/*
sudo cp -r "$FRONTEND_DIST"/. "$STAGING_APP_DIR"/

sudo mkdir -p "$STAGING_LANDING_DIR"
sudo rm -rf "$STAGING_LANDING_DIR"/*
sudo cp -r "$LANDING_DIST"/. "$STAGING_LANDING_DIR"/

echo "── Restarting staging backend via PM2 ───────────────────────"
cd "$BACKEND_DIR"
# Run on port 3001 with staging DB
if pm2 describe kangpos-staging > /dev/null 2>&1; then
  PORT=3001 NODE_ENV=production DB_NAME=kangpos_staging pm2 reload kangpos-staging --update-env
else
  PORT=3001 NODE_ENV=production DB_NAME=kangpos_staging pm2 start src/index.js \
    --name kangpos-staging \
    --interpreter node \
    -- \
    2>&1
fi

echo "── Reloading nginx ──────────────────────────────────────────"
sudo nginx -t && sudo systemctl reload nginx

echo "✓ Staging deploy complete → https://staging.kangpos.com"
