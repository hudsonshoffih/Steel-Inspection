// In-browser stand-in for the real API, used only when VITE_DEMO_MODE=true.
//
// What is REAL here:   the 148 defect rows (from your defects.db), the sample photos,
//                      and the meter formula  length = speed x elapsed time.
// What is SIMULATED:   the "live inspection". It replays the logged defect positions
//                      from your COIL-2026-A101 run. No YOLO model runs in the browser.
// Bounding boxes appear only if you ran scripts/export_demo_results.py (see README).
import seed from "./seed.json";
import samplesJson from "./samples.json";
import {
  DefectItem,
  DefectStats,
  InspectionStatus,
  ModelInfo,
  ReportItem,
  UploadInspectionResponse
} from "../types";

export interface DemoSample {
  file: string;
  original: string;
  hint: string | null;
  width: number;
  height: number;
  detections: Array<{ defect_type: string; confidence: number; bbox: [number, number, number, number] }> | null;
}

export const DEMO_SAMPLES: DemoSample[] = samplesJson as DemoSample[];

const REPLAY_SHEET = "COIL-2026-A101";
const BOX_COLORS: Record<string, string> = { dent: "#f59e0b", hole: "#f43f5e", scratch: "#22d3ee" };

// ---------- in-memory "database" (resets on page refresh) ----------
let db: DefectItem[] = (seed as any[]).map((r) => ({
  id: r.id,
  sheet_number: r.sheet_number,
  defect_type: r.defect_type,
  length_meter: r.length_meter,
  timestamp: r.timestamp,
  image_path: r.image_path
}));
let nextId = Math.max(0, ...db.map((d) => d.id ?? 0)) + 1;
const finishedSheets = new Map<string, { time: string; csv: string }>();

// Real log rows we replay during a demo session, in physical order along the coil.
const replayEvents = db
  .filter((d) => d.sheet_number === REPLAY_SHEET)
  .sort((a, b) => (a.length_meter ?? 0) - (b.length_meter ?? 0));

// The real coil had no defects until ~237 m. Shift positions so the first one appears at 5 m
// (the spacing between defects stays exactly as logged).
const REPLAY_OFFSET = (replayEvents[0]?.length_meter ?? 0) - 5;

// ---------- demo inspection session ----------
interface Session {
  sheet_id: string;
  speed_mps: number;
  conf_threshold: number;
  source: "simulator" | "webcam";
  startedAt: number; // performance.now() is monotonic, same idea as the real backend
  defects: DefectItem[];
  emitted: number;
}
let session: Session | null = null;

function nowStamp(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function advance(): void {
  if (!session) return;
  const length = session.speed_mps * ((performance.now() - session.startedAt) / 1000);
  while (session.emitted < replayEvents.length && replayEvents[session.emitted].length_meter! - REPLAY_OFFSET <= length) {
    const src = replayEvents[session.emitted];
    const item: DefectItem = {
      id: nextId++,
      sheet_number: session.sheet_id,
      sheet_id: session.sheet_id,
      defect_type: src.defect_type,
      length_m: src.length_meter! - REPLAY_OFFSET,
      length_meter: src.length_meter! - REPLAY_OFFSET,
      timestamp: nowStamp(),
      image_path: ""
    };
    session.defects.push(item);
    db.push(item);
    session.emitted += 1;
  }
}

export function demoStreamState() {
  advance();
  if (!session) return { active: false as const };
  const elapsed = (performance.now() - session.startedAt) / 1000;
  return {
    active: true as const,
    elapsed,
    length: session.speed_mps * elapsed,
    speed: session.speed_mps,
    sheet_id: session.sheet_id,
    last: session.defects.length ? session.defects[session.defects.length - 1] : null,
    count: session.defects.length
  };
}

export function pickSampleFor(type: string | undefined, salt: number): DemoSample {
  const matching = DEMO_SAMPLES.filter((s) => s.hint && type && s.hint.toLowerCase() === type.toLowerCase());
  const pool = matching.length ? matching : DEMO_SAMPLES;
  return pool[salt % pool.length];
}

// ---------- API-shaped functions ----------
export async function demoStatus(): Promise<InspectionStatus> {
  advance();
  if (!session) {
    return {
      is_inspecting: false, sheet_id: "", speed_mps: 0, conf_threshold: 0.08,
      source: "simulator", elapsed_seconds: 0, current_length_m: 0, defects_count: 0, latest_defects: []
    };
  }
  const elapsed = (performance.now() - session.startedAt) / 1000;
  return {
    is_inspecting: true,
    sheet_id: session.sheet_id,
    speed_mps: session.speed_mps,
    conf_threshold: session.conf_threshold,
    source: session.source,
    elapsed_seconds: elapsed,
    current_length_m: session.speed_mps * elapsed,
    defects_count: session.defects.length,
    latest_defects: session.defects.slice(-5)
  };
}

export async function demoStart(p: { sheet_id: string; speed_mps: number; conf_threshold: number; source: string }) {
  if (p.source === "webcam") {
    throw new Error("Webcam mode needs the real backend. Demo mode only has the conveyor simulator.");
  }
  session = {
    sheet_id: p.sheet_id.trim() || "DEMO-COIL",
    speed_mps: p.speed_mps,
    conf_threshold: p.conf_threshold,
    source: "simulator",
    startedAt: performance.now(),
    defects: [],
    emitted: 0
  };
  return { status: "started", sheet_id: session.sheet_id };
}

function toCsv(rows: DefectItem[]): string {
  const head = "ID,Sheet Number,Defect Type,Length (m),Timestamp";
  const body = rows.map((d) =>
    [d.id, `"${d.sheet_number ?? ""}"`, d.defect_type, (d.length_meter ?? d.length_m ?? 0).toFixed(2), d.timestamp].join(",")
  );
  return [head, ...body].join("\n");
}

export async function demoStop() {
  advance();
  if (!session) return { status: "already_stopped", report_path: null, total_defects: 0, total_length_m: 0 };
  const s = session;
  const total_length_m = s.speed_mps * ((performance.now() - s.startedAt) / 1000);
  finishedSheets.set(s.sheet_id, { time: nowStamp(), csv: toCsv(s.defects) });
  session = null;
  return {
    status: "stopped",
    sheet_id: s.sheet_id,
    total_defects: s.defects.length,
    total_length_m,
    report_path: `demo/${s.sheet_id}.csv`
  };
}

export async function demoCurrentDefects() {
  advance();
  return { sheet_id: session?.sheet_id ?? "", count: session?.defects.length ?? 0, defects: session?.defects ?? [] };
}

export async function demoLoggedDefects(params?: { sheet_number?: string; defect_type?: string; limit?: number; offset?: number }) {
  let rows = db.slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0));
  if (params?.sheet_number) {
    const q = params.sheet_number.toLowerCase();
    rows = rows.filter((d) => (d.sheet_number ?? "").toLowerCase().includes(q));
  }
  if (params?.defect_type && params.defect_type !== "ALL") {
    rows = rows.filter((d) => d.defect_type.toLowerCase() === params.defect_type!.toLowerCase());
  }
  const off = params?.offset ?? 0;
  rows = rows.slice(off, off + (params?.limit ?? 200));
  return { defects: rows, count: rows.length };
}

