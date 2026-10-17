import time
from typing import Optional

class MeterTracker:
    def __init__(self, sheet_number: str = "DEFAULT", speed_m_per_sec: float = 50.0):
        self.sheet_number = sheet_number
        self.speed = float(speed_m_per_sec)
        self.start_time: Optional[float] = None
        self.accumulated_time: float = 0.0
        self.is_running: bool = False

    def start(self, sheet_number: Optional[str] = None, speed_m_per_sec: Optional[float] = None):
        if sheet_number:
            self.sheet_number = sheet_number
        if speed_m_per_sec is not None:
            self.speed = float(speed_m_per_sec)
        self.start_time = time.time()
        self.accumulated_time = 0.0
        self.is_running = True

    def pause(self):
        if self.is_running and self.start_time is not None:
            self.accumulated_time += time.time() - self.start_time
            self.start_time = None
            self.is_running = False

    def resume(self):
        if not self.is_running:
            self.start_time = time.time()
            self.is_running = True

    def stop(self) -> float:
        total_length = self.get_length()
        self.start_time = None
        self.accumulated_time = 0.0
        self.is_running = False
        return total_length

    def get_elapsed_seconds(self) -> float:
        if not self.is_running:
            return round(self.accumulated_time, 2)
        elapsed = self.accumulated_time + (time.time() - self.start_time if self.start_time else 0.0)
        return round(elapsed, 2)

    def get_length(self) -> float:
        seconds = self.get_elapsed_seconds()
        return round(self.speed * seconds, 2)
