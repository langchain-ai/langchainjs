import { z } from "zod/v3";
import { createMiddleware } from "../middleware.js";
import type { ClientTool, ServerTool } from "../../types.js";

/**
 * Tool selection strategy types
 */
export type ToolSelectionStrategy =
  | "all" // Select all tools (default behavior)
  | "keyword" // Select tools based on keyword matching
  | "semantic" // Select tools based on semantic similarity
  | "custom"; // Use a custom selection function

/**
 * Custom tool selector function type
 */
const customToolSelector = z
  .function()
  .args(
    z.object({
      // all tools
      tools: z.array(z.custom<ClientTool | ServerTool>()).describe("Alltools"),
      // user query
      query: z.string(),
      // agent context
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      context: z.custom<Record<string, any>>(),
    })
  )
  .returns(
    z.union([
      z.array(z.custom<ClientTool | ServerTool>()),
      z.promise(z.array(z.custom<ClientTool | ServerTool>())),
    ])
  );
export type CustomToolSelector = z.infer<typeof customToolSelector>;

/**
 * Keyword matching configuration
 */
export interface KeywordMatchConfig {
  /**
   * Keywords to match against tool names and descriptions
   */
  keywords: string[];
  /**
   * Whether to match keywords in tool descriptions (default: true)
   */
  matchDescriptions?: boolean;
  /**
   * Whether to use case-insensitive matching (default: true)
   */
  caseInsensitive?: boolean;
  /**
   * Minimum number of keyword matches required (default: 1)
   */
  minMatches?: number;
}

/**
 * Semantic similarity configuration
 */
export interface SemanticMatchConfig {
  /**
   * Similarity threshold (0-1, default: 0.3)
   */
  threshold?: number;
  /**
   * Maximum number of tools to select (default: 10)
   */
  maxTools?: number;
  /**
   * Custom embedding function (optional)
   */
  embedFunction?: (text: string) => Promise<number[]> | number[];
}

const DEFAULT_STRATEGY = "all";
const contextSchema = z.object({
  /**
   * Tool selection strategy to use
   */
  strategy: z
    .enum(["all", "keyword", "semantic", "custom"])
    .default(DEFAULT_STRATEGY),

  /**
   * Maximum number of tools to select (default: unlimited)
   */
  maxTools: z.number().positive().optional(),

  /**
   * All available tools (set by the middleware)
   */
  allTools: z.array(z.any()).default([]),

  /**
   * Keyword matching configuration
   */
  keywordConfig: z
    .object({
      keywords: z.array(z.string()).default([]),
      matchDescriptions: z.boolean().default(true),
      caseInsensitive: z.boolean().default(true),
      minMatches: z.number().positive().default(1),
    })
    .optional(),

  /**
   * Semantic matching configuration
   */
  semanticConfig: z
    .object({
      threshold: z.number().min(0).max(1).default(0.3),
      maxTools: z.number().positive().default(10),
      embedFunction: z
        .function()
        .args(z.string())
        .returns(z.union([z.array(z.number()), z.promise(z.array(z.number()))]))
        .optional(),
    })
    .optional(),

  /**
   * Custom tool selector function
   */
  customSelector: customToolSelector.optional(),
});

/**
 * Extract text content from a tool for matching
 */
function getToolText(tool: ClientTool | ServerTool): string {
  if (typeof tool === "object" && tool !== null) {
    const parts: string[] = [];

    // Add tool name
    if ("name" in tool && typeof tool.name === "string") {
      parts.push(tool.name);
    }

    // Add tool description
    if ("description" in tool && typeof tool.description === "string") {
      parts.push(tool.description);
    }

    return parts.join(" ");
  }

  return "";
}

/**
 * Get the last user message from the conversation
 */
function getLastUserMessage(messages: unknown[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    const message = messages[i];
    if (message && typeof message === "object" && message !== null) {
      const msgObj = message as Record<string, unknown>;
      if (
        typeof msgObj._getType === "function" &&
        msgObj._getType() === "human"
      ) {
        return typeof msgObj.content === "string" ? msgObj.content : "";
      }
    }
  }
  return "";
}

/**
 * Keyword-based tool selection
 */
function selectToolsByKeywords(
  tools: (ClientTool | ServerTool)[],
  config: KeywordMatchConfig,
  query: string
): (ClientTool | ServerTool)[] {
  const { keywords, caseInsensitive = true, minMatches = 1 } = config;

  if (keywords.length === 0) {
    return tools;
  }

  const searchText = caseInsensitive ? query.toLowerCase() : query;
  const searchKeywords = keywords.map((k) =>
    caseInsensitive ? k.toLowerCase() : k
  );

  return tools.filter((tool) => {
    const toolText = getToolText(tool);
    const targetText = caseInsensitive ? toolText.toLowerCase() : toolText;

    let matches = 0;

    // Check query against tool text
    for (const keyword of searchKeywords) {
      if (searchText.includes(keyword) && targetText.includes(keyword)) {
        matches++;
      }
    }

    // Also check if tool text contains any keywords from the query
    const queryWords = searchText.split(/\s+/);
    for (const word of queryWords) {
      if (word.length > 2 && targetText.includes(word)) {
        // Skip very short words
        matches++;
      }
    }

    return matches >= minMatches;
  });
}

