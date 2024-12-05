import { Buffer } from "node:buffer";
import fs from "node:fs/promises";

export async function localImageToBase64(filePath: string): Promise<string> {
  const data = await fs.readFile(filePath);
  return Buffer.from(data).toString("base64");
}
