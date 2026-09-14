FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/chatgpt-plugin/mcp-server/src

WORKDIR /app
COPY chatgpt-plugin/mcp-server/pyproject.toml /tmp/pyproject.toml
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir 'fastmcp>=2.0,<3.0'
COPY . /app

USER 65532:65532
EXPOSE 8000
CMD ["python", "chatgpt-plugin/mcp-server/src/server.py"]
