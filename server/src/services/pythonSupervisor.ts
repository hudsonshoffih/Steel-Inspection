import { spawn, ChildProcess } from "child_process";
import fs from "fs";
import { CONFIG } from "../config";

export class PythonSupervisor {
  private static process: ChildProcess | null = null;
  private static isStarting = false;

  public static async isServiceHealthy(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);
      const res = await fetch(`${CONFIG.PYTHON_SERVICE_URL}/health`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res.ok;
    } catch {
      return false;
    }
  }

  public static async ensureServiceRunning(): Promise<void> {
    const isHealthy = await this.isServiceHealthy();
    if (isHealthy) {
      console.log(`✅ [Supervisor] Python AI Service is already running at ${CONFIG.PYTHON_SERVICE_URL}`);
      return;
    }

    if (this.isStarting) {
      return;
    }

    this.isStarting = true;
    console.log(`🚀 [Supervisor] Spawning Python AI Service from ${CONFIG.AI_SERVICE_DIR}...`);

    let pythonBinary = CONFIG.PYTHON_EXEC;
    if (!fs.existsSync(pythonBinary)) {
      console.warn(`⚠️ Virtualenv python not found at ${pythonBinary}, falling back to python3`);
      pythonBinary = "python3";
    }

    const child = spawn(
      pythonBinary,
      ["-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "8000"],
      {
        cwd: CONFIG.AI_SERVICE_DIR,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: "1"
        }
      }
    );

    this.process = child;

    child.stdout.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.log(`[AI Engine] ${line}`);
    });

    child.stderr.on("data", (data) => {
      const line = data.toString().trim();
      if (line) console.warn(`[AI Engine Log] ${line}`);
    });

    child.on("close", (code) => {
      console.log(`🛑 [Supervisor] Python AI Service exited with code ${code}`);
      this.process = null;
      this.isStarting = false;
    });

    // Wait up to 15 seconds for startup
    let attempts = 0;
    while (attempts < 30) {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const ok = await this.isServiceHealthy();
      if (ok) {
        console.log("✅ [Supervisor] Python AI Service confirmed healthy and connected.");
        this.isStarting = false;
        return;
      }
      attempts++;
    }

    console.warn("⚠️ [Supervisor] Python AI Service didn't reply in time. Please check logs.");
    this.isStarting = false;
  }

  public static stop(): void {
    if (this.process) {
      console.log("🛑 [Supervisor] Stopping Python AI Service...");
      this.process.kill("SIGTERM");
      this.process = null;
    }
  }
}
