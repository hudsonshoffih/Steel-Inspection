import path from "path";
import dotenv from "dotenv";

dotenv.config();

export const CONFIG = {
  PORT: parseInt(process.env.PORT || "5000", 10),
  PYTHON_SERVICE_URL: process.env.PYTHON_SERVICE_URL || "http://127.0.0.1:8000",
  PYTHON_EXEC: process.env.PYTHON_EXEC || path.resolve(__dirname, "../../../venv/bin/python"),
  AI_SERVICE_DIR: path.resolve(__dirname, "../../ai_service"),
  CLIENT_DIST_PATH: path.resolve(__dirname, "../../client/dist"),
  REPORTS_PATH: path.resolve(__dirname, "../../../reports"),
  ENV: process.env.NODE_ENV || "development"
};
