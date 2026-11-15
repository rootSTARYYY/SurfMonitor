#!/usr/bin/env node
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const AGENT_VERSION = '5.0.0';
const BIND_HOST = '127.0.0.1';
const BIND_PORT = Number(process.env.SURF_AGENT_PORT || 47200);
const AGENT_TOKEN = process.env.SURF_AGENT_TOKEN || '';
const DOCKER_SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const PM2_HELPER = '/usr/local/bin/surf-pm2-helper';
const SELF_PATH = fileURLToPath(import.meta.url);
const SYSTEMD_UNIT_PATH = '/etc/systemd/system/surf-monitor-agent.service';
const STARTED_AT = Date.now();

const SAFE_ID_REGEX = /^[a-zA-Z0-9_@.-]{1,128}$/;
const SAFE_USER_REGEX = /^[a-z_][a-z0-9_-]{0,31}$/;
const SAFE_PM_ID_REGEX = /^[0-9]{1,6}$/;
const SAFE_IP_REGEX = /^[0-9a-fA-F.:/]{3,45}$/;
const ALLOWED_DOCKER_ACTIONS = new Set(['start', 'stop', 'restart', 'pause', 'unpause']);
const ALLOWED_SERVICE_ACTIONS = new Set(['start', 'stop', 'restart', 'enable', 'disable']);
const ALLOWED_PM2_ACTIONS = new Set(['start', 'stop', 'restart']);

const ALL_PERMISSIONS = [
  'metrics.read',
  'process.read',
  'process.manage',
  'pm2.read',
  'pm2.manage',
  'docker.read',
  'docker.manage',
  'systemd.read',
  'systemd.manage',
  'network.read',
  'firewall.read',
  'firewall.manage',
  'performance.optimize',
  'recovery.manage',
  'integrity.read',
  'jobs.read',
  'jobs.cancel',
];

let agentSettings = {
  cpuIntervalMs: 1000,
  ramIntervalMs: 1000,
  netIntervalMs: 1000,
  diskIntervalMs: 30000,
  processIntervalMs: 5000,
  dockerIntervalMs: 5000,
  pm2IntervalMs: 5000,
  systemdIntervalMs: 30000,
  remediationPolicy: 'approval_required', // 'observe_only' | 'approval_required' | 'restricted_auto'
  cpuAlertThreshold: 90,
  memAlertThreshold: 90,
  diskAlertThreshold: 90,
  trafficSpikeMultiplier: 4,
  eventRetentionLimit: 250,
};

const elDelay = monitorEventLoopDelay({ resolution: 20 });
elDelay.enable();

let prevProcStat = null;
let prevNetStats = null;
let prevDiskIo = null;

const snapshot = {
  updatedAt: 0,
  cpuPercent: 0,
  loadAvg: [0, 0, 0],
  uptimeSeconds: 0,
  memory: { totalBytes: 0, usedBytes: 0, freeBytes: 0, availableBytes: 0, usedPercent: 0, swapTotalBytes: 0, swapUsedBytes: 0, swapPercent: 0 },
  psi: { cpuSomeAvg10: null, memSomeAvg10: null, ioSomeAvg10: null },
  network: { rxBytesPerSec: 0, txBytesPerSec: 0, interfaces: [], tcpEstablished: 0, tcpSynRecv: 0 },
  diskIo: { readBytesPerSec: 0, writeBytesPerSec: 0 },
  disks: [],
  processes: [],
  docker: { available: false, version: 'unknown', containers: [] },
  pm2: { installed: false, helperInstalled: false, error: null, instances: [], processes: [] },
  systemd: [],
  ports: [],
  collectorDurationsMs: {},
  collectorErrors: {},
  timestamps: { fast: 0, disk: 0, process: 0, docker: 0, pm2: 0, systemd: 0, ports: 0 },
};

const metricHistory = []; // bounded 2880 samples (~24h at 30s)
const trafficBaseline = []; // rolling rxBytesPerSec samples
const eventQueue = [];
const activityLog = [];
const activeMitigations = [];
const recoveryRules = [];
const lastEventKeys = new Map();
let sysctlBackup = {};

// --- Self-Protection & File Integrity Baseline ---
function sha256File(filePath) {
  try {
    const buf = fs.readFileSync(filePath);
    return crypto.createHash('sha256').update(buf).digest('hex');
  } catch {
    return null;
  }
}

const integrityBaseline = {
  establishedAt: new Date().toISOString(),
  files: {
    [SELF_PATH]: sha256File(SELF_PATH),
    [SYSTEMD_UNIT_PATH]: sha256File(SYSTEMD_UNIT_PATH),
  },
  tamperDetected: false,
  tamperDetails: [],
  lastCheckedAt: null,
};

function checkSelfIntegrity() {
  integrityBaseline.lastCheckedAt = new Date().toISOString();
  const mismatches = [];
  for (const [fp, expectedHash] of Object.entries(integrityBaseline.files)) {
    if (!expectedHash) continue;
    const currentHash = sha256File(fp);
    if (currentHash !== expectedHash) {
      mismatches.push({ file: fp, expectedHash, currentHash: currentHash || 'MISSING' });
    }
  }
  integrityBaseline.tamperDetected = mismatches.length > 0;
  integrityBaseline.tamperDetails = mismatches;
  if (mismatches.length > 0) {
    pushEvent(
      'tamper_detected',
      'critical',
      'Agent File Integrity Mismatch',
      `Unexpected modification detected on ${mismatches.map((m) => m.file).join(', ')}`,
      { mismatches }
    );
  }
  return integrityBaseline;
}

function pushEvent(type, severity, title, detail, meta = {}) {
  const dedupKey = `${type}:${title}`;
  const now = Date.now();
  if (now - (lastEventKeys.get(dedupKey) || 0) < 30_000) return;
  lastEventKeys.set(dedupKey, now);
  eventQueue.unshift({
    id: `evt-${now}-${crypto.randomBytes(3).toString('hex')}`,
    type,
    severity,
    title,
    detail,
    meta,
    acknowledged: false,
    timestamp: new Date(now).toISOString(),
  });
  if (eventQueue.length > agentSettings.eventRetentionLimit) {
    eventQueue.length = agentSettings.eventRetentionLimit;
  }
}

