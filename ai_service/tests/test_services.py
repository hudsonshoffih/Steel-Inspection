import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import db
import meter_tracker
import report_exporter


def test_meter_tracker_uses_monotonic_elapsed_time(monkeypatch):
    now = [0.0]
    monkeypatch.setattr(meter_tracker.time, "monotonic", lambda: now[0])
    tracker = meter_tracker.MeterTracker(speed_m_per_sec=2)

    tracker.start()
    now[0] = 3.0

    assert tracker.get_length() == 6.0


def test_meter_tracker_pause_and_resume(monkeypatch):
    now = [10.0]
    monkeypatch.setattr(meter_tracker.time, "monotonic", lambda: now[0])
    tracker = meter_tracker.MeterTracker(speed_m_per_sec=3)

    tracker.start()
    now[0] = 12.0
    tracker.pause()
    now[0] = 20.0
    tracker.resume()
    now[0] = 21.0

    assert tracker.get_length() == 9.0


def test_database_initializes_and_inserts_defect(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "defects.db"))
    db.init_db()

    defect_id = db.insert_defect("SHEET-1", "dent", 2.5, "reports/image.jpg")

    assert defect_id == 1
    assert db.get_defects_by_sheet("SHEET-1")[0]["length_meter"] == 2.5


def test_database_filters_defects(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "defects.db"))
    db.init_db()
    db.insert_defect("SHEET-1", "dent", 2.5, "")
    db.insert_defect("SHEET-2", "hole", 4.0, "")

    assert [d["sheet_number"] for d in db.get_all_defects(sheet_number="SHEET-1")] == ["SHEET-1"]
    assert [d["defect_type"] for d in db.get_all_defects(defect_type="hole")] == ["hole"]


def test_database_stats_and_delete(tmp_path, monkeypatch):
    monkeypatch.setattr(db, "DB_PATH", str(tmp_path / "defects.db"))
    db.init_db()
    defect_id = db.insert_defect("SHEET-1", "dent", 2.5, "")
    db.insert_defect("SHEET-1", "hole", 4.0, "")

    assert db.get_defect_stats() == {
        "total_defects": 2,
        "unique_sheets": 1,
        "breakdown": {"dent": 1, "hole": 1},
        "max_meter_recorded": 4.0,
    }
    assert db.delete_defect(defect_id) is True
    assert db.delete_defect(defect_id) is False


def test_excel_report_contains_defect_rows(tmp_path, monkeypatch):
    monkeypatch.setattr(report_exporter, "REPORTS_DIR", str(tmp_path))

    path = report_exporter.generate_excel_report(
        "SHEET-1",
        [{
            "defect_type": "dent",
            "confidence": 0.876,
            "length_m": 1.2,
            "timestamp": "2026-01-01 00:00:00",
            "image_path": "reports/SHEET-1/dent.jpg",
        }],
    )

    assert Path(path).is_file()
    defect_sheet = pd.read_excel(path, sheet_name="Defect Logs")
    summary_sheet = pd.read_excel(path, sheet_name="Inspection Summary")
    assert defect_sheet.loc[0, "Defect Type"] == "dent"
    assert defect_sheet.loc[0, "Confidence"] == "87.6%"
    assert summary_sheet.loc[summary_sheet["Metric"] == "Total Defects", "Value"].iloc[0] == 1


def test_excel_report_can_be_empty(tmp_path, monkeypatch):
    monkeypatch.setattr(report_exporter, "REPORTS_DIR", str(tmp_path))
    path = report_exporter.generate_excel_report("EMPTY", [])

    assert Path(path).is_file()
    defect_sheet = pd.read_excel(path, sheet_name="Defect Logs")
    assert list(defect_sheet.columns) == [
        "Defect ID", "Defect Type", "Confidence", "Length (m)", "Timestamp", "Image Path"
    ]
    assert defect_sheet.empty
