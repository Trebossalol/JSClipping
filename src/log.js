import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const LOG_DIR = path.join(__dirname, "..", "logs");

function stamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function lineStamp(date = new Date()) {
  return date.toISOString();
}

export function createRunLog(label = "clip") {
  fs.mkdirSync(LOG_DIR, { recursive: true });

  const fileName = `${label}-${stamp()}.log`;
  const filePath = path.join(LOG_DIR, fileName);

  function write(level, message) {
    const line = `[${lineStamp()}] [${level}] ${message}\n`;
    fs.appendFileSync(filePath, line);
    if (level === "ERROR") {
      console.error(message);
    } else {
      console.log(message);
    }
  }

  return {
    filePath,
    info(message) {
      write("INFO", message);
    },
    error(message) {
      write("ERROR", message);
    },
  };
}
