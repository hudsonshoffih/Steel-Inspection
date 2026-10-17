"""
Run YOUR trained model on the demo sample images and save the real detections,
so the Vercel demo can draw genuine bounding boxes.

Run from the repo root, with the same Python environment you use for ai_service:
    python scripts/export_demo_results.py
Then rebuild/redeploy the client (git add, commit, push).
"""
import json
import os
from ultralytics import YOLO

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
MODEL = os.path.join(ROOT, "models", "best.pt")
SAMPLES_JSON = os.path.join(ROOT, "client", "src", "demo", "samples.json")
IMAGES_DIR = os.path.join(ROOT, "client", "public", "samples")
CONF = 0.05  # low on purpose; the website's slider filters further

model = YOLO(MODEL)
names = model.names
samples = json.load(open(SAMPLES_JSON))

for s in samples:
    result = model(os.path.join(IMAGES_DIR, s["file"]), imgsz=640, conf=CONF, verbose=False)[0]
    s["detections"] = [
        {
            "defect_type": names[int(b.cls[0])],
            "confidence": round(float(b.conf[0]), 4),
            "bbox": [round(float(v)) for v in b.xyxy[0]],
        }
        for b in result.boxes
    ]
    print(f'{s["file"]}: {len(s["detections"])} detection(s)')

json.dump(samples, open(SAMPLES_JSON, "w"), indent=1)
print("Saved", SAMPLES_JSON)