function redactSecrets(text) {
  let out = String(text || '');
  if (AGENT_TOKEN && AGENT_TOKEN.length >= 4) out = out.split(AGENT_TOKEN).join('[REDACTED]');
  return out.replace(/(password|token|secret|key)=([^\s&]+)/gi, '$1=[REDACTED]');
}

function recordActivity(entry) {
  activityLog.unshift({
    id: `act-${Date.now()}-${crypto.randomBytes(2).toString('hex')}`,
    timestamp: new Date().toISOString(),
    ...entry,
    command: entry.command ? redactSecrets(entry.command) : undefined,
  });
  if (activityLog.length > 300) activityLog.length = 300;
}

function constantTimeTokenMatch(headerVal) {
  if (!AGENT_TOKEN || typeof headerVal !== 'string' || !headerVal.startsWith('Bearer ')) return false;
  const provided = headerVal.slice(7).trim();
  const a = Buffer.from(provided, 'utf8');
  const b = Buffer.from(AGENT_TOKEN, 'utf8');
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// --- Native Linux /proc/* Collectors ---
function readLinuxCpuPercent() {
  if (process.platform === 'linux') {
    try {
      const line = fs.readFileSync('/proc/stat', 'utf8').split('\n')[0];
      const parts = line.trim().split(/\s+/).slice(1).map(Number);
      const idle = (parts[3] || 0) + (parts[4] || 0);
      const total = parts.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);
      if (!prevProcStat) {
        prevProcStat = { idle, total };
        return 0;
      }
      const dIdle = idle - prevProcStat.idle;
      const dTotal = total - prevProcStat.total;
      prevProcStat = { idle, total };
      return dTotal > 0 ? Number((((dTotal - dIdle) / dTotal) * 100).toFixed(1)) : 0;
    } catch {}
  }
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;
  for (const cpu of cpus) {
    for (const k of Object.keys(cpu.times)) total += cpu.times[k];
    idle += cpu.times.idle;
  }
  if (!prevProcStat) {
    prevProcStat = { idle, total };
    return 0;
  }
  const dIdle = idle - prevProcStat.idle;
  const dTotal = total - prevProcStat.total;
  prevProcStat = { idle, total };
  return dTotal > 0 ? Number((((dTotal - dIdle) / dTotal) * 100).toFixed(1)) : 0;
}

function readLinuxMemory() {
  if (process.platform === 'linux') {
    try {
      const raw = fs.readFileSync('/proc/meminfo', 'utf8');
      const map = {};
      for (const line of raw.split('\n')) {
        const m = line.match(/^([A-Za-z0-9_()]+):\s+(\d+)\s+kB/);
        if (m) map[m[1]] = Number(m[2]) * 1024;
      }
      const totalBytes = map.MemTotal || os.totalmem();
      const availableBytes = map.MemAvailable || map.MemFree || os.freemem();
      const usedBytes = Math.max(0, totalBytes - availableBytes);
      const swapTotalBytes = map.SwapTotal || 0;
      const swapFreeBytes = map.SwapFree || 0;
      const swapUsedBytes = Math.max(0, swapTotalBytes - swapFreeBytes);
      return {
        totalBytes,
        usedBytes,
        freeBytes: map.MemFree || availableBytes,
        availableBytes,
        usedPercent: totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0,
        swapTotalBytes,
        swapUsedBytes,
        swapPercent: swapTotalBytes > 0 ? Number(((swapUsedBytes / swapTotalBytes) * 100).toFixed(1)) : 0,
      };
    } catch {}
  }
  const totalBytes = os.totalmem();
  const freeBytes = os.freemem();
  const usedBytes = totalBytes - freeBytes;
  return {
    totalBytes,
    usedBytes,
    freeBytes,
    availableBytes: freeBytes,
    usedPercent: totalBytes > 0 ? Number(((usedBytes / totalBytes) * 100).toFixed(1)) : 0,
    swapTotalBytes: 0,
    swapUsedBytes: 0,
    swapPercent: 0,
  };
}

function readLinuxPsi() {
  if (process.platform !== 'linux') return { cpuSomeAvg10: null, memSomeAvg10: null, ioSomeAvg10: null };
  const readAvg10 = (file) => {
    try {
      const raw = fs.readFileSync(file, 'utf8');
      const m = raw.match(/some\s+avg10=([0-9.]+)/);
      return m ? Number(m[1]) : null;
    } catch {
      return null;
    }
  };
  return {
    cpuSomeAvg10: readAvg10('/proc/pressure/cpu'),
    memSomeAvg10: readAvg10('/proc/pressure/memory'),
    ioSomeAvg10: readAvg10('/proc/pressure/io'),
  };
}

