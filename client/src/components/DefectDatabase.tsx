import { useState, useEffect } from "react";
import {
  Database,
  Search,
  Filter,
  Trash2,
  Download,
  Image as ImageIcon,
  X,
  AlertCircle,
  RefreshCw
} from "lucide-react";
import { fetchLoggedDefects, deleteDefectRecord, getAssetUrl } from "../services/api";
import { DefectItem } from "../types";

export const DefectDatabase: React.FC = () => {
  const [defects, setDefects] = useState<DefectItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchSheet, setSearchSheet] = useState<string>("");
  const [selectedType, setSelectedType] = useState<string>("ALL");
  const [previewImage, setPreviewImage] = useState<DefectItem | null>(null);

  const loadDefects = async () => {
    try {
      setLoading(true);
      const res = await fetchLoggedDefects({
        sheet_number: searchSheet.trim() || undefined,
        defect_type: selectedType,
        limit: 300
      });
      setDefects(res.defects);
    } catch (err) {
      console.error("Failed to load defect database:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDefects();
  }, [selectedType]);

  const handleDelete = async (id?: number) => {
    if (!id) return;
    if (!window.confirm(`Delete defect log #${id}?`)) return;
    try {
      await deleteDefectRecord(id);
      setDefects((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      alert("Failed to delete record: " + String(err));
    }
  };

  const exportCSV = () => {
    if (defects.length === 0) return;
    const headers = ["ID", "Sheet Number", "Defect Type", "Length (m)", "Timestamp", "Image Path"];
    const rows = defects.map((d) => [
      d.id || "",
      `"${d.sheet_number || d.sheet_id || ""}"`,
      `"${d.defect_type}"`,
      d.length_meter ?? d.length_m ?? "",
      `"${d.timestamp}"`,
      `"${d.image_path}"`
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((e) => e.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `steel_defects_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getBadgeStyle = (type: string) => {
    switch (type.toLowerCase()) {
      case "dent":
        return "bg-amber-500/20 text-amber-400 border-amber-500/40";
      case "hole":
        return "bg-rose-500/20 text-rose-400 border-rose-500/40";
      case "scratch":
        return "bg-cyan-500/20 text-cyan-400 border-cyan-500/40";
      default:
        return "bg-slate-500/20 text-slate-400 border-slate-500/40";
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-[#0f1726] border border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Database className="h-5 w-5 text-cyan-400" />
              <h2 className="text-lg font-bold text-white tracking-tight">Defect Records Explorer (SQLite)</h2>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              Search and audit all surface defects logged across previous manufacturing runs.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={exportCSV}
              disabled={defects.length === 0}
              className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              <span>Export CSV</span>
            </button>
            <button
              onClick={loadDefects}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold shadow-md shadow-cyan-950 transition-all"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
          {/* Search by Sheet ID */}
          <div className="sm:col-span-2 relative">
            <Search className="h-4 w-4 absolute left-3.5 top-3 text-slate-500" />
            <input
              type="text"
              value={searchSheet}
              onChange={(e) => setSearchSheet(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && loadDefects()}
              placeholder="Filter by Sheet Number (e.g. test_sheet, sheet 15)..."
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white font-mono placeholder:text-slate-600 focus:outline-none focus:border-cyan-500"
            />
          </div>

          {/* Filter by Defect Class */}
          <div className="relative">
            <Filter className="h-4 w-4 absolute left-3.5 top-3 text-slate-500 pointer-events-none" />
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-xs text-white font-mono focus:outline-none focus:border-cyan-500 appearance-none cursor-pointer"
            >
              <option value="ALL">All Defect Classes</option>
              <option value="Dent">Dent</option>
              <option value="Hole">Hole</option>
              <option value="Scratch">Scratch</option>
            </select>
          </div>
        </div>
      </div>

      {/* Database Table View */}
      <div className="bg-[#0f1726] border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
          <span className="text-xs font-mono text-slate-400">
            Total Matching Records: <span className="text-white font-bold">{defects.length}</span>
          </span>
          <span className="text-[11px] text-slate-500 font-mono">SQLite: defects.db</span>
        </div>

        {loading ? (
          <div className="py-16 text-center">
            <RefreshCw className="h-8 w-8 text-cyan-400 animate-spin mx-auto mb-3" />
            <p className="text-xs font-mono text-slate-400">Querying database records...</p>
          </div>
        ) : defects.length === 0 ? (
          <div className="py-16 text-center">
            <AlertCircle className="h-8 w-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No defect records found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-slate-900/90 text-slate-400 uppercase border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">Record ID</th>
                  <th className="py-3 px-4">Sheet ID</th>
                  <th className="py-3 px-4">Defect Class</th>
                  <th className="py-3 px-4">Length Along Coil</th>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4 text-center">Crop Snapshot</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {defects.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-4 text-slate-500 font-bold">#{d.id}</td>
                    <td className="py-3 px-4 text-white font-semibold">
                      {d.sheet_number || d.sheet_id}
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-0.5 rounded text-[11px] font-bold uppercase border ${getBadgeStyle(d.defect_type)}`}>
                        {d.defect_type}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-emerald-400">
                      {(d.length_meter ?? d.length_m ?? 0).toFixed(2)} m
                    </td>
                    <td className="py-3 px-4 text-slate-400">
                      {d.timestamp}
                    </td>
                    <td className="py-3 px-4 text-center">
                      {d.image_path ? (
                        <button
                          onClick={() => setPreviewImage(d)}
                          className="inline-flex items-center space-x-1 px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 border border-slate-700 text-[11px] font-sans"
                        >
                          <ImageIcon className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      ) : (
                        <span className="text-slate-600">No Image</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => handleDelete(d.id)}
                        className="text-slate-500 hover:text-rose-400 p-1 rounded hover:bg-rose-950/40 transition-colors"
                        title="Delete Record"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Defect Crop Image Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f1726] border border-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl">
            <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded text-xs font-bold uppercase border ${getBadgeStyle(previewImage.defect_type)}`}>
                  {previewImage.defect_type}
                </span>
                <span className="text-sm font-semibold text-white">
                  Sheet: {previewImage.sheet_number || previewImage.sheet_id}
                </span>
              </div>
              <button
                onClick={() => setPreviewImage(null)}
                className="text-slate-400 hover:text-white p-1 rounded hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 bg-black flex items-center justify-center">
              <img
                src={getAssetUrl(previewImage.image_path)}
                alt={previewImage.defect_type}
                className="max-h-80 max-w-full rounded-lg object-contain border border-slate-800"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = "none";
                }}
              />
            </div>

            <div className="p-5 bg-slate-900/90 border-t border-slate-800 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400">Position Along Sheet:</span>
                <span className="text-emerald-400 font-bold">
                  {(previewImage.length_meter ?? previewImage.length_m ?? 0).toFixed(2)} meters
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Logged Timestamp:</span>
                <span className="text-slate-200">{previewImage.timestamp}</span>
              </div>
              <div className="flex justify-between truncate">
                <span className="text-slate-400">File Path:</span>
                <span className="text-slate-400 truncate max-w-xs">{previewImage.image_path}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
