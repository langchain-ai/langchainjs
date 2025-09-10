export function isUrl(url: string): boolean {
  try {
    const newUrl = new URL(url);
    return Boolean(newUrl);
  } catch {
    return false;
  }
}
