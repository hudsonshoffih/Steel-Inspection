import sqlite3
import os
from datetime import datetime
from typing import List, Dict, Any, Optional

BASE_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
LOCAL_DB_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "defects.db"))
DB_PATH = LOCAL_DB_PATH if os.path.exists(LOCAL_DB_PATH) else os.path.join(BASE_DIR, "defects.db")

def get_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS defect_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sheet_number TEXT,
            defect_type TEXT,
            length_meter REAL,
            timestamp TEXT,
            image_path TEXT
        )
    ''')
    conn.commit()
    conn.close()

def insert_defect(sheet_number: str, defect_type: str, length_meter: float, image_path: str, timestamp: Optional[str] = None) -> int:
    if not timestamp:
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    conn = get_connection()
    c = conn.cursor()
    c.execute('''
        INSERT INTO defect_logs (sheet_number, defect_type, length_meter, timestamp, image_path)
        VALUES (?, ?, ?, ?, ?)
    ''', (sheet_number, defect_type, length_meter, timestamp, image_path))
    conn.commit()
    inserted_id = c.lastrowid
    conn.close()
    return inserted_id

def get_all_defects(
    sheet_number: Optional[str] = None,
    defect_type: Optional[str] = None,
    limit: int = 200,
    offset: int = 0
) -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    query = "SELECT * FROM defect_logs WHERE 1=1"
    params = []

    if sheet_number:
        query += " AND sheet_number LIKE ?"
        params.append(f"%{sheet_number}%")
    if defect_type and defect_type.lower() != "all":
        query += " AND LOWER(defect_type) = LOWER(?)"
        params.append(defect_type)

    query += " ORDER BY id DESC LIMIT ? OFFSET ?"
    params.extend([limit, offset])

    c.execute(query, params)
    rows = c.fetchall()
    results = [dict(row) for row in rows]
    conn.close()
    return results

def get_defects_by_sheet(sheet_number: str) -> List[Dict[str, Any]]:
    conn = get_connection()
    c = conn.cursor()
    c.execute("SELECT * FROM defect_logs WHERE sheet_number = ? ORDER BY id ASC", (sheet_number,))
    rows = c.fetchall()
    results = [dict(row) for row in rows]
    conn.close()
    return results

def get_defect_stats() -> Dict[str, Any]:
    conn = get_connection()
    c = conn.cursor()

    # Total count
    c.execute("SELECT count(*) FROM defect_logs")
    total_defects = c.fetchone()[0]

    # Breakdown by defect_type
    c.execute("SELECT defect_type, count(*) as count FROM defect_logs GROUP BY defect_type")
    type_rows = c.fetchall()
    breakdown = {row["defect_type"]: row["count"] for row in type_rows}

    # Distinct sheets
    c.execute("SELECT count(DISTINCT sheet_number) FROM defect_logs")
    unique_sheets = c.fetchone()[0]

    # Max length inspected across logs
    c.execute("SELECT MAX(length_meter) FROM defect_logs")
    max_meter_row = c.fetchone()[0]
    max_meter = float(max_meter_row) if max_meter_row is not None else 0.0

    conn.close()
    return {
        "total_defects": total_defects,
        "unique_sheets": unique_sheets,
        "breakdown": breakdown,
        "max_meter_recorded": max_meter
    }

def delete_defect(defect_id: int) -> bool:
    conn = get_connection()
    c = conn.cursor()
    c.execute("DELETE FROM defect_logs WHERE id = ?", (defect_id,))
    deleted = c.rowcount > 0
    conn.commit()
    conn.close()
    return deleted
