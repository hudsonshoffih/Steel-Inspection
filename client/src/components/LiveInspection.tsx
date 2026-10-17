import { useState, useEffect, useRef } from "react";
import {
  Play,
  Square,
  AlertTriangle,
  Camera,
  Cpu,
  Gauge,
  Clock,
  Ruler,
  Download,
  CheckCircle2,
  RefreshCw
} from "lucide-react";
import {
  fetchInspectionStatus,
  startInspection,
  stopInspection,
  fetchCurrentDefects,
  getStreamUrl,
  getExcelDownloadUrl,
  getReportFilename,
  getAssetUrl
} from "../services/api";
import { DEMO_MODE } from "../config";
import { DemoStream } from "../demo/DemoStream";
import { DefectItem, InspectionStatus } from "../types";

export const LiveInspection: React.FC = () => {
  const [status, setStatus] = useState<InspectionStatus | null>(null);
  const [sheetId, setSheetId] = useState<string>("COIL-2026-A101");
  const [speedMps, setSpeedMps] = useState<number>(50.0);
  const [confThreshold, setConfThreshold] = useState<number>(0.08);
  const [source, setSource] = useState<"simulator" | "webcam">("simulator");
  const [sessionDefects, setSessionDefects] = useState<DefectItem[]>([]);
  const [latestAlert, setLatestAlert] = useState<DefectItem | null>(null);
  const [reportResult, setReportResult] = useState<{
    sheet_id: string;
    total_defects: number;
    total_length_m: number;
    report_path: string;
  } | null>(null);

  const [streamKey, setStreamKey] = useState<number>(Date.now());
  const [streamLoading, setStreamLoading] = useState<boolean>(true);
  const videoRef = useRef<HTMLImageElement>(null);
  const lastDefectCountRef = useRef<number>(0);

  // Poll inspection status every 500ms
  useEffect(() => {
    let isMounted = true;
    const poll = async () => {
      try {
        const s = await fetchInspectionStatus();
        if (!isMounted) return;
        setStatus(s);

        if (s.is_inspecting) {
          // Poll current defects
          const defRes = await fetchCurrentDefects();
          if (!isMounted) return;
          setSessionDefects(defRes.defects);

          // Check if new defects arrived
          if (defRes.defects.length > lastDefectCountRef.current) {
            const newest = defRes.defects[defRes.defects.length - 1];
            setLatestAlert(newest);
            lastDefectCountRef.current = defRes.defects.length;
          }
        }
      } catch (err) {
        console.error("Status polling error:", err);
      }
    };

    poll();
    const interval = setInterval(poll, 600);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  const handleStart = async () => {
    try {
      setReportResult(null);
      lastDefectCountRef.current = 0;
      setSessionDefects([]);
      await startInspection({
        sheet_id: sheetId,
        speed_mps: speedMps,
        conf_threshold: confThreshold,
        source: source
      });
      setStreamKey(Date.now());
      const s = await fetchInspectionStatus();
      setStatus(s);
    } catch (err) {
      alert("Failed to start inspection: " + String(err));
    }
  };

  const handleStop = async () => {
    try {
      const res = await stopInspection();
      setReportResult(res);
      const s = await fetchInspectionStatus();
      setStatus(s);
      setLatestAlert(null);
    } catch (err) {
      alert("Failed to stop inspection: " + String(err));
    }
  };

  const isInspecting = status?.is_inspecting || false;

  const getDefectBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case "dent":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "hole":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "scratch":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      default:
        return "bg-emerald-500/20 text-emerald-400 border-emerald-500/40";
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Alert when defect is detected */}
      {latestAlert && isInspecting && (
        <div className="bg-rose-950/80 border-2 border-rose-500/80 rounded-xl p-4 shadow-xl shadow-rose-950/50 animate-bounce flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-rose-600 rounded-lg text-white">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg text-rose-200">DEFECT DETECTED:</span>
                <span className={`px-2.5 py-0.5 rounded text-sm font-extrabold uppercase border ${getDefectBadgeColor(latestAlert.defect_type)}`}>
                  {latestAlert.defect_type}
                </span>
                {latestAlert.confidence !== undefined && (
                  <span className="text-xs text-rose-300 font-mono">
                    ({Math.round(latestAlert.confidence * 100)}% Conf)
                  </span>
                )}
              </div>
              <p className="text-sm text-rose-300/80">
                Location on sheet: <span className="font-mono font-bold text-white">{latestAlert.length_m?.toFixed(2)} meters</span> | Time: {latestAlert.timestamp}
              </p>
            </div>
          </div>
          <button
            onClick={() => setLatestAlert(null)}
            className="text-rose-400 hover:text-white px-3 py-1 text-xs font-semibold rounded bg-rose-900/60 border border-rose-700"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Inspection Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Live Video Canvas (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0f1726] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl relative">
            {/* Stream Header */}
            <div className="bg-slate-900/90 px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <Camera className="h-4 w-4 text-cyan-400" />
                <span className="text-sm font-semibold text-slate-200">Conveyor Optical Camera Feed (640x640)</span>
              </div>
              <div className="flex items-center space-x-3">
                <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                  {source === "simulator" ? "SIMULATOR: HIGH-SPEED CONVEYOR" : "WEBCAM: /dev/video0"}
                </span>
                <button
                  onClick={() => setStreamKey(Date.now())}
                  title="Reload Stream"
                  className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Video Viewport */}
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              {DEMO_MODE ? (
                <DemoStream onReady={() => setStreamLoading(false)} />
              ) : (
                <img
                  key={streamKey}
                  ref={videoRef}
                  src={`${getStreamUrl()}?t=${streamKey}`}
                  alt="Live Inspection Stream"
                  className="w-full h-full object-contain"
                  onLoad={() => setStreamLoading(false)}
                  onError={() => setStreamLoading(false)}
                />
              )}

              {streamLoading && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950/80 backdrop-blur-xs">
                  <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin mb-2" />
                  <span className="text-xs text-slate-300 font-mono">Initializing Neural Vision Stream...</span>
                </div>
              )}

              {/* Status Indicator Watermark */}
              <div className="absolute top-4 left-4 flex items-center space-x-2 bg-slate-950/75 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
                <div className={`h-2.5 w-2.5 rounded-full ${isInspecting ? "bg-emerald-500 animate-ping" : "bg-amber-500"}`} />
                <span className="font-bold text-white">{isInspecting ? "STREAM ACTIVE" : "CAMERA STANDBY"}</span>
              </div>
            </div>

            {/* Bottom Stream Telemetry Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-4 bg-slate-900/90 border-t border-slate-800 p-3 gap-3">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  <Clock className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Elapsed Time</div>
                  <div className="text-sm font-mono font-bold text-white">
                    {status?.elapsed_seconds ? `${status.elapsed_seconds.toFixed(1)}s` : "0.0s"}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  <Ruler className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Position Along Sheet</div>
                  <div className="text-sm font-mono font-bold text-emerald-400">
                    {status?.current_length_m ? `${status.current_length_m.toFixed(2)} m` : "0.00 m"}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                  <Gauge className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Conveyor Speed</div>
                  <div className="text-sm font-mono font-bold text-slate-200">
                    {status?.speed_mps ? `${status.speed_mps.toFixed(1)} m/s` : `${speedMps.toFixed(1)} m/s`}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  <AlertTriangle className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-[10px] uppercase font-bold text-slate-400">Defects Logged</div>
                  <div className="text-sm font-mono font-bold text-amber-400">
                    {sessionDefects.length}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Real-time Defect Event Stream Table */}
          <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-5 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">Current Session Defect Log</h3>
              </div>
              <span className="text-xs font-mono text-slate-400">
                Total Events: <span className="font-bold text-white">{sessionDefects.length}</span>
              </span>
            </div>

            {sessionDefects.length === 0 ? (
              <div className="py-8 text-center border border-dashed border-slate-800 rounded-xl">
                <CheckCircle2 className="h-8 w-8 text-slate-600 mx-auto mb-2" />
                <p className="text-sm text-slate-400">No defects detected on current coil.</p>
                <p className="text-xs text-slate-600 mt-1">Defect events (Dent, Hole, Scratch) will appear here live.</p>
              </div>
            ) : (
              <div className="overflow-x-auto max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 uppercase font-mono sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Defect Type</th>
                      <th className="py-2.5 px-3">Meter Position</th>
                      <th className="py-2.5 px-3">Confidence</th>
                      <th className="py-2.5 px-3">Timestamp</th>
                      <th className="py-2.5 px-3 text-right">Snapshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-mono">
                    {sessionDefects.slice().reverse().map((d, i) => (
                      <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-2.5 px-3 text-slate-500">{sessionDefects.length - i}</td>
                        <td className="py-2.5 px-3">
                          <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase border ${getDefectBadgeColor(d.defect_type)}`}>
                            {d.defect_type}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-400">
                          {d.length_m?.toFixed(2)} m
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {d.confidence !== undefined ? `${Math.round(d.confidence * 100)}%` : "n/a"}
                        </td>
                        <td className="py-2.5 px-3 text-slate-400">
                          {d.timestamp}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {d.image_path ? (
                            <a
                              href={getAssetUrl(d.image_path)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-cyan-400 hover:text-cyan-300 underline font-sans text-xs"
                            >
                              View Crop
                            </a>
                          ) : (
                            <span className="text-slate-600">Saved</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Controls & Configuration Panel */}
        <div className="space-y-6">
          {/* Main Inspection Control Card */}
          <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
            <div>
              <h3 className="text-base font-bold text-white tracking-tight">Inspection Control Console</h3>
              <p className="text-xs text-slate-400 mt-0.5">Configure sheet metadata and start AI vision loop.</p>
            </div>

            {/* Coil / Sheet Number Input */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Sheet / Coil Number
              </label>
              <input
                type="text"
                disabled={isInspecting}
                value={sheetId}
                onChange={(e) => setSheetId(e.target.value)}
                placeholder="e.g. COIL-2026-B40"
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 disabled:opacity-60"
              />
            </div>

            {/* Video Feed Source Toggle */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
                Camera / Video Source
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={isInspecting}
                  onClick={() => setSource("simulator")}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    source === "simulator"
                      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-md shadow-cyan-950"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  Conveyor Simulator
                </button>
                <button
                  type="button"
                  disabled={isInspecting}
                  onClick={() => setSource("webcam")}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${
                    source === "webcam"
                      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/50 shadow-md shadow-cyan-950"
                      : "bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  Physical Webcam (0)
                </button>
              </div>
            </div>

            {/* Conveyor Speed (m/s) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-slate-300">Conveyor Speed</span>
                <span className="font-mono font-bold text-cyan-400">{speedMps} m/s</span>
              </div>
              <input
                type="range"
                min="5"
                max="120"
                step="5"
                disabled={isInspecting}
                value={speedMps}
                onChange={(e) => setSpeedMps(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
              <div className="flex space-x-2 pt-1">
                {[25, 50, 75, 100].map((spd) => (
                  <button
                    key={spd}
                    type="button"
                    disabled={isInspecting}
                    onClick={() => setSpeedMps(spd)}
                    className="flex-1 py-1 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-400 hover:text-slate-200"
                  >
                    {spd}m/s
                  </button>
                ))}
              </div>
            </div>

            {/* Confidence Threshold */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold uppercase tracking-wider text-slate-300">AI Confidence Threshold</span>
                <span className="font-mono font-bold text-amber-400">{Math.round(confThreshold * 100)}%</span>
              </div>
              <input
                type="range"
                min="0.02"
                max="0.80"
                step="0.02"
                disabled={isInspecting}
                value={confThreshold}
                onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
              />
              <p className="text-[11px] text-slate-500">
                Default 8% (0.08) calibrated for micro-scratches and minor surface dents.
              </p>
            </div>

            {/* Start / Stop Buttons */}
            <div className="pt-3">
              {!isInspecting ? (
                <button
                  onClick={handleStart}
                  className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-lg shadow-emerald-950/60 transition-all cursor-pointer"
                >
                  <Play className="h-5 w-5 fill-current" />
                  <span>START INSPECTION</span>
                </button>
              ) : (
                <button
                  onClick={handleStop}
                  className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white font-bold text-sm shadow-lg shadow-rose-950/60 transition-all cursor-pointer animate-pulse"
                >
                  <Square className="h-5 w-5 fill-current" />
                  <span>STOP & GENERATE REPORT</span>
                </button>
              )}
            </div>
          </div>

          {/* Inspection Report Generated Card */}
          {reportResult && (
            <div className="bg-gradient-to-br from-slate-900 to-emerald-950/50 border border-emerald-500/40 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                <div>
                  <h4 className="text-sm font-bold text-white">Inspection Completed!</h4>
                  <p className="text-xs text-emerald-300/80">Audit report compiled & persisted.</p>
                </div>
              </div>

              <div className="bg-slate-950/70 p-3 rounded-xl space-y-1.5 text-xs font-mono">
                <div className="flex justify-between">
                  <span className="text-slate-400">Sheet ID:</span>
                  <span className="text-white font-bold">{reportResult.sheet_id}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Length:</span>
                  <span className="text-emerald-400 font-bold">{reportResult.total_length_m?.toFixed(2)} m</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Defects:</span>
                  <span className="text-amber-400 font-bold">{reportResult.total_defects}</span>
                </div>
              </div>

              <a
                href={getExcelDownloadUrl(reportResult.sheet_id)}
                download={getReportFilename(reportResult.sheet_id)}
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-all"
              >
                <Download className="h-4 w-4" />
                <span>{DEMO_MODE ? "DOWNLOAD REPORT (.CSV, DEMO)" : "DOWNLOAD EXCEL AUDIT (.XLSX)"}</span>
              </a>
            </div>
          )}

          {/* Model & AI Engine Quick Info */}
          <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3">
            <div className="flex items-center space-x-2 text-xs font-bold text-slate-300 uppercase tracking-wider">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <span>Inspection Neural Pipeline</span>
            </div>
            <div className="space-y-2 text-xs font-mono text-slate-400">
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span>Model:</span>
                <span className="text-slate-200">YOLOv8 Fine-Tuned</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span>Target Classes:</span>
                <span className="text-cyan-400 font-semibold">Dent, Hole, Scratch</span>
              </div>
              <div className="flex justify-between border-b border-slate-800/80 pb-1.5">
                <span>Resolution:</span>
                <span className="text-slate-200">640 × 640 px</span>
              </div>
              <div className="flex justify-between">
                <span>Audit Storage:</span>
                <span className="text-emerald-400">SQLite + Excel</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
