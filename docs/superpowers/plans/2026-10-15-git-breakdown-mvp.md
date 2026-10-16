# git-breakdown MVP Implementation Plan

> **For agentic workers:** Execute inline task-by-task, keeping each behavior covered by a failing test before its implementation.

**Goal:** Ship a usable first TypeScript CLI in the `git-workbench` npm package that reports per-author commits and added/deleted lines split into documentation, code, tests, configuration, generated, and other files.

**Architecture:** The root package is the only published package and owns the `git-breakdown` bin. A private `packages/breakdown` workspace contains the Git reader, classifier, aggregation, and report logic. TypeScript builds the bin and runtime modules into the root `dist/`; the tarball contains the built output and no runtime dependency on the workspace symlink.

**Tech Stack:** Node.js, TypeScript, npm workspaces, Node test runner, `tsx` for TypeScript tests.

---

### Task 1: Establish the package and classifier behavior

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `packages/breakdown/package.json`
- Create: `packages/breakdown/src/classify.ts`
- Create: `packages/breakdown/test/classify.test.ts`

- [ ] Add failing tests for `.md` documentation, a common source extension, test-path precedence, generated-file precedence, configuration, and unknown paths.
- [ ] Run `npm test -- --test-name-pattern='classifies'` and confirm the missing classifier fails.
- [ ] Implement deterministic extension/path classification in `classify.ts`.
- [ ] Run the targeted test and then the full test command.

### Task 2: Read and aggregate Git history

**Files:**
- Create: `packages/breakdown/src/history.ts`
- Create: `packages/breakdown/src/report.ts`
- Create: `packages/breakdown/test/history.test.ts`
- Create: `packages/breakdown/test/report.test.ts`

- [ ] Add fixture-repository tests covering author identity, additions/deletions, multiple categories in one commit, empty commits, and filenames with spaces, tabs, newlines, and non-ASCII characters.
- [ ] Run the targeted tests and confirm expected failures before implementation.
- [ ] Implement Git invocation with an argument array, NUL-safe numstat parsing, author attribution, and the documented non-merge/empty-commit counting rules.
- [ ] Stream stdout in chunks and aggregate without retaining the full history output.
- [ ] Run the history and aggregation tests.

### Task 3: Add the CLI and output

**Files:**
- Create: `src/bin/git-breakdown.ts`
- Create: `packages/breakdown/src/cli.ts`
- Create: `packages/breakdown/src/render.ts`
- Create: `packages/breakdown/test/cli.test.ts`
- Modify: root `package.json` and `tsconfig.json`

- [ ] Add tests for default table output, JSON output, help/version, date/author/path/revision filters, and concise errors outside a repository.
- [ ] Verify tests fail before implementation.
- [ ] Implement CLI parsing, Git adapter call, aligned text/JSON output, `NO_COLOR`/non-TTY behavior, and exit codes.
- [ ] Build the `git-breakdown` bin to `dist/bin/git-breakdown.js` and ensure errors/progress go to stderr while JSON stdout stays clean.
- [ ] Run all tests and the build.

### Task 4: Prepare and verify the npm artifact

**Files:**
- Create: `README.md`
- Create: `LICENSE`
- Create: `.gitignore`
- Modify: root `package.json`

- [ ] Document installation with `npm exec --yes --package=git-workbench -- git-breakdown`, global use, supported filters, category rules, and metric limitations.
- [ ] Set package metadata, Node engine, `files`, `bin`, and publish access for the single `git-workbench` package.
- [ ] Run `npm pack --dry-run`, install the resulting tarball into a temporary project, and invoke `git-breakdown` against a fixture repository.
- [ ] Recheck `npm view git-workbench`; if available, publish the real MVP as `git-workbench@0.1.0` and verify it can be fetched from npm.

## Deliberately deferred

- Additional tools, shared `core` package, user-defined classification, charts/CSV/HTML, cache, and stable JSON compatibility guarantees.
- Publishing cannot run until an authenticated npm session is available.
