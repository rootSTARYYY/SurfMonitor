#!/usr/bin/env node
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AGENT_VERSION = '3.1.0';
const BIND_HOST = '127.0.0.1';
const BIND_PORT = Number(process.env.SURF_AGENT_PORT || 47200);
const AGENT_TOKEN = process.env.SURF_AGENT_TOKEN || '';
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const PM2_HELPER = '/usr/local/bin/surf-pm2-helper';

const SAFE_ID_REGEX = /^[a-zA-Z0-9_@.-]{1,128}$/;
const SAFE_USER_REGEX = /^[a-z_][a-z0-9_-]{0,31}$/;
const SAFE_PM_ID_REGEX = /^[0-9]{1,6}$/;
const ALLOWED_DOCKER_ACTIONS = new Set([
  'start',
  'stop',
  'restart',
  'pause',
  'unpause',
]);
const ALLOWED_SERVICE_ACTIONS = new Set([
  'start',
  'stop',
  'restart',
  'enable',
  'disable',
]);
const ALLOWED_PM2_ACTIONS = new Set(['start', 'stop', 'restart']);

let prevCpuTimes = null;
let prevNetStats = null;
let pm2DiscoveryCache = { ts: 0, data: null };
const PM2_DISCOVERY_TTL_MS = 30_000;

function constantTimeTokenMatch(headerVal) {
  if (!AGENT_TOKEN || typeof headerVal !== 'string') return false;
  if (!headerVal.startsWith('Bearer ')) return false;
  const provided = headerVal.slice(7).trim();
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(AGENT_TOKEN, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

function getCpuPercent() {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const type of Object.keys(cpu.times)) {
      total += cpu.times[type];
    }
    idle += cpu.times.idle;
  }
  if (!prevCpuTimes) {
    prevCpuTimes = { idle, total };
    return 0;
  }
  const idleDiff = idle - prevCpuTimes.idle;
  const totalDiff = total - prevCpuTimes.total;
  prevCpuTimes = { idle, total };
  if (totalDiff <= 0) return 0;
  return Number((((totalDiff - idleDiff) / totalDiff) * 100).toFixed(1));
}

async function getDiskPartitions() {
  if (process.platform === 'win32') {
    return [];
  }
  try {
    const { stdout } = await execFileAsync('df', ['-B1', '-P', '-x', 'tmpfs', '-x', 'devtmpfs']);
    const lines = stdout.trim().split('\n').slice(1);
    const partitions = [];
    for (const line of lines) {
      const cols = line.trim().split(/\s+/);
      if (cols.length >= 6) {
        const total = Number(cols[1]) || 0;
        const used = Number(cols[2]) || 0;
        const avail = Number(cols[3]) || 0;
        const mount = cols.slice(5).join(' ');
        partitions.push({
          filesystem: cols[0],
          mount,
          totalBytes: total,
          usedBytes: used,
          availableBytes: avail,
          usedPercent: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
        });
      }
    }
    return partitions;
  } catch {
    return [];
  }
}

function getNetworkStats() {
  if (process.platform !== 'linux') {
    return { rxBytesPerSec: 0, txBytesPerSec: 0, interfaces: [] };
  }
  try {
    const raw = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = raw.split('\n').slice(2);
    const interfaces = [];
    let totalRx = 0;
    let totalTx = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const [ifacePart, statsPart] = trimmed.split(':');
      if (!statsPart) continue;
      const iface = ifacePart.trim();
      if (iface === 'lo') continue;
      const nums = statsPart.trim().split(/\s+/).map(Number);
      const rx = nums[0] || 0;
      const tx = nums[8] || 0;
      totalRx += rx;
      totalTx += tx;
      interfaces.push({ name: iface, rxBytes: rx, txBytes: tx });
    }

    const now = Date.now();
    let rxBytesPerSec = 0;
    let txBytesPerSec = 0;
    if (prevNetStats) {
      const dt = Math.max(0.5, (now - prevNetStats.ts) / 1000);
      rxBytesPerSec = Math.max(0, Math.round((totalRx - prevNetStats.rx) / dt));
      txBytesPerSec = Math.max(0, Math.round((totalTx - prevNetStats.tx) / dt));
    }
    prevNetStats = { rx: totalRx, tx: totalTx, ts: now };

    return { rxBytesPerSec, txBytesPerSec, interfaces };
  } catch {
    return { rxBytesPerSec: 0, txBytesPerSec: 0, interfaces: [] };
  }
}

