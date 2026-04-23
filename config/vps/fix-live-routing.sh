#!/usr/bin/env bash
set -euo pipefail

APEX_HOST="${1:-clinchworks.in}"
CANONICAL_HOST="${2:-www.${APEX_HOST}}"
SITE_NAME="${3:-clinchworks}"
SITE_CONF="/etc/nginx/sites-available/${SITE_NAME}"
ENABLED_LINK="/etc/nginx/sites-enabled/${SITE_NAME}"

echo "[1/8] Detecting nginx site config"
if [[ ! -f "$SITE_CONF" ]]; then
  echo "Default site file not found at: $SITE_CONF"
  echo "Trying to detect the active file for host: $APEX_HOST"

  NGINX_DUMP="$(mktemp)"
  sudo nginx -T >"$NGINX_DUMP" 2>/dev/null

  SITE_CONF="$(awk -v host="$APEX_HOST" '
  /^# configuration file / {
    line=$0
    sub(/^# configuration file /, "", line)
    split(line, a, ":")
    file=a[1]
  }
  /server_name/ {
    if (index($0, host) > 0) {
      print file
      exit
    }
  }
  ' "$NGINX_DUMP")"

  rm -f "$NGINX_DUMP"

  if [[ -z "${SITE_CONF:-}" || ! -f "$SITE_CONF" ]]; then
    echo "ERROR: Could not detect an nginx site config for host: $APEX_HOST"
    exit 1
  fi

  SITE_NAME="$(basename "$SITE_CONF")"
  ENABLED_LINK="/etc/nginx/sites-enabled/${SITE_NAME}"
fi

echo "Using site config: $SITE_CONF"
BACKUP_PATH="${SITE_CONF}.bak.$(date +%Y%m%d-%H%M%S)"
sudo cp "$SITE_CONF" "$BACKUP_PATH"
echo "Backup saved: $BACKUP_PATH"

echo "[2/8] Detecting web root"
WEB_ROOT="$(awk '
/^[[:space:]]*root[[:space:]]+/ {
  root=$2
  gsub(/;/, "", root)
  print root
  exit
}
' "$SITE_CONF" 2>/dev/null || true)"

if [[ -z "${WEB_ROOT:-}" ]]; then
  WEB_ROOT="/var/www/clinchworks"
fi

echo "Using web root: $WEB_ROOT"

echo "[3/8] Writing repaired nginx config"
TMP_CONF="$(mktemp)"

cat >"$TMP_CONF" <<'EOF'
# Managed by config/vps/fix-live-routing.sh
# Canonical policy: redirect apex -> canonical host and serve clean /slug URLs.

