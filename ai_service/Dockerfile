FROM python:3.12-slim

WORKDIR /app

# Install dependencies first so Docker can cache this layer
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000
# Shell-form CMD (not exec-form ["..."]) so ${PORT:-8000} actually expands —
# Railway/Render inject their own dynamic PORT; falls back to 8000 for local
# Docker/docker-compose use where PORT is not set.
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
