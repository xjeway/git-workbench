# Competitor Evaluation

Evaluated on 2026-10-15 against the `ligom` repository history available locally. The commands only read Git history. Counts below come from different tools with different definitions and should not be compared as if they were one metric.

## Tools Evaluated

| Tool | Distribution / implementation | Relevant capability | Observed gap for this use case |
|---|---|---|---|
| [git-fame](https://github.com/casperdcl/git-fame) | Python CLI; installed for the evaluation with `uvx` | `--bytype` reports totals per file extension; supports author summaries, time filters, `.mailmap` workflows, and many output formats. | `--bytype` printed extension totals separately from the author table. It did not produce an author-by-category matrix in one report. Categories remain file extensions, not semantic buckets such as docs/tests/config/code. |
| [gitinspector](https://github.com/ejwa/gitinspector) | Python CLI; source checkout invoked with Python 3.15 | Per-author commit and insertion/deletion statistics; extension filter; timeline, responsibility, and several output formats. | Default extension list focuses on source code and excludes Markdown. To compare docs with code, run separate extension-filtered reports. Output is text-heavy and has no one-run semantic category summary. |
| [git-contributor-stats](https://github.com/vikkrantxx7/git-contributor-stats) | TypeScript / Node.js CLI distributed on npm; tested package version 2.2.0 | Author statistics, branch/time/path filters, identity merging, table/JSON/CSV/Markdown/HTML output, and charts. | Its CLI and README expose no file-extension or semantic-category grouping option. It reports broad activity analytics rather than the proposed category breakdown. |

## Reproduction

### git-fame

```sh
uvx --from git-fame git-fame --bytype --loc=ins \
  --since=2025-10-15 --silent-progress --format=plain /path/to/ligom
```

Observed output included extension totals such as `.go`, `.md`, `.ts`, `.tsx`, and `.yaml`, followed by one overall author table. The output had 463 commits and 870,928 LOC under this tool's definitions. It did not cross-tabulate author and extension/category.

### gitinspector

```sh
python3 gitinspector.py --file-types=md --since=2026-10-01 /path/to/ligom
python3 gitinspector.py \
  --file-types=go,ts,tsx,js,jsx,py,rs,sh,proto \
  --since=2026-10-01 /path/to/ligom
```

The Markdown-only report found 14 commits, 1,267 insertions, and 190 deletions. The selected source extensions found 39 commits, 23,042 insertions, and 4,385 deletions. For context, `git log --since=2026-10-01 --no-merges` returned 39 commits; the extension-filtered count is therefore bounded by the selected paths and the tool's counting rules. These required separate invocations to compare docs and source.

### git-contributor-stats

```sh
npm exec --yes --package=git-contributor-stats -- \
  git-contributor-stats --since 2025-10-15 --no-count-lines --top 8
```

The package ran successfully with Node.js 26.11.1 and reported author commits and added/deleted lines, but no category split. npm emitted a deprecation warning for transitive `prebuild-install` during the first ephemeral install. The package's broad reporting feature set overlaps substantially with generic contributor analytics.

## Findings

1. The original broad feature set is already served by mature or feature-rich tools. A new tool should not compete on raw author totals, date/path filters, JSON, charts, or line-count metrics alone.
2. `git-fame` already answers a basic “which extensions changed?” question, but it requires the user to mentally group extensions and does not present the author-by-category matrix in the tested output.
3. `gitinspector` can calculate separate Markdown and source reports, but users must know and repeat extension lists; its default configuration excludes Markdown.
4. The narrow, testable product hypothesis is: one command produces an understandable author-by-category report using documented semantic buckets (documentation, tests, configuration, generated files, source code, other), with visible/overridable classification rules.
5. The next validation should check whether those semantic buckets are consistently useful across several different repositories. If extension totals or two filtered invocations are sufficient, recommend an existing tool instead of building another one.

## Cross-Repository Smoke Validation

To check whether the extension-filter workflow generalizes beyond ligom, the same read-only commands were run against Vercel Skills (TypeScript), Cobra (Go), and Serde (Rust). For each repository, `gitinspector --file-types=md` and a separate source-extension invocation were used with `--since=2025-10-15`.

| Repository | Documentation filter | Main source filter |
|---|---:|---:|
| [vercel-labs/skills](https://github.com/vercel-labs/skills) | Markdown: 58 commits, +1,260 / -165 lines | TypeScript/MJS: 179 commits, +36,647 / -4,202 lines |
| [spf13/cobra](https://github.com/spf13/cobra) | Markdown: 3 commits, +69 / 0 lines | Go: 8 commits, +121 / -12 lines |
| [serde-rs/serde](https://github.com/serde-rs/serde) | Markdown: 3 commits, +7 / -7 lines | Rust: 22 commits, +193 / -193 lines |

These numbers are separate filtered reports, not an additive partition: one commit can change both documentation and source, and the reports use the selected extension lists. The test confirms that the existing extension-filter workflow works across these repository types. It does not confirm that users need semantic buckets; that remains the product question.

The default-category challenge is visible in the extensions: Skills has YAML and JSON alongside TS/MD; Cobra has module files and YAML alongside Go/MD; Serde has TOML/YAML/stderr files alongside Rust/MD. A semantic category report would need explicit rules for these auxiliary types, and tests/generated files would need path/name rules beyond language extensions.

The other two tools also ran on all three repositories. `git-fame --bytype` continued to print extension totals separately from the author summary. `git-contributor-stats` produced its author summary on each, but exposed no category grouping. Their numeric totals differed from gitinspector, so the outputs were treated as behavior checks, not a benchmark of counting accuracy.

## Recommendation

Do not begin a broad contributor-analytics implementation. The cross-repository check confirms a workflow gap, but not yet a strong enough product need: existing extension filters already work across TypeScript, Go, and Rust repositories. Before implementation, validate whether users prefer automatic semantic buckets to choosing extension/path filters themselves. If that need is confirmed, implement the smallest CLI that demonstrates a one-run author-by-category report and a transparent classifier; avoid duplicating charts, HTML dashboards, ownership analysis, or a public library API in the first release.
