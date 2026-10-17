import { useState, useEffect } from "react";
import { Navbar } from "./components/Navbar";
import { LiveInspection } from "./components/LiveInspection";
import { DefectDatabase } from "./components/DefectDatabase";
import { AnalyticsReports } from "./components/AnalyticsReports";
import { ImageUploadInspector } from "./components/ImageUploadInspector";
import { SystemSettings } from "./components/SystemSettings";
import { fetchInspectionStatus } from "./services/api";
import { DEMO_MODE } from "./config";

export function App() {
  const [activeTab, setActiveTab] = useState<string>("live");
  const [isInspecting, setIsInspecting] = useState<boolean>(false);

  useEffect(() => {
    const check = async () => {
      try {
        const s = await fetchInspectionStatus();
        setIsInspecting(s.is_inspecting);
      } catch {
        // Ignore silent polling error
      }
    };
    check();
    const interval = setInterval(check, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-[#080c14] text-slate-100 flex flex-col selection:bg-cyan-500 selection:text-white">
      <Navbar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        isInspecting={isInspecting}
      />

      {DEMO_MODE && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-300 text-xs font-mono text-center px-4 py-2">
          DEMO MODE: runs entirely in your browser. The defect log is real data from the project database;
          the live inspection is a replay, and no AI model is running here.
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === "live" && <LiveInspection />}
        {activeTab === "database" && <DefectDatabase />}
        {activeTab === "analytics" && <AnalyticsReports />}
        {activeTab === "upload" && <ImageUploadInspector />}
        {activeTab === "settings" && <SystemSettings />}
      </main>

      <footer className="bg-[#0b101b] border-t border-slate-800/80 py-4 text-center text-xs text-slate-500 font-mono">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>SAIL Steel Defect Inspection System &copy; 2026</span>
          <span className="flex items-center space-x-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
            <span>{DEMO_MODE ? "Demo build (static, no backend)" : "Production Engine: Python + Node.js + TypeScript"}</span>
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
