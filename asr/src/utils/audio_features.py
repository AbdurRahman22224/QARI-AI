"""
Audio Feature Extraction for Qari AI.
Uses librosa for loading audio, computing per-word durations, RMS energy,
MFCC similarity, and pause detection.
"""

import os
import subprocess
import tempfile
import numpy as np
import soundfile as sf


def load_audio(audio_path: str, sr: int = 16000):
    """
    Load audio file using librosa.
    For WebM files, converts to WAV first using ffmpeg (via imageio-ffmpeg).
    """
    ext = os.path.splitext(audio_path)[1].lower()

    if ext in ('.webm', '.ogg', '.opus', '.m4a', '.mp3'):
        # Convert to WAV first using the ffmpeg binary from imageio-ffmpeg
        try:
            import imageio_ffmpeg
            ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
        except ImportError:
            ffmpeg_path = 'ffmpeg'  # fallback to system ffmpeg

        wav_path = audio_path + '.wav'
        try:
            result = subprocess.run(
                [ffmpeg_path, '-y', '-i', audio_path, '-ar', str(sr), '-ac', '1', '-f', 'wav', wav_path],
                capture_output=True, check=True, timeout=30
            )
            import soundfile as sf
            audio, sample_rate = sf.read(wav_path)
            if audio.dtype != np.float32:
                audio = audio.astype(np.float32)
            
            # 🛡️ PEAK NORMALIZATION for converted files
            max_val = np.max(np.abs(audio))
            if max_val > 1e-6:
                audio = audio * (0.89 / max_val)

            return audio, sample_rate
        except Exception as e:
            print(f"❌ ffmpeg/librosa error: {str(e)}", flush=True)
            raise e
        finally:
            try:
                if os.path.exists(wav_path):
                    os.unlink(wav_path)
            except:
                pass
    else:
        import soundfile as sf
        audio, sample_rate = sf.read(audio_path)
        if audio.dtype != np.float32:
            audio = audio.astype(np.float32)

        # 🛡️ PEAK NORMALIZATION: Scale to -1dB (approx 0.89 scale)
        max_val = np.max(np.abs(audio))
        if max_val > 1e-6:
            audio = audio * (0.89 / max_val)
            
        return audio, sample_rate


def get_word_segment(audio: np.ndarray, sr: int, start: float, end: float) -> np.ndarray:
    """Extract audio segment for a specific word based on timestamps."""
    start_sample = int(start * sr)
    end_sample = int(end * sr)
    return audio[start_sample:end_sample]


def compute_rms_energy(segment: np.ndarray) -> float:
    """Compute RMS energy of an audio segment."""
    if len(segment) == 0:
        return 0.0
    return float(np.sqrt(np.mean(segment ** 2)))


def compute_band_energy(segment: np.ndarray, sr: int, min_freq: int, max_freq: int) -> float:
    """
    Compute energy in a specific frequency band using FFT.
    Applies Hanning window before FFT to reduce leakage.
    """
    if len(segment) < 2:
        return 0.0
    
    # Apply Hanning window
    windowed = segment * np.hanning(len(segment))
    
    # FFT
    fft_res = np.fft.rfft(windowed)
    freqs = np.fft.rfftfreq(len(segment), 1/sr)
    
    # Find indices for the band
    idx = np.where((freqs >= min_freq) & (freqs <= max_freq))[0]
    
    if len(idx) == 0:
        return 0.0
    
    # Energy in the band (sum of squares of magnitude)
    band_mag = np.abs(fft_res[idx])
    band_energy = np.sum(band_mag**2) / len(segment)
    
    return float(band_energy)


def silence_based_word_segments(audio: np.ndarray, sr: int, num_words: int) -> list:
    """
    Fallback: segment audio evenly when word timestamps are unavailable.
    """
    total_duration = len(audio) / sr
    return weighted_split_segments(total_duration, num_words)


def weighted_split_segments(total_duration: float, num_words: int) -> list:
    """
    Last-resort fallback: evenly split audio duration across word count.
    """
    if num_words == 0:
        return []
    word_duration = total_duration / num_words
    segments = []
    for i in range(num_words):
        segments.append({
            "start": round(i * word_duration, 2),
            "end": round((i + 1) * word_duration, 2),
        })
    return segments


def extract_word_features(audio: np.ndarray, sr: int, word_segments: list) -> list:
    """
    Extract audio features for each word segment.
    Optimized version: Performs a single FFT per segment to extract all frequency data.
    """
    features = []
    for seg in word_segments:
        segment_audio = get_word_segment(audio, sr, seg["start"], seg["end"])
        duration = seg["end"] - seg["start"]
        
        # Base energy
        rms = compute_rms_energy(segment_audio)
        
        low_freq_ratio = 0.0
        nasal_ratio = 0.0
        
        # Frequency domain features (Optimized: One FFT per segment)
        if len(segment_audio) >= 2:
            windowed = segment_audio * np.hanning(len(segment_audio))
            fft_res = np.fft.rfft(windowed)
            freqs = np.fft.rfftfreq(len(segment_audio), 1/sr)
            magnitudes_sq = np.abs(fft_res)**2
            
            # Total energy in FFT domain
            total_fft_energy = np.sum(magnitudes_sq) / len(segment_audio)
            
            if total_fft_energy > 1e-10:
                # Tafkhim band (0-500Hz)
                low_freq_idx = np.where((freqs >= 0) & (freqs <= 500))[0]
                low_freq_energy = np.sum(magnitudes_sq[low_freq_idx]) / len(segment_audio) if len(low_freq_idx) > 0 else 0.0
                low_freq_ratio = low_freq_energy / total_fft_energy
                
                # Nasal band (200-400Hz)
                nasal_idx = np.where((freqs >= 200) & (freqs <= 400))[0]
                nasal_energy = np.sum(magnitudes_sq[nasal_idx]) / len(segment_audio) if len(nasal_idx) > 0 else 0.0
                nasal_ratio = nasal_energy / total_fft_energy
                
        # Variation score (std / (mean + eps))
        abs_seg = np.abs(segment_audio)
        mean_val = np.mean(abs_seg) if len(abs_seg) > 0 else 0.0
        std_val = np.std(abs_seg) if len(abs_seg) > 0 else 0.0
        variation_score = std_val / (mean_val + 1e-6)
        
        features.append({
            "start": seg["start"],
            "end": seg["end"],
            "duration": round(duration, 3),
            "rms_energy": round(rms, 5),
            "variation_score": round(float(variation_score), 4),
            "low_freq_ratio": round(float(low_freq_ratio), 4),
            "nasal_ratio": round(float(nasal_ratio), 4)
        })
    
    return features
