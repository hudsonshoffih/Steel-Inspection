import { useState, useEffect } from "react";
import {
  Settings,
  Cpu,
  RefreshCw,
  Server
} from "lucide-react";
import { fetchModelInfo, selectActiveModel } from "../services/api";
import { ModelInfo } from "../types";

export const SystemSettings: React.FC = () => {
  const [modelInfo, setModelInfo] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [switching, setSwitching] = useState<boolean>(false);

  const loadInfo = async () => {
    try {
      setLoading(true);
      const data = await fetchModelInfo();
      setModelInfo(data);
    } catch (err) {
      console.error("Failed to load model info:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInfo();
  }, []);

  const handleSelectModel = async (modelPath: string) => {
    try {
      setSwitching(true);
      await selectActiveModel(modelPath);
      await loadInfo();
      alert(`Successfully loaded model: ${modelPath}`);
    } catch (err) {
      alert("Failed to switch model: " + String(err));
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl">
        <div className="flex items-center space-x-2">
          <Settings className="h-5 w-5 text-cyan-400" />
          <h2 className="text-lg font-bold text-white tracking-tight">System Configuration & Model Registry</h2>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Inspect neural network weight checkpoints, change inference models, and inspect runtime microservice health.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Model Checkpoints */}
        <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Cpu className="h-4 w-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">Available YOLO Models</h3>
            </div>
            <button
              onClick={loadInfo}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="space-y-2.5">
            {modelInfo?.available_models.map((m) => {
              const isActive = modelInfo.active_model.includes(m.name);
              return (
                <div
                  key={m.name}
                  className={`p-3.5 rounded-xl border transition-all flex items-center justify-between ${
                    isActive
                      ? "bg-cyan-500/10 border-cyan-500/40"
                      : "bg-slate-900 border-slate-800 hover:border-slate-700"
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs font-mono font-bold text-white">{m.name}</span>
                      {isActive && (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                          ACTIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      Checkpoint Size: {m.size_mb} MB
                    </div>
                  </div>

                  {!isActive && (
                    <button
                      onClick={() => handleSelectModel(m.name)}
                      disabled={switching}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-cyan-400 border border-slate-700 transition-all"
                    >
                      Load Weight
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Runtime Stack & Classes */}
        <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center space-x-2">
            <Server className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Active Vision Engine Specs</h3>
          </div>

          <div className="space-y-3 text-xs font-mono">
            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-slate-400 font-bold uppercase text-[11px]">Class Labels In Trained Model:</div>
              <div className="flex flex-wrap gap-1.5">
                {modelInfo?.classes &&
                  Object.entries(modelInfo.classes).map(([id, name]) => (
                    <span
                      key={id}
                      className="px-2.5 py-1 rounded bg-slate-800 border border-slate-700 text-cyan-300 text-xs"
                    >
                      Class {id}: <strong className="text-white">{name}</strong>
                    </span>
                  ))}
              </div>
            </div>

            <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-400">Inference Runtime:</span>
                <span className="text-emerald-400 font-bold">Python 3.11 + PyTorch + YOLOv8</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">API Gateway:</span>
                <span className="text-white font-bold">Node.js Express + TypeScript</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">UI Dashboard:</span>
                <span className="text-cyan-400 font-bold">React 18 + Vite + Tailwind CSS</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Database Engine:</span>
                <span className="text-purple-400 font-bold">SQLite 3 (defects.db)</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
