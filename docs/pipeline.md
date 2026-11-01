# Pipeline

Three workflows cover the path from a commit to a published image.

```
 push / pull request                         tag v*
        |                                       |
        v                                       v
  +-----------+     +-----------------+   +-----------+
  |  ci.yml   |     |   docker.yml    |   | release   |
  +-----------+     +-----------------+   +-----------+
  | npm ci    |     | buildx build    |   | gh release|
  | lint      |     | (gha cache)     |   | create    |
  | typecheck |     | run container   |   | (notes)   |
  | jest +    |     | curl /health    |   +-----------+
  |  postgres |     +-----------------+
  | build     |       | tag only
  | newman    |       v
  +-----------+     login to ghcr.io, push image
```

## ci.yml

Runs on pushes to `main` and on every pull request. A concurrency group keyed on the
ref cancels older runs of the same branch. Permissions are `contents: read`.

1. `npm ci` with the npm cache keyed on `service/package-lock.json`.
2. `eslint`, then `tsc --noEmit`.
3. Jest with coverage. A `postgres:16-alpine` service container is started and
   `DATABASE_URL` points at it, so `tests/postgres.integration.test.ts` runs. Locally, without
   `DATABASE_URL`, that suite is skipped.
4. `tsc` build.
5. The Postman collection is run with Newman against the built service (in-memory store).

## docker.yml

Runs on pushes to `main`, on version tags, and on pull requests that touch `service/`.

1. Buildx builds the image and loads it into the runner, using the GitHub Actions cache for layers.
2. The smoke test starts the container and polls `/health` for up to 20 seconds, then prints `/version`.
3. Only when the ref is a `v*` tag: log in to `ghcr.io` with `GITHUB_TOKEN` and push. This second
   build reuses the cache, so it is mostly a push. Tags come from `docker/metadata-action`
   (`1.2.3`, `1.2`, and the commit sha).

The job has `contents: read` and `packages: write`, and nothing else.

## release.yml

On a `v*` tag it runs `gh release create --generate-notes`. It needs `contents: write`.

## reusable-node-ci.yml

A `workflow_call` workflow for other repositories. Inputs: `node-version` (default `20`) and
`working-directory` (default `.`). It runs install, lint, typecheck, test and build, skipping
scripts the target repo does not define (`--if-present`). `caller-example.yml.disabled` shows
how to call it.

## Releasing

```
git tag v1.0.0
git push origin v1.0.0
```

This starts `docker.yml` (image push) and `release.yml` (GitHub release).

## Dependabot

`.github/dependabot.yml` checks npm and the Dockerfile in `service/`, and the GitHub Actions
versions, weekly.

## Not yet exercised

These files pass `actionlint`, but none of them has run on GitHub yet.
