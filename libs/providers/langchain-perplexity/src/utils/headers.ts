const PERPLEXITY_INTEGRATION_SLUG = "langchainjs";

const PERPLEXITY_INTEGRATION_HEADER = `${PERPLEXITY_INTEGRATION_SLUG}/${__PKG_VERSION__}`;

export function getPerplexityHeaders(apiKey: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    "X-Pplx-Integration": PERPLEXITY_INTEGRATION_HEADER,
  };
}
