#!/usr/bin/env bash
# Ubuntu prerequisites from official Node/Caddy distribution endpoints.
set -Eeuo pipefail
[[ $(id -u) == 0 && $(uname -m) == x86_64 ]] || { echo 'Requires root on x86_64 Ubuntu'; exit 1; }
if ! command -v caddy >/dev/null; then
    if ss -H -ltn '( sport = :80 or sport = :443 )' | read -r _; then
        echo 'Port 80/443 is already occupied; refusing automatic Caddy installation'; exit 1
    fi
fi
apt-get update -qq
DEBIAN_FRONTEND=noninteractive apt-get install -y curl ca-certificates xz-utils gnupg debian-keyring debian-archive-keyring apt-transport-https
if ! command -v node >/dev/null || ! node -e 'if(Number(process.versions.node.split(".")[0])<24)process.exit(1)'; then
    [[ ! -e /usr/local/bin/node && ! -e /opt/bilabang-node24 ]] || { echo 'Existing Node installation needs manual review'; exit 1; }
    temporary=$(mktemp -d)
    curl --fail --silent --show-error --location https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt -o "$temporary/SHASUMS256.txt"
    archive=$(awk '/node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$/ {print $2}' "$temporary/SHASUMS256.txt")
    [[ "$archive" =~ ^node-v24\.[0-9]+\.[0-9]+-linux-x64.tar.xz$ ]] || exit 1
    curl --fail --silent --show-error --location "https://nodejs.org/dist/latest-v24.x/$archive" -o "$temporary/$archive"
    (cd "$temporary"; grep " $archive$" SHASUMS256.txt | sha256sum -c -)
    mkdir /opt/bilabang-node24
    tar -xJf "$temporary/$archive" -C /opt/bilabang-node24 --strip-components=1
    for executable in node npm npx; do
        [[ ! -e "/usr/local/bin/$executable" ]] || { echo 'Existing executable needs manual review'; exit 1; }
        ln -s "/opt/bilabang-node24/bin/$executable" "/usr/local/bin/$executable"
    done
fi
if ! command -v caddy >/dev/null; then
    curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/gpg.key -o /tmp/bilabang-caddy.key
    gpg --dearmor --yes -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg /tmp/bilabang-caddy.key
    curl --fail --silent --show-error --location https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt -o /etc/apt/sources.list.d/caddy-stable.list
    chmod 644 /usr/share/keyrings/caddy-stable-archive-keyring.gpg /etc/apt/sources.list.d/caddy-stable.list
    apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y caddy
fi
node --version
npm --version
caddy version
