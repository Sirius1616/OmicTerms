#! /usr/bin/env bash
set -e
set -x

python -m app.backend_pre_start

bash scripts/test.sh "$@"
