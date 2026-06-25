#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# KangPOS — EC2 First-Time Setup Script
# Run this ONCE on a fresh Ubuntu 22.04 EC2 instance.
# Usage: bash ec2-setup.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e

REPO_URL="https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPO_NAME.git"
APP_DIR="/var/www/kangpos"
DB_NAME="pos_db"
DB_USER="kangpos"
DB_PASS="$(openssl rand -hex 16)"   # auto-generated secure password

echo "── System update ────────────────────────────────────────────"
sudo apt-get update -y
sudo apt-get upgrade -y

echo "── Install Node.js 20 ───────────────────────────────────────"
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

echo "── Install PostgreSQL ───────────────────────────────────────"
sudo apt-get install -y postgresql postgresql-contrib

echo "── Install Nginx ────────────────────────────────────────────"
sudo apt-get install -y nginx

echo "── Install PM2 ──────────────────────────────────────────────"
sudo npm install -g pm2
pm2 startup systemd -u ubuntu --hp /home/ubuntu

echo "── Create app directories ───────────────────────────────────"
sudo mkdir -p "$APP_DIR/frontend"
sudo mkdir -p "$APP_DIR/uploads"
sudo chown -R ubuntu:ubuntu "$APP_DIR"
chmod 755 "$APP_DIR/uploads"

echo "── Setup PostgreSQL ─────────────────────────────────────────"
sudo -u postgres psql <<SQL
CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
CREATE DATABASE $DB_NAME OWNER $DB_USER;
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
SQL

echo ""
echo "  ┌──────────────────────────────────────────────┐"
echo "  │  DB User:     $DB_USER                       │"
echo "  │  DB Name:     $DB_NAME                        │"
echo "  │  DB Password: $DB_PASS  ← SAVE THIS NOW      │"
echo "  └──────────────────────────────────────────────┘"
echo ""

echo "── Clone repository ─────────────────────────────────────────"
git clone "$REPO_URL" "$APP_DIR/repo"

echo "── Create backend .env ──────────────────────────────────────"
cat > "$APP_DIR/repo/backend/.env" <<ENV
NODE_ENV=production
PORT=3000
JWT_SECRET=$(openssl rand -hex 32)
DB_HOST=localhost
DB_PORT=5432
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASS
DB_NAME=$DB_NAME
DB_SSL=false
FRONTEND_URL=http://$(curl -s ifconfig.me)
CLIENT_URL=http://$(curl -s ifconfig.me)
UPLOAD_DIR=$APP_DIR/uploads
SYSTEM_EMAIL=
SYSTEM_EMAIL_PASSWORD=
OWNER_ALERT_EMAIL=
OPENAI_API_KEY=
XERO_CLIENT_ID=
XERO_CLIENT_SECRET=
XERO_REDIRECT_URI=http://$(curl -s ifconfig.me)/api/xero/callback
ENV

echo "  → Edit $APP_DIR/repo/backend/.env to fill in OPENAI, Xero, Email keys"

echo "── Initialise database schema ───────────────────────────────"
psql -U "$DB_USER" -d "$DB_NAME" -f "$APP_DIR/repo/backend/schema.sql"

echo "── Setup Nginx ──────────────────────────────────────────────"
sudo cp "$APP_DIR/repo/nginx.conf" /etc/nginx/sites-available/kangpos
sudo ln -sf /etc/nginx/sites-available/kangpos /etc/nginx/sites-enabled/kangpos
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl enable nginx
sudo systemctl start nginx

echo "── First deploy ─────────────────────────────────────────────"
bash "$APP_DIR/repo/deploy.sh"

echo ""
echo "✓ EC2 setup complete."
echo "  App is live at: http://$(curl -s ifconfig.me)"
echo ""
echo "  Next steps:"
echo "  1. Fill in API keys in $APP_DIR/repo/backend/.env"
echo "  2. Run: pm2 reload kangpos-api --update-env"
echo "  3. Point your domain DNS A record to this EC2 IP"
