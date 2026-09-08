#!/usr/bin/env bash
# Run as the unprivileged bilabang user; sudo is restricted to this service only.
set -Eeuo pipefail
umask 077
commit=${1:?commit required}
[[ "$commit" =~ ^[0-9a-f]{40}$ ]] || { echo 'Invalid commit'; exit 1; }
base=/opt/bilabang
archive="$base/incoming/$commit.tar.gz"
[[ -f "$archive" ]] || { echo 'Archive missing'; exit 1; }
exec 9>"$base/deploy.lock"
flock -n 9 || { echo 'Another deployment is running'; exit 1; }
set -a
source /etc/bilabang/production.env
set +a
[[ "$DATA_DIR" == /var/lib/bilabang && "$PORT" == 5188 ]] || { echo 'Update deployment configuration for non-default paths/port first'; exit 1; }
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'
release=$(mktemp -d "$base/releases/$commit.XXXXXX")
tar -xzf "$archive" -C "$release" --no-same-owner --no-same-permissions
cd "$release"
npm ci --omit=dev --no-audit --no-fund
node --check server/production.mjs
# Test the same runtime and storage code before touching the active service.
node --test tests/independent-runtime.test.js tests/independent-transfer.test.js
if [[ -d dist/edgeone ]]; then
    [[ -f dist/edgeone/index.html && -d /var/www/bilabang/releases ]] || { echo 'Frontend hosting is not prepared'; exit 1; }
    public_release="/var/www/bilabang/releases/$(basename "$release")"
    mkdir "$public_release"
    cp -R dist/edgeone/. "$public_release/"
    find "$public_release" -type d -exec chmod 755 {} +
    find "$public_release" -type f -exec chmod 644 {} +
fi
previous=$(readlink -f "$base/current" || true)
if ! /usr/bin/systemctl is-active --quiet bilabang.service; then previous=''; fi
stopped=0
rollback() {
    result=$?
    trap - ERR
    if [[ "$stopped" == 1 && -n "$previous" && -d "$previous" ]]; then
        echo 'Deployment failed; restoring previous code (database is not overwritten).'
        ln -sfn "$previous" "$base/current.rollback"
        mv -Tf "$base/current.rollback" "$base/current"
        sudo -n /usr/bin/systemctl restart bilabang.service || true
    elif [[ "$stopped" == 1 ]]; then
        sudo -n /usr/bin/systemctl stop bilabang.service || true
        echo 'Initial deployment failed; service remains stopped.'
    fi
    exit "$result"
}
trap rollback ERR
sudo -n /usr/bin/systemctl stop bilabang.service
stopped=1
if [[ -f "$DATA_DIR/bilabang.sqlite" ]]; then
    backup_dir="$base/backups/$(date -u +%Y%m%dT%H%M%SZ)-$commit"
    node server/transfer.mjs backup "$DATA_DIR" "$backup_dir"
fi
node ops/preflight.mjs
ln -sfn "$release" "$base/current.next"
mv -Tf "$base/current.next" "$base/current"
sudo -n /usr/bin/systemctl restart bilabang.service
healthy=0
for attempt in {1..20}; do
    if curl --fail --silent --max-time 3 "http://127.0.0.1:$PORT/api/health" | node -e 'let s="";for await(const c of process.stdin)s+=c;if(!s)process.exit(1);const r=JSON.parse(s);if(r.ok!==true||r.runtime!=="independent-node"||r.schema!==1)process.exit(1)' --input-type=module; then
        healthy=1
        break
    fi
    sleep 1
done
[[ "$healthy" == 1 ]] || { echo 'Health check failed'; false; }
if [[ -n "${public_release:-}" ]]; then
    ln -sfn "$public_release" /var/www/bilabang/current.next
    mv -Tf /var/www/bilabang/current.next /var/www/bilabang/current
fi
trap - ERR
echo "Backend deployed: $commit"
# Backups and previous releases are deliberately retained, never auto-deleted.
