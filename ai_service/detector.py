import os
import cv2
import time
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from ultralytics import YOLO

from db import insert_defect

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOCAL_MODEL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "models", "best.pt"))
DEFAULT_MODEL_PATH = LOCAL_MODEL_PATH if os.path.exists(LOCAL_MODEL_PATH) else os.path.join(BASE_DIR, "runs", "detect", "train5", "weights", "best.pt")
FALLBACK_MODEL_PATH = os.path.join(BASE_DIR, "yolov8n.pt")
REPORTS_DIR = os.path.join(BASE_DIR, "reports")

# Color palette (BGR for OpenCV)
CLASS_COLORS = {
    "dent": (0, 165, 255),      # Orange
    "hole": (50, 50, 240),      # Crimson Red
    "scratch": (240, 200, 0),   # Cyan/Yellow
    "default": (0, 230, 100)    # Neon Green
}

class DefectDetector:
    def __init__(self, model_path: Optional[str] = None):
        self.model_path = model_path or (DEFAULT_MODEL_PATH if os.path.exists(DEFAULT_MODEL_PATH) else FALLBACK_MODEL_PATH)
        self.model = None
        self.load_model(self.model_path)

    def load_model(self, model_path: str):
        if not os.path.isabs(model_path):
            model_path = os.path.join(BASE_DIR, model_path)
        
        if not os.path.exists(model_path):
            if os.path.exists(DEFAULT_MODEL_PATH):
                model_path = DEFAULT_MODEL_PATH
            elif os.path.exists(FALLBACK_MODEL_PATH):
                model_path = FALLBACK_MODEL_PATH

        print(f"🔄 Loading YOLO model from: {model_path}")
        self.model = YOLO(model_path)
        self.model_path = model_path
        self.class_names = self.model.names if hasattr(self.model, "names") else {}
        print(f"✅ Loaded model with classes: {self.class_names}")

    def detect_defects(
        self,
        frame,
        conf_threshold: float = 0.08,
        sheet_id: Optional[str] = None,
        length_m: float = 0.0,
        save_crop: bool = True
    ) -> Tuple[Any, List[Dict[str, Any]]]:
        """
        Run detection on a single frame.
        Returns:
            annotated_frame (np.ndarray): Frame with custom high-contrast bounding boxes & labels
            detections (list): List of defect metadata dicts
        """
        if self.model is None:
            self.load_model(self.model_path)

        # Run inference
        results = self.model(frame, imgsz=640, conf=conf_threshold, verbose=False)
        annotated_frame = frame.copy()
        detections: List[Dict[str, Any]] = []

        now_str = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        time_tag = datetime.now().strftime("%Y%m%d_%H%M%S")

        if len(results) > 0 and len(results[0].boxes) > 0:
            boxes = results[0].boxes
            h, w, _ = frame.shape

            for idx, box in enumerate(boxes):
                cls_id = int(box.cls[0])
                conf_score = float(box.conf[0])
                defect_type = self.class_names.get(cls_id, f"Defect_{cls_id}")

                # Coordinates
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                x1 = max(0, min(x1, w - 1))
                y1 = max(0, min(y1, h - 1))
                x2 = max(0, min(x2, w - 1))
                y2 = max(0, min(y2, h - 1))

                # Color selection
                color = CLASS_COLORS.get(defect_type.lower(), CLASS_COLORS["default"])

                # Draw high-visibility industrial bounding box
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), color, 2)

                # Label banner
                label = f"{defect_type} {conf_score * 100:.1f}%"
                (tw, th), baseline = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 2)
                cv2.rectangle(
                    annotated_frame,
                    (x1, max(0, y1 - th - 8)),
                    (x1 + tw + 8, y1),
                    color,
                    -1
                )
                cv2.putText(
                    annotated_frame,
                    label,
                    (x1 + 4, max(th + 2, y1 - 4)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.55,
                    (0, 0, 0),
                    2
                )

                # Crop and persist image if in active sheet inspection
                image_rel_path = ""
                if save_crop and sheet_id:
                    crop_w = max(1, x2 - x1)
                    crop_h = max(1, y2 - y1)
                    cropped = frame[y1:y1 + crop_h, x1:x1 + crop_w]
                    
                    sheet_img_dir = os.path.join(REPORTS_DIR, sheet_id, "images")
                    os.makedirs(sheet_img_dir, exist_ok=True)
                    
                    filename = f"{sheet_id}_{defect_type}_{time_tag}_{idx}.jpg"
                    full_crop_path = os.path.join(sheet_img_dir, filename)
                    cv2.imwrite(full_crop_path, cropped)
                    
                    # Relative path for web/DB storage
                    image_rel_path = os.path.join("reports", sheet_id, "images", filename)
                    
                    # Insert into SQLite
                    insert_defect(
                        sheet_number=sheet_id,
                        defect_type=defect_type,
                        length_meter=length_m,
                        image_path=image_rel_path,
                        timestamp=now_str
                    )

                defect_info = {
                    "defect_type": defect_type,
                    "confidence": round(conf_score, 3),
                    "bbox": [x1, y1, x2, y2],
                    "length_m": round(length_m, 2),
                    "timestamp": now_str,
                    "image_path": image_rel_path,
                    "sheet_id": sheet_id
                }
                detections.append(defect_info)

        return annotated_frame, detections
