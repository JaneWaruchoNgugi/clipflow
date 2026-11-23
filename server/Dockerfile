# ClipFlow download server: FastAPI + yt-dlp + ffmpeg. Runs on Cloud Run (Firebase / Google Cloud).
FROM python:3.12-slim

RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY main.py .

ENV PORT=8080
# One worker keeps memory low; the app itself limits concurrent downloads.
CMD exec uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1 --timeout-keep-alive 75
