import os
import cv2
import time
import glob
import random
import threading
import numpy as np
from typing import Optional, List, Dict, Any, Generator

from detector import DefectDetector
from meter_tracker import MeterTracker
from report_exporter import generate_excel_report

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

class VideoStreamManager:
    def __init__(self, detector: DefectDetector):
        self.detector = detector
        self.tracker = MeterTracker(sheet_number="READY", speed_m_per_sec=50.0)

        # Inspection session state
        self.is_inspecting = False
        self.sheet_id = "COIL-A101"
        self.speed_mps = 50.0
        self.conf_threshold = 0.08
        self.source = "simulator"  # "webcam" or "simulator"

        self.session_defects: List[Dict[str, Any]] = []
        self.latest_frame: Optional[np.ndarray] = None
        self.latest_detections: List[Dict[str, Any]] = []
        self.lock = threading.Lock()

        # Pre-load sample images for simulator
        self.sample_images: List[str] = []
        self._load_simulator_samples()
        self.sim_index = 0
        self.sim_last_switch = time.time()
        self.sim_scroll_y = 0

        # Physical camera capture object
        self.cap: Optional[cv2.VideoCapture] = None

    def _load_simulator_samples(self):
        local_samples = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "sample_data", "*.jpg"))
        patterns = [
            local_samples,
            os.path.join(BASE_DIR, "dataset", "train", "images", "*.jpg"),
            os.path.join(BASE_DIR, "dataset", "val", "images", "*.jpg"),
            os.path.join(BASE_DIR, "data_collection", "collected", "**", "*.jpg")
        ]
        files = []
        for p in patterns:
            files.extend(glob.glob(p, recursive=True))
        
        # Filter valid readable images
        self.sample_images = sorted(list(set(files)))
        print(f"📦 Loaded {len(self.sample_images)} steel surface samples for simulator.")

    def start_inspection(self, sheet_id: str, speed_mps: float = 50.0, conf_threshold: float = 0.08, source: str = "simulator") -> Dict[str, Any]:
        with self.lock:
            self.sheet_id = sheet_id.strip() or f"COIL-{int(time.time())}"
            self.speed_mps = float(speed_mps)
            self.conf_threshold = float(conf_threshold)
            self.source = source.lower()
            self.session_defects = []
            self.latest_detections = []
            self.is_inspecting = True

            self.tracker.start(sheet_number=self.sheet_id, speed_m_per_sec=self.speed_mps)

            if self.source == "webcam":
                if self.cap is None or not self.cap.isOpened():
                    self.cap = cv2.VideoCapture(0)
                    if not self.cap.isOpened():
                        print("⚠️ Cannot open webcam 0. Falling back to simulator.")
                        self.source = "simulator"

        return {
            "status": "started",
            "sheet_id": self.sheet_id,
            "speed_mps": self.speed_mps,
            "conf_threshold": self.conf_threshold,
            "source": self.source
        }

    def stop_inspection(self) -> Dict[str, Any]:
        with self.lock:
            if not self.is_inspecting:
                return {"status": "already_stopped", "report_path": None, "total_defects": 0, "total_length_m": 0.0}

            total_length = self.tracker.stop()
            self.is_inspecting = False

            if self.cap is not None:
                self.cap.release()
                self.cap = None

            # Generate Excel report
            report_path = generate_excel_report(self.sheet_id, self.session_defects)
            total_defects = len(self.session_defects)
            sheet_id = self.sheet_id

        return {
            "status": "stopped",
            "sheet_id": sheet_id,
            "total_defects": total_defects,
            "total_length_m": total_length,
            "report_path": report_path
        }

    def get_status(self) -> Dict[str, Any]:
        with self.lock:
            elapsed = self.tracker.get_elapsed_seconds()
            length_m = self.tracker.get_length()
            return {
                "is_inspecting": self.is_inspecting,
                "sheet_id": self.sheet_id,
                "speed_mps": self.speed_mps,
                "conf_threshold": self.conf_threshold,
                "source": self.source,
                "elapsed_seconds": elapsed,
                "current_length_m": length_m,
                "defects_count": len(self.session_defects),
                "latest_defects": self.latest_detections
            }

    def _get_simulated_frame(self) -> np.ndarray:
        """Simulate a rolling steel sheet conveyor with sample defect textures."""
        if not self.sample_images:
            # Generate synthetic metallic sheet texture
            frame = np.full((640, 640, 3), 110, dtype=np.uint8)
            noise = np.random.randint(-15, 15, (640, 640, 3), dtype=np.int16)
            frame = np.clip(frame.astype(np.int16) + noise, 0, 255).astype(np.uint8)
            cv2.putText(frame, "SIMULATOR: NO SAMPLES FOUND", (80, 320), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (0, 0, 255), 2)
            return frame

        # Switch sample every 3.5 seconds
        now = time.time()
        if now - self.sim_last_switch > 3.5:
            self.sim_index = (self.sim_index + 1) % len(self.sample_images)
            self.sim_last_switch = now

        img_path = self.sample_images[self.sim_index]
        img = cv2.imread(img_path)
        if img is None:
            self.sim_index = (self.sim_index + 1) % len(self.sample_images)
            img = np.full((640, 640, 3), 120, dtype=np.uint8)

        img = cv2.resize(img, (640, 640))

        # Add vertical scrolling animation to emulate moving conveyor
        self.sim_scroll_y = (self.sim_scroll_y + 12) % 640
        rolled = np.roll(img, self.sim_scroll_y, axis=0)
        return rolled

    def _get_raw_frame(self) -> np.ndarray:
        if self.source == "webcam":
            if self.cap is None or not self.cap.isOpened():
                self.cap = cv2.VideoCapture(0)
            if self.cap.isOpened():
                ret, frame = self.cap.read()
                if ret and frame is not None:
                    return cv2.resize(frame, (640, 640))
            # If webcam fails, switch seamlessly to simulator
            return self._get_simulated_frame()
        else:
            return self._get_simulated_frame()

    def generate_mjpeg_stream(self) -> Generator[bytes, None, None]:
        fps_limit = 25
        frame_interval = 1.0 / fps_limit
        last_detect_time = 0.0

        while True:
            start_t = time.time()
            raw_frame = self._get_raw_frame()

            with self.lock:
                inspecting = self.is_inspecting
                sheet_id = self.sheet_id
                length_m = self.tracker.get_length()
                conf_thr = self.conf_threshold

            # Detect defects
            # Throttle inference to every 0.1s (~10 FPS inference, 25 FPS stream display)
            now = time.time()
            if now - last_detect_time > 0.09:
                annotated, detections = self.detector.detect_defects(
                    raw_frame,
                    conf_threshold=conf_thr,
                    sheet_id=sheet_id if inspecting else None,
                    length_m=length_m,
                    save_crop=inspecting
                )
                last_detect_time = now
                with self.lock:
                    self.latest_detections = detections
                    if inspecting and detections:
                        # Append new unique detections
                        self.session_defects.extend(detections)
            else:
                annotated = raw_frame.copy()

            # Render industrial heads-up display overlay
            h, w, _ = annotated.shape

            # Top HUD bar (semi-transparent dark bar)
            overlay = annotated.copy()
            cv2.rectangle(overlay, (0, 0), (w, 52), (18, 18, 20), -1)
            cv2.rectangle(overlay, (0, h - 36), (w, h), (18, 18, 20), -1)
            cv2.addWeighted(overlay, 0.75, annotated, 0.25, 0, annotated)

            # Top HUD text
            status_text = f"RUNNING [{self.source.upper()}]" if inspecting else f"STANDBY [{self.source.upper()}]"
            status_color = (0, 255, 120) if inspecting else (180, 180, 180)
            
            cv2.putText(annotated, f"SHEET: {sheet_id}", (12, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.65, (255, 255, 255), 2)
            cv2.putText(annotated, status_text, (260, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.55, status_color, 2)
            cv2.putText(annotated, f"CONF: {conf_thr:.2f}", (w - 140, 34), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (0, 220, 255), 2)

            # Bottom HUD text
            cv2.putText(annotated, f"LENGTH: {length_m:.2f} m", (12, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (0, 255, 120), 2)
            cv2.putText(annotated, f"SPEED: {self.speed_mps:.1f} m/s", (240, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 200, 200), 2)
            defects_cnt = len(self.session_defects) if inspecting else 0
            cv2.putText(annotated, f"DEFECTS: {defects_cnt}", (w - 160, h - 12), cv2.FONT_HERSHEY_SIMPLEX, 0.60, (0, 100, 255) if defects_cnt > 0 else (200, 200, 200), 2)

            # Save latest frame
            self.latest_frame = annotated

            # Encode as JPEG
            ret, buffer = cv2.imencode('.jpg', annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 80])
            if not ret:
                continue

            frame_bytes = buffer.tobytes()
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')

            # Maintain frame pacing
            elapsed_frame = time.time() - start_t
            sleep_time = max(0.005, frame_interval - elapsed_frame)
            time.sleep(sleep_time)
