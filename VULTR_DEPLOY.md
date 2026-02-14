# Asthate Vultr Setup (Inquiry + DD + Portal Intake)

This guide deploys:
- Static website via `nginx`
- Intake API (`/api/*`) via Node.js + Express
- MySQL storage for submitted forms

## 1) Server Security First

1. Change your root password immediately.
2. Create a non-root sudo user.
3. Disable root SSH login after key setup.

## 2) Install Base Packages

```bash
sudo apt update
sudo apt install -y nginx mysql-server ufw curl git
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

## 3) Firewall

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'
sudo ufw --force enable
```

## 4) Upload Project

Copy this project to the server (example path):

```bash
mkdir -p /var/www/asthate
cd /var/www/asthate
# then upload files here (git clone or scp)
```

## 5) MySQL Setup

```bash
sudo mysql
```

Inside MySQL:

```sql
CREATE DATABASE IF NOT EXISTS asthate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'asthate_user'@'localhost' IDENTIFIED BY 'CHANGE_THIS_STRONG_DB_PASSWORD';
GRANT ALL PRIVILEGES ON asthate.* TO 'asthate_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

Run schema:

```bash
mysql -u asthate_user -p asthate < /var/www/asthate/server/schema.sql
```

## 6) API Environment

```bash
cd /var/www/asthate/server
cp .env.example .env
```

Edit `.env`:

```env
PORT=8080
NODE_ENV=production
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=asthate_user
DB_PASSWORD=CHANGE_THIS_STRONG_DB_PASSWORD
DB_NAME=asthate
# If you are testing directly with server IP (no domain yet):
ALLOWED_ORIGINS=http://139.180.223.253

# If domain is connected later, replace with:
# ALLOWED_ORIGINS=https://your-domain.com,https://www.your-domain.com
```

Install API deps:

```bash
cd /var/www/asthate/server
npm install
```

## 7) Run API as systemd Service

Create `/etc/systemd/system/asthate-api.service`:

```ini
[Unit]
Description=Asthate Intake API
After=network.target

[Service]
Type=simple
WorkingDirectory=/var/www/asthate/server
ExecStart=/usr/bin/node /var/www/asthate/server/index.js
Restart=always
RestartSec=3
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

Enable/start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable asthate-api
sudo systemctl start asthate-api
sudo systemctl status asthate-api
```

## 8) Nginx Reverse Proxy

Create `/etc/nginx/sites-available/asthate`:

```nginx
server {
    listen 80;
    # IP-only test (current):
    server_name 139.180.223.253;
    # When domain is ready, replace with:
    # server_name your-domain.com www.your-domain.com;

    root /var/www/asthate;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:8080/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

Enable site:

```bash
sudo ln -s /etc/nginx/sites-available/asthate /etc/nginx/sites-enabled/asthate
sudo nginx -t
sudo systemctl reload nginx
```

## 9) SSL (Let's Encrypt)

If you are using only IP (`139.180.223.253`), skip this step for now.
Let's Encrypt issues certificates for domains, not bare IP in this flow.

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

## 10) Smoke Tests

```bash
curl http://127.0.0.1:8080/api/health
curl -X POST http://127.0.0.1:8080/api/inquiry \
  -H "Content-Type: application/json" \
  -d '{"full_name":"Test","email":"test@example.com","organization":"Demo","investor_type":"Institution","jurisdiction":"SG","ticket_size":"100k - 500k","notes":"test","website":""}'
```

You should see `{ "ok": true, ... }`.

## 11) Optional Next Step

Add admin dashboard and email notifications (e.g. Resend/SMTP) so each submission is delivered to your inbox instantly.
