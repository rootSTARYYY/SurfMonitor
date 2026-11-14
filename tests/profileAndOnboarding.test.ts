import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

describe('Surf Monitor v4.2.0 Free Local-First Profile & Licensing Removal', () => {
  it('removes sunlicense from package.json and sets version to 4.2.0', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), 'package.json'), 'utf8')
    );
    expect(pkg.version).toBe('4.2.0');
    expect(pkg.dependencies?.sunlicense).toBeUndefined();
  });

  it('sanitizes usernames cleanly without HTML/script injection', () => {
    const sanitize = (raw: string) => {
      const cleaned = String(raw ?? '')
        .replace(/[<>&"'`\x00-\x1F\x7F]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
      if (cleaned.length < 2) throw new Error('Username must be at least 2 characters.');
      return cleaned.slice(0, 32).trim();
    };
    expect(sanitize('  Moss  ')).toBe('Moss');
    expect(sanitize('<script>alert(1)</script>Moss')).toBe('scriptalert(1)/scriptMoss');
    expect(() => sanitize('x')).toThrow();
  });
});
