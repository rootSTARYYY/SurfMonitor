import { Resolver } from 'node:dns/promises';
import { CheckState } from './statusClassifier';

export type DnsRecordType =
  | 'A'
  | 'AAAA'
  | 'CNAME'
  | 'MX'
  | 'TXT'
  | 'NS'
  | 'SOA'
  | 'CAA';

export interface DnsCheckOutput {
  state: CheckState;
  networkConnected: boolean;
  httpResponseReceived: boolean;
  applicationHealthy: boolean;
  lookupMs: number;
  recordType: DnsRecordType;
  resolver: string;
  records: string[];
  errorMessage: string | null;
}

export async function performDnsCheck(params: {
  target: string;
  recordType?: DnsRecordType;
  resolverIp?: string;
  expectedRecords?: string[];
}): Promise<DnsCheckOutput> {
  const recordType: DnsRecordType = params.recordType ?? 'A';
  const resolverLabel = params.resolverIp?.trim() || 'system';
  const resolver = new Resolver();
  if (params.resolverIp?.trim()) {
    resolver.setServers([params.resolverIp.trim()]);
  }

  let hostname = params.target.trim();
  try {
    if (hostname.startsWith('http://') || hostname.startsWith('https://')) {
      hostname = new URL(hostname).hostname;
    }
  } catch {
    // Keep raw hostname
  }

  const start = performance.now();

  try {
    let records: string[] = [];
    switch (recordType) {
      case 'A':
        records = await resolver.resolve4(hostname);
        break;
      case 'AAAA':
        records = await resolver.resolve6(hostname);
        break;
      case 'CNAME':
        records = await resolver.resolveCname(hostname);
        break;
      case 'MX': {
        const mx = await resolver.resolveMx(hostname);
        records = mx
          .sort((a, b) => a.priority - b.priority)
          .map((m) => `${m.priority} ${m.exchange}`);
        break;
      }
      case 'TXT': {
        const txt = await resolver.resolveTxt(hostname);
        records = txt.map((parts) => parts.join(''));
        break;
      }
      case 'NS':
        records = await resolver.resolveNs(hostname);
        break;
      case 'SOA': {
        const soa = await resolver.resolveSoa(hostname);
        records = [`${soa.nsname} ${soa.hostmaster} serial=${soa.serial}`];
        break;
      }
      case 'CAA': {
        const caa = await resolver.resolveCaa(hostname);
        records = caa.map(
          (c) => `${c.critical} ${c.issue ?? c.issuewild ?? c.iodef ?? ''}`
        );
        break;
      }
    }

    const lookupMs = Math.max(1, Math.round(performance.now() - start));
    const sortedRecords = [...records].sort();

    let state: CheckState = 'UP';
    let errorMessage: string | null = null;

    if (params.expectedRecords && params.expectedRecords.length > 0) {
      const expectedSorted = [...params.expectedRecords]
        .map((r) => r.trim())
        .filter(Boolean)
        .sort();
      const matches =
        expectedSorted.length === sortedRecords.length &&
        expectedSorted.every((v, idx) => v === sortedRecords[idx]);

      if (!matches) {
        state = 'DEGRADED';
        errorMessage = `DNS records mismatch: got [${sortedRecords.join(', ')}], expected [${expectedSorted.join(', ')}]`;
      }
    }

    return {
      state,
      networkConnected: true,
      httpResponseReceived: true,
      applicationHealthy: state === 'UP',
      lookupMs,
      recordType,
      resolver: resolverLabel,
      records: sortedRecords,
      errorMessage,
    };
  } catch (err) {
    const lookupMs = Math.max(1, Math.round(performance.now() - start));
    return {
      state: 'DOWN',
      networkConnected: false,
      httpResponseReceived: false,
      applicationHealthy: false,
      lookupMs,
      recordType,
      resolver: resolverLabel,
      records: [],
      errorMessage:
        err instanceof Error ? `DNS lookup failed: ${err.message}` : 'DNS lookup failed',
    };
  }
}
