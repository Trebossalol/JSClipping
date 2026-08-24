import fs from "node:fs";
import path from "node:path";
import { ensureDir, getRepoRoot } from "./paths.js";

export interface RunLog {
  filePath: string;
  info(message: string): void;
  error(message: string): void;
}

function stamp(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

export function createRunLog(label = "clip"): RunLog {
  const logDir = path.join(getRepoRoot(), "logs");
  ensureDir(logDir);

  const fileName = `${label}-${stamp()}.log`;
  const filePath = path.join(logDir, fileName);

  function write(level: string, message: string): void {
    const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
    fs.appendFileSync(filePath, line);
    if (level === "ERROR") {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  return {
    filePath,
    info(message: string) {
      write("INFO", message);
    },
    error(message: string) {
      write("ERROR", message);
    },
  };
}
