import * as jschardet from "jschardet";
import { readFile } from "fs/promises";

/**
 * Represents file encoding information
 */
export interface FileEncoding {
  encoding: BufferEncoding | null;
  confidence: number;
}

const EXECUTION_TIMEOUT = 5000;

/**
 * Detects file encodings for a given file path
 * @param filePath - Path to the file
 * @param timeout - Timeout in milliseconds
 * @returns Promise containing list of detected encodings ordered by confidence
 */
export async function detectFileEncodings(
  filePath: string,
  timeout: number = EXECUTION_TIMEOUT
): Promise<FileEncoding[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const buffer = await readFile(filePath, { signal: controller.signal });
    clearTimeout(timeoutId);

    const results = jschardet.detectAll(buffer);

    if (!results || results.every((result) => result.encoding === null)) {
      throw new Error(`Could not detect encoding for ${filePath}`);
    }

    return results
      .filter((result) => result.encoding !== null)
      .map((result) => ({
        encoding: result.encoding.toLowerCase() as BufferEncoding,
        confidence: result.confidence,
      }));
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timeout reached while detecting encoding for ${filePath}`);
    } else if (error instanceof Error) {
      throw new Error("Encoding detection failed", { cause: error });
    }

    throw new Error(
      `An unknown error occurred during encoding detection ${JSON.stringify(error)}`
    );
  }
}