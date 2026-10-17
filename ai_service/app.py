import os
import io
import cv2
import base64
import numpy as np
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Query, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from detector import DefectDetector, DEFAULT_MODEL_PATH, FALLBACK_MODEL_PATH
from streamer import VideoStreamManager
from db import init_db, get_all_defects, get_defects_by_sheet, get_defect_stats, delete_defect
from report_exporter import list_all_reports, REPORTS_DIR, generate_excel_report

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))

# Initialize Database Schema
init_db()

# Initialize AI Detector and Streamer
detector = DefectDetector()
streamer = VideoStreamManager(detector)

app = FastAPI(
    title="SAIL Steel Defect Inspection AI Service",
    description="Computer Vision & Deep Learning Engine for Automated Steel Sheet Quality Inspection",
    version="2.0.0"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount reports folder for cropped defect images
if not os.path.exists(REPORTS_DIR):
    os.makedirs(REPORTS_DIR, exist_ok=True)
app.mount("/reports", StaticFiles(directory=REPORTS_DIR), name="reports")

# Request Models
class StartInspectionRequest(BaseModel):
    sheet_id: str
    speed_mps: float = 50.0
    conf_threshold: float = 0.08
    source: str = "simulator"  # "simulator" or "webcam"

class ModelSelectRequest(BaseModel):
    model_path: str

# ----------------- Health & Info -----------------
@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "active_model": detector.model_path,
        "classes": detector.class_names,
        "is_inspecting": streamer.is_inspecting,
        "service": "Steel Defect Vision Engine"
    }

# ----------------- Inspection Session -----------------
@app.post("/api/inspection/start")
def start_inspection(req: StartInspectionRequest):
    result = streamer.start_inspection(
        sheet_id=req.sheet_id,
        speed_mps=req.speed_mps,
        conf_threshold=req.conf_threshold,
        source=req.source
    )
    return result

@app.post("/api/inspection/stop")
def stop_inspection():
    result = streamer.stop_inspection()
    return result

@app.get("/api/inspection/status")
def inspection_status():
    return streamer.get_status()

@app.get("/api/inspection/stream")
def video_stream():
    """Live MJPEG video stream with YOLO bounding boxes & telemetry HUD."""
    return StreamingResponse(
        streamer.generate_mjpeg_stream(),
        media_type="multipart/x-mixed-replace; boundary=frame"
    )

@app.get("/api/inspection/defects")
def current_defects():
    return {
        "sheet_id": streamer.sheet_id,
        "count": len(streamer.session_defects),
        "defects": streamer.session_defects
    }

# ----------------- Single / Batch Image Inspection -----------------
@app.post("/api/inspect/image")
async def inspect_uploaded_image(
    file: UploadFile = File(...),
    conf_threshold: float = Form(0.08),
    sheet_id: Optional[str] = Form("UPLOADED_SAMPLE")
):
    contents = await file.read()
    nparr = np.frombuffer(contents, np.uint8)
    image = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if image is None:
        raise HTTPException(status_code=400, detail="Invalid image file format.")

    annotated, detections = detector.detect_defects(
        frame=image,
        conf_threshold=conf_threshold,
        sheet_id=sheet_id,
        length_m=0.0,
        save_crop=False
    )

    # Encode annotated image as base64 JPEG
    ret, buffer = cv2.imencode(".jpg", annotated, [int(cv2.IMWRITE_JPEG_QUALITY), 90])
    base64_str = base64.b64encode(buffer).decode("utf-8")

    return {
        "filename": file.filename,
        "width": image.shape[1],
        "height": image.shape[0],
        "defect_count": len(detections),
        "detections": detections,
        "annotated_image": f"data:image/jpeg;base64,{base64_str}"
    }

# ----------------- Database & History -----------------
@app.get("/api/database/defects")
def list_logged_defects(
    sheet_number: Optional[str] = None,
    defect_type: Optional[str] = None,
    limit: int = 100,
    offset: int = 0
):
    defects = get_all_defects(sheet_number=sheet_number, defect_type=defect_type, limit=limit, offset=offset)
    return {"defects": defects, "count": len(defects)}

@app.get("/api/database/stats")
def database_statistics():
    return get_defect_stats()

@app.delete("/api/database/defects/{defect_id}")
def remove_defect_entry(defect_id: int):
    success = delete_defect(defect_id)
    if not success:
        raise HTTPException(status_code=404, detail="Defect record not found.")
    return {"status": "success", "deleted_id": defect_id}

# ----------------- Reports -----------------
@app.get("/api/reports")
def get_reports_list():
    return {"reports": list_all_reports()}

@app.get("/api/reports/download/{sheet_id}")
def download_excel_report(sheet_id: str):
    excel_path = os.path.join(REPORTS_DIR, sheet_id, f"{sheet_id}.xlsx")
    if not os.path.exists(excel_path):
        # Auto-generate from DB records if not already exported
        sheet_defects = get_defects_by_sheet(sheet_id)
        if sheet_defects:
            excel_path = generate_excel_report(sheet_id, sheet_defects)
        else:
            raise HTTPException(status_code=404, detail=f"No report or inspection data for sheet: {sheet_id}")

    return FileResponse(
        excel_path,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        filename=f"Steel_Inspection_Report_{sheet_id}.xlsx"
    )

# ----------------- Models & Training -----------------
@app.get("/api/models")
def list_available_models():
    models = []
    # Check runs
    runs_pattern = os.path.join(BASE_DIR, "runs", "detect", "**", "*.pt")
    import glob
    for pt in glob.glob(runs_pattern, recursive=True):
        if os.path.isfile(pt) and os.path.getsize(pt) > 1000:
            rel = os.path.relpath(pt, BASE_DIR)
            models.append({"name": rel, "size_mb": round(os.path.getsize(pt) / (1024 * 1024), 2)})
    
    # Check yolov8n.pt
    base_pt = os.path.join(BASE_DIR, "yolov8n.pt")
    if os.path.exists(base_pt):
        models.append({"name": "yolov8n.pt", "size_mb": round(os.path.getsize(base_pt) / (1024 * 1024), 2)})

    return {
        "active_model": os.path.relpath(detector.model_path, BASE_DIR) if detector.model_path else "None",
        "classes": detector.class_names,
        "available_models": models
    }

@app.post("/api/models/select")
def select_model(req: ModelSelectRequest):
    try:
        detector.load_model(req.model_path)
        return {
            "status": "success",
            "active_model": detector.model_path,
            "classes": detector.class_names
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to load model: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=False)
