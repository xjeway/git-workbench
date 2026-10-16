# git-workbench — Technical Design

## Goal

Create `git-workbench`, an open-source TypeScript CLI toolkit for Git. Its first command, `git-breakdown`, summarizes Git activity by author and file category. The tools report activity; they do not rank people or claim to measure contribution quality.

The npm package and repository are named `git-workbench`. The package exposes one direct `git-<tool>` executable per tool and does not expose a `git-workbench` runtime command. The first tool runs as `git-breakdown`; Git users can also invoke it as `git breakdown`. All executables are shipped by the same npm package, so users install the toolkit once. Do not claim the conflicting `git contrib` command. Package and repository name availability must be checked again immediately before creation or publication.

## Goals and Non-goals

### Goals

- Let a user run the tool with `npx` without cloning its source repository or configuring a Git alias.
- Separate documentation changes from code and other common file classes.
- Show useful default output in a readable terminal table and support machine-readable JSON.
- Make the counted range and classification rules understandable and repeatable.
- Run locally against Git history without sending repository data to a service.

### Non-goals for the MVP

- Measuring the quality, importance, or individual value of contributions.
- Hosted analytics, telemetry, dashboards, CI integrations, or report publishing.
- User-defined configuration files, graphical output, CSV, or extensive interactive workflows.
- Accurate effort estimation for binary files, copied code, generated output, or complex file moves.

## User Experience

Each tool has one direct executable. For the first tool, run it from inside a Git working tree with:

```sh
npm exec --yes --package=git-workbench -- git-breakdown
```

After global installation of the `git-workbench` package, run `git-breakdown` directly or use Git subcommand discovery with `git breakdown`. The package name is not a runtime command; `git-workbench breakdown` is not supported. `npx git-breakdown` by itself would look for a separate npm package named `git-breakdown`, so use the explicit `--package=git-workbench` form for ephemeral execution.

The default command summarizes the current repository history. Options add filters without changing the default flow:

- `--since` and `--until` for time bounds.
- `--author` for a case-insensitive literal substring match against author name or email. This filter is applied locally, so Git still reads the selected history.
- `--path` for pathspec filtering.
- A Git revision range, such as `main..HEAD`.
- `--json` for structured output suitable for pipes and scripts.
- `--help` and `--version`.

Default output is a color-aware, aligned table grouped by author, with activity split by category. Color is disabled when stdout is not a TTY or `NO_COLOR` is set. JSON output contains no decoration or progress text on stdout; diagnostics go to stderr. When no commits match, the command prints a clear empty-state message and exits successfully. Invalid options, a missing Git executable, or a directory outside a Git repository produce concise actionable errors and a non-zero exit status.

Interactive prompts are not part of the MVP: this tool's common path is report generation, and explicit flags are predictable in scripts and CI.

## Statistics and Classification

For each author and category, report commit count, added lines, and deleted lines. Overall commit count includes each matching non-merge commit that changes at least one tracked path, counted once per author; empty commits are excluded. A category commit count includes a commit once for that author/category if any changed path belongs to the category. A commit touching multiple categories contributes to each touched category's commit count, so category counts are not additive to the overall count. A commit touching the same category across multiple files still counts once in that category.

Net line change may be included in JSON or an opt-in display, but is not a default ranking or primary metric. Added and deleted lines remain separate because deletions and refactors can be valuable work.

MVP categories and initial rules:

1. **Tests** — recognized test filename and directory patterns, checked first.
2. **Documentation** — `.md`, `.mdx`, and `.rst` files, including docs directories.
3. **Configuration** — common structured configuration and environment file types.
4. **Generated** — common generated-code markers and generated-output directories.
5. **Code** — common source-code extensions not already classified above.
6. **Other** — files that do not match the preceding rules.

Rules are bundled, deterministic, documented, and kept behind an internal classifier module so they can be changed without changing Git-history parsing or presentation. A later release may add a repository-level configuration format after real repositories show where defaults fail. Classification is based on paths and file metadata, not language parsing.

Use Git's `--numstat` data for line counts. Define an unambiguous NUL-framed output protocol for commit metadata and use `--numstat -z` so paths are not quoted or split on whitespace. Parse it as a streaming state machine; do not parse paths by lines or tabs alone. Handle rename records, whose NUL-delimited form contains both paths. Binary files have no numeric line counts and are reported as zero counted lines; the report documentation must explain this. Renames use Git's reported line counts and are classified by the destination path. The tool will document that those counts do not represent effort. `.mailmap` is honored when supported by the selected Git log format. Commits are attributed to the author, not committer. Merge commits are excluded by default; an explicit option to include them can be considered after MVP.

## Architecture and Data Flow

Implement in TypeScript as a Node.js monorepo with one public npm package, `git-workbench`. The root package owns the tool executable entries, package version, and release; it does not provide a unified command dispatcher. Internal workspace packages hold tools and any genuinely shared code; they are not separately published. Bundle the CLI, tools, and required shared workspace code into the public package. Register each `git-<tool>` command in the root package `bin` map. Each command gets a tiny entry file that selects its tool explicitly, so it does not depend on detecting which npm bin name launched the shared script. This keeps installation and versioning unified while allowing tools and shared code to be developed and tested in separate directories. The CLI requires Node.js 20.19 or newer.

Initial source layout:

