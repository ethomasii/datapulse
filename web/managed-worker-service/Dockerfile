FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends git \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml verified-sources-requirements.txt ./
COPY verified_sources/ ./verified_sources/
COPY main.py agent_system_metrics.py dbt_executor.py ./

RUN pip install --no-cache-dir -U pip \
  && pip install --no-cache-dir \
    "fastapi>=0.115.0" \
    "httpx>=0.27.0" \
    "uvicorn[standard]>=0.32.0" \
    "dlt[motherduck]>=1.5.0" \
    "psutil>=6.0.0" \
  && pip install --no-cache-dir -r verified-sources-requirements.txt

ENV PORT=8080
EXPOSE 8080

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
