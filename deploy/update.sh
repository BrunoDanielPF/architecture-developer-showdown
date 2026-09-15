#!/usr/bin/env bash
# Update an already configured instance without changing its proxy or service.
set -euo pipefail
release_name="${1:?release name required}"
archive="${2:?archive required}"
expected_hash="${3:?sha256 required}"
expected_current="${4:?current release required}"
app_root=/var/www/architecture-developer-showdown
data_root=/var/lib/architecture-developer-showdown/data
service=architecture-developer-showdown

[[ "$release_name" =~ ^architecture-developer-showdown-[0-9]{8}-[0-9]{6}$ ]]
[[ "$expected_hash" =~ ^[a-f0-9]{64}$ ]]
[[ "$archive" == "/tmp/$release_name.tar.gz" && -f "$archive" ]]
[[ "$expected_current" == "$app_root/releases/"* && -d "$expected_current" ]]
[[ "$(readlink -f "$app_root/current")" == "$expected_current" ]]
[[ "$(sha256sum "$archive" | cut -d' ' -f1)" == "$expected_hash" ]]
release="$app_root/releases/$release_name"
[[ ! -e "$release" ]]
install -d -m 755 "$release"
tar -xzf "$archive" -C "$release"
chown -R root:root "$release"
cd "$release"
npm ci --no-audit --no-fund
# Linux verification with an isolated temporary data directory and ephemeral port.
runuser -u showdown -- node node_modules/tsx/dist/cli.mjs tests/production-smoke.ts

# Keep old hashed assets available for tabs opened before this update.
cp -an "$expected_current/dist/assets/." "$release/dist/assets/"
[[ "$(readlink -f "$app_root/current")" == "$expected_current" ]]
backup_dir="/var/backups/architecture-developer-showdown/$release_name"
install -d -m 700 "$backup_dir"
printf '%s\n' "$expected_current" > "$backup_dir/previous-release"
stopped=0
rollback() {
 local result=$?
 trap - ERR
 if [[ "$stopped" == 1 ]]; then
  ln -sfn "$expected_current" "$app_root/current.rollback"
  mv -Tf "$app_root/current.rollback" "$app_root/current"
  systemctl restart "$service" || true
  printf 'Rollback activated: %s\n' "$expected_current" >&2
 fi
 exit "$result"
}
trap rollback ERR
systemctl stop "$service"
stopped=1
tar -czf "$backup_dir/data.tar.gz" -C "$data_root" .
chmod 600 "$backup_dir/data.tar.gz"
ln -sfn "$release" "$app_root/current.new"
mv -Tf "$app_root/current.new" "$app_root/current"
systemctl start "$service"
healthy=0
for attempt in {1..20}; do
 if curl -fsS http://127.0.0.1:3001/api/health >/dev/null; then healthy=1; break; fi
 sleep 1
done
[[ "$healthy" == 1 ]]
cmp <(curl -fsS http://127.0.0.1:3001/) "$release/dist/index.html"
systemctl is-active --quiet "$service"
trap - ERR
printf 'Published: %s\nPrevious: %s\nData backup: %s\n' "$release" "$expected_current" "$backup_dir/data.tar.gz"
