import { describe, expect, it } from 'vitest';
import {
  decryptSecret,
  encryptSecret,
  redactSecrets,
} from '../electron/security/secrets';
import {
  assertSafeExternalUrl,
  isPrivateOrReservedIp,
} from '../electron/security/ssrfGuard';

describe('security: secrets and SSRF guard', () => {
  it('encrypts and decrypts secrets without storing plaintext or plain Base64', () => {
    const token = 'super-secret-bearer-token-12345';
    const encrypted = encryptSecret(token);
    expect(encrypted).not.toBe(token);
    expect(encrypted).not.toBe(Buffer.from(token).toString('base64'));
    expect(decryptSecret(encrypted)).toBe(token);
  });

  it('redacts sensitive secrets from error messages', () => {
    const msg = 'Auth failed with token my-secret-token-999 on request';
    expect(redactSecrets(msg, ['my-secret-token-999'])).toBe(
      'Auth failed with token [REDACTED] on request'
    );
  });

  it('identifies private and reserved IP addresses', () => {
    expect(isPrivateOrReservedIp('127.0.0.1')).toBe(true);
    expect(isPrivateOrReservedIp('10.0.0.5')).toBe(true);
    expect(isPrivateOrReservedIp('192.168.1.1')).toBe(true);
    expect(isPrivateOrReservedIp('169.254.169.254')).toBe(true);
    expect(isPrivateOrReservedIp('8.8.8.8')).toBe(false);
  });

  it('blocks localhost and private IP SSRF targets', async () => {
    await expect(assertSafeExternalUrl('http://localhost:8080')).rejects.toThrow(
      'Blocked SSRF'
    );
    await expect(
      assertSafeExternalUrl('http://169.254.169.254/latest/meta-data/')
    ).rejects.toThrow('Blocked SSRF');
  });
});
