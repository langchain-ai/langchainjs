import * as fs from "node:fs/promises";

export async function encodeImage(imagePath: string): Promise<string> {
  const base64Image = await fs.readFile(imagePath, { encoding: "base64" });
  return base64Image;
}

export async function imageToDataUrl(imagePath: string): Promise<string> {
  const base64Image = await encodeImage(imagePath);
  const mimeType = "application/octet-stream"; // Fallback MIME type
  return `data:${mimeType};base64,${base64Image}`;
}
