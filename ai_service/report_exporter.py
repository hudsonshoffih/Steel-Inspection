import os
import pandas as pd
from typing import List, Dict, Any
from datetime import datetime

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
REPORTS_DIR = os.path.join(BASE_DIR, "reports")

def generate_excel_report(sheet_id: str, defect_data: List[Dict[str, Any]]) -> str:
    """Generate and save Excel report for a given sheet inspection."""
    sheet_report_dir = os.path.join(REPORTS_DIR, sheet_id)
    os.makedirs(sheet_report_dir, exist_ok=True)
    excel_path = os.path.join(sheet_report_dir, f"{sheet_id}.xlsx")

    if not defect_data:
        # Create empty report dataframe
        df = pd.DataFrame(columns=["Defect ID", "Defect Type", "Confidence", "Length (m)", "Timestamp", "Image Path"])
    else:
        rows = []
        for idx, d in enumerate(defect_data, start=1):
            rows.append({
                "Defect ID": idx,
                "Defect Type": d.get("defect_type", "Unknown"),
                "Confidence": f"{round(float(d.get('confidence', 0.0)) * 100, 1)}%",
                "Length (m)": d.get("length_m", 0.0),
                "Timestamp": d.get("timestamp", datetime.now().strftime("%Y-%m-%d %H:%M:%S")),
                "Image Path": d.get("image_path", "")
            })
        df = pd.DataFrame(rows)

    with pd.ExcelWriter(excel_path, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="Defect Logs", index=False)
        
        # Summary sheet
        summary_data = {
            "Metric": ["Sheet ID", "Report Generated", "Total Defects", "Dent Count", "Hole Count", "Scratch Count"],
            "Value": [
                sheet_id,
                datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                len(defect_data),
                sum(1 for d in defect_data if str(d.get("defect_type", "")).lower() == "dent"),
                sum(1 for d in defect_data if str(d.get("defect_type", "")).lower() == "hole"),
                sum(1 for d in defect_data if str(d.get("defect_type", "")).lower() == "scratch"),
            ]
        }
        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, sheet_name="Inspection Summary", index=False)

    return excel_path

def list_all_reports() -> List[Dict[str, Any]]:
    reports = []
    if not os.path.exists(REPORTS_DIR):
        return reports

    for item in os.listdir(REPORTS_DIR):
        item_path = os.path.join(REPORTS_DIR, item)
        if os.path.isdir(item_path):
            xlsx_file = os.path.join(item_path, f"{item}.xlsx")
            if os.path.isfile(xlsx_file):
                stats = os.stat(xlsx_file)
                reports.append({
                    "sheet_id": item,
                    "filename": f"{item}.xlsx",
                    "file_path": xlsx_file,
                    "size_bytes": stats.st_size,
                    "modified_time": datetime.fromtimestamp(stats.st_mtime).strftime("%Y-%m-%d %H:%M:%S")
                })
    return sorted(reports, key=lambda r: r["modified_time"], reverse=True)
