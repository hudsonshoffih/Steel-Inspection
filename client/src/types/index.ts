export interface DefectItem {
  id?: number;
  sheet_id?: string;
  sheet_number?: string;
  defect_type: string;
  confidence?: number;
  bbox?: [number, number, number, number];
  length_m?: number;
  length_meter?: number;
  timestamp: string;
  image_path: string;
}

export interface InspectionStatus {
  is_inspecting: boolean;
  sheet_id: string;
  speed_mps: number;
  conf_threshold: number;
  source: "simulator" | "webcam";
  elapsed_seconds: number;
  current_length_m: number;
  defects_count: number;
  latest_defects: DefectItem[];
}

export interface DefectStats {
  total_defects: number;
  unique_sheets: number;
  breakdown: Record<string, number>;
  max_meter_recorded: number;
}

export interface ReportItem {
  sheet_id: string;
  filename: string;
  file_path: string;
  size_bytes: number;
  modified_time: string;
}

export interface ModelInfo {
  active_model: string;
  classes: Record<string, string>;
  available_models: Array<{ name: string; size_mb: number }>;
}

export interface UploadInspectionResponse {
  filename: string;
  width: number;
  height: number;
  defect_count: number;
  detections: DefectItem[];
  annotated_image: string;
}
