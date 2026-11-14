import crypto from 'node:crypto';
import os from 'node:os';
import type {
  SunLicense as SunLicenseClass,
  SunLicenseAnalyticsHandle,
} from 'sunlicense';
import { LicenseStateRecord, SurfDatabase } from '../db/database';
import { decryptSecret, encryptSecret } from '../security/secrets';

type SunLicenseModule = typeof import('sunlicense');

let cachedSdk: SunLicenseModule | null = null;

async function getSunLicenseSdk(): Promise<SunLicenseModule> {
  if (!cachedSdk) {
    // Prevent TypeScript CommonJS compiler from down-leveling import() to require()
    const dynamicImport = new Function(
      'specifier',
      'return import(specifier)'
    ) as (specifier: string) => Promise<SunLicenseModule>;
    cachedSdk = await dynamicImport('sunlicense');
  }
  return cachedSdk;
}

export type LicenseStatus =
  | 'ACTIVE'
  | 'EXPIRED'
  | 'REVOKED'
  | 'SUSPENDED'
  | 'INVALID'
  | 'UNACTIVATED'
  | 'OFFLINE_GRACE'
  | 'RATE_LIMITED'
  | 'CONFIG_ERROR';

export interface PublicLicenseState {
  status: LicenseStatus;
  licensed: boolean;
  maskedKey: string | null;
  machineId: string;
  productName: string | null;
  planName: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  lastValidatedAt: string | null;
  lastAttemptAt: string | null;
  lastResultCode: string | null;
  offlineGraceUntil: string | null;
  offlineGraceRemainingMs: number | null;
  machinesUsed: number | null;
  machinesLimit: number | null;
  analyticsEnabled: boolean;
  message: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const BASE_URL = 'https://api.sunlicense.com';
// Validate-only client key (slk_...) safe to bundle in desktop builds; never embed slp_ tokens
const DEFAULT_VALIDATE_KEY = 'slk_9dMzQkEvw_lbjq2uaBpEAt7TRpUWe7EZ';

export function maskLicenseKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 4) return '****';
  const parts = trimmed.split('-');
  if (parts.length > 1) {
    return `${parts[0]}-${parts
      .slice(1)
      .map(() => 'XXXX')
      .join('-')}`;
  }
  return `${trimmed.slice(0, 4)}${'*'.repeat(Math.max(4, trimmed.length - 4))}`;
}

export function getStableMachineFingerprint(): string {
  if (cachedSdk) {
    try {
      const id = cachedSdk.machineId();
      if (id && id.length >= 8) return id;
    } catch {
      // Fallback below
    }
  }
  const raw = `${os.platform()}|${os.arch()}|${os.hostname()}`;
  return crypto.createHash('sha256').update(raw).digest('hex').slice(0, 32);
}

function mapCodeToStatus(code?: string): LicenseStatus {
  switch ((code || '').toUpperCase()) {
    case 'EXPIRED':
      return 'EXPIRED';
    case 'REVOKED':
      return 'REVOKED';
    case 'SUSPENDED':
      return 'SUSPENDED';
    case 'TOO_MANY_MACHINES':
    case 'TOO_MANY_IPS':
    case 'NOT_FOUND':
    case 'BLACKLISTED':
      return 'INVALID';
    default:
      return 'INVALID';
  }
}

export class LicenseService {
  private db: SurfDatabase;
  private apiKey: string;
  private analyticsHandle: SunLicenseAnalyticsHandle | null = null;
  private retryAfterUntilMs = 0;

  constructor(db: SurfDatabase, apiKey?: string) {
    this.db = db;
    // Only slk_ validation keys are permitted; never embed slp_ personal tokens
    const rawKey = (
      apiKey ??
      process.env.SUNLICENSE_API_KEY ??
      DEFAULT_VALIDATE_KEY
    ).trim();
    this.apiKey = rawKey.startsWith('slp_') ? '' : rawKey;
    void getSunLicenseSdk().catch(() => {});
  }

