#!/usr/bin/env bash
set -euo pipefail

# Surf Monitor Agent Installer (Ubuntu / Debian / systemd Linux)
INSTALL_DIR="/opt/surf-monitor-agent"
SERVICE_USER="surfagent"
AGENT_PORT="${SURF_AGENT_PORT:-47200}"
AGENT_TOKEN="${SURF_AGENT_TOKEN:-$(openssl rand -hex 32)}"
PM2_HELPER="/usr/local/bin/surf-pm2-helper"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js (>= 18) is required to run Surf Monitor Agent."
  exit 1
fi

if ! id "$SERVICE_USER" >/dev/null 2>&1; then
  useradd --system --no-create-home --shell /usr/sbin/nologin "$SERVICE_USER"
fi

# Add surfagent to docker group if Docker is installed
if getent group docker >/dev/null 2>&1; then
  usermod -aG docker "$SERVICE_USER"
fi

mkdir -p "$INSTALL_DIR"
if [ -f "$INSTALL_DIR/surf-agent.mjs" ]; then
  cp "$INSTALL_DIR/surf-agent.mjs" "$INSTALL_DIR/surf-agent.mjs.bak"
fi
cp "$(dirname "$0")/surf-agent.mjs" "$INSTALL_DIR/surf-agent.mjs"
chmod 750 "$INSTALL_DIR/surf-agent.mjs"
chown -R root:"$SERVICE_USER" "$INSTALL_DIR"

# Preserve existing token if reinstalling/updating unless SURF_AGENT_TOKEN was explicitly provided
if [ -f /etc/surf-monitor-agent.env ] && [ -z "${SURF_AGENT_TOKEN:-}" ]; then
  EXISTING_TOKEN="$(grep -E '^SURF_AGENT_TOKEN=' /etc/surf-monitor-agent.env | head -n1 | cut -d= -f2- || true)"
  if [ -n "$EXISTING_TOKEN" ]; then
    AGENT_TOKEN="$EXISTING_TOKEN"
  fi
fi

cat > /etc/surf-monitor-agent.env <<EOF
SURF_AGENT_PORT=$AGENT_PORT
SURF_AGENT_TOKEN=$AGENT_TOKEN
EOF
chmod 640 /etc/surf-monitor-agent.env
chown root:"$SERVICE_USER" /etc/surf-monitor-agent.env

# Install narrowly scoped PM2 helper for multi-user PM2 discovery, metrics, logs & allowlisted actions
cat > "$PM2_HELPER" <<'HELPER_EOF'
#!/usr/bin/env bash
set -euo pipefail

# Narrowly scoped, root-owned PM2 helper for surfagent.
# Validates every input strictly and never executes arbitrary shell commands.

CMD="${1:-}"
SAFE_USER_RE='^[a-z_][a-z0-9_-]{0,31}$'
SAFE_ID_RE='^[0-9]{1,6}$'

