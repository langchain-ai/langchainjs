/**
 * Normalize a dedicated model URL to OpenAI-compatible `/sync/v1` format.
 *
 * Baseten dedicated model endpoints come in several forms:
 * - `.../predict` -> converted to `.../sync/v1`
 * - `.../sync` -> appended with `/v1`
 * - anything else -> ensures trailing `/v1`
 *
 * See: Python `langchain-baseten._normalize_model_url`
 */
export function normalizeModelUrl(url: string): string {
  if (url.endsWith("/predict")) {
    return `${url.slice(0, -"/predict".length)}/sync/v1`;
  }
  if (url.endsWith("/sync")) {
    return `${url}/v1`;
  }
  if (!url.endsWith("/v1")) {
    let trimmed = url;
    while (trimmed.endsWith("/")) {
      trimmed = trimmed.slice(0, -1);
    }
    return `${trimmed}/v1`;
  }
  return url;
}
