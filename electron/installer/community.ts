import crypto from 'node:crypto';
import { ConfigFieldSchema, InstallerCategory } from './types';

export interface CommunityInstallerManifest {
  manifestVersion: 1;
  packageId: string;
  name: string;
  version: string;
  description: string;
  category: InstallerCategory;
  publisher: {
    name: string;
    contact?: string;
    keyFingerprint?: string;
  };
  supportedOs: string[];
  supportedArch: string[];
  minDiskMb: number;
  minRamMb: number;
  requiredPorts: number[];
  requiredPrivileges: 'root_or_sudo' | 'user';
  permissions: string[];
  configSchema: ConfigFieldSchema[];
  installCommands: Array<{ label: string; command: string }>;
  verifyCommand: string;
  uninstallCommand?: string;
  docsUrl?: string;
}

export interface CommunityValidationResult {
  valid: boolean;
  sha256: string;
  errors: string[];
  warnings: string[];
  manifest?: CommunityInstallerManifest;
}

const VALID_CATEGORIES = new Set<string>([
  'containers',
  'hosting_panels',
  'databases',
  'web_servers',
  'monitoring',
  'security',
  'devtools',
  'storage',
]);

const DANGEROUS_PATTERNS = [
  /rm\s+-rf\s+\/(\s|$)/i,
  /mkfs\./i,
  /dd\s+if=.*of=\/dev\//i,
  /:\(\)\s*\{\s*:\|:&\s*\};:/,
  /curl\s+[^|]*\|\s*(sh|bash)/i,
  /wget\s+[^|]*\|\s*(sh|bash)/i,
];

export function computeManifestSha256(rawJson: string): string {
  return crypto.createHash('sha256').update(rawJson, 'utf8').digest('hex');
}

export function parseAndValidateCommunityManifest(
  rawJson: string,
  expectedSha256?: string
): CommunityValidationResult {
  const sha256 = computeManifestSha256(rawJson);
  const errors: string[] = [];
  const warnings: string[] = [
    'Community installer: untrusted by default. Review every declared command and permission before running.',
  ];

  if (expectedSha256 && expectedSha256.toLowerCase() !== sha256.toLowerCase()) {
    errors.push(
      `SHA-256 mismatch: expected ${expectedSha256}, computed ${sha256}.`
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    return {
      valid: false,
      sha256,
      errors: [
        `Invalid JSON manifest: ${err instanceof Error ? err.message : String(err)}`,
      ],
      warnings,
    };
  }

  if (!parsed || typeof parsed !== 'object') {
    return {
      valid: false,
      sha256,
      errors: ['Manifest must be a JSON object.'],
      warnings,
    };
  }

  const m = parsed as Record<string, unknown>;
  if (m.manifestVersion !== 1) {
    errors.push('manifestVersion must be 1.');
  }
  if (typeof m.packageId !== 'string' || !/^[a-z0-9][a-z0-9._-]{2,64}$/.test(m.packageId)) {
    errors.push('packageId must be 3-65 lowercase alphanumeric/dot/dash/underscore characters.');
  }
  if (typeof m.name !== 'string' || m.name.trim().length < 2) {
    errors.push('name is required.');
  }
  if (typeof m.version !== 'string' || m.version.trim().length < 1) {
    errors.push('version is required.');
  }
  if (typeof m.category !== 'string' || !VALID_CATEGORIES.has(m.category)) {
    errors.push('category must be a valid Surf Monitor installer category.');
  }
  if (!m.publisher || typeof m.publisher !== 'object' || typeof (m.publisher as Record<string, unknown>).name !== 'string') {
    errors.push('publisher.name is required.');
  }
  if (!Array.isArray(m.permissions) || m.permissions.length === 0) {
    errors.push('permissions array must explicitly declare required operations.');
  }
  if (!Array.isArray(m.installCommands) || m.installCommands.length === 0) {
    errors.push('installCommands array must contain at least one step.');
  } else {
    for (const step of m.installCommands) {
      if (!step || typeof step !== 'object' || typeof (step as Record<string, unknown>).command !== 'string') {
        errors.push('Each installCommands entry must have a string command.');
        continue;
      }
      const cmd = (step as { command: string }).command;
      for (const pat of DANGEROUS_PATTERNS) {
        if (pat.test(cmd)) {
          warnings.push(`Potentially dangerous command pattern detected: ${cmd.slice(0, 80)}`);
        }
      }
    }
  }
  if (typeof m.verifyCommand !== 'string' || m.verifyCommand.trim().length === 0) {
    errors.push('verifyCommand is required so installation can be verified.');
  }

  return {
    valid: errors.length === 0,
    sha256,
    errors,
    warnings,
    manifest: errors.length === 0 ? (parsed as CommunityInstallerManifest) : undefined,
  };
}