function readLinuxNetwork() {
  if (process.platform !== 'linux') {
    return { rxBytesPerSec: 0, txBytesPerSec: 0, interfaces: [], tcpEstablished: 0, tcpSynRecv: 0 };
  }
  try {
    const raw = fs.readFileSync('/proc/net/dev', 'utf8');
    const lines = raw.split('\n').slice(2);
    const interfaces = [];
    let totalRx = 0;
    let totalTx = 0;
    for (const line of lines) {
      const t = line.trim();
      if (!t) continue;
      const [ifacePart, statsPart] = t.split(':');
      if (!statsPart) continue;
      const iface = ifacePart.trim();
      if (iface === 'lo') continue;
      const nums = statsPart.trim().split(/\s+/).map(Number);
      const rx = nums[0] || 0;
      const rxErr = nums[2] || 0;
      const rxDrop = nums[3] || 0;
      const tx = nums[8] || 0;
      const txErr = nums[10] || 0;
      const txDrop = nums[11] || 0;
      totalRx += rx;
      totalTx += tx;
      interfaces.push({ name: iface, rxBytes: rx, txBytes: tx, rxErr, rxDrop, txErr, txDrop });
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

    let tcpEstablished = 0;
    let tcpSynRecv = 0;
    try {
      const tcpRaw = fs.readFileSync('/proc/net/tcp', 'utf8').split('\n').slice(1);
      for (const l of tcpRaw) {
        const cols = l.trim().split(/\s+/);
        if (cols[3] === '01') tcpEstablished++;
        else if (cols[3] === '03') tcpSynRecv++;
      }
    } catch {}

    return { rxBytesPerSec, txBytesPerSec, interfaces, tcpEstablished, tcpSynRecv };
  } catch {
    return { rxBytesPerSec: 0, txBytesPerSec: 0, interfaces: [], tcpEstablished: 0, tcpSynRecv: 0 };
  }
}

function readLinuxDiskIo() {
  if (process.platform !== 'linux') return { readBytesPerSec: 0, writeBytesPerSec: 0 };
  try {
    const raw = fs.readFileSync('/proc/diskstats', 'utf8');
    let readSectors = 0;
    let writeSectors = 0;
    for (const line of raw.split('\n')) {
      const cols = line.trim().split(/\s+/);
      if (cols.length >= 14 && /^(sd|vd|nvme|xvd)[a-z0-9]+$/.test(cols[2]) && !/\d+$/.test(cols[2])) {
        readSectors += Number(cols[5]) || 0;
        writeSectors += Number(cols[9]) || 0;
      }
    }
    const now = Date.now();
    let readBytesPerSec = 0;
    let writeBytesPerSec = 0;
    if (prevDiskIo) {
      const dt = Math.max(0.5, (now - prevDiskIo.ts) / 1000);
      readBytesPerSec = Math.max(0, Math.round(((readSectors - prevDiskIo.r) * 512) / dt));
      writeBytesPerSec = Math.max(0, Math.round(((writeSectors - prevDiskIo.w) * 512) / dt));
    }
    prevDiskIo = { r: readSectors, w: writeSectors, ts: now };
    return { readBytesPerSec, writeBytesPerSec };
  } catch {
    return { readBytesPerSec: 0, writeBytesPerSec: 0 };
  }
}

function readLinuxProcesses(limit = 80) {
  if (process.platform !== 'linux') return [];
  try {
    const entries = fs.readdirSync('/proc');
    const list = [];
    for (const name of entries) {
      if (!/^\d+$/.test(name)) continue;
      const pid = Number(name);
      try {
        const status = fs.readFileSync(`/proc/${pid}/status`, 'utf8');
        const getField = (k) => {
          const m = status.match(new RegExp(`^${k}:\\s*(.+)$`, 'm'));
          return m ? m[1].trim() : '';
        };
        const procName = getField('Name');
        const state = getField('State').slice(0, 1);
        const ppid = Number(getField('PPid') || '0');
        const threads = Number(getField('Threads') || '1');
        const vmRssKb = Number((getField('VmRSS').match(/\d+/) || ['0'])[0]);
        let cmdline = procName;
        try {
          const rawCmd = fs.readFileSync(`/proc/${pid}/cmdline`, 'utf8').replace(/\0/g, ' ').trim();
          if (rawCmd) cmdline = redactSecrets(rawCmd.slice(0, 200));
        } catch {}
        list.push({ pid, ppid, name: procName, state, threads, rssBytes: vmRssKb * 1024, rssMb: Number((vmRssKb / 1024).toFixed(1)), cmdline });
      } catch {}
    }
    return list.sort((a, b) => b.rssBytes - a.rssBytes).slice(0, limit);
  } catch {
    return [];
  }
}

async function getDiskPartitions() {
  if (process.platform === 'win32') return [];
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

async function getListeningPorts() {
  if (process.platform !== 'linux') return [];
  try {
    const { stdout } = await execFileAsync('ss', ['-tulnp'], { timeout: 5000 });
    const ports = [];
    for (const line of stdout.split('\n').slice(1)) {
      const cols = line.trim().split(/\s+/);
      if (cols.length < 5) continue;
      const proto = cols[0];
      const local = cols[4];
      const portMatch = local.match(/:(\d+)$/);
      if (!portMatch) continue;
      const port = Number(portMatch[1]);
      const procRaw = cols.slice(6).join(' ');
      const pidMatch = procRaw.match(/pid=(\d+)/);
      const nameMatch = procRaw.match(/"([^"]+)"/);
      ports.push({ proto, address: local, port, pid: pidMatch ? Number(pidMatch[1]) : null, process: nameMatch ? nameMatch[1] : null });
    }
    return ports;
  } catch {
    return [];
  }
}

function dockerRequest(method, reqPath) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: DOCKER_SOCKET, path: reqPath, method, timeout: 6000 }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve({ status: res.statusCode || 500, body: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.on('timeout', () => req.destroy(new Error('Docker socket timeout')));
    req.end();
  });
}

async function collectDocker() {
  try {
    const infoRes = await dockerRequest('GET', '/version');
    const listRes = await dockerRequest('GET', '/containers/json?all=1');
    if (listRes.status >= 400) return { available: false, version: 'unknown', containers: [] };
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
    return { available: true, version: versionObj.Version || 'unknown', containers };
  } catch {
    return { available: false, version: 'unknown', containers: [] };
  }
}

function parseJsonArrayFromMixed(raw) {
  const i = raw.indexOf('[');
  const j = raw.lastIndexOf(']');
  if (i !== -1 && j > i) return JSON.parse(raw.slice(i, j + 1));
  return JSON.parse(raw || '[]');
}

async function runPm2Helper(args, timeoutMs = 10000) {
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const cmd = isRoot ? PM2_HELPER : 'sudo';
  const cmdArgs = isRoot ? args : ['-n', PM2_HELPER, ...args];
  const { stdout } = await execFileAsync(cmd, cmdArgs, { timeout: timeoutMs });
  return stdout;
}

