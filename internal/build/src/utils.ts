import path from "node:path";
import fs from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { setTimeout } from "node:timers/promises";
import { format, type FormatConfig } from "oxfmt";

export const PROJECT_ROOT = process.cwd();

/**
 * Converts a file path to use POSIX-style forward slashes.
 *
 * This is important for package.json exports, import maps, and other
 * contexts where paths must use forward slashes regardless of the OS.
 * On Windows, Node's `path.join`, `path.dirname`, etc. produce
 * backslash-separated paths which break package tooling like publint.
 *
 * @param p - The file path to normalize
 * @returns The path with all backslashes replaced by forward slashes
 */
export function toPosixPath(p: string): string {
  return p.replace(/\\/g, "/");
}

export function isSafeProjectPath(targetPath: string): boolean {
  // Normalize and check for containment in root
  const resolvedRoot = path.resolve(PROJECT_ROOT);
  const resolvedPath = path.resolve(targetPath);
  return resolvedPath.startsWith(resolvedRoot + path.sep);
}

const OXFMT_CONFIG_FILES = [".oxfmtrc.jsonc", ".oxfmtrc.json"];
let cachedOxfmtConfig: FormatConfig | undefined;

async function loadOxfmtConfig(): Promise<FormatConfig | undefined> {
  if (cachedOxfmtConfig) return cachedOxfmtConfig;

  for (const filename of OXFMT_CONFIG_FILES) {
    const configPath = path.join(PROJECT_ROOT, filename);
    try {
      const raw = await fs.readFile(configPath, "utf-8");
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if ("$schema" in parsed) {
        delete parsed.$schema;
      }
      cachedOxfmtConfig = parsed as FormatConfig;
      return cachedOxfmtConfig;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
        throw error;
      }
    }
  }

  return undefined;
}

export async function formatWithOxfmt(
  source: string,
  fileName = "file.ts"
): Promise<string> {
  const config = await loadOxfmtConfig();
  const result = await format(fileName, source, config);
  if (result.errors.length > 0) {
    const firstError = result.errors[0];
    throw new Error(
      `Oxfmt failed to format ${fileName}: ${firstError.message}`
    );
  }
  return result.code;
}

/**
 * Replaces `filePath` with `content` in one step: writes a temporary file next
 * to it and renames that into place, so a build reading the file at the same
 * time sees the old or the new content, never a half-written file. On Windows
 * the rename can fail while another process has the file open, so it is
 * retried a few times.
 */
export async function writeFileAtomic(
  filePath: string,
  content: string
): Promise<void> {
  const temporaryPath = `${filePath}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporaryPath, content, { flag: "wx" });
    for (let attempt = 0; ; attempt += 1) {
      try {
        await fs.rename(temporaryPath, filePath);
        return;
      } catch (error) {
        if (
          process.platform !== "win32" ||
          attempt >= 5 ||
          !["EPERM", "EACCES", "EBUSY"].includes(
            (error as NodeJS.ErrnoException).code ?? ""
          )
        ) {
          throw error;
        }
        await setTimeout(50 * (attempt + 1));
      }
    }
  } finally {
    await fs.rm(temporaryPath, { force: true });
  }
}

/**
 * Writes `content` to `filePath` unless the file already holds exactly that.
 * Generated files are committed and rarely change, so most builds skip the
 * write entirely.
 *
 * @returns Whether the file was written
 */
export async function writeFileIfChanged(
  filePath: string,
  content: string
): Promise<boolean> {
  const current = await fs.readFile(filePath, "utf-8").catch(() => undefined);
  if (current === content) return false;
  await writeFileAtomic(filePath, content);
  return true;
}