/**
 * Simple semantic similarity using basic text overlap
 * In a real implementation, you'd use proper embeddings
 */
function calculateSimpleSimilarity(text1: string, text2: string): number {
  const words1 = new Set(text1.toLowerCase().split(/\s+/));
  const words2 = new Set(text2.toLowerCase().split(/\s+/));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size > 0 ? intersection.size / union.size : 0;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosine(a: number[], b: number[]): number {
  const num = a.reduce((s, v, i) => s + v * (b[i] ?? 0), 0);
  const da = Math.hypot(...a);
  const db = Math.hypot(...b);
  return da && db ? num / (da * db) : 0;
}

/**
 * Semantic similarity-based tool selection
 */
async function selectToolsBySemantic(
  tools: (ClientTool | ServerTool)[],
  config: SemanticMatchConfig,
  query: string
): Promise<(ClientTool | ServerTool)[]> {
  const { threshold = 0.3, maxTools = 10, embedFunction } = config;

  if (!query.trim()) {
    return tools.slice(0, maxTools);
  }

  if (embedFunction) {
    const q = await Promise.resolve(embedFunction(query));
    const scored = await Promise.all(
      tools.map(async (tool) => {
        const t = getToolText(tool);
        const e = await Promise.resolve(embedFunction(t));
        return { tool, score: cosine(q, e) };
      })
    );
    return scored
      .filter(({ score }) => score >= threshold)
      .sort((a, b) => b.score - a.score)
      .slice(0, maxTools)
      .map(({ tool }) => tool);
  }

  const toolsWithScores = tools.map((tool) => ({
    tool,
    score: calculateSimpleSimilarity(query, getToolText(tool)),
  }));

  return toolsWithScores
    .filter(({ score }) => score >= threshold)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxTools)
    .map(({ tool }) => tool);
}

/**
 * Creates a "Big Tool" middleware that dynamically selects tools based on different strategies.
 *
 * This middleware helps manage large tool sets (1000+ tools) by intelligently selecting only
 * the most relevant tools for each query, preventing context window explosion while maintaining
 * functionality.
 *
 * ## Features
 *
 * - **Multiple Selection Strategies**: Choose from keyword matching, semantic similarity, or custom logic
 * - **Context Window Optimization**: Reduce tool descriptions sent to the model
 * - **Flexible Configuration**: Fine-tune selection criteria per strategy
 * - **Performance Tracking**: Monitor tool selection statistics
 * - **Fallback Support**: Graceful degradation when selection fails
 *
 * ## Selection Strategies
 *
 * ### All (Default)
 * Passes all tools to the model (original behavior)
 *
 * ### Keyword Matching
 * Selects tools based on keyword overlap between the query and tool names/descriptions
 *
 * ### Semantic Similarity
 * Uses text similarity to find the most relevant tools (basic implementation included)
 *
 * ### Custom
 * Allows you to provide your own tool selection logic
 *
 * @param middlewareOptions - Configuration options for tool selection
 * @param middlewareOptions.strategy - Tool selection strategy ("all" | "keyword" | "semantic" | "custom")
 * @param middlewareOptions.maxTools - Maximum number of tools to select
 * @param middlewareOptions.keywordConfig - Configuration for keyword matching strategy
 * @param middlewareOptions.semanticConfig - Configuration for semantic similarity strategy
 * @param middlewareOptions.customSelector - Custom tool selection function
 *
 * @returns A middleware instance that can be passed to `createAgent`
 *
 * @example
 * Basic usage with keyword matching
 * ```typescript
 * import { bigTool } from "langchain/middleware";
 * import { createAgent } from "langchain";
 *
 * const agent = createAgent({
 *   model: "openai:gpt-4",
 *   tools: [...manyTools], // 1000+ tools
 *   middleware: [
 *     bigTool({
 *       strategy: "keyword",
 *       maxTools: 20,
 *       keywordConfig: {
 *         keywords: ["file", "database", "api", "search"],
 *         matchDescriptions: true,
 *         minMatches: 1
 *       }
 *     })
 *   ]
 * });
 * ```
 *
 * @example
 * Semantic similarity strategy
 * ```typescript
 * // Basic semantic similarity using simple text-overlap
 * const semanticMiddleware = bigTool({
 *   strategy: "semantic",
 *   semanticConfig: {
 *     threshold: 0.4,
 *     maxTools: 15,
 *   },
 * });
 *
 * // Semantic similarity with a custom embedding function (e.g.cosine ranking)
 * // Note: embedFunction can be async. It should return a numeric vector.
 * import { embedText } from "./myEmbeddings";
 * const semanticWithEmbeddings = bigTool({
 *   strategy: "semantic",
 *   semanticConfig: {
 *     threshold: 0.35,
 *     maxTools: 10,
 *     embedFunction: (text: string) => embedText(text),
 *   },
 * });
 *
 * // Semantic similarity with a vendor embedding function
 * import OpenAI from "openai";
 * import { bigTool } from "langchain/middleware";
 *
 * const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
 * const embedFunction = async (text: string): Promise<number[]> => {
 *   const res = await openai.embeddings.create({
 *     model: "text-embedding-3-small", // or "text-embedding-3-large"
 *     input: text,
 *   });
 *   return res.data[0].embedding;
 * };
 *
 * const middleware = bigTool({
 *   strategy: "semantic",
 *   semanticConfig: {
 *     threshold: 0.35,
 *     maxTools: 10,
 *     embedFunction,
 *   },
 * });
 * ```
 *
 * @example
 * Custom selection logic
 * ```typescript
 * const customMiddleware = bigTool({
 *   strategy: "custom",
 *   customSelector: async (tools, query, context) => {
 *     // Your custom logic here
 *     const relevantTools = tools.filter(tool => {
 *       // Custom filtering logic
 *       return someCustomLogic(tool, query);
 *     });
 *     return relevantTools.slice(0, 10);
 *   }
 * });
 * ```
 *
 * @example
 * Runtime configuration override
 * ```typescript
 * // Override keyword strategy at runtime
 * await agent.invoke(
 *   { messages: [new HumanMessage("Find files related to user data")] },
 *   {
 *     configurable: {
 *       middleware_context: {
 *         bigToolOptions: {
 *           strategy: "keyword",
 *           maxTools: 5,
 *           keywordConfig: {
 *             keywords: ["user", "data", "file"],
 *             minMatches: 2,
 *           },
 *         },
 *       },
 *     },
 *   }
 * );
 *
 * // Override semantic strategy (including embeddings) at runtime
 * const embed = (text: string) => embedText(text);
 * await agent.invoke(
 *   { messages: [new HumanMessage("Query customer database records")] },
 *   {
 *     configurable: {
 *       middleware_context: {
 *         bigToolOptions: {
 *           strategy: "semantic",
 *           semanticConfig: {
 *             threshold: 0.4,
 *             maxTools: 8,
 *             embedFunction: embed,
 *           },
 *         },
 *       },
 *     },
 *   }
 * );
 * ```
 */
