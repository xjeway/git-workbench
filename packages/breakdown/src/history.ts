import { spawn } from 'node:child_process';
import { once } from 'node:events';
import type { Readable } from 'node:stream';

export interface ChangedFile {
  path: string;
  added: number;
  deleted: number;
}

export interface GitCommit {
  hash: string;
  author: string;
  email: string;
  files: ChangedFile[];
}

export interface HistoryOptions {
  since?: string;
  until?: string;
  range?: string;
  paths?: string[];
}

async function* nulTokens(stream: Readable): AsyncGenerator<string> {
  let pending = Buffer.alloc(0);
  for await (const part of stream) {
    const chunk = Buffer.isBuffer(part) ? part : Buffer.from(part);
    const data = pending.length ? Buffer.concat([pending, chunk]) : chunk;
    let start = 0;
    for (let i = 0; i < data.length; i++) {
      if (data[i] === 0) {
        yield data.subarray(start, i).toString('utf8');
        start = i + 1;
      }
    }
    pending = data.subarray(start);
  }
  if (pending.length) yield pending.toString('utf8');
}

export async function* parseLog(stream: Readable): AsyncGenerator<GitCommit> {
  let current: GitCommit | undefined;
  let stage: 'header' | 'author' | 'email' | 'stats' = 'header';
  let rename: { added: number; deleted: number; paths: string[] } | undefined;

  for await (const raw of nulTokens(stream)) {
    if (rename) {
      rename.paths.push(raw);
      if (rename.paths.length === 2) {
        current?.files.push({ path: rename.paths[1]!, added: rename.added, deleted: rename.deleted });
        rename = undefined;
      }
      continue;
    }

    let token = raw;
    if (stage === 'header') {
      token = token.replace(/^\n/, '');
      if (!token.startsWith('\x1e') || !/^[0-9a-f]{40,64}$/i.test(token.slice(1))) {
        if (token === '') continue;
        throw new Error('无法解析 Git 提交记录');
      }
      current = { hash: token.slice(1), author: '', email: '', files: [] };
      stage = 'author';
      continue;
    }

    if (stage === 'author') {
      current!.author = token;
      stage = 'email';
      continue;
    }

    if (stage === 'email') {
      current!.email = token;
      stage = 'stats';
      continue;
    }

    token = token.replace(/^\n/, '');
    if (token.startsWith('\x1e')) {
      if (current?.files.length) yield current;
      current = undefined;
      stage = 'header';
      const marker = token;
      const hash = marker.slice(1);
      if (!/^[0-9a-f]{40,64}$/i.test(hash)) throw new Error('无法解析 Git 提交记录');
      current = { hash, author: '', email: '', files: [] };
      stage = 'author';
      continue;
    }
    if (!token) continue;

    const firstTab = token.indexOf('\t');
    const secondTab = token.indexOf('\t', firstTab + 1);
    if (firstTab < 0 || secondTab < 0) throw new Error('无法解析 Git 文件统计');
    const addedValue = token.slice(0, firstTab);
    const deletedValue = token.slice(firstTab + 1, secondTab);
    const added = /^\d+$/.test(addedValue) ? Number(addedValue) : 0;
    const deleted = /^\d+$/.test(deletedValue) ? Number(deletedValue) : 0;
    const filePath = token.slice(secondTab + 1);
    if (filePath) {
      current!.files.push({ path: filePath, added, deleted });
    } else {
      rename = { added, deleted, paths: [] };
    }
  }

  if (rename) throw new Error('Git 输出中的重命名记录不完整');
  if (current?.files.length) yield current;
}

export async function* readHistory(cwd: string, options: HistoryOptions = {}): AsyncGenerator<GitCommit> {
  const args = [
    'log', '--root', '--no-merges', '--numstat', '-z',
    '--format=%x1e%H%x00%aN%x00%aE',
  ];
  if (options.since) args.push(`--since=${options.since}`);
  if (options.until) args.push(`--until=${options.until}`);
  if (options.range) args.push(options.range);
  if (options.paths?.length) args.push('--', ...options.paths);

  const child = spawn('git', args, { cwd, stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  child.stderr.setEncoding('utf8').on('data', (part: string) => {
    if (stderr.length < 4000) stderr += part.slice(0, 4000 - stderr.length);
  });
  for await (const commit of parseLog(child.stdout)) yield commit;
  const [code] = await once(child, 'close') as [number | null, NodeJS.Signals | null];
  if (code !== 0) throw new Error(stderr.trim() || `git log 退出码 ${code}`);
}
