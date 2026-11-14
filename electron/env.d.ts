declare module 'nodemailer' {
  export interface SentMessageInfo {
    messageId?: string;
    accepted?: string[];
    rejected?: string[];
    response?: string;
  }

  export interface Transporter {
    verify(): Promise<boolean>;
    sendMail(mailOptions: {
      from?: string;
      to?: string;
      subject?: string;
      text?: string;
      html?: string;
    }): Promise<SentMessageInfo>;
  }

  export function createTransport(options: {
    host: string;
    port: number;
    secure?: boolean;
    requireTLS?: boolean;
    ignoreTLS?: boolean;
    connectionTimeout?: number;
    greetingTimeout?: number;
    socketTimeout?: number;
    auth?: {
      user: string;
      pass: string;
    };
  }): Transporter;
}

declare module 'sunlicense' {
  export interface SunLicenseValidationResult {
    valid: boolean;
    status?: number;
    code?: string;
    message?: string;
    expiresAt?: string | null;
    productName?: string | null;
    planName?: string | null;
    machinesUsed?: number | null;
    machinesLimit?: number | null;
    retryAfterSeconds?: number | null;
    unlock?: string | null;
  }

  export interface SunLicenseAnalyticsHandle {
    feature(name: string): void;
    close(): void;
  }

  export interface SunLicenseProtectionHandle {
    notice(): string;
    unseal(blob: string): string;
    integrity(dir: string): string;
  }

  export class SunLicense {
    constructor(options: { baseUrl: string; token: string });
    validate(
      licenseKey: string,
      context?: { host?: string; fingerprint?: string }
    ): Promise<SunLicenseValidationResult>;
    analytics(options: {
      licenseKey: string;
      fingerprint: string;
      productVersion: string;
      enabled: boolean;
    }): SunLicenseAnalyticsHandle;
    protection(options: {
      licenseKey: string;
      fingerprint: string;
      product: string;
      owner: string;
      terms?: string;
    }): SunLicenseProtectionHandle;
  }

  export function machineId(): string;
  export function defaultStateDir(): string;
}