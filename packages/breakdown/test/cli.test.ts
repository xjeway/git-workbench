import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { runCli } from '../src/cli.ts';

function makeRepo(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'git-breakdown-cli-'));
  execFileSync('git', ['init', '-q', dir]);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'CLI Author']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'cli@example.test']);
  mkdirSync(path.join(dir, 'docs'));
  writeFileSync(path.join(dir, 'docs', 'guide.md'), 'hello\n');
  writeFileSync(path.join(dir, '--odd.md'), 'odd name\n');
  writeFileSync(path.join(dir, 'src.ts'), 'const value = 1;\n');
  execFileSync('git', ['-C', dir, 'add', '.']);
  execFileSync('git', ['-C', dir, 'commit', '-qm', 'initial']);
  return dir;
}

test('prints machine-readable JSON and honors literal author/path filters', async () => {
  const repo = makeRepo();
  try {
    const result = await runCli(['--json', '--author=cli@EXAMPLE.test', '--path=docs'], repo);
    assert.equal(result.code, 0);
    const report = JSON.parse(result.stdout);
    assert.equal(report.authors[0].categories.documentation.added, 1);
    assert.equal(report.authors[0].categories.code.commits, 0);
    const unusual = await runCli(['--json', '--path=--odd.md'], repo);
    assert.equal(JSON.parse(unusual.stdout).authors[0].categories.documentation.added, 1);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('prints help and reports invalid flags without throwing', async () => {
  const help = await runCli(['--help'], process.cwd());
  assert.equal(help.code, 0);
  assert.match(help.stdout, /git-breakdown/);
  const invalid = await runCli(['--unknown'], process.cwd());
  assert.equal(invalid.code, 2);
  assert.match(invalid.stderr, /未知选项/);
});
