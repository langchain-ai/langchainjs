import Anthropic from "@anthropic-ai/sdk";

import { tool, type DynamicStructuredTool } from "@langchain/core/tools";

interface WebSearchOptions {
  maxUses?: number;
  allowedDomains?: string[];
  blockedDomains?: string[];
  userLocation?: Anthropic.Beta.BetaWebSearchTool20250305.UserLocation;
}

export function webSearch_20250305(
  options?: WebSearchOptions
): DynamicStructuredTool {
  const webSearchTool = tool(
    () => {
      // not implemented
    },
    {
      name: "web_search",
      description: "Web search tool",
      schema: {},
    }
  );

  webSearchTool.metadata = {
    providerToolDefinition: {
      type: "web_search_20250305",
      name: "web_search",
      max_uses: options?.maxUses,
      allowed_domains: options?.allowedDomains,
      blocked_domains: options?.blockedDomains,
      user_location: options?.userLocation,
    },
  };

  return webSearchTool;
}
