/**
 * Error Handling
 *
 * This example shows how to handle errors in tools.
 *
 * Why this is important:
 * - If you want to bubble up the error to the `invoke` call and let the caller handle it
 * - If you want to return a fallback value if the tool call fails
 *
 * Example Scenario:
 * You're building a live stock price tool that is rate-limited. You want to handle the error gracefully by
 * returning a cached value if the tool call fails.
 */
import {
  createReactAgent,
  tool,
  HumanMessage,
  SystemMessage,
  ToolMessage,
} from "langchain";
import { ChatOpenAI } from "@langchain/openai";
import z from "zod";

class LiveQuotesApiError extends Error {
  code = "RATE_LIMIT";

  retryAfterMs = 5000;

  constructor(symbol: string) {
    super(`LiveQuotesApiError: rate-limited while fetching ${symbol}`);
    this.name = "LiveQuotesApiError";
  }
}

const cachedStockResults = {
  AAPL: {
    symbol: "AAPL",
    source: "cache",
    price: 150.75,
    ts: Date.now(),
  },
  MSFT: {
    symbol: "MSFT",
    source: "cache",
    price: 210.22,
    ts: Date.now(),
  },
};

/**
 * Simulated live quotes API (flaky)
 * - 30% chance to fail with a "rate limit / timeout"-like error
 */
const getLiveStockPrice = tool(
  async ({ symbol }: { symbol: string }) => {
    /**
     * add some latency
     */
    await new Promise((r) => {
      setTimeout(r, 200);
    });

    /**
     * 80% chance to fail with a "rate limit / timeout"-like error
     */
    if (Math.random() < 0.8) {
      console.log("throwing error in tool");
      throw new LiveQuotesApiError(symbol);
    }

    /**
     * return a random price
     */
    const price = (100 + Math.random() * 50).toFixed(2);
    return { symbol, source: "live", price: Number(price), ts: Date.now() };
  },
  {
    name: "get_live_stock_price",
    description:
      "Fetch latest live stock price for a symbol (may be rate-limited).",
    schema: z.object({
      symbol: z.string().describe("Ticker symbol, e.g. 'AAPL'"),
    }),
  }
);

const agent = createReactAgent({
  llm: new ChatOpenAI({ model: "gpt-4o-mini" }),
  tools: [getLiveStockPrice],

  /**
   * Handle tool call errors
   */
  onToolCallError: async (toolCall, _state, config) => {
    const error =
      toolCall.error instanceof Error
        ? toolCall.error
        : new Error(String(toolCall.error));
    if (config.context?.errorBehavior === "handleGracefully") {
      return new ToolMessage({
        content: JSON.stringify(
          cachedStockResults[
            toolCall.args.symbol as keyof typeof cachedStockResults
          ]
        ),
        name: toolCall.name,
        tool_call_id: toolCall.id ?? "",
      });
    }

    throw error;
  },

  prompt: new SystemMessage("Be a helpful assistant."),
  contextSchema: z.object({
    errorBehavior: z.enum(["escalate", "handleGracefully"]).optional(),
  }),
});

/**
 * Scenario 1: handle error in tool gracefully
 */
const res = await agent.invoke(
  {
    messages: [new HumanMessage("What is the latest price for AAPL?")],
  },
  {
    context: {
      errorBehavior: "handleGracefully",
    },
  }
);
console.log(
  `Last Message after gracefully handling error: ${
    res.messages.at(-1)?.content
  }`
);

/**
 * Scenario 2: escalate error, this should throw an error
 */
await agent.invoke(
  {
    messages: [new HumanMessage("What is the latest price for MSFT?")],
  },
  {
    context: {
      errorBehavior: "escalate",
    },
  }
);
