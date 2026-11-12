// Prints the ADMIN_PASSWORD_HASH for AUTH_MODE=local-password.
// Usage: `pnpm hash-password` and type the password (it is not echoed),
// or pipe it in: `echo "my password" | pnpm hash-password`.
import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { hashPassword } from '../security/password.js';

const MIN_LENGTH = 12;

async function readPassword(): Promise<string> {
  if (!process.stdin.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of process.stdin) chunks.push(chunk as Buffer);
    return Buffer.concat(chunks)
      .toString('utf8')
      .replace(/\r?\n$/, '');
  }

  let muted = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!muted) process.stdout.write(chunk);
      callback();
    },
  });
  const rl = createInterface({ input: process.stdin, output, terminal: true });
  return new Promise((resolve) => {
    rl.question('Password: ', (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
    muted = true;
  });
}

const password = await readPassword();
if (password.length === 0) {
  // Windows PowerShell runs `pnpm` through pnpm.ps1, which hands scripts an empty stdin.
  console.error('No password received. In PowerShell, run `pnpm.cmd hash-password` instead.');
  process.exit(1);
}
if (password.length < MIN_LENGTH) {
  console.error(`Use at least ${MIN_LENGTH} characters.`);
  process.exit(1);
}
console.log(await hashPassword(password));
