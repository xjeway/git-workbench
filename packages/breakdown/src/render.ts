import { categories, type AuthorReport } from './report.js';

const labels = {
  tests: 'Tests',
  documentation: 'Docs',
  configuration: 'Config',
  generated: 'Generated',
  code: 'Code',
  other: 'Other',
} as const;

function paint(value: string, code: number, enabled: boolean): string {
  return enabled ? `\u001b[${code}m${value}\u001b[0m` : value;
}

export function renderTable(authors: AuthorReport[], color: boolean): string {
  if (!authors.length) return '没有匹配的贡献记录。';
  const headers = ['Author', 'Commits', 'Lines +/-', ...categories.map((category) => `${labels[category]} +/-`)];
  const rows = authors.map((author) => [
    `${author.author} <${author.email}>`,
    String(author.commits),
    `${author.total.added}/${author.total.deleted}`,
    ...categories.map((category) => {
      const stats = author.categories[category];
      return `${stats.added}/${stats.deleted}`;
    }),
  ]);
  const widths = headers.map((header, index) => Math.max(header.length, ...rows.map((row) => row[index]!.length)));
  const pad = (cell: string, index: number) => cell.padEnd(widths[index]!);
  return [
    headers.map((header, index) => paint(pad(header, index), 36, color)).join('  '),
    widths.map((width) => '-'.repeat(width)).join('  '),
    ...rows.map((row) => row.map(pad).join('  ')),
  ].join('\n');
}

export function renderReport(authors: AuthorReport[], json: boolean, color: boolean): string {
  return json ? JSON.stringify({ authors }, null, 2) : renderTable(authors, color);
}