async function collectPm2() {
  if (!fs.existsSync(PM2_HELPER)) {
    return { installed: false, helperInstalled: false, error: 'surf-pm2-helper not found', instances: [], processes: [] };
  }
  try {
    const discRaw = await runPm2Helper(['discover'], 8000);
    const disc = JSON.parse(discRaw || '{"users":[]}');
    const users = Array.isArray(disc.users) ? disc.users : [];
    const instances = [];
    const processes = [];
    for (const u of users) {
      let procList = [];
      if (u.accessible) {
        try {
          const jRaw = await runPm2Helper(['jlist', u.user], 8000);
          procList = parseJsonArrayFromMixed(jRaw);
        } catch {}
      }
      instances.push({
        linuxUser: u.user,
        pm2Path: u.pm2Path || null,
        daemonAvailable: Boolean(u.daemonAvailable),
        accessible: Boolean(u.accessible),
        processCount: procList.length,
        pm2Home: u.pm2Home || '',
      });
      for (const p of procList) {
        const env = p.pm2_env || {};
        const monit = p.monit || {};
        const pmId = Number(p.pm_id ?? 0);
        const rawStatus = String(env.status || 'unknown').toLowerCase();
        const state = ['online', 'stopped', 'errored', 'launching'].includes(rawStatus) ? rawStatus : 'unknown';
        const uptimeMs = env.pm_uptime ? Math.max(0, Date.now() - Number(env.pm_uptime)) : 0;
        processes.push({
          processKey: `${u.user}:${pmId}`,
          pmId,
          name: String(p.name || 'unknown'),
          linuxUser: u.user,
          status: rawStatus,
          state,
          cpu: Number(monit.cpu || 0),
          memoryBytes: Number(monit.memory || 0),
          uptimeMs,
          uptimeSeconds: Math.floor(uptimeMs / 1000),
          restarts: Number(env.restart_time || 0),
          unstableRestarts: Number(env.unstable_restarts || 0),
          execMode: String(env.exec_mode || 'fork'),
          instances: Number(env.instances || 1),
          nodeVersion: env.node_version ? String(env.node_version) : null,
          scriptPath: env.pm_exec_path ? String(env.pm_exec_path) : null,
          cwd: env.pm_cwd ? String(env.pm_cwd) : null,
          lastRestartAt: env.pm_uptime ? new Date(Number(env.pm_uptime)).toISOString() : null,
          pid: Number(p.pid || 0) || null,
          envName: env.namespace ? String(env.namespace) : 'default',
        });
      }
    }
    return { installed: true, helperInstalled: true, error: null, instances, processes };
  } catch (err) {
    return { installed: true, helperInstalled: true, error: err instanceof Error ? err.message : String(err), instances: [], processes: [] };
  }
}

async function collectSystemd() {
  if (process.platform !== 'linux') return [];
  try {
    const { stdout } = await execFileAsync('systemctl', ['list-units', '--type=service', '--all', '--no-pager', '--no-legend', '--plain']);
    const services = [];
    for (const line of stdout.split('\n')) {
      const t = line.trim();
      if (!t) continue;
      const parts = t.split(/\s+/);
      const unit = parts[0] || '';
      if (!unit.endsWith('.service')) continue;
      services.push({
        name: unit.replace(/\.service$/, ''),
        loadState: parts[1] || '',
        activeState: parts[2] || '',
        subState: parts[3] || '',
        description: parts.slice(4).join(' '),
      });
    }
    return services;
  } catch {
    return [];
  }
}

// --- Performance Booster & Safe Optimization Profiles ---
const OPTIMIZATION_PROFILES = {
  balanced: {
    id: 'balanced',
    name: 'Balanced',
    description: 'Default Linux kernel & service parameters with conservative swappiness.',
    sysctl: { 'vm.swappiness': '30', 'net.core.somaxconn': '1024' },
    tradeoffs: 'Minimal memory or network bias; safe for general-purpose VPS workloads.',
  },
  performance: {
    id: 'performance',
    name: 'Performance',
    description: 'Prioritizes throughput and low-latency socket queues for busy web/game/API hosts.',
    sysctl: { 'vm.swappiness': '10', 'net.core.somaxconn': '4096', 'net.ipv4.tcp_max_syn_backlog': '4096' },
    tradeoffs: 'Keeps more pages in RAM before swapping; slightly higher kernel socket buffer memory.',
  },
  memory_efficient: {
    id: 'memory_efficient',
    name: 'Memory Efficient',
    description: 'Tunes dirty writeback and swappiness for small RAM VPS instances.',
    sysctl: { 'vm.swappiness': '60', 'vm.dirty_ratio': '15', 'vm.dirty_background_ratio': '5' },
    tradeoffs: 'Flushes dirty pages earlier; slightly more disk write frequency to preserve free RAM.',
  },
  network_optimized: {
    id: 'network_optimized',
    name: 'Network Optimized',
    description: 'Increases TCP backlog and enables SYN cookies + BBR congestion control where supported.',
    sysctl: { 'net.core.somaxconn': '8192', 'net.ipv4.tcp_syncookies': '1', 'net.ipv4.tcp_max_syn_backlog': '8192' },
    tradeoffs: 'Improves resilience against SYN floods and high connection concurrency.',
  },
};

function analyzePerformanceBottlenecks() {
  const bottlenecks = [];
  if (snapshot.cpuPercent >= agentSettings.cpuAlertThreshold) {
    bottlenecks.push({ type: 'cpu_saturation', severity: 'critical', evidence: `CPU at ${snapshot.cpuPercent}%, loadAvg=${snapshot.loadAvg.map((n) => n.toFixed(2)).join('/')}` });
  }
  if (snapshot.memory.usedPercent >= agentSettings.memAlertThreshold) {
    const top = snapshot.processes.slice(0, 3).map((p) => `${p.name} (${p.rssMb}MB)`).join(', ');
    bottlenecks.push({ type: 'memory_pressure', severity: 'critical', evidence: `RAM at ${snapshot.memory.usedPercent}%. Top consumers: ${top}` });
  }
  if (snapshot.memory.swapPercent >= 50) {
    bottlenecks.push({ type: 'swap_pressure', severity: 'warning', evidence: `Swap at ${snapshot.memory.swapPercent}%` });
  }
  const zombies = snapshot.processes.filter((p) => p.state === 'Z');
  if (zombies.length > 0) {
    bottlenecks.push({ type: 'zombie_processes', severity: 'warning', evidence: `${zombies.length} zombie process(es) detected` });
  }
  for (const d of snapshot.disks) {
    if (d.usedPercent >= agentSettings.diskAlertThreshold) {
      bottlenecks.push({ type: 'disk_pressure', severity: 'critical', evidence: `Mount ${d.mount} is ${d.usedPercent}% full` });
    }
  }
  const failedSvcs = snapshot.systemd.filter((s) => s.activeState === 'failed');
  if (failedSvcs.length > 0) {
    bottlenecks.push({ type: 'failed_services', severity: 'critical', evidence: `Failed systemd units: ${failedSvcs.map((s) => s.name).join(', ')}` });
  }
  return {
    status: bottlenecks.some((b) => b.severity === 'critical') ? 'critical' : bottlenecks.length > 0 ? 'warning' : 'healthy',
    bottlenecks,
    psi: snapshot.psi,
    topMemoryProcesses: snapshot.processes.slice(0, 10),
    collectedAt: new Date().toISOString(),
  };
}

