export type Category =
  | 'tests'
  | 'documentation'
  | 'configuration'
  | 'generated'
  | 'code'
  | 'other';

const codeExtensions = new Set([
  'c', 'cc', 'cpp', 'cs', 'css', 'go', 'h', 'hpp', 'html', 'java', 'js', 'jsx',
  'kt', 'm', 'mm', 'php', 'proto', 'py', 'rb', 'rs', 'scss', 'sh', 'sql', 'swift',
  'ts', 'tsx', 'vue', 'xml',
]);
const configExtensions = new Set(['conf', 'env', 'ini', 'json', 'properties', 'toml', 'yaml', 'yml']);

export function classifyPath(filePath: string): Category {
  const path = filePath.replaceAll('\\', '/').toLowerCase();
  const base = path.slice(path.lastIndexOf('/') + 1);
  const extension = base.includes('.') ? base.slice(base.lastIndexOf('.') + 1) : '';

  if (/(^|\/)(__tests__|tests?|specs?)\//.test(path) || /\.(test|spec)\.[^.]+$/.test(base)) {
    return 'tests';
  }
  if (['md', 'mdx', 'rst'].includes(extension) || /(^|\/)(readme|changelog|contributing)(\.|$)/.test(base)) {
    return 'documentation';
  }
  if (base === '.env' || base.startsWith('.env.') || configExtensions.has(extension)) {
    return 'configuration';
  }
  if (/(^|\/)(dist|build|generated|vendor)\//.test(path) || /\.(generated|min)\.[^.]+$/.test(base) || base.endsWith('.pb.go')) {
    return 'generated';
  }
  return codeExtensions.has(extension) ? 'code' : 'other';
}
