# Docker decisions

The files are `service/Dockerfile`, `service/.dockerignore`, `docker-compose.yml` and
`docker-compose.override.yml`. They were linted (hadolint, YAML parsing) but not built or
run, because Docker is not installed on the development machine.

## Dockerfile

- **`node:20-alpine` base.** Small, and matches the Node version used in CI.
- **Three stages.** `deps` installs everything from the lockfile, `build` compiles TypeScript,
  `runtime` holds only what is needed to run. Compiler, Jest, ESLint and Newman never reach the
  final image.
- **Copy `package*.json` before the source.** The dependency layer is only rebuilt when the
  lockfile changes.
- **`npm ci`, not `npm install`.** Installs exactly what the lockfile says and fails if it
  disagrees with `package.json`.
- **`npm ci --omit=dev` in the final stage.** Production dependencies only (express, pg).
  Checked outside Docker: the install has 99 packages and no jest, typescript or newman.
- **BuildKit cache mount for `~/.npm`.** Faster rebuilds. `npm cache clean` afterwards is a
  precaution; the cache mount is not part of the image layer anyway.
- **`USER 1000:1000`.** The `node` user in the image has uid 1000. A numeric id is used so
  Kubernetes `runAsNonRoot` checks can verify it, and hadolint does not warn.
- **`NODE_ENV=production`.** Express and some libraries change behaviour.
- **`APP_VERSION` build arg.** Becomes the env var that `/version` returns. CI passes the tag
  or commit sha.
- **Exec-form `CMD ["node", ...]`.** Node is PID 1 and receives SIGTERM directly, so the
  graceful shutdown in `src/server.ts` runs. No `npm start` wrapper, which would swallow the signal.
- **`HEALTHCHECK`.** Uses Node's built-in `fetch` against `/health`, so no `curl` or `wget` is
  needed in the image.

## .dockerignore

Keeps `node_modules`, `dist`, tests, local env files and git data out of the build context.
That makes the context small and stops host `node_modules` from overwriting container ones.

## docker-compose.yml

- `db` is `postgres:16-alpine` with a named volume `pgdata` and a `pg_isready` healthcheck.
- `api` uses `depends_on` with `condition: service_healthy`, so it starts only once Postgres
  accepts connections. The service also creates its table on startup.
- Credentials come from `.env` (copy `.env.example`). The example values are for development only.

## docker-compose.override.yml

Docker Compose merges this file automatically for `docker compose up`. For development it:

- builds the `build` stage (which has dev dependencies) instead of `runtime`,
- runs `tsx watch` with `./service/src` bind-mounted, so edits restart the server,
- exposes Postgres on `127.0.0.1:5432`,
- has a `develop.watch` rule that rebuilds the image when `package.json` changes
  (`docker compose watch`).

For a production-like run use `docker compose -f docker-compose.yml up --build`.
