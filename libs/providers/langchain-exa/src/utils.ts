import Exa, { ContentsOptions, RegularSearchOptions } from "exa-js";

export function createExaClient(apiKey?: string): Exa {
  const client = new Exa(apiKey);
  (client as unknown as { headers: Headers }).headers.set(
    "x-exa-integration",
    "langchain-ai/langchainjs-exa-integration"
  );
  return client;
}

const LEGACY_CONTENT_KEYS = [
  "text",
  "highlights",
  "summary",
  "livecrawl",
  "livecrawlTimeout",
  "maxAgeHours",
  "filterEmptyResults",
  "subpages",
  "subpageTarget",
  "extras",
] as const;

/**
 * exa-js 2.x takes content options nested under `contents`, while earlier
 * versions of this package accepted them at the top level of `searchArgs`.
 * Nest any legacy top-level content options so existing callers keep working,
 * and default to auto search with text contents.
 */
export function normalizeSearchArgs<T extends ContentsOptions>(
  searchArgs?: RegularSearchOptions & T
): RegularSearchOptions & { contents: T } {
  const { contents, ...rest } = { ...(searchArgs ?? {}) } as {
    contents?: ContentsOptions;
  } & Record<string, unknown>;
  const legacy: Record<string, unknown> = {};
  for (const key of LEGACY_CONTENT_KEYS) {
    if (rest[key] !== undefined) {
      legacy[key] = rest[key];
      delete rest[key];
    }
  }
  const merged = { ...legacy, ...contents };
  return {
    type: "auto",
    ...rest,
    contents: Object.keys(merged).length > 0 ? merged : { text: true },
  } as RegularSearchOptions & { contents: T };
}