  public getPublicState(message: string | null = null): PublicLicenseState {
    const fp = getStableMachineFingerprint();
    const rec = this.db.getLicenseState();

    if (!rec) {
      return {
        status: 'UNACTIVATED',
        licensed: false,
        maskedKey: null,
        machineId: fp,
        productName: 'Surf Monitor',
        planName: null,
        activatedAt: null,
        expiresAt: null,
        lastValidatedAt: null,
        lastAttemptAt: null,
        lastResultCode: null,
        offlineGraceUntil: null,
        offlineGraceRemainingMs: null,
        machinesUsed: null,
        machinesLimit: null,
        analyticsEnabled: true,
        message,
      };
    }

    const now = Date.now();
    const graceEndMs = rec.offlineGraceUntil
      ? new Date(rec.offlineGraceUntil).getTime()
      : 0;
    const graceRemainingMs = graceEndMs > now ? graceEndMs - now : null;

    const status = rec.status as LicenseStatus;
    const licensed =
      status === 'ACTIVE' ||
      (status === 'OFFLINE_GRACE' && graceRemainingMs !== null);

    return {
      status,
      licensed,
      maskedKey: rec.maskedKey,
      machineId: rec.machineId || fp,
      productName: rec.productName ?? 'Surf Monitor',
      planName: rec.planName,
      activatedAt: rec.activatedAt,
      expiresAt: rec.expiresAt,
      lastValidatedAt: rec.lastValidatedAt,
      lastAttemptAt: rec.lastAttemptAt,
      lastResultCode: rec.lastResultCode,
      offlineGraceUntil: rec.offlineGraceUntil,
      offlineGraceRemainingMs: graceRemainingMs,
      machinesUsed: rec.machinesUsed,
      machinesLimit: rec.machinesLimit,
      analyticsEnabled: rec.analyticsEnabled === 1,
      message,
    };
  }

  public hasValidCachedActivation(): boolean {
    const state = this.getPublicState();
    return state.licensed;
  }

  public async activateWithKey(
    licenseKey: string,
    analyticsEnabled = true
  ): Promise<PublicLicenseState> {
    const trimmed = licenseKey.trim();
    if (!trimmed) {
      return this.getPublicState('Please enter a license key.');
    }
    return this.performValidation(trimmed, analyticsEnabled, true);
  }

  public async validateCurrent(): Promise<PublicLicenseState> {
    const rec = this.db.getLicenseState();
    if (!rec) {
      return this.getPublicState('No license key activated on this device.');
    }
    const key = decryptSecret(rec.encryptedLicenseKey);
    return this.performValidation(key, rec.analyticsEnabled === 1, false);
  }

  private async performValidation(
    licenseKey: string,
    analyticsEnabled: boolean,
    isNewActivation: boolean
  ): Promise<PublicLicenseState> {
    const sdk = await getSunLicenseSdk();
    const fp = sdk.machineId ? sdk.machineId() : getStableMachineFingerprint();
    const nowIso = new Date().toISOString();
    const existing = this.db.getLicenseState();

    if (Date.now() < this.retryAfterUntilMs) {
      return this.getPublicState(
        'Validation rate-limited. Please wait before retrying.'
      );
    }

    if (!this.apiKey) {
      this.db.saveLicenseState({
        encryptedLicenseKey: encryptSecret(licenseKey),
        maskedKey: maskLicenseKey(licenseKey),
        machineId: fp,
        status: 'CONFIG_ERROR',
        productName: 'Surf Monitor',
        planName: existing?.planName ?? null,
        activatedAt: existing?.activatedAt ?? null,
        expiresAt: existing?.expiresAt ?? null,
        lastValidatedAt: existing?.lastValidatedAt ?? null,
        lastAttemptAt: nowIso,
        lastResultCode: 'MISSING_API_KEY',
        offlineGraceUntil: existing?.offlineGraceUntil ?? null,
        machinesUsed: existing?.machinesUsed ?? null,
        machinesLimit: existing?.machinesLimit ?? null,
        analyticsEnabled: analyticsEnabled ? 1 : 0,
      });
      return this.getPublicState(
        'SunLicense API key (SUNLICENSE_API_KEY=slk_...) is not configured.'
      );
    }

    const client = new sdk.SunLicense({ baseUrl: BASE_URL, token: this.apiKey });

    try {
      const res = await client.validate(licenseKey, { host: fp });

      if (res.valid) {
        const graceUntil = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
        this.db.saveLicenseState({
          encryptedLicenseKey: encryptSecret(licenseKey),
          maskedKey: maskLicenseKey(licenseKey),
          machineId: fp,
          status: 'ACTIVE',
          productName: res.productName ?? 'Surf Monitor',
          planName: res.planName ?? 'Standard',
          activatedAt: existing?.activatedAt ?? nowIso,
          expiresAt: res.expiresAt ?? null,
          lastValidatedAt: nowIso,
          lastAttemptAt: nowIso,
          lastResultCode: res.code ?? 'VALID',
          offlineGraceUntil: graceUntil,
          machinesUsed: res.machinesUsed ?? null,
          machinesLimit: res.machinesLimit ?? null,
          analyticsEnabled: analyticsEnabled ? 1 : 0,
        });
        this.initAnalytics(client, licenseKey, fp, analyticsEnabled);
        return this.getPublicState('License active.');
      }

      if (res.status === 401) {
        this.saveStatusOnly(
          existing,
          licenseKey,
          fp,
          'CONFIG_ERROR',
          'API_UNAUTHORIZED',
          analyticsEnabled,
          nowIso
        );
        return this.getPublicState(
          'API configuration error (HTTP 401): invalid slk_ API key.'
        );
      }

      if (res.status === 429) {
        const retrySec = res.retryAfterSeconds ?? 60;
        this.retryAfterUntilMs = Date.now() + retrySec * 1000;
        return this.getPublicState(
          `Rate limited by SunLicense (HTTP 429). Retry after ${retrySec}s.`
        );
      }

      if (res.status === 400 || res.code) {
        const rejectedStatus = mapCodeToStatus(res.code);
        this.db.saveLicenseState({
          encryptedLicenseKey: encryptSecret(licenseKey),
          maskedKey: maskLicenseKey(licenseKey),
          machineId: fp,
          status: rejectedStatus,
          productName: existing?.productName ?? 'Surf Monitor',
          planName: existing?.planName ?? null,
          activatedAt: existing?.activatedAt ?? null,
          expiresAt: res.expiresAt ?? existing?.expiresAt ?? null,
          lastValidatedAt: existing?.lastValidatedAt ?? null,
          lastAttemptAt: nowIso,
          lastResultCode: res.code ?? 'REJECTED',
          offlineGraceUntil: null,
          machinesUsed: res.machinesUsed ?? existing?.machinesUsed ?? null,
          machinesLimit: res.machinesLimit ?? existing?.machinesLimit ?? null,
          analyticsEnabled: analyticsEnabled ? 1 : 0,
        });
        return this.getPublicState(
          res.message || `License rejected (${res.code ?? 'INVALID'}).`
        );
      }

      return this.handleOfflineFallback(
        existing,
        isNewActivation,
        'SunLicense server unavailable (5xx).'
      );
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Network connection failed';
      return this.handleOfflineFallback(existing, isNewActivation, msg);
    }
  }

