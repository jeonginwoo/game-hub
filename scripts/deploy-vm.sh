#!/usr/bin/env bash
# Runs ON the deploy VM: fast-forward the checkout to origin/main, rebuild, restart the service.
# Called by GitHub Actions over SSH — the deploy key in ~/.ssh/authorized_keys is pinned to this
# script with `restrict,command="bash /home/ubuntu/game-hub/scripts/deploy-vm.sh"`, so that key
# can do nothing else. Also fine to run by hand on the VM. Setup: docs/deploy.md.
#
# The `git merge` below may rewrite this very file while it runs. That is safe: git writes a new
# inode (bash keeps reading the old one), the body is one function parsed before it runs, and the
# trailing `exit` stops bash from reading anything after main.
#
# Not atomic: the checkout, node_modules and lobby/dist change in place. A failed `npm ci` or build
# leaves the running process up, but the site may be broken (or not restartable) until a fixed
# deploy lands. Fix forward, or `git reset --hard <previous>` on the VM and run this again.
set -euo pipefail

main() {
  cd "$(dirname "$0")/.."

  git fetch --quiet origin main
  local before after
  before=$(git rev-parse --short HEAD)
  # --ff-only: a hand edit on the VM stops the deploy instead of being silently discarded
  git merge --ff-only --quiet origin/main
  after=$(git rev-parse --short HEAD)

  npm ci --no-audit --no-fund
  # build fails → set -e stops here, before the restart (see the header: not atomic)
  npm run build
  sudo -n systemctl restart game-hub

  # health check: the page must answer, not just the unit be "active" (a crash loop can look active)
  local i
  for i in 1 2 3 4 5 6 7 8 9 10; do
    if curl -fsS -o /dev/null http://localhost:8080/; then
      echo "deployed $before -> $after"
      return 0
    fi
    sleep 1
  done
  echo "game-hub did not answer on :8080 after restart:"
  sudo -n journalctl -u game-hub -n 30 --no-pager
  exit 1
}

main "$@"
exit
