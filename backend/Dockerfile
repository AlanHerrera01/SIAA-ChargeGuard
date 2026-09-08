FROM python:3.10-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

RUN addgroup --system app && adduser --system --ingroup app app

COPY backend/requirements.txt ./backend/requirements.txt
RUN pip install --no-cache-dir --requirement backend/requirements.txt

COPY --chown=app:app backend ./backend
COPY --chown=app:app agents ./agents
COPY --chown=app:app config.py ./config.py
COPY --chown=app:app datasets ./datasets

USER app

EXPOSE 8000

CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8000"]
