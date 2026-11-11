import { describe, expect, it } from 'vitest';
import { hashPassword, parsePasswordHash, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the right password and rejects others', async () => {
    const hash = await hashPassword('a long enough password');
    expect(hash).toMatch(/^scrypt:\d+:\d+:\d+:[\w-]+:[\w-]+$/);
    expect(hash).not.toContain('$');
    await expect(verifyPassword('a long enough password', hash)).resolves.toBe(true);
    await expect(verifyPassword('a long enough passwore', hash)).resolves.toBe(false);
  });

  it('uses a new salt every time', async () => {
    expect(await hashPassword('same')).not.toBe(await hashPassword('same'));
  });

  it('rejects malformed hashes', async () => {
    expect(parsePasswordHash('plain')).toBeNull();
    expect(parsePasswordHash('scrypt:0:8:1:abc:def')).toBeNull();
    await expect(verifyPassword('x', 'bcrypt:whatever')).resolves.toBe(false);
  });
});