// --- DDoS & Traffic Anomaly Classification ---
function classifyTrafficAnomaly() {
  const rx = snapshot.network.rxBytesPerSec;
  const avg = trafficBaseline.length > 0 ? trafficBaseline.reduce((a, b) => a + b, 0) / trafficBaseline.length : rx;
  const ratio = avg > 1024 ? rx / avg : 1;
  const synRecv = snapshot.network.tcpSynRecv;

  let classification = 'normal';
  const evidence = [];
  if (synRecv > 200 || (ratio >= agentSettings.trafficSpikeMultiplier && rx > 5 * 1024 * 1024)) {
    classification = 'potential_attack';
    evidence.push(`Inbound ${Math.round(rx / 1024)} KB/s (${ratio.toFixed(1)}x baseline), SYN_RECV=${synRecv}`);
  } else if (ratio >= 2.5 && rx > 1024 * 1024) {
    classification = 'suspicious';
    evidence.push(`Inbound ${Math.round(rx / 1024)} KB/s is ${ratio.toFixed(1)}x rolling baseline`);
  } else if (synRecv > 60) {
    classification = 'elevated';
    evidence.push(`Elevated SYN_RECV count (${synRecv})`);
  }

  return {
    classification,
    rxBytesPerSec: rx,
    txBytesPerSec: snapshot.network.txBytesPerSec,
    baselineRxBytesPerSec: Math.round(avg),
    tcpEstablished: snapshot.network.tcpEstablished,
    tcpSynRecv: synRecv,
    evidence,
    activeMitigations,
    volumetricLimitationNote:
      'Host-level mitigation (UFW/nftables/Fail2ban/sysctl) cannot stop large volumetric DDoS attacks; upstream ISP or CDN (e.g. Cloudflare) mitigation is required.',
  };
}

// --- Capacity Forecasting ---
function computeCapacityForecast() {
  const rootDisk = snapshot.disks.find((d) => d.mount === '/') || snapshot.disks[0];
  if (metricHistory.length < 4) {
    return {
      sufficientData: false,
      sampleCount: metricHistory.length,
      confidence: 'low',
      message: 'Collecting baseline samples; check back after at least 4 polling intervals.',
      current: {
        cpuPercent: snapshot.cpuPercent,
        ramPercent: snapshot.memory.usedPercent,
        diskPercent: rootDisk ? rootDisk.usedPercent : 0,
      },
    };
  }
  const first = metricHistory[0];
  const last = metricHistory[metricHistory.length - 1];
  const dtDays = Math.max(1 / 1440, (last.ts - first.ts) / 86_400_000);
  const diskGrowthPerDay = (last.diskPercent - first.diskPercent) / dtDays;
  const ramGrowthPerDay = (last.ramPercent - first.ramPercent) / dtDays;

  const project = (curr, rate, days) => Number(Math.min(100, Math.max(0, curr + rate * days)).toFixed(1));
  const estDaysToDiskFull = diskGrowthPerDay > 0.05 ? Math.round((100 - last.diskPercent) / diskGrowthPerDay) : null;

  return {
    sufficientData: true,
    sampleCount: metricHistory.length,
    confidence: metricHistory.length >= 60 ? 'high' : 'medium',
    current: { cpuPercent: last.cpuPercent, ramPercent: last.ramPercent, diskPercent: last.diskPercent },
    forecast7d: { diskPercent: project(last.diskPercent, diskGrowthPerDay, 7), ramPercent: project(last.ramPercent, ramGrowthPerDay, 7) },
    forecast30d: { diskPercent: project(last.diskPercent, diskGrowthPerDay, 30), ramPercent: project(last.ramPercent, ramGrowthPerDay, 30) },
    forecast90d: { diskPercent: project(last.diskPercent, diskGrowthPerDay, 90), ramPercent: project(last.ramPercent, ramGrowthPerDay, 90) },
    estimatedDaysToDiskExhaustion: estDaysToDiskFull,
  };
}

// --- Background Collector Scheduler ---
const runningCollectors = new Set();
async function runCollector(key, fn) {
  if (runningCollectors.has(key)) return;
  runningCollectors.add(key);
  const t0 = Date.now();
  try {
    await fn();
    snapshot.collectorDurationsMs[key] = Date.now() - t0;
    delete snapshot.collectorErrors[key];
  } catch (err) {
    snapshot.collectorErrors[key] = err instanceof Error ? err.message : String(err);
  } finally {
    runningCollectors.delete(key);
  }
}

function tickFastCollectors() {
  snapshot.cpuPercent = readLinuxCpuPercent();
  snapshot.memory = readLinuxMemory();
  snapshot.psi = readLinuxPsi();
  snapshot.network = readLinuxNetwork();
  snapshot.diskIo = readLinuxDiskIo();
  snapshot.loadAvg = os.loadavg();
  snapshot.uptimeSeconds = os.uptime();
  snapshot.updatedAt = Date.now();
  snapshot.timestamps.fast = snapshot.updatedAt;

  trafficBaseline.push(snapshot.network.rxBytesPerSec);
  if (trafficBaseline.length > 60) trafficBaseline.shift();

  if (snapshot.cpuPercent >= agentSettings.cpuAlertThreshold) {
    pushEvent('high_cpu', 'warning', 'High CPU Usage', `CPU reached ${snapshot.cpuPercent}%`);
  }
  if (snapshot.memory.usedPercent >= agentSettings.memAlertThreshold) {
    pushEvent('high_memory', 'warning', 'High Memory Usage', `RAM reached ${snapshot.memory.usedPercent}%`);
  }
}

