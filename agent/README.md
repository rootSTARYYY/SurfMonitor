# Surf Monitor Agent (Linux & Windows)

Lightweight, localhost-only infrastructure agent for Surf Monitor.

## Security & Firewall Model
- The agent binds **exclusively** to `127.0.0.1:47200` — **no public ports** need to be opened in your VPS firewall (only standard SSH port `22` is required).
- Surf Monitor connects over SSH using your private key, verifies the SHA-256 host key fingerprint, and tunnels HTTP requests over SSH (`forwardOut`) with a per-server `Authorization: Bearer <token>`.

## Manual Linux Installation (Ubuntu / Debian)
1. Ensure Node.js >= 18 is installed.
2. Copy `surf-agent.mjs` and `install.sh` to the server and run:
   ```bash
   sudo bash install.sh
   ```
3. Or use the **Install Agent** button inside Surf Monitor's **Add Server** modal to upload and install automatically over SFTP.

## Permissions
- Runs as dedicated unprivileged system user `surfagent`.
- Docker monitoring: `surfagent` is added to the `docker` group (`/var/run/docker.sock`) without exposing Docker over TCP.
- systemd service control: `/etc/sudoers.d/surf-monitor-agent` grants `NOPASSWD` **only** for `systemctl start|stop|restart|enable|disable *.service`.

## Uninstallation
```bash
sudo bash uninstall.sh
```