  private saveStatusOnly(
    existing: LicenseStateRecord | undefined,
    licenseKey: string,
    fp: string,
    status: LicenseStatus,
    code: string,
    analyticsEnabled: boolean,
    nowIso: string
  ): void {
    this.db.saveLicenseState({
      encryptedLicenseKey: encryptSecret(licenseKey),
      maskedKey: maskLicenseKey(licenseKey),
      machineId: fp,
      status,
      productName: existing?.productName ?? 'Surf Monitor',
      planName: existing?.planName ?? null,
      activatedAt: existing?.activatedAt ?? null,
      expiresAt: existing?.expiresAt ?? null,
      lastValidatedAt: existing?.lastValidatedAt ?? null,
      lastAttemptAt: nowIso,
      lastResultCode: code,
      offlineGraceUntil: existing?.offlineGraceUntil ?? null,
      machinesUsed: existing?.machinesUsed ?? null,
      machinesLimit: existing?.machinesLimit ?? null,
      analyticsEnabled: analyticsEnabled ? 1 : 0,
    });
  }

  private handleOfflineFallback(
    existing: LicenseStateRecord | undefined,
    isNewActivation: boolean,
    networkError: string
  ): PublicLicenseState {
    if (!isNewActivation && existing?.offlineGraceUntil) {
      const graceEnd = new Date(existing.offlineGraceUntil).getTime();
      if (graceEnd > Date.now()) {
        this.db.saveLicenseState({
          ...existing,
          status: 'OFFLINE_GRACE',
          lastAttemptAt: new Date().toISOString(),
          lastResultCode: 'OFFLINE_GRACE',
        });
        return this.getPublicState(
          `Offline mode: using cached unlock (${networkError}).`
        );
      }
    }
    return this.getPublicState(
      `Unable to reach SunLicense: ${networkError}. No valid offline grace available.`
    );
  }

  private initAnalytics(
    client: SunLicenseClass,
    licenseKey: string,
    fp: string,
    enabled: boolean
  ): void {
    if (process.env.SUNLICENSE_ANALYTICS === 'off') return;
    this.analyticsHandle?.close();
    try {
      this.analyticsHandle = client.analytics({
        licenseKey,
        fingerprint: fp,
        productVersion: '2.2.0',
        enabled,
      });
    } catch {
      // Analytics must never block or crash startup
    }
  }

  public setAnalyticsEnabled(enabled: boolean): PublicLicenseState {
    const rec = this.db.getLicenseState();
    if (rec) {
      this.db.saveLicenseState({
        ...rec,
        analyticsEnabled: enabled ? 1 : 0,
      });
      if (!enabled) {
        this.analyticsHandle?.close();
        this.analyticsHandle = null;
      }
    }
    return this.getPublicState();
  }

  public clearLocalActivation(): PublicLicenseState {
    this.analyticsHandle?.close();
    this.analyticsHandle = null;
    this.db.clearLicenseState();
    return this.getPublicState('Local device activation cleared.');
  }

  public shutdown(): void {
    this.analyticsHandle?.close();
    this.analyticsHandle = null;
  }
}
