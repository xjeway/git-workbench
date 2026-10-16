import type { HistoryOptions } from './history.js';
import { readHistory } from './history.js';
import { renderReport } from './render.js';
import { summarize } from './report.js';

const help = `git-breakdown - 按作者和文件类别汇总 Git 提交

用法：git-breakdown [选项] [<revision-range>]

选项：
  --since <date>    只统计此时间之后的提交
  --until <date>    只统计此时间之前的提交
  --author <text>   按作者名或邮箱做不区分大小写的字面包含匹配
  --path <path>     只统计匹配路径（可重复）
  --json            输出 JSON
  --help            显示帮助
  --version         显示版本

分类：tests、documentation、configuration、generated、code、other
二进制文件不计入增删行数；提交数按非合并且改动了受跟踪路径的提交计算。
`;

interface Options extends HistoryOptions {
  author?: string;
  json: boolean;
  help: boolean;
  version: boolean;
}

interface Result {
  code: number;
  stdout: string;
  stderr: string;
}

function parseArgs(args: string[]): Options {
  const options: Options = { paths: [], json: false, help: false, version: false };
  const takeValue = (flag: string, index: number, inline?: string): string => {
    const value = inline ?? args[index + 1];
    if (!value || (inline === undefined && value.startsWith('--'))) throw new Error(`选项 ${flag} 缺少参数`);
    return value;
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    const equals = arg.indexOf('=');
    const flag = equals < 0 ? arg : arg.slice(0, equals);
    const inline = equals < 0 ? undefined : arg.slice(equals + 1);
    if (flag === '--help' || flag === '-h') options.help = true;
    else if (flag === '--version' || flag === '-v') options.version = true;
    else if (flag === '--json' && inline === undefined) options.json = true;
    else if (flag === '--since') {
      options.since = takeValue(flag, i, inline);
      if (inline === undefined) i++;
    } else if (flag === '--until') {
      options.until = takeValue(flag, i, inline);
      if (inline === undefined) i++;
    } else if (flag === '--author') {
      options.author = takeValue(flag, i, inline);
      if (inline === undefined) i++;
    } else if (flag === '--path') {
      options.paths!.push(takeValue(flag, i, inline));
      if (inline === undefined) i++;
    }
    else if (arg.startsWith('-')) throw new Error(`未知选项：${arg}`);
    else if (!options.range) options.range = arg;
    else throw new Error(`只能指定一个 revision range：${arg}`);
  }
  return options;
}

export async function runCli(
  args: string[],
  cwd: string,
  isTTY = false,
  noColor = false,
  onProgress?: (message: string) => void,
  version = '0.1.0',
): Promise<Result> {
  let options: Options;
  try {
    options = parseArgs(args);
  } catch (error) {
    return { code: 2, stdout: '', stderr: `${error instanceof Error ? error.message : String(error)}\n运行 git-breakdown --help 查看用法。\n` };
  }
  if (options.help) return { code: 0, stdout: help, stderr: '' };
  if (options.version) return { code: 0, stdout: `git-workbench ${version}\n`, stderr: '' };

  try {
    let processed = 0;
    async function* history() {
      for await (const commit of readHistory(cwd, options)) {
        processed++;
        if (isTTY && processed % 1000 === 0) onProgress?.(`\r已读取 ${processed} 个提交`);
        yield commit;
      }
    }
    const report = await summarize(history(), options.author);
    if (isTTY && processed >= 1000) onProgress?.(`\r已读取 ${processed} 个提交\n`);
    return {
      code: 0,
      stdout: `${renderReport(report.authors, options.json, isTTY && !noColor)}\n`,
      stderr: '',
    };
  } catch (error) {
    return { code: 1, stdout: '', stderr: `git-breakdown: ${error instanceof Error ? error.message : String(error)}\n` };
  }
}

export async function main(args = process.argv.slice(2), cwd = process.cwd(), version = '0.1.0'): Promise<void> {
  const result = await runCli(args, cwd, process.stdout.isTTY, process.env.NO_COLOR !== undefined, (message) => process.stderr.write(message), version);
  process.stdout.write(result.stdout);
  process.stderr.write(result.stderr);
  process.exitCode = result.code;
}
