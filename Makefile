.PHONY: install dev lint typecheck test build api-test check docker-build docker-up docker-down lint-infra clean

install:
	cd service && npm ci

dev:
	cd service && npm run dev

lint:
	cd service && npm run lint

typecheck:
	cd service && npm run typecheck

test:
	cd service && npm test

build:
	cd service && npm run build

api-test: build
	cd service && npm run test:api

check: lint typecheck test build api-test

docker-build:
	docker build -t devops-service:local service

docker-up:
	test -f .env || cp .env.example .env
	docker compose up --build

docker-down:
	docker compose down

# Needs the Python tools from .venv: pip install actionlint-py yamllint hadolint-py
lint-infra:
	.venv/bin/actionlint .github/workflows/*.yml
	.venv/bin/hadolint service/Dockerfile
	.venv/bin/yamllint -d "{extends: relaxed, rules: {line-length: disable}}" docker-compose.yml docker-compose.override.yml .github

clean:
	rm -rf service/dist service/coverage
