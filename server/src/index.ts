import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import fs from "fs";
import { createProxyMiddleware } from "http-proxy-middleware";
import { CONFIG } from "./config";
import { PythonSupervisor } from "./services/pythonSupervisor";

const app = express();

// Middleware
app.use(cors());
app.use(morgan("dev"));

// Serve cropped defect images from reports
if (!fs.existsSync(CONFIG.REPORTS_PATH)) {
  fs.mkdirSync(CONFIG.REPORTS_PATH, { recursive: true });
}
app.use("/reports", express.static(CONFIG.REPORTS_PATH));

// Gateway Health Endpoint
app.get("/api/gateway/health", async (_req: Request, res: Response) => {
  const pythonHealthy = await PythonSupervisor.isServiceHealthy();
  res.json({
    status: "healthy",
    gateway: "Node.js TypeScript API Gateway",
    uptime_seconds: process.uptime(),
    python_service: {
      url: CONFIG.PYTHON_SERVICE_URL,
      healthy: pythonHealthy
    }
  });
});

// Proxy API & Video Stream requests to Python AI Microservice
const pythonProxy = createProxyMiddleware({
  target: CONFIG.PYTHON_SERVICE_URL,
  changeOrigin: true,
  ws: true,
  on: {
    error: (err: any, _req: any, res: any) => {
      console.error("❌ [Proxy Error]", err.message);
      if (res && "writeHead" in res && typeof res.writeHead === "function") {
        res.writeHead(502, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Python AI Service is unavailable", detail: err.message }));
      }
    }
  }
});

// Forward /api/* and /health to Python service (excluding /api/gateway/*)
app.use("/health", pythonProxy);
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith("/api/gateway")) {
    return next();
  }
  if (req.path.startsWith("/api")) {
    return pythonProxy(req, res, next);
  }
  next();
});

// Serve frontend in production
if (fs.existsSync(CONFIG.CLIENT_DIST_PATH)) {
  console.log(`📦 Serving static client bundle from ${CONFIG.CLIENT_DIST_PATH}`);
  app.use(express.static(CONFIG.CLIENT_DIST_PATH));
  app.get("*", (req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/reports")) {
      return next();
    }
    res.sendFile(path.join(CONFIG.CLIENT_DIST_PATH, "index.html"));
  });
} else {
  app.get("/", (_req: Request, res: Response) => {
    res.json({
      message: "SAIL Steel Defect Inspection Backend is running.",
      note: "Frontend build not detected at client/dist. Run 'npm run build' in client/ or use Vite dev server."
    });
  });
}

// Start Server
const server = app.listen(CONFIG.PORT, async () => {
  console.log(`\n======================================================`);
  console.log(`🏭 STEEL INSPECTOR WEB GATEWAY`);
  console.log(`🌐 URL: http://localhost:${CONFIG.PORT}`);
  console.log(`📡 Python AI Target: ${CONFIG.PYTHON_SERVICE_URL}`);
  console.log(`======================================================\n`);

  // Ensure Python AI Service is running
  await PythonSupervisor.ensureServiceRunning();
});

// Graceful Shutdown
const shutdown = () => {
  console.log("\n🛑 Gracefully shutting down Steel Inspector server...");
  PythonSupervisor.stop();
  server.close(() => {
    console.log("✅ Server closed cleanly.");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
