import { useState } from "react";
import {
  UploadCloud,
  FileImage,
  AlertTriangle,
  RefreshCw
} from "lucide-react";
import { uploadAndInspectImage, inspectSampleImage } from "../services/api";
import { DEMO_MODE } from "../config";
import { DEMO_SAMPLES } from "../demo/demoApi";
import { UploadInspectionResponse } from "../types";

export const ImageUploadInspector: React.FC = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confThreshold, setConfThreshold] = useState<number>(0.08);
  const [loading, setLoading] = useState<boolean>(false);
  const [result, setResult] = useState<UploadInspectionResponse | null>(null);
  const [selectedSample, setSelectedSample] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setSelectedSample(null);
      setPreviewUrl(URL.createObjectURL(file));
      setResult(null);
    }
  };

  const handleInspect = async () => {
    if (!selectedFile && !selectedSample) return;
    try {
      setLoading(true);
      const res = selectedSample
        ? await inspectSampleImage(selectedSample, confThreshold)
        : await uploadAndInspectImage(selectedFile!, confThreshold);
      setResult(res);
    } catch (err) {
      alert("Failed to analyze image: " + String(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2">
          <UploadCloud className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">Image & Batch Defect Inspector</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Upload custom steel surface photos to run instantaneous YOLOv8 AI inference, bounding box localization, and defect classification.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Upload & Config Controls (1 col) */}
        <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">Upload Steel Photo</h3>

          {/* Drag & Drop Area */}
          <label className="border-2 border-dashed border-slate-700 hover:border-cyan-500/70 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all bg-slate-900/50 hover:bg-slate-900">
            <UploadCloud className="h-10 w-10 text-slate-500 mb-3" />
            <span className="text-sm font-semibold text-slate-200 text-center">Click or Drag & Drop Image</span>
            <span className="text-xs text-slate-500 mt-1">JPG, PNG, WEBP (Up to 25MB)</span>
            <input
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              className="hidden"
            />
          </label>

          {selectedFile && (
            <div className="flex items-center space-x-2 text-xs font-mono text-slate-300 bg-slate-900 p-3 rounded-xl border border-slate-800">
              <FileImage className="h-4 w-4 text-cyan-400 shrink-0" />
              <span className="truncate">{selectedFile.name}</span>
            </div>
          )}

          {DEMO_MODE && (
            <div className="space-y-2">
              <div className="text-xs font-semibold uppercase tracking-wider text-slate-300">Or try a sample</div>
              <div className="grid grid-cols-4 gap-1.5 max-h-40 overflow-y-auto">
                {DEMO_SAMPLES.map((s) => (
                  <button
                    key={s.file}
                    type="button"
                    onClick={() => {
                      setSelectedSample(s.file);
                      setSelectedFile(null);
                      setPreviewUrl(`/samples/${s.file}`);
                      setResult(null);
                    }}
                    className={`rounded-lg overflow-hidden border ${
                      selectedSample === s.file ? "border-cyan-400" : "border-slate-800 hover:border-slate-600"
                    }`}
                  >
                    <img src={`/samples/${s.file}`} alt={s.original} className="aspect-square object-cover" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Confidence Slider */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-300">Confidence Threshold</span>
              <span className="font-mono font-bold text-amber-400">{Math.round(confThreshold * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.02"
              max="0.80"
              step="0.02"
              value={confThreshold}
              onChange={(e) => setConfThreshold(parseFloat(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
          </div>

          <button
            onClick={handleInspect}
            disabled={(!selectedFile && !selectedSample) || loading}
            className="w-full flex items-center justify-center space-x-2 py-3.5 px-4 rounded-xl bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold text-sm shadow-lg shadow-cyan-950/60 transition-all disabled:opacity-50 cursor-pointer"
          >
            {loading ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>RUNNING YOLOV8 INFERENCE...</span>
              </>
            ) : (
              <span>RUN AI DEFECT INSPECTION</span>
            )}
          </button>
        </div>

        {/* Right: Visual Result Viewport (2 cols) */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-[#0f1726] border border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-4 py-3 bg-slate-900/90 border-b border-slate-800 flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                {result ? "AI Detection Viewport (With Bounding Boxes)" : "Preview Viewport"}
              </span>
              {result && (
                <span className="text-xs font-mono px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  {result.defect_count} Defect(s) Identified
                </span>
              )}
            </div>

            <div className="relative aspect-video bg-black flex items-center justify-center p-2">
              {result?.annotated_image ? (
                <img
                  src={result.annotated_image}
                  alt="Annotated Inspection Result"
                  className="max-h-[460px] max-w-full object-contain rounded-lg border border-slate-800"
                />
              ) : previewUrl ? (
                <img
                  src={previewUrl}
                  alt="Original Preview"
                  className="max-h-[460px] max-w-full object-contain rounded-lg border border-slate-800"
                />
              ) : (
                <div className="text-center py-20">
                  <FileImage className="h-12 w-12 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-500 font-mono">Upload an image on the left to start inspection.</p>
                </div>
              )}
            </div>

            {/* Detections List */}
            {result && result.detections.length > 0 && (
              <div className="p-4 bg-slate-900/90 border-t border-slate-800">
                <div className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-2">
                  Localized Defect Bounding Boxes
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {result.detections.map((d, i) => (
                    <div
                      key={i}
                      className="bg-slate-950/80 border border-slate-800 rounded-lg p-2.5 flex items-center justify-between text-xs font-mono"
                    >
                      <div className="flex items-center space-x-2">
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                        <span className="font-bold text-white uppercase">{d.defect_type}</span>
                      </div>
                      <div className="text-slate-400">
                        Conf: <span className="text-emerald-400 font-bold">{Math.round((d.confidence || 0) * 100)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
