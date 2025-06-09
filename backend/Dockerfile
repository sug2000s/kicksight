FROM python:3.13-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app
COPY .env .env
COPY quicksight_agent_config.json quicksight_agent_config.json

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]