function dockerRequest(method, path) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCKET,
        path,
        method,
        timeout: 8000,
      },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf8');
          resolve({ status: res.statusCode || 500, body });
        });
      }
    );
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy(new Error('Docker socket timeout'));
    });
    req.end();
  });
}

async function listSystemdServices() {
  if (process.platform === 'win32') {
    const { stdout } = await execFileAsync('powershell', [
      '-NoProfile',
      '-Command',
      'Get-Service | Select-Object -First 80 Name,DisplayName,Status,StartType | ConvertTo-Json',
    ]);
    const parsed = JSON.parse(stdout || '[]');
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    return arr.map((s) => ({
      name: String(s.Name || ''),
      displayName: String(s.DisplayName || s.Name || ''),
      description: String(s.DisplayName || ''),
      activeState: String(s.Status) === '4' || String(s.Status).toLowerCase() === 'running' ? 'active' : 'inactive',
      enabledState: String(s.StartType || 'manual').toLowerCase(),
      platform: 'windows',
    }));
  }

  const { stdout } = await execFileAsync('systemctl', [
    'list-units',
    '--type=service',
    '--all',
    '--no-pager',
    '--no-legend',
    '--plain',
  ]);
  const services = [];
  for (const line of stdout.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const parts = trimmed.split(/\s+/);
    const unit = parts[0] || '';
    if (!unit.endsWith('.service')) continue;
    const name = unit.replace(/\.service$/, '');
    const activeState = parts[2] || 'unknown';
    const subState = parts[3] || '';
    const description = parts.slice(4).join(' ');
    services.push({
      name,
      displayName: name,
      description,
      activeState,
      enabledState: subState,
      platform: 'linux',
    });
  }
  return services.slice(0, 120);
}

async function runServiceAction(name, action) {
  if (!SAFE_ID_REGEX.test(name) || !ALLOWED_SERVICE_ACTIONS.has(action)) {
    throw new Error('Invalid service name or disallowed action');
  }
  if (process.platform === 'win32') {
    const psCmd =
      action === 'start'
        ? `Start-Service -Name '${name}'`
        : action === 'stop'
          ? `Stop-Service -Name '${name}' -Force`
          : action === 'restart'
            ? `Restart-Service -Name '${name}' -Force`
            : action === 'enable'
              ? `Set-Service -Name '${name}' -StartupType Automatic`
              : `Set-Service -Name '${name}' -StartupType Disabled`;
    await execFileAsync('powershell', ['-NoProfile', '-Command', psCmd]);
    return { ok: true };
  }

  const cmd = process.getuid && process.getuid() === 0 ? 'systemctl' : 'sudo';
  const args =
    cmd === 'systemctl'
      ? [action, `${name}.service`]
      : ['-n', 'systemctl', action, `${name}.service`];
  await execFileAsync(cmd, args);
  return { ok: true };
}

// --- PM2 Helpers (Phases 1-4 & 7) ---


function extractJsonFromOutput(raw, fallback = null) {
  if (typeof raw !== 'string') return fallback;
  const trimmed = raw.trim();
  if (!trimmed) return fallback;
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip leading/trailing banners such as PM2 ">>>> In-memory PM2 is out-of-date..." or MOTD lines
    const firstBracket = trimmed.indexOf('[');
    const firstBrace = trimmed.indexOf('{');
    let startIdx = -1;
    let closeChar = '';
    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      startIdx = firstBracket;
      closeChar = ']';
    } else if (firstBrace !== -1) {
      startIdx = firstBrace;
      closeChar = '}';
    }
    if (startIdx === -1) return fallback;
    const endIdx = trimmed.lastIndexOf(closeChar);
    if (endIdx <= startIdx) return fallback;
    const candidate = trimmed.slice(startIdx, endIdx + 1);
    return JSON.parse(candidate);
  }
}