async function tickSlowCollectors() {
  const now = Date.now();
  await Promise.allSettled([
    now - snapshot.timestamps.disk >= agentSettings.diskIntervalMs
      ? runCollector('disk', async () => {
          snapshot.disks = await getDiskPartitions();
          snapshot.timestamps.disk = Date.now();
          const rootDisk = snapshot.disks.find((d) => d.mount === '/') || snapshot.disks[0];
          metricHistory.push({
            ts: Date.now(),
            cpuPercent: snapshot.cpuPercent,
            ramPercent: snapshot.memory.usedPercent,
            diskPercent: rootDisk ? rootDisk.usedPercent : 0,
          });
          if (metricHistory.length > 2880) metricHistory.shift();
          checkSelfIntegrity();
        })
      : Promise.resolve(),
    now - snapshot.timestamps.process >= agentSettings.processIntervalMs
      ? runCollector('process', async () => {
          snapshot.processes = readLinuxProcesses(80);
          snapshot.timestamps.process = Date.now();
        })
      : Promise.resolve(),
    now - snapshot.timestamps.docker >= agentSettings.dockerIntervalMs
      ? runCollector('docker', async () => {
          snapshot.docker = await collectDocker();
          snapshot.timestamps.docker = Date.now();
        })
      : Promise.resolve(),
    now - snapshot.timestamps.pm2 >= agentSettings.pm2IntervalMs
      ? runCollector('pm2', async () => {
          snapshot.pm2 = await collectPm2();
          snapshot.timestamps.pm2 = Date.now();
        })
      : Promise.resolve(),
    now - snapshot.timestamps.systemd >= agentSettings.systemdIntervalMs
      ? runCollector('systemd', async () => {
          snapshot.systemd = await collectSystemd();
          snapshot.timestamps.systemd = Date.now();
          snapshot.ports = await getListeningPorts();
          snapshot.timestamps.ports = Date.now();
        })
      : Promise.resolve(),
  ]);
}

tickFastCollectors();
void tickSlowCollectors();
setInterval(tickFastCollectors, 1000);
setInterval(() => void tickSlowCollectors(), 5000);

async function collectSecurityOverview() {
  let firewallBackend = 'none_detected';
  let firewallStatus = 'unknown';
  let fail2banActive = false;
  const warnings = [];
  if (process.platform === 'linux') {
    try {
      const { stdout } = await execFileAsync('ufw', ['status'], { timeout: 3000 });
      firewallBackend = 'ufw';
      firewallStatus = stdout.trim();
    } catch {
      try {
        await execFileAsync('nft', ['list', 'ruleset'], { timeout: 3000 });
        firewallBackend = 'nftables';
        firewallStatus = 'nftables active';
      } catch {
        firewallBackend = 'iptables_or_none';
      }
    }
    try {
      const { stdout } = await execFileAsync('systemctl', ['is-active', 'fail2ban'], { timeout: 3000 });
      fail2banActive = stdout.trim() === 'active';
    } catch {}
    try {
      const sshd = fs.readFileSync('/etc/ssh/sshd_config', 'utf8');
      if (/^\s*PasswordAuthentication\s+yes/m.test(sshd)) {
        warnings.push('SSH PasswordAuthentication is enabled; SSH key-only auth is recommended.');
      }
    } catch {}
  }
  return {
    firewallBackend,
    firewallStatus,
    fail2banActive,
    listeningPorts: snapshot.ports,
    warnings,
    integrity: checkSelfIntegrity(),
    volumetricLimitationNote:
      'On-host firewalls and Fail2ban cannot mitigate large volumetric DDoS attacks; upstream ISP or CDN (e.g. Cloudflare) protection is required.',
  };
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'));
      } catch {
        resolve({});
      }
    });
  });
}

async function runServiceAction(serviceName, action) {
  if (!SAFE_ID_REGEX.test(serviceName) || !ALLOWED_SERVICE_ACTIONS.has(action)) {
    throw new Error('Invalid service name or action');
  }
  const isRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  await execFileAsync(isRoot ? 'systemctl' : 'sudo', isRoot ? [action, `${serviceName}.service`] : ['-n', 'systemctl', action, `${serviceName}.service`], { timeout: 15000 });
  recordActivity({ operation: `systemd.${action}`, target: serviceName, status: 'completed', command: `systemctl ${action} ${serviceName}.service` });
  return { ok: true, service: serviceName, action };
}

