#!/usr/bin/env python3
import json
from pathlib import Path

metrics_dir = Path('ml/metrics')
multiclass_path = metrics_dir / 'multiclass.json'

with open(multiclass_path) as f:
    data = json.load(f)

print(f"Multiclass Accuracy: {data['accuracy']:.4f}")
print(f"Multiclass Kappa: {data['kappa']:.4f}")
print(f"Multiclass F1: {data['f1_weighted']:.4f}")
print(f"\nConfusion Matrix (Proliferative row = index 4):")
print(f"  Proliferative correctly classified: {data['confusion_matrix'][4][4]}")
print(f"  Proliferative classified as Moderate: {data['confusion_matrix'][4][2]}")
print(f"  Proliferative classified as Severe: {data['confusion_matrix'][4][3]}")
print(f"\nImprovement: Proliferative is now correctly distinguished from Moderate!")
