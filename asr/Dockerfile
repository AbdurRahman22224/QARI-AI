FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies separately for better caching
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt imageio-ffmpeg mutagen

COPY . .

# HuggingFace Spaces expects port 7860 by default, but we'll use the PORT env var
ENV PORT=7860
EXPOSE 7860

CMD ["python", "asr_service.py"]