server {
    listen 80;
    listen [::]:80;
    server_name __APEX_HOST__;
    return 301 https://__CANONICAL_HOST__$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name __CANONICAL_HOST__;
    return 301 https://__CANONICAL_HOST__$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name __APEX_HOST__;

    ssl_certificate /etc/letsencrypt/live/__APEX_HOST__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__APEX_HOST__/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    return 301 https://__CANONICAL_HOST__$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name __CANONICAL_HOST__;

    root __WEB_ROOT__;
    index index.html;

    ssl_certificate /etc/letsencrypt/live/__APEX_HOST__/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/__APEX_HOST__/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Content-Security-Policy "default-src 'self'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; frame-src 'self' https://*.firebaseapp.com; object-src 'none'; script-src 'self' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com https://www.gstatic.com https://apis.google.com https://*.firebaseapp.com 'sha256-1V9OeVOgczaU1mkVyVpychYYRxedP/Wdx5a3dq3vD5s=' 'sha256-3f9eqhHOXVBsGxXI21KkWe+tYactjyv1AFAXRJVc1xc=' 'sha256-5Fh5cnZN863k0Nhuq/R0JrJBNynL1Zp8EsqVnAOjwrg=' 'sha256-HhcuCFAFyj/tzLxuW6hNi0vR6F8KQt3yNvFnrwxwkPs=' 'sha256-Pc+AinygybJgTmWHzkW4yb+2FtISAUCU+19wLHDQGFU=' 'sha256-QgT8bSXCFdRFtUwPG3p+nmT84KFOKesrobiUtnqrvs8=' 'sha256-WV1uE1RBUBDsZaFohde0pvj/TH8aTzJwC26j+6P6PFw=' 'sha256-XMdr/QAPhu9Au02SuKn6W+qaD32gHxyMD6OXf1TczdI=' 'sha256-YThqGKQOI6IqQ+klhSa6WFF3eMdzhNDoujpKhLUlZlw=' 'sha256-YeFzxNHmkSwfx90XElxmz3vE7VhOUkpOZqzNmCRdJYw=' 'sha256-cy7Ksp7APzgFDUvaRtPP4RN7TMbMBage/z15CWaAoGM=' 'sha256-gyorwW+4JHxtAxntECOMW8YX705QyxDd52Dfovtvd04=' 'sha256-x7O/qr8g264+IH+ysRdODVT/2o7Dk0yCc89f6xDatJA=' 'sha256-xJ/JzQD9w6xKgJKG2uc7PfKuLcR7WtFTdOjTB0r+QNc='; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: https:; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com;" always;

    # Serve custom 404 page instead of default nginx error page.
    error_page 404 /404.html;
    location = /404.html {
        # Prefer pages/404.html so your added file works without moving.
        try_files /pages/404.html /404 .html =404;
    }

    # Block all hidden files/directories except .well-known (for Let's Encrypt)
    location ~ /\.(?!well-known)(.*)$ { return 404; }

    # Block functions and data directories explicitly
    location ~* ^/functions(?:/|$) { return 404; }
    location ~* ^/\.data(?:/|$) { return 404; }

    # Block explicitly sensitive files
    location ~* ^/(?:dev-server\.js|examquestions\.json|firebase\.json|firestore\.indexes\.json|firestore\.rules)$ { return 404; }

    # Canonical root and index handling
    location = / { try_files /index.html =404; }
    location = /index { return 301 /; }
    location = /index.html { return 301 /; }
    location ~ ^/pages/([A-Za-z0-9-]+)(?:\.html)?/?$ { return 301 /$1; }
    location ~ ^/(?!index\.html$)([A-Za-z0-9-]+)\.html$ { return 301 /$1; }

    # API routes should never hit static fallback.
    location ^~ /api/ {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Connection "";
    }

    # Clean URL resolver.
    location / {
        try_files $uri $uri/ @clean_pages;
    }

    location @clean_pages {
        try_files /pages$uri.html $uri.html =404;
    }
}
EOF

sed -i \
  -e "s|__APEX_HOST__|$APEX_HOST|g" \
  -e "s|__CANONICAL_HOST__|$CANONICAL_HOST|g" \
  -e "s|__WEB_ROOT__|$WEB_ROOT|g" \
  "$TMP_CONF"

sudo install -m 0644 "$TMP_CONF" "$SITE_CONF"
rm -f "$TMP_CONF"

echo "[4/8] Ensuring site symlink is enabled"
sudo ln -sf "$SITE_CONF" "$ENABLED_LINK"

echo "[5/8] Validating nginx config"
sudo nginx -t

echo "[6/8] Reloading nginx"
sudo systemctl reload nginx

echo "[7/8] Verifying Node backend listener on :8080"
if sudo ss -ltnp | grep -q ':8080'; then
  echo "Node backend is listening on :8080"
else
  echo "WARNING: Nothing is listening on :8080. /api/* routes will return 502 until Node is running."
fi

echo "[8/8] Route checks"
for url in \
  "https://${APEX_HOST}/" \
  "https://${APEX_HOST}/services" \
  "https://${CANONICAL_HOST}/" \
  "https://${CANONICAL_HOST}/services" \
  "https://${CANONICAL_HOST}/pages/services" \
  "https://${CANONICAL_HOST}/pages/services.html" \
  "https://${CANONICAL_HOST}/firebase.json"
do
  echo "=== ${url} ==="
  curl -sI "$url" | sed -n '1p;/^Location:/Ip;/^Server:/Ip;/^Content-Type:/Ip'
  echo
done

API_URL="https://${CANONICAL_HOST}/api/session"
API_HEADERS="$(mktemp)"
API_BODY="$(mktemp)"

echo "=== ${API_URL} (GET) ==="
curl -sS "$API_URL" -D "$API_HEADERS" -o "$API_BODY" || true
sed -n '1p;/^Location:/Ip;/^Server:/Ip;/^Content-Type:/Ip' "$API_HEADERS"
echo "BODY: $(tr -d '\r' <"$API_BODY" | head -c 300)"
echo

rm -f "$API_HEADERS" "$API_BODY"

echo "Done."
