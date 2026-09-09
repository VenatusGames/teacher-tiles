import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, lstatSync } from 'node:fs';

// An explicit inventory prevents accidental publication of a new export or upload.
// Add files here only after reviewing them for public sharing.
const approved = new Set([
  '.github/workflows/deploy-pages.yml', '.gitignore', 'README.md',
  'app/api/admin/data/route.ts', 'app/api/admin/upload/route.ts',
  'app/api/bootstrap/route.ts', 'app/api/files/route.ts',
  'app/api/history/route.ts', 'app/api/responses/route.ts',
  'app/globals.css', 'app/layout.tsx', 'app/page.tsx',
  'components/goal-garden-app.tsx', 'components/ui/button.tsx',
  'components/ui/checkbox.tsx', 'components/ui/dialog.tsx',
  'components/ui/input.tsx', 'components/ui/textarea.tsx',
  'db/runtime.ts', 'env.d.ts', 'lib/development-access.ts', 'lib/utils.ts',
  'next.config.ts', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml',
  'public/favicon.svg', 'public/teacher-tiles.png',
  'tests/privacy.mjs', 'tests/public-source.mjs', 'tsconfig.json', 'vite.config.ts',
]);
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean))];
const rules = [
  ['private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/],
  ['access token', /\b(?:gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,}|AKIA[A-Z0-9]{16}|xox[baprs]-[A-Za-z0-9-]{16,})\b/],
  ['service key', /\b(?:sk_(?:live|test)_[A-Za-z0-9]{16,}|sk-(?:proj-|svcacct-)?[A-Za-z0-9_-]{24,}|AIza[A-Za-z0-9_-]{35})\b/],
  ['email address', /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/],
  ['personal machine path', /(?:[A-Z]:[\\/](?:Users|Documents and Settings)[\\/]|\/(?:Users|home)\/)[A-Za-z0-9._-]+/],
  ['embedded file', /data:(?:image|application)\/[A-Za-z0-9.+-]+;base64,/],
];
for (const file of files) {
  assert(approved.has(file), `Unreviewed public file: ${file}`);
  assert(!lstatSync(file).isSymbolicLink(), `Linked file is not allowed: ${file}`);
  const bytes = readFileSync(file);
  if (file === 'public/teacher-tiles.png') {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    let offset = 8;
    while (offset < bytes.length) {
      const length = bytes.readUInt32BE(offset);
      const type = bytes.toString('ascii', offset + 4, offset + 8);
      assert(['IHDR', 'IDAT', 'IEND'].includes(type), `Unexpected PNG metadata: ${type}`);
      offset += length + 12;
    }
    assert.equal(offset, bytes.length);
    continue;
  }
  assert(!bytes.includes(0), `Unexpected binary file: ${file}`);
  const text = bytes.toString('utf8');
  for (const [label, pattern] of rules) assert(!pattern.test(text), `Potential ${label} in ${file}; inspect privately.`);
}
console.log(`Public-source audit passed for ${files.length} files. This checks the current source, not prior Git history.`);
