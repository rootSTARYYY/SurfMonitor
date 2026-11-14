import dns from 'node:dns/promises';
import net from 'node:net';

export function isPrivateOrReservedIp(ip: string): boolean {
  const version = net.isIP(ip);
  if (version === 4) {
    const parts = ip.split('.').map(Number);
    if (parts.length !== 4) return true;
    const [a, b] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 0) return true; // 0.0.0.0/8
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a >= 224) return true; // Multicast & reserved
    return false;
  }

  if (version === 6) {
    const lower = ip.toLowerCase();
    if (
      lower === '::1' ||
      lower === '::' ||
      lower.startsWith('fe80:') ||
      lower.startsWith('fc') ||
      lower.startsWith('fd')
    ) {
      return true;
    }
    return false;
  }

  return true;
}

export async function assertSafeExternalUrl(
  rawUrl: string,
  allowPrivate = false
): Promise<URL> {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only HTTP and HTTPS protocols are permitted');
  }

  if (allowPrivate) {
    return parsed;
  }

  const host = parsed.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local')
  ) {
    throw new Error('Blocked SSRF target: localhost/local domain');
  }

  if (net.isIP(host)) {
    if (isPrivateOrReservedIp(host)) {
      throw new Error(`Blocked SSRF target: private/reserved IP ${host}`);
    }
    return parsed;
  }

  try {
    const records = await dns.lookup(host, { all: true });
    for (const rec of records) {
      if (isPrivateOrReservedIp(rec.address)) {
        throw new Error(
          `Blocked SSRF target: ${host} resolves to private IP ${rec.address}`
        );
      }
    }
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('Blocked SSRF')) {
      throw err;
    }
    // Let downstream HTTP layer report DNS resolution failure cleanly
  }

  return parsed;
}
