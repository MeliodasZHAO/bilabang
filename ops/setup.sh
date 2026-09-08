#!/usr/bin/env bash
# One-time Ubuntu preparation. Installs no packages and touches no existing service.
# Install Node 24 and Caddy from their official distributions first.
set -Eeuo pipefail
[[ "$(id -u)" == 0 ]] || { echo 'Run as root'; exit 1; }
site=${1:?HTTPS frontend origin required}
api=${2:?HTTPS backend origin required}
pubkey=${3:?Path to deployment SSH public key required}
[[ -f "$pubkey" ]] || { echo 'Public key missing'; exit 1; }
node_bin=$(command -v node)
node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'
command -v caddy >/dev/null
[[ ! -e /etc/bilabang/production.env && ! -e /etc/systemd/system/bilabang.service ]] || { echo 'Existing configuration found; review manually instead of overwriting'; exit 1; }
[[ ! -e /opt/bilabang/current ]] || { echo 'Existing deployment found'; exit 1; }
if ss -H -ltn 'sport = :5188' | read -r _; then echo 'API port is occupied'; exit 1; fi
export SITE_URL="$site" API_ORIGIN="$api" NODE_ENV=production HOST=127.0.0.1 PORT=5188 DATA_DIR=/var/lib/bilabang
export RATE_SALT
RATE_SALT=$(node -e 'console.log(require("node:crypto").randomBytes(32).toString("hex"))')
node --input-type=module -e 'import {validateConfig} from "./ops/preflight.mjs"; const e=validateConfig(process.env);if(e.length)throw Error(e.join("\n"))'
if id bilabang >/dev/null 2>&1; then echo 'User bilabang already exists; review ownership before setup'; exit 1; fi
useradd --system --create-home --home-dir /opt/bilabang --shell /bin/bash bilabang
install -d -m 700 -o bilabang -g bilabang /opt/bilabang/{incoming,releases,backups,.ssh} /var/lib/bilabang
install -m 600 -o bilabang -g bilabang "$pubkey" /opt/bilabang/.ssh/authorized_keys
install -d -m 750 -o root -g bilabang /etc/bilabang
umask 077
printf 'NODE_ENV=production\nHOST=127.0.0.1\nPORT=5188\nSITE_URL=%s\nAPI_ORIGIN=%s\nDATA_DIR=/var/lib/bilabang\nRATE_SALT=%s\nTRUST_PROXY=1\n' "$site" "$api" "$RATE_SALT" > /etc/bilabang/production.env
chown root:bilabang /etc/bilabang/production.env
chmod 640 /etc/bilabang/production.env
sed "s|/usr/bin/node|$node_bin|g" ops/bilabang.service > /etc/systemd/system/bilabang.service
install -m 755 -o root -g root ops/deploy.sh /usr/local/bin/bilabang-deploy
printf 'bilabang ALL=(root) NOPASSWD: /usr/bin/systemctl stop bilabang.service, /usr/bin/systemctl restart bilabang.service\n' > /etc/sudoers.d/bilabang
chmod 440 /etc/sudoers.d/bilabang
visudo -cf /etc/sudoers.d/bilabang
systemd-analyze verify /etc/systemd/system/bilabang.service
systemctl daemon-reload
systemctl enable bilabang.service
echo 'Service prepared but not started. Deploy code, import data/bootstrap administrator, then configure DNS and Caddy.'
echo 'Caddy configuration is deliberately not installed over another website.'
