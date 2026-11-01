# devops-repository

A small notes REST service written to show a complete delivery setup: TypeScript, Jest,
Docker, docker-compose, GitHub Actions CI/CD and a Postman collection run by Newman.

## Stack

- Node 20, TypeScript (strict), Express 4
- Storage: in-memory by default, PostgreSQL (`pg`) when `DATABASE_URL` is set
- Jest + ts-jest + supertest, ESLint, Newman (Postman CLI)
- Docker (multi-stage, non-root), docker-compose, GitHub Actions, Dependabot

## API

| Method | Path | Notes |
| --- | --- | --- |
| GET | `/health` | liveness |
| GET | `/ready` | readiness, pings the store, 503 if it fails |
| GET | `/version` | from `APP_VERSION`, else the package version |
| GET | `/api/notes` | list |
| POST | `/api/notes` | `{ "title": 1-100 chars, "body": optional, up to 1000 }` |
| GET / PUT / DELETE | `/api/notes/:id` | PUT replaces title and body |

Errors are JSON: 400 (validation or malformed JSON), 404, 413, 500, 503.
Logs are one JSON object per line. SIGTERM and SIGINT close the HTTP server and the store before exit.

## Run locally

```
cd service
cp .env.example .env     # optional, the service reads real env vars
npm ci
npm run dev              # http://localhost:5300
```

Configuration (all optional): `PORT` (5300), `LOG_LEVEL` (info), `APP_VERSION`, `DATABASE_URL`.
Invalid values stop the service at startup with an error.

With Docker (see the status table below):

```
cp .env.example .env
docker compose up --build
```

## Test

```
cd service
npm run lint
npm run typecheck
npm test              # Jest
npm run build && npm run test:api   # starts dist/ on port 5300 and runs the Postman collection
```

To run the PostgreSQL integration tests against a database:
`DATABASE_URL=postgres://user:pass@localhost:5432/db npm test`. They are skipped when it is unset.

`make check` runs lint, typecheck, tests, build and the Newman run.

## Layout

```
.github/workflows/   ci.yml, docker.yml, release.yml, reusable-node-ci.yml, caller-example.yml.disabled
.github/dependabot.yml
service/             the Express service
  src/               app, config, logger, validation, server, store/ (memory, postgres)
  tests/             unit and API tests, postgres integration test
  scripts/run-newman.js
  Dockerfile  .dockerignore
postman/             collection run by Newman
docs/                pipeline.md, docker.md
docker-compose.yml  docker-compose.override.yml  .env.example  Makefile
```

## What has and has not been run

| Part | Status |
| --- | --- |
| Jest (unit and API tests), ESLint, `tsc` | run locally, passing |
| Newman collection against the built service | run locally, passing |
| Production dependency install and `/health` check of `dist/` outside Docker | run locally |
| SIGTERM graceful shutdown | run locally (exit code 0) |
| `Dockerfile` | linted with hadolint only, never built |
| `docker-compose*.yml` | parsed with a YAML library and yamllint, `docker compose config` never run |
| GitHub Actions workflows | linted with actionlint only, never run on GitHub |
| PostgreSQL store and its integration test | written, never run (no Postgres available locally); first real run will be CI |

## Limitations

- Notes have no authentication, pagination or search.
- No schema migrations: the table is created with `CREATE TABLE IF NOT EXISTS` on startup.
  `gen_random_uuid()` needs PostgreSQL 13 or newer.
- `npm audit` reports advisories in Newman's dependency tree (dev dependency only). The production
  install reports none.
- The compose override bind-mounts source and also defines a watch rule; use one workflow for editing, not both at once.
- Workflow action versions are pinned to major tags, not commit SHAs.
