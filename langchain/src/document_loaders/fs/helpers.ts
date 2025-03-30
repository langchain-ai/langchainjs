import * as jschardet from "jschardet";
import * as fs from "fs";

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
  filePath: fs.PathLike,
  timeout: number = EXECUTION_TIMEOUT
): Promise<FileEncoding[]> {
  try {
    // Create a promise that rejects after the timeout
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Timeout reached while detecting encoding for ${filePath}`)
        );
      }, timeout);
    });

    // Create the detection promise
    const detectionPromise = async (): Promise<FileEncoding[]> => {
      const buffer = fs.readFileSync(filePath);
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
    };

    // Race between timeout and detection
    return await Promise.race([detectionPromise(), timeoutPromise]);
  } catch (error) {
    throw new Error(
      `An unknown error occurred during encoding detection ${error}`
    );
  }
}
