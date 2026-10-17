import { useState, useEffect } from "react";
import {
  BarChart3,
  FileSpreadsheet,
  Download,
  Layers,
  AlertTriangle,
  Ruler,
  RefreshCw,
  FolderOpen
} from "lucide-react";
import { fetchDatabaseStats, fetchReportsList, getExcelDownloadUrl, getReportFilename } from "../services/api";
import { DEMO_MODE } from "../config";
import { DefectStats, ReportItem } from "../types";

export const AnalyticsReports: React.FC = () => {
  const [stats, setStats] = useState<DefectStats | null>(null);
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  const loadData = async () => {
    try {
      setLoading(true);
      const [s, r] = await Promise.all([
        fetchDatabaseStats(),
        fetchReportsList()
      ]);
      setStats(s);
      setReports(r.reports);
    } catch (err) {
      console.error("Failed to load analytics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const breakdown = stats?.breakdown || {};

  const getDefectPercentage = (cnt: number) => {
    return Math.round((cnt / (stats?.total_defects || 1)) * 100);
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5 text-cyan-400" />
            <h2 className="text-lg font-bold text-white tracking-tight">Quality Analytics & Audit Reports</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Manufacturing quality metrics, defect type distributions, and automated Excel audits.
          </p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          <span>Refresh Analytics</span>
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Total Defects Logged</span>
            <AlertTriangle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-white">
            {stats?.total_defects || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Recorded in defects.db</div>
        </div>

        <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Coils Inspected</span>
            <Layers className="h-4 w-4 text-blue-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-cyan-400">
            {stats?.unique_sheets || 0}
          </div>
          <div className="text-xs text-slate-500 mt-1">Distinct Sheet IDs</div>
        </div>

        <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Max Recorded Position</span>
            <Ruler className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-emerald-400">
            {stats?.max_meter_recorded?.toFixed(1) || "0.0"} m
          </div>
          <div className="text-xs text-slate-500 mt-1">Along continuous sheet</div>
        </div>

        <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-5 shadow-lg">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs uppercase font-bold tracking-wider">Available Reports</span>
            <FileSpreadsheet className="h-4 w-4 text-purple-400" />
          </div>
          <div className="text-2xl font-bold font-mono text-purple-400">
            {reports.length}
          </div>
          <div className="text-xs text-slate-500 mt-1">Compiled .xlsx sheets</div>
        </div>
      </div>

      {/* Defect Breakdown Distribution */}
      <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-5">
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">
          Defect Class Distribution Breakdown
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Dent */}
          <div className="bg-slate-900/80 border border-amber-500/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-amber-400 uppercase tracking-wide">Dent</span>
              <span className="font-mono text-white font-bold">{breakdown["Dent"] || 0} events</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-500"
                style={{ width: `${getDefectPercentage(breakdown["Dent"] || 0)}%` }}
              />
            </div>
            <div className="text-right text-[11px] font-mono text-slate-400">
              {getDefectPercentage(breakdown["Dent"] || 0)}% of total
            </div>
          </div>

          {/* Hole */}
          <div className="bg-slate-900/80 border border-rose-500/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-rose-400 uppercase tracking-wide">Hole</span>
              <span className="font-mono text-white font-bold">{breakdown["Hole"] || 0} events</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-rose-500 transition-all duration-500"
                style={{ width: `${getDefectPercentage(breakdown["Hole"] || 0)}%` }}
              />
            </div>
            <div className="text-right text-[11px] font-mono text-slate-400">
              {getDefectPercentage(breakdown["Hole"] || 0)}% of total
            </div>
          </div>

          {/* Scratch */}
          <div className="bg-slate-900/80 border border-cyan-500/30 rounded-xl p-4 space-y-2">
            <div className="flex justify-between items-center text-xs">
              <span className="font-bold text-cyan-400 uppercase tracking-wide">Scratch</span>
              <span className="font-mono text-white font-bold">{breakdown["Scratch"] || 0} events</span>
            </div>
            <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 transition-all duration-500"
                style={{ width: `${getDefectPercentage(breakdown["Scratch"] || 0)}%` }}
              />
            </div>
            <div className="text-right text-[11px] font-mono text-slate-400">
              {getDefectPercentage(breakdown["Scratch"] || 0)}% of total
            </div>
          </div>
        </div>
      </div>

      {/* Generated Excel Reports Table */}
      <div className="bg-[#0f1726] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Generated Excel Audit Spreadsheets (.xlsx)
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            Location: <code className="text-cyan-400 font-bold">reports/&lt;sheet_id&gt;/</code>
          </span>
        </div>

        {reports.length === 0 ? (
          <div className="py-12 text-center">
            <FolderOpen className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No Excel reports generated yet.</p>
            <p className="text-xs text-slate-600 mt-1">
              Start an inspection and click "Stop & Generate Report" to produce an audit file.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Sheet / Coil ID</th>
                  <th className="py-3 px-4">File Name</th>
                  <th className="py-3 px-4">Size</th>
                  <th className="py-3 px-4">Generated Timestamp</th>
                  <th className="py-3 px-4 text-right">Download</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {reports.map((r, i) => (
                  <tr key={i} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-white font-bold">{r.sheet_id}</td>
                    <td className="py-3 px-4 text-slate-300 flex items-center space-x-1.5">
                      <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-400" />
                      <span>{r.filename}</span>
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {Math.round(r.size_bytes / 1024)} KB
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {r.modified_time}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <a
                        href={getExcelDownloadUrl(r.sheet_id)}
                        download={getReportFilename(r.sheet_id)}
                        className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 text-xs font-semibold transition-all"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>{DEMO_MODE ? "Download .csv" : "Download .xlsx"}</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
