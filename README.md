
# @3fv/ditsy

This project is a fork from [async-injection](https://github.com/pcafstockf/async-injection) which served as an amazing springboard in executing this refined DI evolution

unfortunately - i still need to write a readme :(

## Commands

[pnpm](https://pnpm.io) is the package manager, at the version pinned by the
`packageManager` field of `package.json`.

| Command            | What it does                                                       |
| ------------------ | ------------------------------------------------------------------ |
| `pnpm install`     | Installs dependencies from `pnpm-lock.yaml`                        |
| `pnpm build`       | Compiles `src/` to `lib/esm` and `lib/cjs` (`tsc -b`)              |
| `pnpm build:watch` | Same, in watch mode                                                |
| `pnpm test`        | Runs jest (`ts-jest`) over the specs in `src/__tests__`            |
| `pnpm test:watch`  | Same, in watch mode                                                |
| `pnpm dev`         | Runs the build and the tests in watch mode together                |
| `pnpm clean`       | Removes `lib/`                                                     |
| `pnpm release`     | Starts the GitHub Actions release workflow (patch bump)            |

The package is a hybrid: `lib/esm` holds the ES modules and `lib/cjs` the
CommonJS build, each with its own declarations, selected through the `exports`
map of `package.json` (`@3fv/ditsy` and `@3fv/ditsy/<module>`). `lodash`
functions are imported one file at a time (`lodash/uniq.js`), which is the form
that loads in native Node ES modules as well as in CommonJS.

`pnpm-workspace.yaml` denies the `@swc/core` and `@parcel/watcher` install
scripts; their native binaries come from their optional dependencies.

To use a local checkout from another project, run `pnpm link /path/to/ditsy` in
that project after `pnpm build` here.

## Releasing

Releases run entirely in GitHub Actions (`.github/workflows/release.yml`),
started by `pnpm release` or by
`gh workflow run release.yml --ref master -f bump=<patch|minor|major|none>` (add
`-f dist-tag=<tag>` to publish under a tag other than `latest`):

1. The `version` job runs `pnpm version`, which builds and tests the package
   (`preversion`), commits and tags `vX.Y.Z`, and pushes both to `master`.
2. The `publish` job checks out that tag, builds it and runs `npm publish`
   through npm trusted publishing, so no npm token or two-factor prompt is
   involved. If it fails, re-run that job alone: it publishes the same tag.

`bump=none` publishes the version already in `package.json` at the dispatched
commit without bumping or tagging.

Trusted publishing needs a one-time registration of the workflow on npm:

    npm trust github @3fv/ditsy --repo 3fv/ditsy --file release.yml --allow-publish