export function bigTool(
  middlewareOptions?: Partial<z.infer<typeof contextSchema>> & {
    customSelector?: CustomToolSelector;
  }
) {
  return createMiddleware({
    name: "BigToolMiddleware",
    contextSchema: z.object({
      bigToolOptions: contextSchema,
    }),

    prepareModelRequest: async (request, state, runtime) => {
      const contextConfiguration = runtime.context.bigToolOptions;
      // Get configuration with fallbacks
      const strategy =
        DEFAULT_STRATEGY === contextConfiguration?.strategy
          ? middlewareOptions?.strategy ?? DEFAULT_STRATEGY
          : DEFAULT_STRATEGY;
      const maxTools =
        contextConfiguration?.maxTools ?? middlewareOptions?.maxTools;
      const keywordConfig =
        contextConfiguration?.keywordConfig ?? middlewareOptions?.keywordConfig;
      const semanticConfig =
        contextConfiguration?.semanticConfig ??
        middlewareOptions?.semanticConfig;
      const customSelector =
        contextConfiguration?.customSelector ??
        middlewareOptions?.customSelector;

      const originalTools = request.tools;
      let selectedTools = originalTools;

      // Get the user query from the last message
      const query = getLastUserMessage(state.messages);

      try {
        // Apply tool selection strategy
        switch (strategy) {
          case "all":
            break;

          case "keyword":
            if (keywordConfig) {
              selectedTools = selectToolsByKeywords(
                originalTools,
                keywordConfig,
                query
              );
            }
            break;

          case "semantic":
            if (semanticConfig) {
              selectedTools = await selectToolsBySemantic(
                originalTools,
                semanticConfig,
                query
              );
            }
            break;

          case "custom":
            if (customSelector) {
              selectedTools = await Promise.resolve(
                customSelector({
                  tools: originalTools,
                  query,
                  context: runtime.context,
                })
              );
            }
            break;

          default:
            selectedTools = originalTools;
        }

        // Apply max tools limit if specified
        if (maxTools && selectedTools.length > maxTools) {
          selectedTools = selectedTools.slice(0, maxTools);
        }

        // Ensure we have at least some tools (fallback to first few tools if selection fails)
        if (selectedTools.length === 0 && originalTools.length > 0) {
          const fallbackCount = Math.min(maxTools ?? 10, originalTools.length);
          selectedTools = originalTools.slice(0, fallbackCount);
        }
      } catch (error) {
        console.warn(
          "BigToolMiddleware: Tool selection failed, falling back to original tools:",
          error
        );
        selectedTools = originalTools;
        if (maxTools && selectedTools.length > maxTools) {
          selectedTools = selectedTools.slice(0, maxTools);
        }
      }

      // Return modified request with selected tools
      return {
        ...request,
        tools: selectedTools,
      };
    },
  });
}
