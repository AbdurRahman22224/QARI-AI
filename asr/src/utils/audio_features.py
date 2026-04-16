"""
Audio Feature Extraction Engine for Qari AI.
Uses numpy/scipy for optimized frame-based analysis (RMS Energy, Spectral Centroid, Band Ratios).
25ms window, 10ms hop. Optimized for low-latency Word Lab training.
"""
import os
import subprocess
import numpy as np

def get_ffmpeg_path():
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        return 'ffmpeg'

def load_and_preprocess_audio(audio_path: str, sr: int = 16000):
    """
    Load audio, convert if necessary, normalize, and perform conservative silence trimming.
    Uses soundfile (C backend) — instant loading, no JIT.
    """
    import time
    t0 = time.time()
    ext = os.path.splitext(audio_path)[1].lower()
    wav_path = audio_path
    print(f"   [preprocess] Input: {audio_path} (ext={ext})", flush=True)
    
    if ext in ('.webm', '.ogg', '.opus', '.m4a', '.mp3'):
        wav_path = audio_path + '.wav'
        ffmpeg_exe = get_ffmpeg_path()
        print(f"   [preprocess] Converting {ext} with ffmpeg ({ffmpeg_exe})...", flush=True)
        try:
            result = subprocess.run(
                [ffmpeg_exe, '-y', '-i', audio_path, '-ar', str(sr), '-ac', '1', '-f', 'wav', wav_path],
                capture_output=True, text=True, timeout=30
            )
            
            if result.returncode != 0:
                error_msg = result.stderr if result.stderr else result.stdout
                print(f"❌ ffmpeg failed with code {result.returncode}", flush=True)
                print(f"   STDERR: {error_msg[:500]}", flush=True)  # First 500 chars
                if os.path.exists(wav_path):
                    os.unlink(wav_path)
                raise RuntimeError(f"ffmpeg conversion failed: {error_msg[:200]}")
            
            print(f"   [preprocess] ffmpeg done in {time.time()-t0:.2f}s", flush=True)
        except subprocess.TimeoutExpired:
            print(f"❌ ffmpeg TIMEOUT after 30s!", flush=True)
            if os.path.exists(wav_path):
                os.unlink(wav_path)
            raise RuntimeError("ffmpeg conversion timed out")
        except Exception as e:
            print(f"❌ ffmpeg conversion error: {str(e)}", flush=True)
            if os.path.exists(wav_path):
                os.unlink(wav_path)
            raise e
            
    try:
        t1 = time.time()
        import soundfile as sf
        audio, sample_rate = sf.read(wav_path, dtype='float32')
        
        # If stereo, take first channel
        if len(audio.shape) > 1:
            audio = audio[:, 0]
        
        # Resample if needed (ffmpeg should already output at target sr)
        if sample_rate != sr:
            print(f"   [preprocess] Resampling {sample_rate} → {sr}...", flush=True)
            from scipy.signal import resample
            num_samples = int(len(audio) * sr / sample_rate)
            audio = resample(audio, num_samples).astype(np.float32)
            
        print(f"   [preprocess] Audio loaded in {time.time()-t1:.2f}s ({len(audio)} samples, {len(audio)/sr:.2f}s)", flush=True)
        
        # Peak Normalization (scale to -1dB)
        max_val = np.max(np.abs(audio))
        if max_val > 1e-6:
            audio = audio * (0.89 / max_val)
            
        # Conservative silence trimming using RMS energy thresholding (pure numpy)
        t2 = time.time()
        frame_len = int(sr * 0.05)   # 50ms frames
        hop = int(sr * 0.025)        # 25ms hop
        threshold_db = 40
        threshold_linear = 10 ** (-threshold_db / 20.0)
        
        n_frames = max(1, 1 + (len(audio) - frame_len) // hop)
        frames_rms = np.array([
            np.sqrt(np.mean(audio[i*hop:i*hop+frame_len]**2))
            for i in range(n_frames)
        ])
        
        active = np.where(frames_rms > threshold_linear)[0]
        if len(active) > 0:
            start_sample = active[0] * hop
            end_sample = min(active[-1] * hop + frame_len, len(audio))
            trimmed_audio = audio[start_sample:end_sample]
            offset_time = float(start_sample) / sr
        else:
            trimmed_audio = audio
            offset_time = 0.0
            
        print(f"   [preprocess] Trim done in {time.time()-t2:.2f}s (kept {len(trimmed_audio)/sr:.2f}s)", flush=True)
        print(f"   [preprocess] TOTAL: {time.time()-t0:.2f}s", flush=True)
        
        return trimmed_audio, sr, offset_time
    finally:
        if ext != '.wav' and wav_path != audio_path and os.path.exists(wav_path):
            try:
                os.unlink(wav_path)
            except: pass


def extract_frame_features(audio: np.ndarray, sr: int = 16000):
    """
    Extract Frame-based Features using pure numpy/scipy.
    25ms window, 10ms hop.
    """
    import time
    t0 = time.time()
    
    win_length = int(sr * 0.025)  # 25ms = 400 samples at 16kHz
    hop_length = int(sr * 0.010)  # 10ms = 160 samples at 16kHz
    n_fft = 512
    
    # ── RMS Energy (pure numpy) ──
    n_frames = 1 + (len(audio) - win_length) // hop_length
    rms = np.array([
        np.sqrt(np.mean(audio[i*hop_length:i*hop_length+win_length]**2))
        for i in range(n_frames)
    ])
    
    # ── STFT (numpy FFT) ──
    window = np.hanning(win_length)
    stft_frames = []
    for i in range(n_frames):
        start = i * hop_length
        frame = audio[start:start+win_length]
        if len(frame) < n_fft:
            frame = np.pad(frame, (0, n_fft - len(frame)))
        windowed = frame[:win_length] * window
        if len(windowed) < n_fft:
            windowed = np.pad(windowed, (0, n_fft - len(windowed)))
        spectrum = np.abs(np.fft.rfft(windowed, n=n_fft))
        stft_frames.append(spectrum)
    
    stft = np.array(stft_frames).T  # shape: (n_fft//2+1, n_frames)
    freqs = np.fft.rfftfreq(n_fft, d=1.0/sr)
    
    # ── Spectral Centroid ──
    magnitude_sum = np.sum(stft, axis=0) + 1e-10
    centroid = np.sum(freqs[:, np.newaxis] * stft, axis=0) / magnitude_sum
    
    # ── Frequency Band Ratios ──
    low_idx = np.where((freqs >= 0) & (freqs <= 500))[0]
    nasal_idx = np.where((freqs >= 150) & (freqs <= 600))[0]
    
    total_energy = np.sum(stft**2, axis=0) + 1e-10
    low_freq_energy = np.sum(stft[low_idx, :]**2, axis=0)
    nasal_energy = np.sum(stft[nasal_idx, :]**2, axis=0)
    
    low_ratio = low_freq_energy / total_energy
    nasal_ratio = nasal_energy / total_energy
    
    # ── Temporal Smoothing ──
    def smooth(arr, window=5):
        return np.convolve(arr, np.ones(window)/window, mode='same')
    
    print(f"   [features] Extracted {n_frames} frames in {time.time()-t0:.2f}s", flush=True)
    
    return {
        "rms": smooth(rms).tolist(),
        "centroid": smooth(centroid).tolist(),
        "low_ratio": smooth(low_ratio).tolist(),
        "nasal_ratio": smooth(nasal_ratio).tolist(),
        "hop_length": hop_length,
        "sr": sr
    }


def get_segment_features(frame_features: dict, start_time: float, end_time: float):
    """
    Get aggregated features for a specific time segment mapping to alignment.
    """
    sr = frame_features["sr"]
    hop_length = frame_features["hop_length"]
    
    if end_time <= start_time:
        end_time = start_time + 0.05
        
    start_frame = int(start_time * sr / hop_length)
    end_frame = int(end_time * sr / hop_length)
    
    start_frame = max(0, start_frame)
    end_frame = min(len(frame_features["rms"]), end_frame)
    
    if start_frame >= end_frame:
        start_frame = end_frame - 1 if end_frame > 0 else 0
        end_frame = start_frame + 1
        
    rms_frames = frame_features["rms"][start_frame:end_frame]
    
    return {
        "duration": end_time - start_time,
        "rms_mean": float(np.mean(rms_frames)) if rms_frames else 0.0,
        "rms_max": float(np.max(rms_frames)) if rms_frames else 0.0,
        "centroid_mean": float(np.mean(frame_features["centroid"][start_frame:end_frame])),
        "low_ratio_mean": float(np.mean(frame_features["low_ratio"][start_frame:end_frame])),
        "nasal_ratio_mean": float(np.mean(frame_features["nasal_ratio"][start_frame:end_frame])),
        "rms_frames": rms_frames
    }
