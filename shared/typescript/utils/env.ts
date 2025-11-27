import { config } from "dotenv";
import fs from "node:fs";
import path from "node:path";

/**
 * Load environment variables from .env files.
 * Searches for .env files in the current working directory and parent directories
 * up to the repository root.
 */
export function loadEnv(): void {
  // Try to find .env file starting from current working directory
  // and walking up to repo root
  let currentDir = process.cwd();
  const repoRoot = path.resolve(__dirname, "../../../..");

  while (currentDir !== repoRoot && currentDir !== path.dirname(currentDir)) {
    const envPath = path.join(currentDir, ".env");
    if (fs.existsSync(envPath)) {
      config({ path: envPath });
      return;
    }
    currentDir = path.dirname(currentDir);
  }

  // Fallback: try repo root
  const rootEnvPath = path.join(repoRoot, ".env");
  if (fs.existsSync(rootEnvPath)) {
    config({ path: rootEnvPath });
    return;
  }

  // Last resort: load from current working directory (default dotenv behavior)
  config();
}

