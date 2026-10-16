import assert from 'node:assert/strict';
import test from 'node:test';
import { summarize } from '../src/report.ts';
import type { GitCommit } from '../src/history.ts';

const commits: GitCommit[] = [
  {
    hash: 'one', author: 'A[da', email: 'ada@example.test', files: [
      { path: 'README.md', added: 2, deleted: 1 },
      { path: 'docs/guide.md', added: 3, deleted: 0 },
      { path: 'src/main.ts', added: 5, deleted: 2 },
    ],
  },
  { hash: 'empty', author: 'Ada', email: 'ada@example.test', files: [] },
  { hash: 'two', author: 'Grace', email: 'grace@example.test', files: [{ path: 'src/app.ts', added: 0, deleted: 4 }] },
];

test('counts commits once per author and category while summing changed lines', async () => {
  const report = await summarize(commits);
  const ada = report.authors.find((author) => author.author === 'A[da')!;
  assert.equal(ada.commits, 1);
  assert.deepEqual(ada.categories.documentation, { commits: 1, added: 5, deleted: 1 });
  assert.deepEqual(ada.categories.code, { commits: 1, added: 5, deleted: 2 });
  assert.deepEqual(ada.total, { added: 10, deleted: 3 });
});

test('matches author filters as case-insensitive literal substrings and skips empty commits', async () => {
  assert.equal((await summarize(commits, '[')).authors.length, 1);
  assert.equal((await summarize(commits, 'A[DA')).authors.length, 1);
});
