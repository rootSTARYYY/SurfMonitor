import { describe, expect, it } from 'vitest';
import { classifySshError } from '../electron/remote/sshManager';
import { decryptSecret, encryptSecret } from '../electron/security/secrets';

describe('remote infrastructure security & SSH classification', () => {
  it('classifies SSH authentication, timeout, host key, and network errors', () => {
    expect(
      classifySshError(new Error('All configured authentication methods failed'))
    ).toContain('Authentication failure');

    expect(
      classifySshError(new Error('Timed out while waiting for handshake'))
    ).toContain('SSH timeout');

    expect(
      classifySshError(new Error('Host key verification failed'))
    ).toContain('Invalid host key');

    expect(classifySshError(new Error('connect ECONNREFUSED 1.2.3.4:22'))).toContain(
      'Network unreachable'
    );
  });

  it('encrypts SSH private keys and agent tokens without plaintext storage', () => {
    const fakeKey = '-----BEGIN OPENSSH PRIVATE KEY-----\nabc123\n-----END OPENSSH PRIVATE KEY-----';
    const enc = encryptSecret(fakeKey);
    expect(enc).not.toContain('OPENSSH PRIVATE KEY');
    expect(decryptSecret(enc)).toBe(fakeKey);
  });
});