```text
git-workbench/
├── package.json                 # public npm package, workspaces, bin map
├── src/bin/                     # direct executable entry files
├── packages/
│   └── breakdown/
│       ├── package.json         # private workspace package
│       └── src/                 # first tool, including its Git adapter
├── docs/
└── .github/workflows/
```

The root package owns the public `bin` map and builds each entrypoint to `dist/bin/`. The build must bundle the first tool and its runtime dependencies into files included in the root package tarball; the private workspace package is not separately published or required at runtime. Verify this with `npm pack` followed by installing and invoking `git-breakdown` from the produced tarball. Add `packages/core/` when more than one tool has a real consumer for shared code. Keep it private and bundle it into `git-workbench`; publish no separate core package in the initial design. The root package is the only release/version boundary.

```text
Tool entrypoint (`git-breakdown`)
     │
     ▼
validate tool options
     │
     ▼
locate repository and invoke Git log with bounded arguments and numstat output
     │
     ▼
parse commits and changed paths
     │
     ▼
classify paths and aggregate by author/category
     │
     ├── terminal table renderer
     └── JSON renderer
```

Keep the main responsibilities in separate internal modules, organized as workspace packages when they are shared across tools:

- **Tool CLI adapter**: parse that tool’s arguments, apply defaults, route output, and set process status.
- **Git history adapter**: execute Git without a shell, validate repository availability, and return normalized commit/file records.
- **Classifier**: map a path to exactly one category using the documented priority.
- **Aggregator**: calculate per-author and overall totals from normalized records.
- **Renderers**: format the same aggregate result as terminal output or JSON.
- **Shared core workspace**: only stable, genuinely reused Git and reporting primitives; add shared modules when there is a second real consumer rather than prebuilding a framework.
- **Tool workspace**: each command owns its CLI options, domain-specific logic, and tests.

The aggregator and classifier are pure functions. Git process execution is the main side-effect seam and is exercised with fixture repositories. Avoid exposing implementation module details as a public library API in the MVP.

## Compatibility and Safety

- Require Git to be installed and available on `PATH`; Git history is the source of truth.
- Invoke Git with an argument array, never by interpolating user-provided filters into a shell command.
- Pass path filters as pathspec arguments and document their Git semantics.
- Support common macOS, Linux, and Windows terminal environments through Node.js and dependency choices.
- Respect `NO_COLOR`, non-TTY output, and Unicode fallback limitations where the terminal lacks glyph support.
- Do not read or transmit credentials, remotes, or file contents; only query commit metadata and numstat.

## Large Repository Behavior

The CLI should support repositories with at least tens of thousands of commits. On 2026-10-15, the public `openai/codex` repository page showed 12,256 commits. A local shallow clone containing 500 commits produced 15,191 lines from `git log --no-merges --format=%H --numstat` in 1.7 seconds on the development machine. This measures Git's history/diff output for that 500-commit slice, not the future CLI or a full-history run, and is only a baseline.

To keep memory use bounded, read Git stdout incrementally and aggregate each parsed record as it arrives; do not buffer the full `git log` output or retain all per-commit records after aggregation. Use Git-side date/revision/path filters to limit work when requested. For full-history runs, show progress on stderr when output is a TTY, and allow piping JSON without progress noise. Do not add a cache until a benchmark shows that repeated full-history runs need one.

Very large repositories with huge generated files or unusually large binary histories can still take longer because Git must inspect historical trees and diffs. The CLI should document that cost and offer practical filters rather than promising constant-time full-history analysis.

## Testing and Quality

- Unit-test classification priority, extension coverage, unknown extensions, and generated/test path patterns.
- Unit-test aggregation for multiple authors/categories, empty history, deletions, and merge filtering.
- Use temporary fixture repositories to verify Git argument handling, `.mailmap`, author identity, rename behavior, revision/path/date filters, empty commits, and unusual paths containing spaces, tabs, newlines, and non-ASCII characters.
- Feed Git output to the parser in small chunks to verify NUL-framed records parse correctly across chunk boundaries.
- Snapshot or assert terminal and JSON output, including TTY/color behavior and `NO_COLOR`.
- Test CLI failures for absent Git, invalid revisions/options, and non-repository directories.
- In CI, run formatting/lint, type-checking, tests, and a package smoke test that packs the root package, installs the tarball in a temporary directory, and invokes its `git-breakdown` bin.

## Release and Adoption

- Publish one npm package, `git-workbench`, with a clear README for each direct executable (`git-breakdown`) and its Git subcommand form (`git breakdown`). Each added tool adds a corresponding `git-<tool>` executable; all tools ship and release at the toolkit version.
- Include license, changelog/release notes, supported Node.js and Git versions, classification rules, and measurement limitations.
- Keep the existing personal Git alias usable during adoption; replacing it is not part of the CLI implementation.
- The direct `git-<tool>` names must not collide with Git commands or common installed extensions; avoid `git contrib`, which is already provided by git-extras.
- Each direct `git-<tool>` command invokes its tool implementation; there is no unified `git-workbench <tool>` runtime command.
- The npm package is the sole public distribution unit; individual tools cannot be installed or versioned separately in the initial design.

## Open Decisions

- Exact initial extension and path-pattern lists for configuration, generated files, and source code.
- Whether a later release should split out independently installable tools if users demonstrate that need.
- Exact JSON field names and compatibility policy before the first stable JSON release.
