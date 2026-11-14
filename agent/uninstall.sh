#!/usr/bin/env bash
set -euo pipefail

systemctl disable --now surf-monitor-agent.service 2>/dev/null || true
rm -f /etc/systemd/system/surf-monitor-agent.service
rm -f /etc/sudoers.d/surf-monitor-agent
rm -f /etc/surf-monitor-agent.env
rm -rf /opt/surf-monitor-agent
systemctl daemon-reload

if id surfagent >/dev/null 2>&1; then
  userdel surfagent 2>/dev/null || true
fi

echo "Surf Monitor Agent safely uninstalled."
