import crypto from 'node:crypto';

let fallbackKey: Buffer | null = null;

function getFallbackKey(): Buffer {
  if (!fallbackKey) {
    fallbackKey = crypto.randomBytes(32);
  }
  return fallbackKey;
}

function getSafeStorage():
  | {
      isEncryptionAvailable: () => boolean;
      encryptString: (plain: string) => Buffer;
      decryptString: (buf: Buffer) => string;
    }
  | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const electron = require('electron') as {
      safeStorage?: {
        isEncryptionAvailable: () => boolean;
        encryptString: (plain: string) => Buffer;
        decryptString: (buf: Buffer) => string;
      };
    };
    if (
      electron?.safeStorage &&
      electron.safeStorage.isEncryptionAvailable()
    ) {
      return electron.safeStorage;
    }
  } catch {
    // Running outside Electron (e.g. Vitest)
  }
  return null;
}

export function encryptSecret(plaintext: string): string {
  if (!plaintext) return '';
  const safe = getSafeStorage();
  if (safe) {
    const encrypted = safe.encryptString(plaintext);
    return `enc:safe:${encrypted.toString('base64')}`;
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getFallbackKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `enc:gcm:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

export function decryptSecret(stored: string): string {
  if (!stored) return '';
  if (stored.startsWith('enc:safe:')) {
    const safe = getSafeStorage();
    if (!safe) {
      throw new Error('Electron safeStorage unavailable to decrypt secret');
    }
    const buf = Buffer.from(stored.slice('enc:safe:'.length), 'base64');
    return safe.decryptString(buf);
  }

  if (stored.startsWith('enc:gcm:')) {
    const parts = stored.slice('enc:gcm:'.length).split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted secret format');
    }
    const [ivHex, tagHex, dataHex] = parts;
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      getFallbackKey(),
      Buffer.from(ivHex, 'hex')
    );
    decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataHex, 'hex')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  return stored;
}

export function redactSecrets(text: string, secrets: string[]): string {
  let result = text;
  for (const secret of secrets) {
    if (secret && secret.length >= 4) {
      result = result.split(secret).join('[REDACTED]');
    }
  }
  return result;
}
