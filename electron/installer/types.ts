export type InstallerCategory =
  | 'containers'
  | 'hosting_panels'
  | 'databases'
  | 'web_servers'
  | 'monitoring'
  | 'security'
  | 'devtools'
  | 'storage';

export type InstallerSource = 'official' | 'community';

export type VerificationStatus = 'production_ready' | 'beta' | 'experimental' | 'community';

export type ApprovalPolicy = 'always_review' | 'automatic' | 'per_installer';

export type JobStatus =
  | 'draft'
  | 'validating'
  | 'waiting_for_approval'
  | 'queued'
  | 'preparing'
  | 'installing'
  | 'configuring'
  | 'verifying'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'rolling_back'
  | 'recovery_required';

export interface ConfigFieldSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'password' | 'boolean' | 'select';
  required?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  description?: string;
  options?: Array<{ label: string; value: string }>;
  advancedOnly?: boolean;
  secret?: boolean;
}

export interface PreflightCheckItem {
  id: string;
  label: string;
  passed: boolean;
  actual: string;
  required: string;
  blocking: boolean;
}

export interface PreflightCheckResult {
  passed: boolean;
  osName: string;
  osVersion: string;
  arch: string;
  pkgManager: string;
  freeDiskMb: number;
  freeMemMb: number;
  isRootOrSudo: boolean;
  checks: PreflightCheckItem[];
}

export interface DeploymentPlan {
  installerId: string;
  installerName: string;
  version: string;
  serverId: string;
  serverName: string;
  installDir: string;
  packages: string[];
  servicesToCreate: string[];
  portsToOpen: number[];
  filesToModify: string[];
  configSummary: Array<{ label: string; value: string; secret?: boolean }>;
  requiredPrivileges: 'root_or_sudo' | 'user';
  estimatedDiskMb: number;
  estimatedRamMb: number;
  rollbackAvailable: boolean;
  rollbackNote: string;
  hasDestructiveOperations: boolean;
  destructiveWarnings: string[];
}

export interface InstallerStepContext {
  serverId: string;
  config: Record<string, unknown>;
  secrets: string[];
  preflight: PreflightCheckResult;
  exec: (
    command: string,
    opts?: { timeoutMs?: number; label?: string }
  ) => Promise<{ code: number; stdout: string; stderr: string }>;
  log: (line: string) => void;
}

export interface VerificationResult {
  ok: boolean;
  versionDetected?: string;
  url?: string;
  serviceName?: string;
  containerName?: string;
  installDir?: string;
  port?: number;
  details: string;
}

export interface InstallerDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  category: InstallerCategory;
  publisher: string;
  source: InstallerSource;
  verificationStatus: VerificationStatus;
  supportedOs: string[];
  supportedArch: string[];
  minDiskMb: number;
  minRamMb: number;
  requiredPorts: number[];
  dependencies: string[];
  requiredPrivileges: 'root_or_sudo' | 'user';
  supportsOneClick: boolean;
  supportsGuided: boolean;
  rollbackAvailable: boolean;
  rollbackNote: string;
  docsUrl?: string;
  configSchema: ConfigFieldSchema[];
  buildPlan: (
    serverId: string,
    serverName: string,
    config: Record<string, unknown>,
    preflight: PreflightCheckResult
  ) => DeploymentPlan;
  install: (ctx: InstallerStepContext) => Promise<void>;
  verify: (ctx: InstallerStepContext) => Promise<VerificationResult>;
  uninstall?: (ctx: InstallerStepContext) => Promise<void>;
}

export interface InstallerCatalogItemDTO {
  id: string;
  name: string;
  version: string;
  description: string;
  category: InstallerCategory;
  publisher: string;
  source: InstallerSource;
  verificationStatus: VerificationStatus;
  supportedOs: string[];
  supportedArch: string[];
  minDiskMb: number;
  minRamMb: number;
  requiredPorts: number[];
  dependencies: string[];
  requiredPrivileges: 'root_or_sudo' | 'user';
  supportsOneClick: boolean;
  supportsGuided: boolean;
  rollbackAvailable: boolean;
  rollbackNote: string;
  docsUrl?: string;
  configSchema: ConfigFieldSchema[];
  policy: ApprovalPolicy;
  installedCount?: number;
}
