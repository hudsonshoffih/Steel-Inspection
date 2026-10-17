# 🏭 SAIL Steel Defect Inspection Web Application

A modern, production-grade web application for automated steel surface defect detection, meter-based defective position tracking, SQLite persistence, and automated Excel audit report generation.

Powered by **Python (YOLOv8 + OpenCV + PyTorch)**, **Node.js & TypeScript (Express Gateway & Microservice Supervisor)**, and **React + TypeScript + Tailwind CSS (Industrial Control Room Dashboard)**.

---

## 🌟 Key Capabilities

1. **Dual Mode Optical Vision Feed**:
   - **Real-Time Webcam (`/dev/video0`)**: Connects directly to shopfloor cameras for live steel coil inspection.
   - **Conveyor Simulation Engine**: Simulates moving conveyor motion with real steel surface defect textures from the training and validation dataset (`Dent`, `Hole`, `Scratch`), ensuring full functionality in any testing or remote environment.
2. **Physical Meter Tracking Engine**:
   - Computes physical defect location along continuous sheets: $\text{Length} = \text{Speed} \times \Delta t$ with configurable line velocity (e.g. 50 m/s).
3. **Automated Defect Persistence**:
   - Logs defect metadata (timestamp, physical meter marker, defect class, confidence score, crop image path) directly to SQLite database (`defects.db`).
   - Automatically crops defect bounding boxes and stores high-resolution snapshots under `reports/<sheet_id>/images/`.
4. **Excel Quality Audit Reports**:
   - Automatically compiles formatted `.xlsx` spreadsheets with defect records, confidence percentages, and coil quality summaries via OpenPyXL and Pandas.
5. **Interactive Single / Batch Image Inspector**:
   - Upload any steel sheet photo for immediate YOLO inference, side-by-side comparison, and bounding box localization.
6. **Unified Production Architecture**:
   - Single command boots the Node.js TypeScript API Gateway, which automatically initializes and supervises the Python AI engine in the background while serving the compiled React frontend.

---

## 🏗️ Architecture

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   React + TypeScript + Tailwind UI                    │
│   (Live Video Stream, Real-Time HUD, Defect Radar, Database Explorer)  │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTP / REST / MJPEG Stream (Port 5000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│              Node.js + Express + TypeScript Gateway                    │
│   - Python AI Microservice Supervisor                                 │
│   - Static Asset Server (`client/dist`)                               │
│   - Request Proxying & Session Management                             │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ IPC / Loopback HTTP (Port 8000)
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│               Python AI Inference Engine (FastAPI + YOLOv8)            │
│   - Model: runs/detect/train5/weights/best.pt                          │
│   - Classes: Dent, Hole, Scratch                                      │
│   - Physical Meter Tracking: utils.meter_tracker                       │
│   - Database: SQLite (defects.db)                                      │
│   - Reports: reports/<sheet_id>/<sheet_id>.xlsx                       │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites
- **Python**: 3.10+ with `ultralytics`, `torch`, `opencv-python`, `fastapi`, `uvicorn`, `pandas`, `openpyxl` (already installed in `../venv`).
- **Node.js**: v18+ with `npm`.

### Quick Start (Production Mode)

From the `steel-inspector-web/` directory:

```bash
# 1. Build client and server bundles
npm run build

# 2. Start the unified production web application
npm start
```

Open your browser and navigate to:
👉 **`http://localhost:5000`**

The Node.js server automatically starts and monitors the Python AI service on port 8000, proxies requests, and serves the dashboard.

---

### Development Mode

To run both services concurrently with hot-reloading:

```bash
npm run dev
```

- Web Dashboard (Vite): `http://localhost:3000`
- API Gateway (Node.js): `http://localhost:5000`
- Python AI Engine (FastAPI): `http://localhost:8000`

---

## 📂 Directory Structure

```text
steel-inspector-web/
├── ai_service/                    # Python AI & Computer Vision Service
│   ├── app.py                     # FastAPI application & REST endpoints
│   ├── detector.py                # YOLOv8 defect detection & bbox renderer
│   ├── meter_tracker.py           # Physical conveyor distance tracking
│   ├── streamer.py                # MJPEG video stream (Webcam + Simulator)
│   ├── db.py                      # SQLite database operations & analytics
│   ├── report_exporter.py         # Automated Excel (.xlsx) report generation
│   └── requirements.txt           # Python dependencies
│
├── server/                        # Node.js + TypeScript Gateway
│   ├── src/
│   │   ├── index.ts               # Express gateway server entry
│   │   ├── config.ts              # Configuration & environment paths
│   │   └── services/
│   │       └── pythonSupervisor.ts# Process manager for Python AI engine
│   ├── package.json
│   └── tsconfig.json
│
├── client/                        # React + TypeScript + Tailwind CSS Frontend
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.tsx         # Top industrial header & clock
│   │   │   ├── LiveInspection.tsx # Real-time inspection & video canvas
│   │   │   ├── DefectDatabase.tsx # SQLite database explorer & modal
│   │   │   ├── AnalyticsReports.tsx # Defect metrics & Excel downloads
│   │   │   ├── ImageUploadInspector.tsx # Image upload & detection view
│   │   │   └── SystemSettings.tsx # Model selection & runtime specs
│   │   ├── services/api.ts        # Typed API service
│   │   ├── types/index.ts         # TypeScript definitions
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── package.json                   # Root orchestrator scripts
└── README.md
```

---

## 📡 REST API Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Health check and active YOLO model information |
| `POST` | `/api/inspection/start` | Start inspection session (`sheet_id`, `speed_mps`, `source`, `conf_threshold`) |
| `POST` | `/api/inspection/stop` | Stop inspection, finalize meter length, and compile `.xlsx` report |
| `GET` | `/api/inspection/status` | Real-time session telemetry (speed, meters, defect count) |
| `GET` | `/api/inspection/stream` | Live multipart MJPEG video stream with YOLO bounding boxes |
| `GET` | `/api/inspection/defects` | List defects identified in current session |
| `POST` | `/api/inspect/image` | Upload image for instant YOLO detection & base64 visualization |
| `GET` | `/api/database/defects` | Query SQLite historical defect records (`sheet_number`, `defect_type`) |
| `GET` | `/api/database/stats` | KPI stats (total defects, unique sheets, distribution) |
| `GET` | `/api/reports` | List all compiled Excel reports in `reports/` |
| `GET` | `/api/reports/download/:sheet_id` | Download `.xlsx` spreadsheet for a sheet ID |
| `GET` | `/api/models` | List available YOLO model weight checkpoints |
| `POST` | `/api/models/select` | Dynamically switch active model checkpoint |