find_pm2_for_home() {
  local user_home="$1"
  local candidate
  for candidate in \
    "$user_home/.npm-global/bin/pm2" \
    "$user_home/.local/bin/pm2" \
    "$user_home/.yarn/bin/pm2" \
    "$user_home/.pnpm/pm2" \
    /usr/local/bin/pm2 \
    /usr/bin/pm2
  do
    if [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  done
  # Check nvm installations under user's home
  if [ -d "$user_home/.nvm/versions/node" ]; then
    candidate="$(find "$user_home/.nvm/versions/node" -maxdepth 3 -type f -name pm2 2>/dev/null | sort -V | tail -n1 || true)"
    if [ -n "$candidate" ] && [ -x "$candidate" ]; then
      echo "$candidate"
      return 0
    fi
  fi
  if command -v pm2 >/dev/null 2>&1; then
    command -v pm2
    return 0
  fi
  return 1
}

get_user_home() {
  local target_user="$1"
  if [[ ! "$target_user" =~ $SAFE_USER_RE ]]; then
    echo "Invalid Linux user" >&2
    exit 2
  fi
  getent passwd "$target_user" | cut -d: -f6
}

run_pm2_as_user() {
  local target_user="$1"
  local user_home="$2"
  local pm2_bin="$3"
  shift 3
  local bin_dir
  bin_dir="$(dirname "$pm2_bin")"
  runuser -u "$target_user" -- env \
    HOME="$user_home" \
    PM2_HOME="$user_home/.pm2" \
    TERM=dumb \
    PM2_SILENT=true \
    PATH="$bin_dir:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin" \
    "$pm2_bin" "$@"
}

case "$CMD" in
  discover)
    node -e '
      const fs = require("fs");
      const { execFileSync } = require("child_process");
      const passwd = fs.readFileSync("/etc/passwd", "utf8").split("\n");
      const seen = new Set();
      const results = [];
      for (const line of passwd) {
        if (!line) continue;
        const parts = line.split(":");
        const user = parts[0];
        const uid = Number(parts[2]);
        const home = parts[5];
        if (!user || !home || seen.has(user)) continue;
        if (uid !== 0 && uid < 1000) continue;
        seen.add(user);
        const pm2Dir = home + "/.pm2";
        if (!fs.existsSync(pm2Dir)) continue;
        let pm2Path = "";
        try {
          pm2Path = execFileSync("/usr/local/bin/surf-pm2-helper", ["which-pm2", user], { encoding: "utf8", timeout: 3000 }).trim();
        } catch {}
        const sockExists = fs.existsSync(pm2Dir + "/rpc.sock") || fs.existsSync(pm2Dir + "/pub.sock");
        results.push({
          user,
          homeDir: home,
          pm2Home: pm2Dir,
          pm2Path: pm2Path || null,
          daemonAvailable: sockExists,
          accessible: Boolean(pm2Path)
        });
      }
      process.stdout.write(JSON.stringify({ users: results }));
    '
    ;;

  which-pm2)
    TARGET_USER="${2:-}"
    USER_HOME="$(get_user_home "$TARGET_USER")"
    [ -n "$USER_HOME" ] || exit 3
    find_pm2_for_home "$USER_HOME"
    ;;

  jlist)
    TARGET_USER="${2:-}"
    USER_HOME="$(get_user_home "$TARGET_USER")"
    [ -n "$USER_HOME" ] || { echo "User not found" >&2; exit 3; }
    PM2_BIN="$(find_pm2_for_home "$USER_HOME" || true)"
    [ -n "$PM2_BIN" ] || { echo "PM2 binary not found for $TARGET_USER" >&2; exit 4; }
    run_pm2_as_user "$TARGET_USER" "$USER_HOME" "$PM2_BIN" jlist --no-color
    ;;

  action)
    TARGET_USER="${2:-}"
    PM_ID="${3:-}"
    ACTION="${4:-}"
    USER_HOME="$(get_user_home "$TARGET_USER")"
    [ -n "$USER_HOME" ] || { echo "User not found" >&2; exit 3; }
    if [[ ! "$PM_ID" =~ $SAFE_ID_RE ]]; then
      echo "Invalid PM2 process ID" >&2
      exit 2
    fi
    case "$ACTION" in
      start|stop|restart) ;;
      *)
        echo "Disallowed PM2 action" >&2
        exit 2
        ;;
    esac
    PM2_BIN="$(find_pm2_for_home "$USER_HOME" || true)"
    [ -n "$PM2_BIN" ] || { echo "PM2 binary not found for $TARGET_USER" >&2; exit 4; }
    run_pm2_as_user "$TARGET_USER" "$USER_HOME" "$PM2_BIN" "$ACTION" "$PM_ID" --no-color --silent
    ;;

  logs)
    TARGET_USER="${2:-}"
    PM_ID="${3:-}"
    LINES="${4:-80}"
    USER_HOME="$(get_user_home "$TARGET_USER")"
    [ -n "$USER_HOME" ] || { echo "User not found" >&2; exit 3; }
    if [[ ! "$PM_ID" =~ $SAFE_ID_RE ]]; then
      echo "Invalid PM2 process ID" >&2
      exit 2
    fi
    if [[ ! "$LINES" =~ ^[0-9]{1,3}$ ]] || [ "$LINES" -lt 1 ] || [ "$LINES" -gt 300 ]; then
      LINES=80
    fi
    PM2_BIN="$(find_pm2_for_home "$USER_HOME" || true)"
    [ -n "$PM2_BIN" ] || { echo "PM2 binary not found for $TARGET_USER" >&2; exit 4; }
    RAW_JSON="$(run_pm2_as_user "$TARGET_USER" "$USER_HOME" "$PM2_BIN" jlist --no-color)"
    node -e '
      const fs = require("fs");
      const raw = process.argv[1];
      const pmId = Number(process.argv[2]);
      const maxLines = Number(process.argv[3]);
      let list = [];
      try { const i = raw.indexOf("["); const j = raw.lastIndexOf("]"); list = JSON.parse(i !== -1 && j > i ? raw.slice(i, j + 1) : raw); } catch {}
      const proc = list.find(p => Number(p.pm_id) === pmId);
      if (!proc) { process.stderr.write("PM2 process not found"); process.exit(5); }
      const outPath = proc.pm2_env && proc.pm2_env.pm_out_log_path;
      const errPath = proc.pm2_env && proc.pm2_env.pm_err_log_path;
      function readTail(filePath) {
        if (!filePath || typeof filePath !== "string") return { exists: false, lines: [] };
        try {
          if (!fs.existsSync(filePath)) return { exists: false, lines: [] };
          const stat = fs.statSync(filePath);
          const maxBytes = 65536;
          const start = Math.max(0, stat.size - maxBytes);
          const fd = fs.openSync(filePath, "r");
          const buf = Buffer.alloc(stat.size - start);
          fs.readSync(fd, buf, 0, buf.length, start);
          fs.closeSync(fd);
          const lines = buf.toString("utf8").split(/\r?\n/).filter(Boolean).slice(-maxLines);
          return { exists: true, lines };
        } catch {
          return { exists: false, lines: [] };
        }
      }
      process.stdout.write(JSON.stringify({
        stdout: readTail(outPath),
        stderr: readTail(errPath)
      }));
    ' "$RAW_JSON" "$PM_ID" "$LINES"
    ;;

  *)
    echo "Unknown command" >&2
    exit 2
    ;;
