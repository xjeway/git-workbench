# git-workbench

[GitHub repository](https://github.com/xjeway/git-workbench)

Small Git command-line tools. The first tool, `git-breakdown`, summarizes each author's commit and line counts by file category.

## Use

Requires Node.js 20.19 or newer and Git.

Run without a global install:

```sh
npm exec --yes --package=git-workbench -- git-breakdown
```

Or install the toolkit once:

```sh
npm install --global git-workbench
git-breakdown
# Git also discovers this as:
git breakdown
```

Run from inside the repository to analyze. The tool reads local Git history and does not contact a hosted service.

## Options

```text
git-breakdown [--since <date>] [--until <date>] [--author <text>]
              [--path <path> ...] [--json] [<revision-range>]
```

- `--since`, `--until`: Git date filters.
- `--author`: case-insensitive literal substring in the canonical author name or email.
- `--path`: Git pathspec filter; may be repeated.
- `<revision-range>`: for example, `main..HEAD`.
- `--json`: emit structured JSON without terminal decoration.
- `--help`, `--version`: show help or package version.

`--author` is applied locally after reading history, so it does not reduce Git's history scan. Date, revision, and path filters are passed to Git.

## Categories and counting

Each changed path is assigned to one category, in this order:

1. `tests` — test directories and `.test.*` / `.spec.*` files.
2. `documentation` — Markdown and reStructuredText files, plus common README/changelog names.
3. `configuration` — common JSON, YAML, TOML, INI, environment, and `.conf` files.
4. `generated` — common generated/build output directories and generated/minified file names.
5. `code` — common source-code extensions.
6. `other` — everything else.

The rules are built in; there is no repository config yet. A commit is counted once per author if it changes at least one tracked path. Empty and merge commits are excluded. A commit touching multiple categories counts once in each touched category, so category commit counts can overlap. Added and deleted lines are reported separately. Binary files have no line counts and contribute zero. Renames are classified using the destination path.

The numbers describe Git history, not effort or contribution quality. Line counts can overstate copied or generated work.

## JSON shape

`git-breakdown --json` returns an `authors` array. Each author has `author`, `email`, `commits`, `total` (`added` and `deleted`), and `categories`; each category has `commits`, `added`, and `deleted`.

## Development

```sh
npm install
npm test
npm run build
```

The root package is the only public npm package. Tool implementations live in private workspaces and are bundled into that package.
