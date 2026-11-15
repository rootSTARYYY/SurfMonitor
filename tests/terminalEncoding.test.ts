import { describe, expect, it } from 'vitest';
import { StringDecoder } from 'node:string_decoder';

describe('Terminal UTF-8 multibyte & ANSI streaming decoder', () => {
  it('preserves 3-byte box-drawing characters split across SSH buffer chunks', () => {
    const decoder = new StringDecoder('utf8');
    const original = '┌───────┬───────┐\n│ id    │ name  │\n└───────┴───────┘\n';
    const raw = Buffer.from(original, 'utf8');

    // Split mid-codepoint (1-byte, 2-byte, 5-byte chunks)
    let out = '';
    for (let i = 0; i < raw.length; i += 2) {
      out += decoder.write(raw.subarray(i, Math.min(raw.length, i + 2)));
    }
    out += decoder.end();

    expect(out).toBe(original);
    expect(out).not.toContain('\uFFFD');
  });

  it('preserves ANSI color sequences and non-English UTF-8 text without replacement chars', () => {
    const decoder = new StringDecoder('utf8');
    const sample = '\x1b[90m|\x1b[39m\x1b[1m\x1b[36m online \x1b[39m\x1b[22m 日本語 🚀\r\n';
    const buf = Buffer.from(sample, 'utf8');

    let out = '';
    for (let i = 0; i < buf.length; i += 3) {
      out += decoder.write(buf.subarray(i, Math.min(buf.length, i + 3)));
    }
    out += decoder.end();

    expect(out).toBe(sample);
    expect(out).not.toContain('\uFFFD');
  });
});
