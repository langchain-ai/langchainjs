async function encodeImage(imagePath: string): Promise<string> {
  const { readFile } = await import("node:fs/promises");
  const base64Image = await readFile(imagePath, { encoding: "base64" });
  return base64Image;
}

export async function imageToDataUrl(imagePath: string): Promise<string> {
  const base64Image = await encodeImage(imagePath);
  const mimeType = "application/octet-stream"; // Fallback MIME type
  return `data:${mimeType};base64,${base64Image}`;
}
