FROM python:3.14-slim

WORKDIR /app

COPY --from=ghcr.io/astral-sh/uv:latest /uv /usr/local/bin/uv

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
ENV PATH="/app/.venv/bin:$PATH"
COPY app ./app
COPY alembic.ini ./
COPY migration ./migration
COPY scripts ./scripts

RUN chmod +x scripts/prestart.sh

CMD [ "./scripts/prestart.sh" ]