export async function demoStats(): Promise<DefectStats> {
  const breakdown: Record<string, number> = {};
  db.forEach((d) => { breakdown[d.defect_type] = (breakdown[d.defect_type] ?? 0) + 1; });
  return {
    total_defects: db.length,
    unique_sheets: new Set(db.map((d) => d.sheet_number)).size,
    breakdown,
    max_meter_recorded: Math.max(0, ...db.map((d) => d.length_meter ?? d.length_m ?? 0))
  };
}

export async function demoDelete(id: number) {
  db = db.filter((d) => d.id !== id);
  return { status: "success", deleted_id: id };
}

function sheetCsv(sheetId: string): string {
  const fin = finishedSheets.get(sheetId);
  if (fin) return fin.csv;
  return toCsv(db.filter((d) => d.sheet_number === sheetId));
}

export async function demoReports(): Promise<{ reports: ReportItem[] }> {
  const sheets = Array.from(new Set(db.map((d) => d.sheet_number ?? ""))).filter(Boolean);
  const reports = sheets.map((id) => {
    const csv = sheetCsv(id);
    return {
      sheet_id: id,
      filename: `${id}.csv`,
      file_path: `demo/${id}.csv`,
      size_bytes: csv.length,
      modified_time: finishedSheets.get(id)?.time ?? "from seed data"
    };
  });
  return { reports };
}

export function demoReportUrl(sheetId: string): string {
  return "data:text/csv;charset=utf-8," + encodeURIComponent(sheetCsv(sheetId));
}

export async function demoModels(): Promise<ModelInfo> {
  return {
    active_model: "models/best.pt (demo: not loaded)",
    classes: { "0": "Dent", "1": "Hole", "2": "Scratch" },
    available_models: [{ name: "models/best.pt", size_mb: 5.96 }]
  };
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load sample image."));
    img.src = url;
  });
}

export function drawBoxes(
  ctx: CanvasRenderingContext2D,
  boxes: NonNullable<DemoSample["detections"]>,
  scale: number,
  dx = 0,
  dy = 0
) {
  ctx.lineWidth = 2;
  ctx.font = "bold 12px monospace";
  boxes.forEach((b) => {
    const color = BOX_COLORS[b.defect_type.toLowerCase()] ?? "#34d399";
    const [x1, y1, x2, y2] = b.bbox;
    const label = `${b.defect_type} ${(b.confidence * 100).toFixed(1)}%`;
    ctx.strokeStyle = color;
    ctx.strokeRect(dx + x1 * scale, dy + y1 * scale, (x2 - x1) * scale, (y2 - y1) * scale);
    const w = ctx.measureText(label).width + 8;
    ctx.fillStyle = color;
    ctx.fillRect(dx + x1 * scale, dy + y1 * scale - 16, w, 16);
    ctx.fillStyle = "#000";
    ctx.fillText(label, dx + x1 * scale + 4, dy + y1 * scale - 4);
  });
}

export async function demoInspectSample(file: string, conf: number): Promise<UploadInspectionResponse> {
  const sample = DEMO_SAMPLES.find((s) => s.file === file);
  if (!sample) throw new Error("Unknown sample image.");
  if (!sample.detections) {
    throw new Error(
      "This site has no saved YOLO results for the sample images yet. " +
      "Run `python scripts/export_demo_results.py` once on your machine, rebuild, and redeploy."
    );
  }
  const img = await loadImage(`/samples/${sample.file}`);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.drawImage(img, 0, 0);
  const shown = sample.detections.filter((d) => d.confidence >= conf);
  drawBoxes(ctx, shown, 1);
  return {
    filename: sample.original,
    width: canvas.width,
    height: canvas.height,
    defect_count: shown.length,
    detections: shown.map((d) => ({ defect_type: d.defect_type, confidence: d.confidence, bbox: d.bbox, timestamp: "", image_path: "" })),
    annotated_image: canvas.toDataURL("image/jpeg", 0.9)
  };
}