const server = http.createServer(async (req, res) => {
  try {
    if (!constantTimeTokenMatch(req.headers.authorization)) {
      sendJson(res, 401, { error: 'Unauthorized' });
      return;
    }

    const urlObj = new URL(req.url || '/', `http://${BIND_HOST}:${BIND_PORT}`);
    const pathname = urlObj.pathname;

    // --- Health, Capabilities & Integrity ---
    if (req.method === 'GET' && (pathname === '/health' || pathname === '/v1/agent/health')) {
      const mem = process.memoryUsage();
      sendJson(res, 200, {
        ok: true,
        status: 'healthy',
        version: AGENT_VERSION,
        hostname: os.hostname(),
        platform: process.platform,
        arch: process.arch,
        uptimeSeconds: os.uptime(),
        agentUptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
        selfMetrics: {
          rssMb: Number((mem.rss / 1048576).toFixed(1)),
          heapUsedMb: Number((mem.heapUsed / 1048576).toFixed(1)),
          eventLoopLagMs: Number((elDelay.mean / 1e6).toFixed(2)),
          eventQueueSize: eventQueue.length,
        },
        integrity: checkSelfIntegrity(),
        snapshotUpdatedAt: snapshot.updatedAt,
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/agent/capabilities') {
      sendJson(res, 200, {
        version: AGENT_VERSION,
        permissions: ALL_PERMISSIONS,
        capabilities: {
          monitoring: { available: true, nativeProc: process.platform === 'linux' },
          performanceBooster: { available: process.platform === 'linux' },
          ddosDetection: { available: true },
          capacityForecasting: { available: true },
          selfIntegrity: { available: true },
          processes: { available: process.platform === 'linux' },
          pm2: { available: fs.existsSync(PM2_HELPER) },
          docker: { available: snapshot.docker.available },
          systemd: { available: process.platform === 'linux' },
          security: { available: true },
        },
      });
      return;
    }

    // --- Metrics (100% Backward Compatible /metrics + /v1/metrics/snapshot) ---
    if (req.method === 'GET' && (pathname === '/metrics' || pathname === '/v1/metrics/snapshot')) {
      const rootDisk = snapshot.disks.find((d) => d.mount === '/') || snapshot.disks[0];
      const cpus = os.cpus();
      sendJson(res, 200, {
        agentVersion: AGENT_VERSION,
        hostname: os.hostname(),
        platform: process.platform,
        osInfo: `${os.type()} ${os.release()}`,
        kernelVersion: os.release(),
        arch: os.arch(),
        cpuCores: cpus.length,
        cpuModel: (cpus[0] && cpus[0].model) || 'unknown',
        cpuPercent: snapshot.cpuPercent,
        ramTotalBytes: snapshot.memory.totalBytes,
        ramUsedBytes: snapshot.memory.usedBytes,
        ramPercent: snapshot.memory.usedPercent,
        diskTotalBytes: rootDisk ? rootDisk.totalBytes : 0,
        diskUsedBytes: rootDisk ? rootDisk.usedBytes : 0,
        diskPercent: rootDisk ? rootDisk.usedPercent : 0,
        partitions: snapshot.disks,
        netRxBytesPerSec: snapshot.network.rxBytesPerSec,
        netTxBytesPerSec: snapshot.network.txBytesPerSec,
        interfaces: snapshot.network.interfaces,
        uptimeSeconds: snapshot.uptimeSeconds,
        loadAvg: snapshot.loadAvg,
        timestamp: new Date(snapshot.updatedAt || Date.now()).toISOString(),
        cached: true,
        memory: snapshot.memory,
        psi: snapshot.psi,
        network: snapshot.network,
        diskIo: snapshot.diskIo,
        collectorDurationsMs: snapshot.collectorDurationsMs,
      });
      return;
    }

    // --- Performance Booster & Capacity Forecasting ---
    if (req.method === 'GET' && pathname === '/v1/performance/analysis') {
      sendJson(res, 200, analyzePerformanceBottlenecks());
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/performance/profiles') {
      sendJson(res, 200, { profiles: Object.values(OPTIMIZATION_PROFILES), hasBackup: Object.keys(sysctlBackup).length > 0 });
      return;
    }

    if (req.method === 'POST' && pathname === '/v1/performance/profiles/apply') {
      const body = await readJsonBody(req);
      const profile = OPTIMIZATION_PROFILES[String(body.profileId || '')];
      if (!profile) {
        sendJson(res, 400, { error: 'Unknown optimization profile' });
        return;
      }
      if (process.platform !== 'linux') {
        sendJson(res, 400, { error: 'Sysctl optimization is supported on Linux servers only.' });
        return;
      }
      const backup = {};
      for (const [k, val] of Object.entries(profile.sysctl)) {
        try {
          const { stdout } = await execFileAsync('sysctl', ['-n', k]);
          backup[k] = stdout.trim();
        } catch {}
        await execFileAsync('sysctl', ['-w', `${k}=${val}`]);
      }
      sysctlBackup = backup;
      recordActivity({ operation: 'performance.profile.apply', target: profile.id, status: 'completed' });
      sendJson(res, 200, { ok: true, profile: profile.id, backup });
      return;
    }

    if (req.method === 'POST' && pathname === '/v1/performance/profiles/rollback') {
      for (const [k, val] of Object.entries(sysctlBackup)) {
        await execFileAsync('sysctl', ['-w', `${k}=${val}`]);
      }
      recordActivity({ operation: 'performance.profile.rollback', status: 'completed' });
      sendJson(res, 200, { ok: true, restored: sysctlBackup });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/capacity/forecast') {
      sendJson(res, 200, computeCapacityForecast());
      return;
    }

    // --- Network, DDoS Anomalies & Mitigation ---
    if (req.method === 'GET' && pathname === '/v1/network/anomalies') {
      sendJson(res, 200, classifyTrafficAnomaly());
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/network/ports') {
      const ports = snapshot.ports.length > 0 ? snapshot.ports : await getListeningPorts();
      sendJson(res, 200, { ports, interfaces: snapshot.network.interfaces });
      return;
    }

    if (req.method === 'POST' && pathname === '/v1/security/mitigations/block-ip') {
      const body = await readJsonBody(req);
      const ip = String(body.ip || '').trim();
      const durationSec = Math.min(86400, Math.max(60, Number(body.durationSec || 600)));
      if (!SAFE_IP_REGEX.test(ip) || ip === '127.0.0.1' || ip === '::1') {
        sendJson(res, 400, { error: 'Invalid or protected IP address' });
        return;
      }
      // Safe temporary UFW deny rule with automatic expiry timer
      await execFileAsync('ufw', ['insert', '1', 'deny', 'from', ip, 'to', 'any'], { timeout: 5000 });
      const entry = { id: `mit-${Date.now()}`, ip, durationSec, expiresAt: new Date(Date.now() + durationSec * 1000).toISOString() };
      activeMitigations.push(entry);
      setTimeout(() => {
        void execFileAsync('ufw', ['delete', 'deny', 'from', ip, 'to', 'any']).catch(() => {});
      }, durationSec * 1000);
      recordActivity({ operation: 'security.mitigation.block_ip', target: ip, status: 'completed' });
      sendJson(res, 200, { ok: true, mitigation: entry });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/processes') {
      sendJson(res, 200, { processes: snapshot.processes, updatedAt: snapshot.timestamps.process });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/events') {
      sendJson(res, 200, { events: eventQueue });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/agent/activity') {
      sendJson(res, 200, { activity: activityLog });
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/agent/settings') {
      sendJson(res, 200, agentSettings);
      return;
    }

    if (req.method === 'POST' && pathname === '/v1/agent/settings') {
      const body = await readJsonBody(req);
      agentSettings = { ...agentSettings, ...body };
      recordActivity({ operation: 'agent.settings.update', status: 'completed' });
      sendJson(res, 200, agentSettings);
      return;
    }

    if (req.method === 'GET' && pathname === '/v1/security/overview') {
      sendJson(res, 200, await collectSecurityOverview());
      return;
    }

    // --- Existing v3.x PM2, Docker, and Systemd Routes ---
    if (req.method === 'GET' && (pathname === '/pm2' || pathname === '/v1/pm2' || pathname === '/pm2/processes')) {
      if (urlObj.searchParams.get('refresh') === '1') {
        snapshot.pm2 = await collectPm2();
        snapshot.timestamps.pm2 = Date.now();
      }
      sendJson(res, 200, snapshot.pm2);
      return;
    }

    const pm2LogsMatch = pathname.match(/^\/pm2\/processes\/([^/]+)\/(\d+)\/logs$/);
    if (req.method === 'GET' && pm2LogsMatch) {
      const [, linuxUser, pmIdStr] = pm2LogsMatch;
      const lines = Math.min(500, Math.max(10, Number(urlObj.searchParams.get('lines') || '100')));
      if (!SAFE_USER_REGEX.test(linuxUser) || !SAFE_PM_ID_REGEX.test(pmIdStr)) {
        sendJson(res, 400, { error: 'Invalid PM2 user or process ID' });
        return;
      }
      const raw = await runPm2Helper(['logs', linuxUser, pmIdStr, String(lines)], 8000);
      sendJson(res, 200, JSON.parse(raw || '{}'));
      return;
    }

    const pm2ActionMatch = pathname.match(/^\/pm2\/processes\/([^/]+)\/(\d+)\/(start|stop|restart)$/);
    if (req.method === 'POST' && pm2ActionMatch) {
      const [, linuxUser, pmIdStr, action] = pm2ActionMatch;
      if (!SAFE_USER_REGEX.test(linuxUser) || !SAFE_PM_ID_REGEX.test(pmIdStr) || !ALLOWED_PM2_ACTIONS.has(action)) {
        sendJson(res, 400, { error: 'Invalid PM2 user, process ID, or action' });
        return;
      }
      await runPm2Helper(['action', linuxUser, pmIdStr, action], 12000);
      snapshot.timestamps.pm2 = 0;
      recordActivity({ operation: `pm2.${action}`, target: `${linuxUser}:${pmIdStr}`, status: 'completed' });
      sendJson(res, 200, { ok: true, linuxUser, pmId: Number(pmIdStr), action });
      return;
    }

    if (req.method === 'GET' && pathname === '/pm2/logs') {
      const linuxUser = urlObj.searchParams.get('user') || '';
      const pmIdStr = urlObj.searchParams.get('id') || '';
      const lines = Math.min(500, Math.max(10, Number(urlObj.searchParams.get('lines') || '100')));
      if (!SAFE_USER_REGEX.test(linuxUser) || !SAFE_PM_ID_REGEX.test(pmIdStr)) {
        sendJson(res, 400, { error: 'Invalid PM2 user or process ID' });
        return;
      }
      const raw = await runPm2Helper(['logs', linuxUser, pmIdStr, String(lines)], 8000);
      sendJson(res, 200, JSON.parse(raw || '{}'));
      return;
    }

    if (req.method === 'POST' && pathname === '/pm2/action') {
      const linuxUser = urlObj.searchParams.get('user') || '';
      const pmIdStr = urlObj.searchParams.get('id') || '';
      const action = urlObj.searchParams.get('action') || '';
      if (!SAFE_USER_REGEX.test(linuxUser) || !SAFE_PM_ID_REGEX.test(pmIdStr) || !ALLOWED_PM2_ACTIONS.has(action)) {
        sendJson(res, 400, { error: 'Invalid PM2 user, process ID, or action' });
        return;
      }
      await runPm2Helper(['action', linuxUser, pmIdStr, action], 12000);
      snapshot.timestamps.pm2 = 0;
      recordActivity({ operation: `pm2.${action}`, target: `${linuxUser}:${pmIdStr}`, status: 'completed' });
      sendJson(res, 200, { ok: true, linuxUser, pmId: Number(pmIdStr), action });
      return;
    }

    if (req.method === 'GET' && (pathname === '/docker/containers' || pathname === '/v1/docker')) {
      sendJson(res, 200, snapshot.docker);
      return;
    }

    const dockerActionMatch = pathname.match(/^\/docker\/containers\/([a-zA-Z0-9_.-]+)\/(start|stop|restart|pause|unpause|inspect|logs)$/);
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
        const r = await dockerRequest('GET', `/containers/${containerId}/logs?stdout=1&stderr=1&tail=100`);
        sendJson(res, 200, { logs: r.body });
        return;
      }
      if (req.method === 'POST' && ALLOWED_DOCKER_ACTIONS.has(action)) {
        const r = await dockerRequest('POST', `/containers/${containerId}/${action}`);
        snapshot.timestamps.docker = 0;
        recordActivity({ operation: `docker.${action}`, target: containerId, status: r.status < 400 ? 'completed' : 'failed' });
        sendJson(res, r.status >= 400 ? r.status : 200, { ok: r.status < 400 });
        return;
      }
    }

    if (req.method === 'GET' && (pathname === '/services' || pathname === '/v1/systemd')) {
      sendJson(res, 200, { services: snapshot.systemd });
      return;
    }

    const svcLogsMatch = pathname.match(/^\/services\/([a-zA-Z0-9_@.-]+)\/logs$/);
    if (req.method === 'GET' && svcLogsMatch) {
      const svcName = svcLogsMatch[1];
      if (!SAFE_ID_REGEX.test(svcName)) {
        sendJson(res, 400, { error: 'Invalid service name' });
        return;
      }
      const { stdout } = await execFileAsync('journalctl', ['-u', `${svcName}.service`, '-n', '60', '--no-pager']);
      sendJson(res, 200, { logs: stdout });
      return;
    }

    const svcActionMatch = pathname.match(/^\/services\/([a-zA-Z0-9_@.-]+)\/(start|stop|restart|enable|disable)$/);
    if (req.method === 'POST' && svcActionMatch) {
      const [, svcName, action] = svcActionMatch;
      const out = await runServiceAction(svcName, action);
      snapshot.timestamps.systemd = 0;
      sendJson(res, 200, out);
      return;
    }

    sendJson(res, 404, { error: 'Not found' });
  } catch (err) {
    sendJson(res, 500, { error: err instanceof Error ? err.message : 'Agent error' });
  }
});

if (!AGENT_TOKEN) {
  console.error('SURF_AGENT_TOKEN must be set. Refusing to start unauthenticated agent.');
  process.exit(1);
}

server.listen(BIND_PORT, BIND_HOST, () => {
  console.log(`Surf Agent v${AGENT_VERSION} listening on ${BIND_HOST}:${BIND_PORT}`);
});
