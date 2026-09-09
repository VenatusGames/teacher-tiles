import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { DatabaseSync } from 'node:sqlite';

globalThis.__testEnv = {};
const gateSource = readFileSync('lib/development-access.ts', 'utf8');
for (const development of [false, true]) {
  const js = ts.transpileModule(gateSource.replace('import.meta.env.DEV', String(development)), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
  const gate = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
  const response = gate.requireLocalDevelopment();
  if (development) assert.equal(response, null);
  else {
    assert.equal(response.status, 503);
    assert.equal(response.headers.get('cache-control'), 'no-store');
  }
}

const sqlite = new DatabaseSync(':memory:');
const db = { prepare(sql) { return { bind(...args) { this.args = args; return this; }, args: [], async run() { return sqlite.prepare(sql).run(...this.args); }, async all() { return { results: sqlite.prepare(sql).all(...this.args) }; }, async first() { return sqlite.prepare(sql).get(...this.args); } }; }, async batch(statements) { return Promise.all(statements.map(s => s.run())); } };
globalThis.__testEnv.DB = db;
const runtimeSource = readFileSync('db/runtime.ts', 'utf8').replace("import { env } from 'cloudflare:workers';", 'const env = globalThis.__testEnv;');
const runtimeJs = ts.transpileModule(runtimeSource, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 } }).outputText;
const runtime = await import(`data:text/javascript;base64,${Buffer.from(runtimeJs).toString('base64')}`);
await runtime.ensureDatabase();
for (const table of ['students', 'responses', 'response_items']) assert.equal(sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count, 0);
assert.equal(sqlite.prepare('SELECT COUNT(*) AS count FROM questions').get().count, 1);
for (const route of ['bootstrap', 'history', 'files', 'responses', 'admin/data', 'admin/upload']) {
  const text = readFileSync(`app/api/${route}/route.ts`, 'utf8');
  assert.match(text, /const blocked = requireLocalDevelopment\(\);\s+if \(blocked\) return blocked;/);
}
sqlite.close();
console.log('Privacy checks passed: new databases have no student records; production data access is disabled until sign-in is connected.');
