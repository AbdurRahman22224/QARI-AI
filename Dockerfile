FROM python:3.11-slim

RUN apt-get update && apt-get install -y ffmpeg && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Point to dependencies inside the asr folder
COPY asr/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt imageio-ffmpeg mutagen

# Copy everything from the asr directory into the container
COPY asr/ .

# HuggingFace Spaces expects port 7860
ENV PORT=7860
EXPOSE 7860

CMD ["python", "asr_service.py"]
