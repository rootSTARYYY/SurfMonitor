import os from 'node:os';
import type {
  SunLicense as SunLicenseClass,
  SunLicenseAnalyticsHandle,
} from 'sunlicense';
import {
  EntitlementHistoryRecord,
  LicenseStateRecord,
  SurfDatabase,
  TrialStateRecord,
} from '../db/database';
import { decryptSecret, encryptSecret } from '../security/secrets';
import {
  getCrossPlatformMachineHash,
  readSignedEntitlementAnchor,
  signAnchorPayload,
  verifyAnchorPayload,
  writeSignedEntitlementAnchor,
} from './machineIdentity';

type SunLicenseModule = typeof import('sunlicense');

let cachedSdk: SunLicenseModule | null = null;

async function getSunLicenseSdk(): Promise<SunLicenseModule> {
  if (!cachedSdk) {
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
  | 'TRIAL_ACTIVE'
  | 'TRIAL_EXPIRED'
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
  isTrial: boolean;
  username: string | null;
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
  trialStartedAt: string | null;
  trialExpiresAt: string | null;
  trialRemainingMs: number | null;
  trialServerEnforced: boolean;
  clockTamperDetected: boolean;
  discordInviteUrl: string;
  history: EntitlementHistoryRecord[];
  message: string | null;
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const BASE_URL = 'https://api.sunlicense.com';
const DEFAULT_VALIDATE_KEY = 'slk_9dMzQkEvw_lbjq2uaBpEAt7TRpUWe7EZ';
const DISCORD_SETTING_KEY = 'discord_invite_url';
const DEFAULT_DISCORD_INVITE = 'https://discord.gg/SuhjUxmTrt';

export function sanitizeUsername(raw: string): string {
  const cleaned = String(raw ?? '')
    .replace(/[<>&"'`\x00-\x1F\x7F]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (cleaned.length < 2) {
    throw new Error('Username must be at least 2 characters.');
  }
  if (cleaned.length > 32) {
    return cleaned.slice(0, 32).trim();
  }
  return cleaned;
}

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
  return getCrossPlatformMachineHash();
}

export function maskMachineId(hash: string): string {
  if (!hash || hash.length < 12) return 'unknown';
  return `${hash.slice(0, 8)}…${hash.slice(-4)}`;
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
  private trialApiUrl: string;
  private analyticsHandle: SunLicenseAnalyticsHandle | null = null;
  private retryAfterUntilMs = 0;

  constructor(db: SurfDatabase, apiKey?: string, trialApiUrl?: string) {
    this.db = db;
    const rawKey = (
      apiKey ??
      process.env.SUNLICENSE_API_KEY ??
      DEFAULT_VALIDATE_KEY
    ).trim();
    this.apiKey = rawKey.startsWith('slp_') ? '' : rawKey;
    this.trialApiUrl = (trialApiUrl ?? process.env.SURF_TRIAL_API_URL ?? '').trim().replace(/\/+$/, '');
    void getSunLicenseSdk().catch(() => {});
  }

  public getDiscordInviteUrl(): string {
    return this.db.getAppSetting(DISCORD_SETTING_KEY) || DEFAULT_DISCORD_INVITE;
  }

  public setDiscordInviteUrl(url: string): PublicLicenseState {
    const trimmed = url.trim();
    if (trimmed && !/^https:\/\/(discord\.gg|discord\.com\/invite)\/[A-Za-z0-9_-]+/i.test(trimmed)) {
      throw new Error('Please enter a valid https://discord.gg/... or https://discord.com/invite/... URL.');
    }
    this.db.setAppSetting(DISCORD_SETTING_KEY, trimmed);
    return this.getPublicState();
  }

  public setUsername(rawUsername: string): PublicLicenseState {
    const clean = sanitizeUsername(rawUsername);
    this.db.saveUserProfile(clean);
    this.db.recordEntitlementEvent('PROFILE_UPDATED', 'OK', 'local', `Username updated to ${clean}`);
    return this.getPublicState();
  }

  /**
   * Reconciles local trial DB record with surviving OS anchor to resist
   * local SQLite deletion, app reinstalls, and system clock rollbacks.
   */
  private reconcileTrialRecord(machineHash: string): {
    trial: TrialStateRecord | undefined;
    clockTamperDetected: boolean;
  } {
    let trial = this.db.getTrialState();
    const anchor = readSignedEntitlementAnchor(machineHash);
    const nowMs = Date.now();
    let clockTamperDetected = false;

    if (!trial && anchor) {
      // Restore trial from surviving OS anchor after DB deletion or reinstall
      const effectiveNowMs = Math.max(nowMs, anchor.maxObservedUtcMs);
      if (nowMs + 60_000 < anchor.maxObservedUtcMs) {
        clockTamperDetected = true;
      }
      const expMs = new Date(anchor.trialExpiresAt).getTime();
      const restoredStatus: TrialStateRecord['status'] =
        effectiveNowMs >= expMs ? 'TRIAL_EXPIRED' : 'TRIAL_ACTIVE';

      trial = this.db.saveTrialState({
        machineIdHash: machineHash,
        status: restoredStatus,
        startedAt: anchor.trialStartedAt,
        expiresAt: anchor.trialExpiresAt,
        signedEntitlement: anchor.signature,
        lastServerTime: null,
        maxObservedUtcMs: effectiveNowMs,
        lastValidatedAt: new Date(effectiveNowMs).toISOString(),
        lastError: clockTamperDetected ? 'System clock rollback detected' : null,
      });
      this.db.recordEntitlementEvent(
        'TRIAL_RESTORED_FROM_ANCHOR',
        restoredStatus,
        'anchor',
        'Restored machine-bound trial timeline from OS entitlement anchor'
      );
      return { trial, clockTamperDetected };
    }

    if (trial) {
      const prevMax = Math.max(
        trial.maxObservedUtcMs || 0,
        anchor?.maxObservedUtcMs || 0
      );
      if (nowMs + 60_000 < prevMax) {
        clockTamperDetected = true;
      }
      const effectiveNowMs = Math.max(nowMs, prevMax);
      const expMs = new Date(trial.expiresAt).getTime();

      // Verify signed entitlement integrity
      const expectedSig = signAnchorPayload(
        trial.machineIdHash,
        trial.startedAt,
        trial.expiresAt,
        trial.maxObservedUtcMs
      );
      const sigOk =
        trial.machineIdHash === machineHash &&
        Boolean(trial.signedEntitlement) &&
        verifyAnchorPayload({
          machineIdHash: trial.machineIdHash,
          trialStartedAt: trial.startedAt,
          trialExpiresAt: trial.expiresAt,
          maxObservedUtcMs: trial.maxObservedUtcMs,
          signature: trial.signedEntitlement || expectedSig,
        });

      const nextStatus: TrialStateRecord['status'] =
        trial.status === 'CONVERTED'
          ? 'CONVERTED'
          : !sigOk || effectiveNowMs >= expMs
            ? 'TRIAL_EXPIRED'
            : 'TRIAL_ACTIVE';

      if (
        effectiveNowMs > trial.maxObservedUtcMs ||
        nextStatus !== trial.status
      ) {
        const nextSig = signAnchorPayload(
          machineHash,
          trial.startedAt,
          trial.expiresAt,
          effectiveNowMs
        );
        trial = this.db.saveTrialState({
          machineIdHash: machineHash,
          status: nextStatus,
          startedAt: trial.startedAt,
          expiresAt: trial.expiresAt,
          signedEntitlement: nextSig,
          lastServerTime: trial.lastServerTime,
          maxObservedUtcMs: effectiveNowMs,
          lastValidatedAt: trial.lastValidatedAt,
          lastError: clockTamperDetected
            ? 'System clock rollback detected; using monotonic clock'
            : trial.lastError,
        });
        writeSignedEntitlementAnchor(
          machineHash,
          trial.startedAt,
          trial.expiresAt,
          effectiveNowMs
        );
      }
    }

    return { trial, clockTamperDetected };
  }

  public getPublicState(message: string | null = null): PublicLicenseState {
    const fp = getStableMachineFingerprint();
    const rec = this.db.getLicenseState();
    const profile = this.db.getUserProfile();
    const { trial, clockTamperDetected } = this.reconcileTrialRecord(fp);
    const discordInviteUrl = this.getDiscordInviteUrl();
    const history = this.db.getEntitlementHistory(25);
    const now = Date.now();

    // 1. Check active/valid paid license first (v3.x upgrades & licensed users)
    if (rec) {
      const graceEndMs = rec.offlineGraceUntil
        ? new Date(rec.offlineGraceUntil).getTime()
        : 0;
      const graceRemainingMs = graceEndMs > now ? graceEndMs - now : null;
      const status = rec.status as LicenseStatus;
      const licensed =
        status === 'ACTIVE' ||
        (status === 'OFFLINE_GRACE' && graceRemainingMs !== null);

      const hasActiveTrial =
        trial &&
        trial.status === 'TRIAL_ACTIVE' &&
        new Date(trial.expiresAt).getTime() > Math.max(now, trial.maxObservedUtcMs || 0);
      if (licensed || (status !== 'UNACTIVATED' && !hasActiveTrial)) {
        return {
          status,
          licensed,
          isTrial: false,
          username: profile?.username ?? null,
          maskedKey: rec.maskedKey,
          machineId: maskMachineId(rec.machineId || fp),
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
          trialStartedAt: trial?.startedAt ?? null,
          trialExpiresAt: trial?.expiresAt ?? null,
          trialRemainingMs: null,
          trialServerEnforced: Boolean(this.trialApiUrl),
          clockTamperDetected,
          discordInviteUrl,
          history,
          message,
        };
      }
    }

    // 2. Check trial state
    if (trial && trial.status !== 'CONVERTED') {
      const expMs = new Date(trial.expiresAt).getTime();
      const effectiveNow = Math.max(now, trial.maxObservedUtcMs || 0);
      const remainingMs = Math.max(0, expMs - effectiveNow);
      const isTrialActive = trial.status === 'TRIAL_ACTIVE' && remainingMs > 0;

      return {
        status: isTrialActive ? 'TRIAL_ACTIVE' : 'TRIAL_EXPIRED',
        licensed: isTrialActive,
        isTrial: true,
        username: profile?.username ?? null,
        maskedKey: null,
        machineId: maskMachineId(fp),
        productName: 'Surf Monitor',
        planName: '7-Day Free Trial',
        activatedAt: trial.startedAt,
        expiresAt: trial.expiresAt,
        lastValidatedAt: trial.lastValidatedAt,
        lastAttemptAt: trial.lastValidatedAt,
        lastResultCode: isTrialActive ? 'TRIAL_ACTIVE' : 'TRIAL_EXPIRED',
        offlineGraceUntil: null,
        offlineGraceRemainingMs: null,
        machinesUsed: 1,
        machinesLimit: 1,
        analyticsEnabled: true,
        trialStartedAt: trial.startedAt,
        trialExpiresAt: trial.expiresAt,
        trialRemainingMs: isTrialActive ? remainingMs : 0,
        trialServerEnforced: Boolean(this.trialApiUrl),
        clockTamperDetected,
        discordInviteUrl,
        history,
        message: message ?? trial.lastError,
      };
    }

    // 3. Unactivated fresh install
    return {
      status: 'UNACTIVATED',
      licensed: false,
      isTrial: false,
      username: profile?.username ?? null,
      maskedKey: null,
      machineId: maskMachineId(fp),
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
      trialStartedAt: null,
      trialExpiresAt: null,
      trialRemainingMs: null,
      trialServerEnforced: Boolean(this.trialApiUrl),
      clockTamperDetected,
      discordInviteUrl,
      history,
      message,
    };
  }

  public hasValidCachedActivation(): boolean {
    return this.getPublicState().licensed;
  }

  public async startTrial(rawUsername: string): Promise<PublicLicenseState> {
    const username = sanitizeUsername(rawUsername);
    this.db.saveUserProfile(username);

    const fp = getStableMachineFingerprint();
    const { trial: existing } = this.reconcileTrialRecord(fp);
    if (existing) {
      if (existing.status === 'TRIAL_EXPIRED') {
        this.db.recordEntitlementEvent(
          'TRIAL_START_REJECTED',
          'TRIAL_EXPIRED',
          'local',
          'Trial already used and expired on this machine'
        );
        return this.getPublicState(
          'A 7-day free trial has already been used on this machine.'
        );
      }
      return this.getPublicState('Trial is already active.');
    }

    let startedAt = new Date().toISOString();
    let expiresAt = new Date(Date.now() + SEVEN_DAYS_MS).toISOString();
    let serverTime: string | null = null;
    let source = 'local-signed-anchor';

    // If an authoritative Trial Backend URL is configured, register with it first
    if (this.trialApiUrl) {
      try {
        const res = await fetch(`${this.trialApiUrl}/api/v1/trial/start`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            machineIdHash: fp,
            platform: os.platform(),
            appVersion: '4.0.0',
          }),
        });
        const data = (await res.json()) as {
          eligible?: boolean;
          startedAt?: string;
          expiresAt?: string;
          serverTime?: string;
          error?: string;
        };
        if (!res.ok || data.eligible === false) {
          this.db.recordEntitlementEvent(
            'TRIAL_START_REJECTED',
            'TRIAL_EXPIRED',
            'server',
            data.error ?? `HTTP ${res.status}`
          );
          if (data.startedAt && data.expiresAt) {
            const maxMs = Math.max(
              Date.now(),
              new Date(data.serverTime ?? Date.now()).getTime()
            );
            const sig = signAnchorPayload(fp, data.startedAt, data.expiresAt, maxMs);
            this.db.saveTrialState({
              machineIdHash: fp,
              status: 'TRIAL_EXPIRED',
              startedAt: data.startedAt,
              expiresAt: data.expiresAt,
              signedEntitlement: sig,
              lastServerTime: data.serverTime ?? null,
              maxObservedUtcMs: maxMs,
              lastValidatedAt: new Date().toISOString(),
              lastError: data.error ?? 'Trial already consumed on this machine.',
            });
            writeSignedEntitlementAnchor(fp, data.startedAt, data.expiresAt, maxMs);
          }
          return this.getPublicState(
            data.error ?? 'This machine is not eligible for another free trial.'
          );
        }
        if (data.startedAt && data.expiresAt) {
          startedAt = data.startedAt;
          expiresAt = data.expiresAt;
          serverTime = data.serverTime ?? new Date().toISOString();
          source = 'server';
        }
      } catch (err) {
        return this.getPublicState(
          `Unable to reach trial server: ${err instanceof Error ? err.message : 'Network error'}`
        );
      }
    }

    const nowMs = Date.now();
    const sig = signAnchorPayload(fp, startedAt, expiresAt, nowMs);
    this.db.saveTrialState({
      machineIdHash: fp,
      status: 'TRIAL_ACTIVE',
      startedAt,
      expiresAt,
      signedEntitlement: sig,
      lastServerTime: serverTime,
      maxObservedUtcMs: nowMs,
      lastValidatedAt: new Date(nowMs).toISOString(),
      lastError: null,
    });
    writeSignedEntitlementAnchor(fp, startedAt, expiresAt, nowMs);
    this.db.recordEntitlementEvent(
      'TRIAL_STARTED',
      'TRIAL_ACTIVE',
      source,
      `7-day trial started for ${username}, expires ${expiresAt}`
    );

    return this.getPublicState('7-day free trial activated.');
  }

  public async activateWithKey(
    licenseKey: string,
    analyticsEnabled = true,
    username?: string
  ): Promise<PublicLicenseState> {
    if (username && username.trim()) {
      this.db.saveUserProfile(sanitizeUsername(username));
    }
    const trimmed = licenseKey.trim();
    if (!trimmed) {
      return this.getPublicState('Please enter a license key.');
    }
    return this.performValidation(trimmed, analyticsEnabled, true);
  }

  public async validateCurrent(): Promise<PublicLicenseState> {
    const rec = this.db.getLicenseState();
    if (rec) {
      const key = decryptSecret(rec.encryptedLicenseKey);
      return this.performValidation(key, rec.analyticsEnabled === 1, false);
    }

    // Validate active trial against server if configured
    const fp = getStableMachineFingerprint();
    const { trial } = this.reconcileTrialRecord(fp);
    if (trial && this.trialApiUrl && trial.status !== 'CONVERTED') {
      try {
        const res = await fetch(`${this.trialApiUrl}/api/v1/trial/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ machineIdHash: fp }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            active?: boolean;
            startedAt?: string;
            expiresAt?: string;
            serverTime?: string;
          };
          const srvMs = new Date(data.serverTime ?? Date.now()).getTime();
          const maxMs = Math.max(Date.now(), srvMs, trial.maxObservedUtcMs);
          const nextStatus: TrialStateRecord['status'] = data.active
            ? 'TRIAL_ACTIVE'
            : 'TRIAL_EXPIRED';
          const st = data.startedAt ?? trial.startedAt;
          const ex = data.expiresAt ?? trial.expiresAt;
          const sig = signAnchorPayload(fp, st, ex, maxMs);
          this.db.saveTrialState({
            machineIdHash: fp,
            status: nextStatus,
            startedAt: st,
            expiresAt: ex,
            signedEntitlement: sig,
            lastServerTime: data.serverTime ?? new Date().toISOString(),
            maxObservedUtcMs: maxMs,
            lastValidatedAt: new Date().toISOString(),
            lastError: null,
          });
          writeSignedEntitlementAnchor(fp, st, ex, maxMs);
        }
      } catch {
        // Offline: rely on monotonic local signed entitlement without extending expiry
      }
    }

    return this.getPublicState();
  }

  private async performValidation(
    licenseKey: string,
    analyticsEnabled: boolean,
    isNewActivation: boolean
  ): Promise<PublicLicenseState> {
    const sdk = await getSunLicenseSdk();
    const fp = getStableMachineFingerprint();
    const sdkHost = sdk.machineId ? sdk.machineId() : fp;
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
      const res = await client.validate(licenseKey, { host: sdkHost });

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

        const trial = this.db.getTrialState();
        if (trial && trial.status !== 'CONVERTED') {
          this.db.saveTrialState({
            ...trial,
            status: 'CONVERTED',
          });
        }

        this.db.recordEntitlementEvent(
          isNewActivation ? 'LICENSE_ACTIVATED' : 'LICENSE_VALIDATED',
          'ACTIVE',
          'sunlicense',
          `Plan: ${res.planName ?? 'Standard'}`
        );

        this.initAnalytics(client, licenseKey, sdkHost, analyticsEnabled);
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
        this.db.recordEntitlementEvent(
          'RATE_LIMITED',
          'RATE_LIMITED',
          'sunlicense',
          `HTTP 429 retry after ${retrySec}s`
        );
        return this.getPublicState(
          `Rate limited by SunLicense (HTTP 429). Retry after ${retrySec}s.`
        );
      }

      if (res.status === 400 || res.code) {
        const rejectedStatus = mapCodeToStatus(res.code);
        const { trial: activeTrial } = this.reconcileTrialRecord(fp);
        const trialStillActive =
          activeTrial &&
          activeTrial.status === 'TRIAL_ACTIVE' &&
          new Date(activeTrial.expiresAt).getTime() >
            Math.max(Date.now(), activeTrial.maxObservedUtcMs || 0);

        if (isNewActivation && trialStillActive && !existing) {
          this.db.recordEntitlementEvent(
            'LICENSE_REJECTED',
            rejectedStatus,
            'sunlicense',
            res.code ?? 'REJECTED'
          );
          return this.getPublicState(
            res.message || `License rejected (${res.code ?? 'INVALID'}). Your 7-day trial remains active.`
          );
        }
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
        this.db.recordEntitlementEvent(
          'LICENSE_REJECTED',
          rejectedStatus,
          'sunlicense',
          res.code ?? 'REJECTED'
        );
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
        productVersion: '4.1.0',
        enabled,
      });
    } catch {
      // Never block or crash startup
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
    this.db.recordEntitlementEvent('LICENSE_CLEARED', 'UNACTIVATED', 'local');
    return this.getPublicState('Local device activation cleared.');
  }

  public shutdown(): void {
    this.analyticsHandle?.close();
    this.analyticsHandle = null;
  }
}
