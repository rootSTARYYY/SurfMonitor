import { describe, expect, it } from 'vitest';
import {
  buildNodemailerTransportOptions,
  classifySmtpError,
  normalizeSmtpConfig,
} from '../electron/engine/notificationService';

describe('SMTP Configuration & Error Classification (v3.2.0)', () => {
  it('configures STARTTLS on port 587 with valid credentials', () => {
    const { cfg, options } = buildNodemailerTransportOptions({
      provider: 'brevo',
      host: 'smtp-relay.brevo.com',
      port: 587,
      security: 'starttls',
      authEnabled: true,
      username: 'alerts@strixhost.xyz',
      password: 'xsmtpsib-test-password',
      senderName: 'Surf Monitor',
      senderEmail: 'alerts@strixhost.xyz',
      recipientEmail: 'ops@strixhost.xyz',
    });
    expect(cfg.host).toBe('smtp-relay.brevo.com');
    expect(options.port).toBe(587);
    expect(options.secure).toBe(false);
    expect(options.requireTLS).toBe(true);
    expect(options.auth).toEqual({
      user: 'alerts@strixhost.xyz',
      pass: 'xsmtpsib-test-password',
    });
  });

  it('configures Implicit TLS on port 465', () => {
    const { options } = buildNodemailerTransportOptions({
      host: 'smtp.gmail.com',
      port: 465,
      security: 'tls',
      authEnabled: true,
      username: 'user@gmail.com',
      password: 'app-password',
      recipientEmail: 'ops@example.com',
    });
    expect(options.port).toBe(465);
    expect(options.secure).toBe(true);
    expect(options.requireTLS).toBe(false);
  });

  it('supports unauthenticated relay when authEnabled is false', () => {
    const { options } = buildNodemailerTransportOptions({
      host: '127.0.0.1',
      port: 25,
      security: 'none',
      authEnabled: false,
      recipientEmail: 'ops@internal.local',
    });
    expect(options.auth).toBeUndefined();
    expect(options.ignoreTLS).toBe(true);
  });

  it('rejects missing credentials when authentication is required', () => {
    expect(() =>
      buildNodemailerTransportOptions({
        host: 'smtp.gmail.com',
        port: 587,
        security: 'starttls',
        authEnabled: true,
        username: '',
        password: '',
        recipientEmail: 'ops@example.com',
      })
    ).toThrow(/Authentication required/);
  });

  it('rejects invalid host or invalid port', () => {
    expect(() =>
      buildNodemailerTransportOptions({
        host: '',
        port: 587,
        security: 'starttls',
        authEnabled: false,
        recipientEmail: 'ops@example.com',
      })
    ).toThrow(/SMTP server unavailable/);

    expect(() =>
      buildNodemailerTransportOptions({
        host: 'smtp.example.com',
        port: 99999,
        security: 'starttls',
        authEnabled: false,
        recipientEmail: 'ops@example.com',
      })
    ).toThrow(/SMTP server unavailable/);
  });

  it('classifies real-world SMTP errors accurately', () => {
    expect(
      classifySmtpError(new Error('502 5.7.0 Please authenticate first'))
    ).toMatch(/^Authentication required/);
    expect(
      classifySmtpError(new Error('535 5.7.8 Authentication failed'))
    ).toMatch(/^Invalid username or password/);
    expect(
      classifySmtpError(new Error('wrong version number: TLS handshake error'))
    ).toMatch(/^TLS negotiation failed/);
    expect(
      classifySmtpError(new Error('connect ETIMEDOUT 1.2.3.4:587'))
    ).toMatch(/^Connection timeout/);
    expect(
      classifySmtpError(new Error('553 5.7.1 Sender address rejected'))
    ).toMatch(/^Sender rejected/);
    expect(
      classifySmtpError(new Error('550 5.1.1 Recipient address rejected'))
    ).toMatch(/^Recipient rejected/);
    expect(
      classifySmtpError(new Error('getaddrinfo ENOTFOUND bad.smtp.local'))
    ).toMatch(/^SMTP server unavailable/);
  });

  it('normalizes legacy email channel records safely', () => {
    const legacy = normalizeSmtpConfig({
      host: 'smtp.legacy.local',
      port: 465,
      secure: true,
      user: 'legacy@local',
      pass: 'secret',
      to: 'dest@local',
    });
    expect(legacy.security).toBe('tls');
    expect(legacy.authEnabled).toBe(true);
    expect(legacy.username).toBe('legacy@local');
    expect(legacy.recipientEmail).toBe('dest@local');
  });
});
