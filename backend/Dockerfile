FROM python:3.14-slim

# uv binary without installing pip-based tooling into the final image.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# tiny-swara's phonemizer needs espeak-ng on PATH.
RUN apt-get update \
 && apt-get install -y --no-install-recommends espeak-ng \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY app ./app
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

ENTRYPOINT ["docker-entrypoint.sh"]
