def compute_timing_score(total_duration: float, reference_duration: float) -> float:
    if not reference_duration or reference_duration <= 0:
        return 0.0

    ratio = total_duration / max(reference_duration, 0.01)
    
    if 0.9 <= ratio <= 1.1:
        return 100.0
    
    if ratio < 0.9:
        # Rushing penalty: 200 points per 1.0 deviation
        deviation = 0.9 - ratio
        score = 100 - (deviation * 200)
    else:
        # Slow penalty: 60 points per 1.0 deviation
        deviation = ratio - 1.1
        score = 100 - (deviation * 60)
    
    return round(max(0, min(100, score)), 1)

print(f"Rushing (2s / 5s, ratio 0.4): {compute_timing_score(2, 5)}")
print(f"Slightly fast (4s / 5s, ratio 0.8): {compute_timing_score(4, 5)}")
print(f"Mastery (5s / 5s, ratio 1.0): {compute_timing_score(5, 5)}")
print(f"Slightly slow (6s / 5s, ratio 1.2): {compute_timing_score(6, 5)}")
print(f"Slow (10s / 5s, ratio 2.0): {compute_timing_score(10, 5)}")
print(f"Fallback (5s / 0s): {compute_timing_score(5, 0)}")
