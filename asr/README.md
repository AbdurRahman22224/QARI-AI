---
title: Qari AI ASR
emoji: 🎤
colorFrom: green
colorTo: blue
sdk: docker
app_port: 7860
---

# Qari AI — Enhanced Arabic Speech-to-Text Analysis Service

This service provides real-time Tajweed and Arabic pronunciation analysis using Whisper "small" model.

## Deployment Details
- **Architecture**: Flask + faster-whisper
- **CPU Inference**: Optimized with int8 quantization
- **Memory**: Requires ~1GB RAM (HF Spaces provides 16GB free)
