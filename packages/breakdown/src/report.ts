import { classifyPath, type Category } from './classify.js';
import type { GitCommit } from './history.js';

export const categories: Category[] = [
  'tests', 'documentation', 'configuration', 'generated', 'code', 'other',
];

export interface CategoryStats {
  commits: number;
  added: number;
  deleted: number;
}

export interface AuthorReport {
  author: string;
  email: string;
  commits: number;
  total: { added: number; deleted: number };
  categories: Record<Category, CategoryStats>;
}

export async function summarize(commits: AsyncIterable<GitCommit> | Iterable<GitCommit>, authorFilter?: string): Promise<{ authors: AuthorReport[] }> {
  const authors = new Map<string, AuthorReport>();
  const needle = authorFilter?.toLocaleLowerCase();

  for await (const commit of commits) {
    if (!commit.files.length) continue;
    if (needle && !`${commit.author} ${commit.email}`.toLocaleLowerCase().includes(needle)) continue;

    const key = commit.email.toLocaleLowerCase() || commit.author.toLocaleLowerCase();
    let report = authors.get(key);
    if (!report) {
      report = {
        author: commit.author,
        email: commit.email,
        commits: 0,
        total: { added: 0, deleted: 0 },
        categories: Object.fromEntries(categories.map((category) => [category, { commits: 0, added: 0, deleted: 0 }])) as Record<Category, CategoryStats>,
      };
      authors.set(key, report);
    }

    report.commits++;
    const touched = new Set<Category>();
    for (const file of commit.files) {
      const category = classifyPath(file.path);
      const stats = report.categories[category];
      stats.added += file.added;
      stats.deleted += file.deleted;
      report.total.added += file.added;
      report.total.deleted += file.deleted;
      touched.add(category);
    }
    for (const category of touched) report.categories[category].commits++;
  }

  return {
    authors: [...authors.values()].sort((a, b) => b.commits - a.commits || a.author.localeCompare(b.author)),
  };
}
