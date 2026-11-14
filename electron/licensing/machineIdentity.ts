import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { decryptSecret, encryptSecret } from '../security/secrets';

/**
 * Generates a stable, cross-platform SHA-256 machine fingerprint hash.
 * Raw hardware identifiers are hashed before storage or transmission.
 */
export function getCrossPlatformMachineHash(): string {
  const parts: string[] = [os.platform(), os.arch()];

  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'reg',
        ['query', 'HKLM\\SOFTWARE\\Microsoft\\Cryptography', '/v', 'MachineGuid'],
        { encoding: 'utf8', timeout: 2500 }
      );
      const match = out.match(/MachineGuid\s+REG_SZ\s+([^\r\n]+)/i);
      if (match?.[1]) parts.push(match[1].trim());
    } else if (process.platform === 'darwin') {
      const out = execFileSync(
        'ioreg',
        ['-rd1', '-c', 'IOPlatformExpertDevice'],
        { encoding: 'utf8', timeout: 2500 }
      );
      const match = out.match(/"IOPlatformUUID"\s*=\s*"([^"]+)"/);
      if (match?.[1]) parts.push(match[1].trim());
    } else {
      for (const p of ['/etc/machine-id', '/var/lib/dbus/machine-id']) {
        if (fs.existsSync(p)) {
          const val = fs.readFileSync(p, 'utf8').trim();
          if (val) {
            parts.push(val);
            break;
          }
        }
      }
    }
  } catch {
    // Graceful fallback below
  }

  // Add stable CPU model + primary non-internal MAC if OS UUID was unavailable
  if (parts.length <= 2) {
    parts.push(os.hostname());
    const cpus = os.cpus();
    if (cpus[0]?.model) parts.push(cpus[0].model);
    const nets = os.networkInterfaces();
    const macs = Object.values(nets)
      .flat()
      .filter((n): n is os.NetworkInterfaceInfo => Boolean(n && !n.internal && n.mac && n.mac !== '00:00:00:00:00:00'))
      .map((n) => n.mac)
      .sort();
    if (macs[0]) parts.push(macs[0]);
  }

  return crypto
    .createHash('sha256')
    .update(`surf-monitor-v4:${parts.join('|')}`)
    .digest('hex');
}

export interface SignedEntitlementAnchor {
  machineIdHash: string;
  trialStartedAt: string;
  trialExpiresAt: string;
  maxObservedUtcMs: number;
  signature: string;
}

function getAnchorSecret(machineIdHash: string): string {
  return crypto
    .createHash('sha256')
    .update(`surf-entitlement-hmac-v4:${machineIdHash}`)
    .digest('hex');
}

export function signAnchorPayload(
  machineIdHash: string,
  trialStartedAt: string,
  trialExpiresAt: string,
  maxObservedUtcMs: number
): string {
  const payload = `${machineIdHash}|${trialStartedAt}|${trialExpiresAt}|${maxObservedUtcMs}`;
  return crypto
    .createHmac('sha256', getAnchorSecret(machineIdHash))
    .update(payload)
    .digest('hex');
}

export function verifyAnchorPayload(anchor: SignedEntitlementAnchor): boolean {
  const expected = signAnchorPayload(
    anchor.machineIdHash,
    anchor.trialStartedAt,
    anchor.trialExpiresAt,
    anchor.maxObservedUtcMs
  );
  const a = Buffer.from(anchor.signature, 'utf8');
  const b = Buffer.from(expected, 'utf8');
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

/**
 * Survives local SQLite DB deletion and app reinstalls by storing an
 * encrypted, HMAC-signed trial anchor in OS local app-data outside userData.
 */
export function getEntitlementAnchorPath(): string {
  if (process.platform === 'win32') {
    const localAppData =
      process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
    return path.join(localAppData, 'SurfMonitor', '.entitlement-anchor');
  }
  if (process.platform === 'darwin') {
    return path.join(
      os.homedir(),
      'Library',
      'Application Support',
      'SurfMonitor',
      '.entitlement-anchor'
    );
  }
  const xdg = process.env.XDG_STATE_HOME || path.join(os.homedir(), '.local', 'state');
  return path.join(xdg, 'surf-monitor', '.entitlement-anchor');
}

export function readSignedEntitlementAnchor(
  expectedMachineHash: string
): SignedEntitlementAnchor | null {
  try {
    const anchorPath = getEntitlementAnchorPath();
    if (!fs.existsSync(anchorPath)) return null;
    const raw = fs.readFileSync(anchorPath, 'utf8').trim();
    if (!raw) return null;
    const decrypted = decryptSecret(raw);
    const parsed = JSON.parse(decrypted) as SignedEntitlementAnchor;
    if (
      !parsed ||
      parsed.machineIdHash !== expectedMachineHash ||
      !verifyAnchorPayload(parsed)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSignedEntitlementAnchor(
  machineIdHash: string,
  trialStartedAt: string,
  trialExpiresAt: string,
  maxObservedUtcMs: number
): void {
  try {
    const anchorPath = getEntitlementAnchorPath();
    fs.mkdirSync(path.dirname(anchorPath), { recursive: true });
    const signature = signAnchorPayload(
      machineIdHash,
      trialStartedAt,
      trialExpiresAt,
      maxObservedUtcMs
    );
    const payload: SignedEntitlementAnchor = {
      machineIdHash,
      trialStartedAt,
      trialExpiresAt,
      maxObservedUtcMs,
      signature,
    };
    const encrypted = encryptSecret(JSON.stringify(payload));
    fs.writeFileSync(anchorPath, encrypted, 'utf8');
  } catch {
    // Non-fatal if OS directory is read-only
  }
}
