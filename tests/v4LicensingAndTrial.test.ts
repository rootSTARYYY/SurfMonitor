import { describe, expect, it } from 'vitest';
import {
  getStableMachineFingerprint,
  maskLicenseKey,
  maskMachineId,
  sanitizeUsername,
} from '../electron/licensing/licenseService';
import {
  signAnchorPayload,
  verifyAnchorPayload,
} from '../electron/licensing/machineIdentity';

describe('Surf Monitor v4.0.0 Licensing, Trial & Identity', () => {
  it('sanitizes usernames and strips HTML/script characters', () => {
    expect(sanitizeUsername('  Star  ')).toBe('Star');
    expect(sanitizeUsername('<script>alert(1)</script>Star')).toBe('scriptalert(1)/scriptStar');
    expect(() => sanitizeUsername('a')).toThrow(/at least 2 characters/);
    expect(sanitizeUsername('A'.repeat(50)).length).toBe(32);
  });

  it('produces a stable hashed machine fingerprint and masks it for UI', () => {
    const fp1 = getStableMachineFingerprint();
    const fp2 = getStableMachineFingerprint();
    expect(fp1).toBe(fp2);
    expect(fp1).toMatch(/^[a-f0-9]{64}$/);
    const masked = maskMachineId(fp1);
    expect(masked.length).toBeLessThan(20);
    expect(masked).toContain('…');
  });

  it('signs and verifies trial entitlement anchors and rejects tampering', () => {
    const fp = getStableMachineFingerprint();
    const start = '2026-11-01T00:00:00.000Z';
    const exp = '2026-11-08T00:00:00.000Z';
    const maxUtc = new Date('2026-11-03T00:00:00.000Z').getTime();

    const sig = signAnchorPayload(fp, start, exp, maxUtc);
    expect(
      verifyAnchorPayload({
        machineIdHash: fp,
        trialStartedAt: start,
        trialExpiresAt: exp,
        maxObservedUtcMs: maxUtc,
        signature: sig,
      })
    ).toBe(true);

    // Tampered expiry must fail HMAC verification
    expect(
      verifyAnchorPayload({
        machineIdHash: fp,
        trialStartedAt: start,
        trialExpiresAt: '2099-01-01T00:00:00.000Z',
        maxObservedUtcMs: maxUtc,
        signature: sig,
      })
    ).toBe(false);
  });

  it('masks license keys without exposing plaintext', () => {
    expect(maskLicenseKey('SURF-1234-5678-90AB')).toBe('SURF-XXXX-XXXX-XXXX');
  });
});
