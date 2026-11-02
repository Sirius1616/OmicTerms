#!/usr/bin/env bash

# Story 3 — test harness entry point. Runs under `uv run` so it works with
# only uv + Postgres/Docker available (no manual venv activation).
set -e
set -x

uv run coverage run -m pytest tests/
uv run coverage report
uv run coverage html --title "${@-coverage}"