esac
HELPER_EOF
chmod 755 "$PM2_HELPER"
chown root:root "$PM2_HELPER"

# Least-privilege sudoers rules for systemd service control + scoped PM2 helper only
cat > /etc/sudoers.d/surf-monitor-agent <<EOF
$SERVICE_USER ALL=(root) NOPASSWD: /bin/systemctl start *.service, /bin/systemctl stop *.service, /bin/systemctl restart *.service, /bin/systemctl enable *.service, /bin/systemctl disable *.service
$SERVICE_USER ALL=(root) NOPASSWD: $PM2_HELPER *
EOF
chmod 440 /etc/sudoers.d/surf-monitor-agent

cat > /etc/systemd/system/surf-monitor-agent.service <<EOF
[Unit]
Description=Surf Monitor Agent
After=network.target

[Service]
Type=simple
User=$SERVICE_USER
EnvironmentFile=/etc/surf-monitor-agent.env
ExecStart=$(command -v node) $INSTALL_DIR/surf-agent.mjs
Restart=always
RestartSec=5
NoNewPrivileges=false

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now surf-monitor-agent.service
systemctl restart surf-monitor-agent.service

echo "Surf Monitor Agent installed and running on 127.0.0.1:$AGENT_PORT"
echo "SURF_AGENT_TOKEN=$AGENT_TOKEN"
