import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { Readable } from 'node:stream';
import test from 'node:test';
import { parseLog, readHistory } from '../src/history.ts';

function makeRepo(): string {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'git-breakdown-'));
  execFileSync('git', ['init', '-q', dir]);
  execFileSync('git', ['-C', dir, 'config', 'user.name', 'Fixture Author']);
  execFileSync('git', ['-C', dir, 'config', 'user.email', 'fixture@example.test']);
  return dir;
}

function put(repo: string, name: string, content: string): void {
  const file = path.join(repo, name);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, content);
}

function commit(repo: string, message: string, author?: string): void {
  execFileSync('git', ['-C', repo, 'add', '-A']);
  execFileSync('git', ['-C', repo, 'commit', '-qm', message, ...(author ? ['--author', author] : [])]);
}

test('reads author, numstat, and unusual paths without losing filename bytes', async () => {
  const repo = makeRepo();
  try {
    put(repo, 'docs/guide\nwith\ttabs.md', 'line one\nline two\n');
    commit(repo, 'add docs');
    const commits = [];
    for await (const item of readHistory(repo)) commits.push(item);
    assert.equal(commits.length, 1);
    assert.equal(commits[0]?.author, 'Fixture Author');
    assert.equal(commits[0]?.email, 'fixture@example.test');
    assert.deepEqual(commits[0]?.files, [{ path: 'docs/guide\nwith\ttabs.md', added: 2, deleted: 0 }]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('uses mailmap identities and omits empty commits', async () => {
  const repo = makeRepo();
  try {
    put(repo, '.mailmap', 'Mapped Author <mapped@example.test> Original Author <original@example.test>\n');
    put(repo, 'src/a.ts', 'const a = 1;\n');
    commit(repo, 'first', 'Original Author <original@example.test>');
    execFileSync('git', ['-C', repo, 'commit', '--allow-empty', '-qm', 'empty']);
    const commits = [];
    for await (const item of readHistory(repo)) commits.push(item);
    assert.equal(commits.length, 1);
    assert.equal(commits[0]?.author, 'Mapped Author');
    assert.equal(commits[0]?.email, 'mapped@example.test');
    assert.equal(commits[0]?.files.length, 2);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('parses NUL records across byte chunks and classifies a rename by its new path', async () => {
  const repo = makeRepo();
  try {
    put(repo, 'src/old.ts', 'one\ntwo\n');
    commit(repo, 'add source');
    mkdirSync(path.join(repo, 'docs'));
    execFileSync('git', ['-C', repo, 'mv', 'src/old.ts', 'docs/new\nname.md']);
    commit(repo, 'move to docs');
    const actual = [];
    for await (const item of readHistory(repo)) actual.push(item);
    assert.equal(actual[0]?.files[0]?.path, 'docs/new\nname.md');

    const hash = 'a'.repeat(40);
    const bytes = Buffer.from(`\x1e${hash}\0Author\0author@example.test\0\n1\t0\t\0old\nname\0new\tname.md\0`);
    const chunks = Array.from({ length: bytes.length }, (_, index) => bytes.subarray(index, index + 1));
    const parsed = [];
    for await (const item of parseLog(Readable.from(chunks))) parsed.push(item);
    assert.deepEqual(parsed[0]?.files, [{ path: 'new\tname.md', added: 1, deleted: 0 }]);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('excludes merge commits from history', async () => {
  const repo = makeRepo();
  try {
    put(repo, 'base.txt', 'base\n');
    commit(repo, 'base');
    execFileSync('git', ['-C', repo, 'checkout', '-qb', 'side']);
    put(repo, 'side.txt', 'side\n');
    commit(repo, 'side');
    execFileSync('git', ['-C', repo, 'checkout', '-q', '-']);
    put(repo, 'main.txt', 'main\n');
    commit(repo, 'main');
    execFileSync('git', ['-C', repo, 'merge', '--no-ff', '-qm', 'merge', 'side']);
    const commits = [];
    for await (const item of readHistory(repo)) commits.push(item);
    assert.equal(commits.length, 3);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});
