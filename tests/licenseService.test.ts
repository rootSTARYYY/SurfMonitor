import { describe, expect, it } from 'vitest';
import {
  getStableMachineFingerprint,
  maskLicenseKey,
} from '../electron/licensing/licenseService';

describe('SunLicense helpers & machine fingerprint', () => {
  it('masks license keys without exposing the full key', () => {
    expect(maskLicenseKey('K7QX-M2PD-9HWT-R4CN')).toBe('K7QX-XXXX-XXXX-XXXX');
    expect(maskLicenseKey('SURF12345678')).toBe('SURF********');
    expect(maskLicenseKey('abc')).toBe('****');
  });

  it('produces a deterministic non-empty machine fingerprint', () => {
    const fp1 = getStableMachineFingerprint();
    const fp2 = getStableMachineFingerprint();
    expect(fp1.length).toBeGreaterThanOrEqual(8);
    expect(fp1).toBe(fp2);
  });
});
