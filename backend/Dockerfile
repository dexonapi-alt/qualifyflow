FROM python:3.14-slim
WORKDIR /app
COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev
COPY app ./app
COPY migrations ./migrations
COPY alembic.ini ./
ENV PATH="/app/.venv/bin:$PATH"
RUN useradd --create-home app && chown -R app:app /app
USER app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0"]
