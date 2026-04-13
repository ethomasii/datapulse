import fs from "fs";
import os from "os";
import path from "path";

export type StoredSensorConfig = {
  name: string;
  pipeline_name: string;
  type: string;
  config: Record<string, unknown>;
};

export function sensorsConfigFilePath(): string {
  return path.join(os.homedir(), ".datapulse", "sensors_config.json");
}

export function readStoredSensorConfigs(): StoredSensorConfig[] {
  const p = sensorsConfigFilePath();
  try {
    const raw = fs.readFileSync(p, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return [];
    return data.filter(
      (row): row is StoredSensorConfig =>
        row &&
        typeof row === "object" &&
        typeof (row as StoredSensorConfig).name === "string" &&
        typeof (row as StoredSensorConfig).type === "string" &&
        typeof (row as StoredSensorConfig).config === "object" &&
        (row as StoredSensorConfig).config !== null
    );
  } catch {
    return [];
  }
}
