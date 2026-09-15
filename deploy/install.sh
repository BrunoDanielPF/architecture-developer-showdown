#!/usr/bin/env bash
set -euo pipefail

release_name="${1:?release name is required}"
archive="${2:-/tmp/showdown-release.tar.gz}"
expected_sha256="${3:-}"

if [[ ! "$release_name" =~ ^architecture-developer-showdown-[0-9]{8}-[0-9]{6}$ ]]; then
  echo "invalid release name" >&2
  exit 2
fi

if [[ -n "$expected_sha256" ]]; then
  actual_sha256="$(sha256sum "$archive" | cut -d' ' -f1)"
  if [[ "$actual_sha256" != "$expected_sha256" ]]; then
    echo "release checksum mismatch" >&2
    exit 3
  fi
fi

app_root="/var/www/architecture-developer-showdown"
release="$app_root/releases/$release_name"
data_root="/var/lib/architecture-developer-showdown/data"

install -d -m 755 "$app_root/releases"
install -d -m 755 "$release"
tar -xzf "$archive" -C "$release"
chown -R root:root "$release"

cd "$release"
npm ci --no-audit --no-fund

if ! id showdown >/dev/null 2>&1; then
  useradd --system --home-dir /var/lib/architecture-developer-showdown --shell /usr/sbin/nologin showdown
fi
install -d -o showdown -g showdown -m 750 "$data_root"

ln -sfn "$release" "$app_root/current.new"
mv -Tf "$app_root/current.new" "$app_root/current"

install -m 644 "$release/deploy/architecture-developer-showdown.service" /etc/systemd/system/architecture-developer-showdown.service
if [[ -f /etc/letsencrypt/live/architecture-developer-showdown.brdanpe.tech/fullchain.pem ]]; then
  install -m 644 "$release/deploy/nginx-https.conf" /etc/nginx/sites-available/architecture-developer-showdown
else
  install -m 644 "$release/deploy/nginx-http.conf" /etc/nginx/sites-available/architecture-developer-showdown
fi
ln -sfn /etc/nginx/sites-available/architecture-developer-showdown /etc/nginx/sites-enabled/architecture-developer-showdown

nginx -t
systemctl daemon-reload
systemctl enable architecture-developer-showdown
systemctl restart architecture-developer-showdown
systemctl reload nginx
rm -f "$archive"