async function runPm2Helper(args, timeoutMs = 8000) {
  const isRoot = process.getuid && process.getuid() === 0;
  const cmd = isRoot ? PM2_HELPER : 'sudo';
  const finalArgs = isRoot ? args : ['-n', PM2_HELPER, ...args];
  const { stdout } = await execFileAsync(cmd, finalArgs, {
    timeout: timeoutMs,
    maxBuffer: 4 * 1024 * 1024,
  });
  return stdout;
}

function redactLogLine(line) {
  return String(line)
    .replace(/\b(Bearer|Token|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi, '$1 [REDACTED]')
    .replace(/\b(slk_|slp_|sk_|pk_|ghp_|gho_|AIza)[A-Za-z0-9_-]{8,}\b/g, '$1[REDACTED]')
    .replace(/([A-Za-z0-9_]*(?:PASSWORD|SECRET|TOKEN|API_KEY|PRIVATE_KEY)[A-Za-z0-9_]*\s*[:=]\s*)([^\s'"]+|'[^']*'|"[^"]*")/gi, '$1[REDACTED]');
}

function normalizePm2Process(raw, linuxUser) {
  const env = raw.pm2_env || {};
  const monit = raw.monit || {};
  const rawStatus = String(env.status || 'unknown').toLowerCase();
  const state =
    rawStatus === 'online'
      ? 'online'
      : rawStatus === 'stopped' || rawStatus === 'stopping'
        ? 'stopped'
        : rawStatus === 'errored'
          ? 'errored'
          : rawStatus === 'launching' || rawStatus === 'one-launch-status'
            ? 'launching'
            : 'unknown';

  const uptimeOrigin = Number(env.pm_uptime || 0);
  const uptimeMs =
    state === 'online' && uptimeOrigin > 0
      ? Math.max(0, Date.now() - uptimeOrigin)
      : 0;

  return {
    processKey: `${linuxUser}:${raw.pm_id ?? 0}`,
    pmId: Number(raw.pm_id ?? 0),
    name: String(raw.name || env.name || `pm2-${raw.pm_id ?? 0}`),
    linuxUser,
    status: rawStatus,
    state,
    cpu: Number(monit.cpu ?? 0),
    memoryBytes: Number(monit.memory ?? 0),
    uptimeMs,
    uptimeSeconds: Math.floor(uptimeMs / 1000),
    restarts: Number(env.restart_time ?? 0),
    unstableRestarts: Number(env.unstable_restarts ?? 0),
    execMode: String(env.exec_mode || 'fork_mode').replace(/_mode$/, ''),
    instances: Number(env.instances ?? 1),
    nodeVersion: env.node_version ? String(env.node_version) : null,
    scriptPath: env.pm_exec_path ? String(env.pm_exec_path) : null,
    cwd: env.pm_cwd ? String(env.pm_cwd) : null,
    lastRestartAt:
      uptimeOrigin > 0 ? new Date(uptimeOrigin).toISOString() : null,
    pid: typeof raw.pid === 'number' && raw.pid > 0 ? raw.pid : null,
    envName: env.NODE_ENV ? String(env.NODE_ENV) : null,
  };
}

async function discoverPm2Instances(forceRefresh = false) {
  if (process.platform !== 'linux') {
    return { available: false, helperInstalled: false, instances: [] };
  }
  const now = Date.now();
  if (
    !forceRefresh &&
    pm2DiscoveryCache.data &&
    now - pm2DiscoveryCache.ts < PM2_DISCOVERY_TTL_MS
  ) {
    return pm2DiscoveryCache.data;
  }

  if (!fs.existsSync(PM2_HELPER)) {
    return {
      available: false,
      helperInstalled: false,
      error: 'PM2 helper not installed. Click Install / Update Agent to enable PM2.',
      instances: [],
    };
  }

  try {
    const out = await runPm2Helper(['discover'], 6000);
    const parsed = extractJsonFromOutput(out, { users: [] });
    const result = {
      available: true,
      helperInstalled: true,
      instances: Array.isArray(parsed.users) ? parsed.users : [],
    };
    pm2DiscoveryCache = { ts: now, data: result };
    return result;
  } catch (err) {
    return {
      available: false,
      helperInstalled: true,
      error: err instanceof Error ? err.message : 'PM2 discovery failed',
      instances: [],
    };
  }
}

async function collectAllPm2Processes(forceRefresh = false) {
  const discovery = await discoverPm2Instances(forceRefresh);
  if (!discovery.available) {
    return {
      installed: false,
      helperInstalled: discovery.helperInstalled,
      error: discovery.error || null,
      instances: [],
      processes: [],
    };
  }

  const instances = [];
  const processes = [];

  for (const inst of discovery.instances) {
    const linuxUser = String(inst.user || '');
    if (!SAFE_USER_REGEX.test(linuxUser)) continue;

    if (!inst.pm2Path) {
      instances.push({
        linuxUser,
        pm2Path: null,
        daemonAvailable: Boolean(inst.daemonAvailable),
        accessible: false,
        processCount: 0,
        error: 'PM2 binary not found in user PATH/nvm/npm-global',
      });
      continue;
    }

    try {
      const rawJson = await runPm2Helper(['jlist', linuxUser], 8000);
      const list = extractJsonFromOutput(rawJson, []);
      const normalized = Array.isArray(list)
        ? list.map((item) => normalizePm2Process(item, linuxUser))
        : [];
      instances.push({
        linuxUser,
        pm2Path: inst.pm2Path,
        daemonAvailable: true,
        accessible: true,
        processCount: normalized.length,
        error: null,
      });
      processes.push(...normalized);
    } catch (err) {
      instances.push({
        linuxUser,
        pm2Path: inst.pm2Path,
        daemonAvailable: false,
        accessible: false,
        processCount: 0,
        error: err instanceof Error ? err.message : 'Failed to query PM2 daemon',
      });
    }
  }

  return {
    installed: instances.some((i) => Boolean(i.pm2Path)),
    helperInstalled: true,
    error: null,
    instances,
    processes,
  };
}

function sendJson(res, status, data) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(data));
}

const server = http.createServer(async (req, res) => {
  if (!constantTimeTokenMatch(req.headers.authorization)) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const url = new URL(req.url || '/', `http://${BIND_HOST}:${BIND_PORT}`);
  const pathname = url.pathname.replace(/^\/api\/v1(?=\/pm2\b)/, '');

  try {
    if (req.method === 'GET' && pathname === '/health') {
      sendJson(res, 200, {
        ok: true,
        version: AGENT_VERSION,
        platform: process.platform,
        hostname: os.hostname(),
        uptimeSeconds: Math.round(os.uptime()),
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/metrics') {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const disks = await getDiskPartitions();
      const rootDisk = disks.find((d) => d.mount === '/') || disks[0] || {
        totalBytes: 0,
        usedBytes: 0,
        availableBytes: 0,
        usedPercent: 0,
      };
      const net = getNetworkStats();
      const loads = os.loadavg();

      sendJson(res, 200, {
        agentVersion: AGENT_VERSION,
        hostname: os.hostname(),
        platform: process.platform,
        osInfo: `${os.type()} ${os.release()}`,
        kernelVersion: os.release(),
        arch: os.arch(),
        cpuCores: os.cpus().length,
        cpuModel: os.cpus()[0]?.model || 'Unknown',
        cpuPercent: getCpuPercent(),
        ramTotalBytes: totalMem,
        ramUsedBytes: usedMem,
        ramPercent: Number(((usedMem / totalMem) * 100).toFixed(1)),
        diskTotalBytes: rootDisk.totalBytes,
        diskUsedBytes: rootDisk.usedBytes,
        diskPercent: rootDisk.usedPercent,
        partitions: disks,
        netRxBytesPerSec: net.rxBytesPerSec,
        netTxBytesPerSec: net.txBytesPerSec,
        interfaces: net.interfaces,
        uptimeSeconds: Math.round(os.uptime()),
        loadAvg: loads.map((n) => Number(n.toFixed(2))),
      });
      return;
    }

    // --- PM2 Endpoints (Phase 3) ---
    if (req.method === 'GET' && pathname === '/pm2/status') {
      const force = url.searchParams.get('refresh') === '1';
      const data = await collectAllPm2Processes(force);
      sendJson(res, 200, {
        installed: data.installed,
        helperInstalled: data.helperInstalled,
        error: data.error,
        instances: data.instances,
        totalProcesses: data.processes.length,
        onlineProcesses: data.processes.filter((p) => p.state === 'online').length,
        stoppedProcesses: data.processes.filter((p) => p.state === 'stopped').length,
        erroredProcesses: data.processes.filter((p) => p.state === 'errored').length,
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/pm2/processes') {
      const force = url.searchParams.get('refresh') === '1';
      const data = await collectAllPm2Processes(force);
      sendJson(res, 200, data);
      return;
    }

    const pm2DetailMatch = pathname.match(
      /^\/pm2\/processes\/([a-z_][a-z0-9_-]{0,31})\/([0-9]{1,6})$/
    );
    if (req.method === 'GET' && pm2DetailMatch) {
      const [, linuxUser, pmIdStr] = pm2DetailMatch;
      const pmId = Number(pmIdStr);
      const data = await collectAllPm2Processes(false);
      const proc = data.processes.find(
        (p) => p.linuxUser === linuxUser && p.pmId === pmId
      );
      if (!proc) {
        sendJson(res, 404, { error: 'PM2 process not found' });
        return;
      }
      sendJson(res, 200, { process: proc });
      return;
    }

    const pm2LogsMatch = pathname.match(
      /^\/pm2\/processes\/([a-z_][a-z0-9_-]{0,31})\/([0-9]{1,6})\/logs$/
    );
    if (req.method === 'GET' && pm2LogsMatch) {
      const [, linuxUser, pmIdStr] = pm2LogsMatch;
      const linesParam = Math.min(
        300,
        Math.max(10, Number(url.searchParams.get('lines') || 100))
      );
      const raw = await runPm2Helper(
        ['logs', linuxUser, pmIdStr, String(linesParam)],
        8000
      );
      const parsed = extractJsonFromOutput(raw, {});
      sendJson(res, 200, {
        stdout: {
          exists: Boolean(parsed.stdout?.exists),
          lines: Array.isArray(parsed.stdout?.lines)
            ? parsed.stdout.lines.map(redactLogLine)
            : [],
        },
        stderr: {
          exists: Boolean(parsed.stderr?.exists),
          lines: Array.isArray(parsed.stderr?.lines)
            ? parsed.stderr.lines.map(redactLogLine)
            : [],
        },
      });
      return;
    }

    const pm2ActionMatch = pathname.match(
      /^\/pm2\/processes\/([a-z_][a-z0-9_-]{0,31})\/([0-9]{1,6})\/(start|stop|restart)$/
    );
    if (req.method === 'POST' && pm2ActionMatch) {
      const [, linuxUser, pmIdStr, action] = pm2ActionMatch;
      if (
        !SAFE_USER_REGEX.test(linuxUser) ||
        !SAFE_PM_ID_REGEX.test(pmIdStr) ||
        !ALLOWED_PM2_ACTIONS.has(action)
      ) {
        sendJson(res, 400, { error: 'Invalid PM2 user, process ID, or action' });
        return;
      }
      await runPm2Helper(['action', linuxUser, pmIdStr, action], 12000);
      pm2DiscoveryCache.ts = 0;
      sendJson(res, 200, { ok: true, linuxUser, pmId: Number(pmIdStr), action });
      return;
    }

    if (req.method === 'GET' && pathname === '/docker/containers') {
      try {
        const infoRes = await dockerRequest('GET', '/version');
        const listRes = await dockerRequest('GET', '/containers/json?all=1');
        if (listRes.status >= 400) {
          sendJson(res, 200, { available: false, containers: [] });
          return;
        }
        const versionObj = JSON.parse(infoRes.body || '{}');
        const rawList = JSON.parse(listRes.body || '[]');
        const containers = rawList.map((c) => ({
          id: String(c.Id || '').slice(0, 12),
          fullId: String(c.Id || ''),
          name: String((c.Names && c.Names[0]) || '').replace(/^\//, ''),
          image: String(c.Image || ''),
          state: String(c.State || 'unknown'),
          status: String(c.Status || ''),
          created: c.Created ? new Date(c.Created * 1000).toISOString() : null,
        }));
        sendJson(res, 200, {
          available: true,
          version: versionObj.Version || 'unknown',
          containers,
        });
      } catch {
        sendJson(res, 200, { available: false, containers: [] });
      }
      return;
    }

    const dockerActionMatch = pathname.match(
      /^\/docker\/containers\/([a-zA-Z0-9_.-]+)\/(start|stop|restart|pause|unpause|inspect|logs)$/
    );
    if (dockerActionMatch) {
      const [, containerId, action] = dockerActionMatch;
      if (!SAFE_ID_REGEX.test(containerId)) {
        sendJson(res, 400, { error: 'Invalid container ID' });
        return;
      }
      if (action === 'inspect' && req.method === 'GET') {
        const r = await dockerRequest('GET', `/containers/${containerId}/json`);
        sendJson(res, r.status, JSON.parse(r.body || '{}'));
        return;
      }
      if (action === 'logs' && req.method === 'GET') {
        const r = await dockerRequest(
          'GET',
          `/containers/${containerId}/logs?stdout=1&stderr=1&tail=100`
        );
        sendJson(res, 200, { logs: r.body });
        return;
      }
      if (req.method === 'POST' && ALLOWED_DOCKER_ACTIONS.has(action)) {
        const r = await dockerRequest(
          'POST',
          `/containers/${containerId}/${action}`
        );
        sendJson(res, r.status >= 400 ? r.status : 200, { ok: r.status < 400 });
        return;
      }
    }

    if (req.method === 'GET' && pathname === '/services') {
      const services = await listSystemdServices();
      sendJson(res, 200, { services });
      return;
    }

    const svcLogsMatch = pathname.match(/^\/services\/([a-zA-Z0-9_@.-]+)\/logs$/);
    if (req.method === 'GET' && svcLogsMatch) {
      const svcName = svcLogsMatch[1];
      if (!SAFE_ID_REGEX.test(svcName)) {
        sendJson(res, 400, { error: 'Invalid service name' });
        return;
      }
      const { stdout } = await execFileAsync('journalctl', [
        '-u',
        `${svcName}.service`,
        '-n',
        '60',
        '--no-pager',
      ]);
      sendJson(res, 200, { logs: stdout });
      return;
    }

    const svcActionMatch = pathname.match(
      /^\/services\/([a-zA-Z0-9_@.-]+)\/(start|stop|restart|enable|disable)$/
    );
    if (req.method === 'POST' && svcActionMatch) {
      const [, svcName, action] = svcActionMatch;
      const out = await runServiceAction(svcName, action);
      sendJson(res, 200, out);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, {
      error: err instanceof Error ? err.message : 'Agent error',
    });
  }
});

if (!AGENT_TOKEN) {
  console.error('SURF_AGENT_TOKEN must be set. Refusing to start unauthenticated agent.');
  process.exit(1);
}

server.listen(BIND_PORT, BIND_HOST, () => {
  console.log(`Surf Monitor Agent v${AGENT_VERSION} listening on ${BIND_HOST}:${BIND_PORT}`);
});
