import { Ratelimit } from "@upstash/ratelimit";
import { Serialized } from "@langchain/core/load/serializable";
import { LLMResult } from "@langchain/core/outputs";
import { ChainValues } from "@langchain/core/utils/types";
import { BaseCallbackHandler } from "@langchain/core/callbacks/base";

/**
 * Upstash Ratelimit Error
 *
 * Raised when the rate limit is reached in `UpstashRatelimitHandler`.
 */
class UpstashRatelimitError extends Error {
  type: "token" | "request";

  limit?: number;

  reset?: number;

  /**
   * @param message - Error message
   * @param type - The kind of limit which was reached. One of "token" or "request"
   * @param limit - The limit which was reached. Passed when type is request
   * @param reset - Unix timestamp in milliseconds when the limits are reset. Passed when type is request
   */
  constructor(
    message: string,
    type: "token" | "request",
    limit?: number,
    reset?: number
  ) {
    super(message);
    this.type = type;
    this.limit = limit;
    this.reset = reset;
  }
}

interface UpstashRatelimitHandlerOptions {
  tokenRatelimit?: Ratelimit;
  requestRatelimit?: Ratelimit;
  includeOutputTokens?: boolean;

  llmOutputTokenUsageField?: string;
  llmOutputTotalTokenField?: string;
  llmOutputPromptTokenField?: string;
}

/**
 * Callback to handle rate limiting based on the number of requests
 * or the number of tokens in the input.
 *
 * It uses Upstash Ratelimit to track the rate limit which utilizes
 * Upstash Redis to track the state.
 *
 * Should not be passed to the chain when initializing the chain.
 * This is because the handler has a state which should be fresh
 * every time invoke is called. Instead, initialize and pass a handler
 * every time you invoke.
 */
class UpstashRatelimitHandler extends BaseCallbackHandler {
  name = "UpstashRatelimit";

  raiseError = true;

  private _checked = false;

  identifier: string;

  tokenRatelimit?: Ratelimit;

  requestRatelimit?: Ratelimit;

  includeOutputTokens: boolean;

  llmOutputTokenUsageField: string;

  llmOutputTotalTokenField: string;

  llmOutputPromptTokenField: string;

  /**
   * @param identifier - The identifier to rate limit, like a user ID or an IP address
   * @param options - Ratelimit options
   */
  constructor(identifier: string, options: UpstashRatelimitHandlerOptions) {
    super();
    if (!options.tokenRatelimit && !options.requestRatelimit) {
      throw new Error(
        "You must pass at least one of tokenRatelimit or requestRatelimit."
      );
    }
    this.identifier = identifier;
    this.tokenRatelimit = options.tokenRatelimit;
    this.requestRatelimit = options.requestRatelimit;
    this.includeOutputTokens = options.includeOutputTokens ?? false;

    this.llmOutputTokenUsageField =
      options.llmOutputTokenUsageField ?? "tokenUsage";
    this.llmOutputTotalTokenField =
      options.llmOutputTotalTokenField ?? "totalTokens";
    this.llmOutputPromptTokenField =
      options.llmOutputPromptTokenField ?? "promptTokens";

    this.awaitHandlers = true;
  }

  /**
   * Run when the chain starts running.
   *
   * This method is called multiple times during a chain execution.
   * To ensure it only runs once, it checks and updates a `_checked` state.
   *
   * @param _chain - Serialized chain
   * @param _inputs - Chain input values
   * @throws UpstashRatelimitError - If the request rate limit is reached
   */
  async handleChainStart(
    _chain: Serialized,
    _inputs: ChainValues
  ): Promise<void> {
    if (this.requestRatelimit && !this._checked) {
      const response = await this.requestRatelimit.limit(this.identifier);
      if (!response.success) {
        throw new UpstashRatelimitError(
          "Request limit reached!",
          "request",
          response.limit,
          response.reset
        );
      }
      this._checked = true;
    }
  }

  /**
   * Run when the LLM starts running.
   *
   * @param _llm - Serialized LLM
   * @param _prompts - Prompts passed to the LLM
   * @throws UpstashRatelimitError - If the token rate limit is reached
   */
  async handleLLMStart(
    _llm: Serialized,
    _prompts: string[],
    _runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
    _name?: string
  ): Promise<void> {
    if (this.tokenRatelimit) {
      const result = await this.tokenRatelimit.getRemaining(this.identifier);

      // result of getRemaining was changed from a number to an object in v2.0.0.
      // we check to make sure that it works with versions before & after:
      const remaining = typeof result === "number" ? result : result.remaining;

      if (remaining <= 0) {
        throw new UpstashRatelimitError("Token limit reached!", "token");
      }
    }
  }

  /**
   * Run when the LLM ends running.
   *
   * If the `includeOutputTokens` is set to true, the number of tokens
   * in the LLM completion are counted for rate limiting.
   *
   * @param output - LLM result output
   * @throws Error - If the LLM response does not include required token usage information
   */
  async handleLLMEnd(
    output: LLMResult,
    _runId: string,
    _parentRunId?: string,
    _tags?: string[]
  ): Promise<void> {
    if (this.tokenRatelimit) {
      const llmOutput = output.llmOutput || {};
      try {
        const tokenUsage = llmOutput[this.llmOutputTokenUsageField];
        const tokenCount = this.includeOutputTokens
          ? tokenUsage[this.llmOutputTotalTokenField]
          : tokenUsage[this.llmOutputPromptTokenField];

        if (tokenCount !== undefined) {
          await this.tokenRatelimit.limit(this.identifier, {
            rate: tokenCount,
          });
        } else {
          throw new Error("tokenCount not found in llm output");
        }
      } catch (error) {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (error instanceof UpstashRatelimitError) {
          throw error;
        }
        console.error(
          `Failed to log token usage for Upstash rate limit. It could be because the LLM returns the token usage in a different format than expected. See UpstashRatelimitHandler parameters. Got error: ${error}`
        );
      }
    }
  }

  /**
   * Creates a new UpstashRatelimitHandler object with the same
   * ratelimit configurations but with a new identifier if it's
   * provided.
   *
   * Also resets the state of the handler.
   *
   * @param identifier - Optional new identifier to use for the new handler instance
   * @returns New UpstashRatelimitHandler instance
   */
  reset(identifier?: string): UpstashRatelimitHandler {
    return new UpstashRatelimitHandler(identifier ?? this.identifier, {
      tokenRatelimit: this.tokenRatelimit,
      requestRatelimit: this.requestRatelimit,
      includeOutputTokens: this.includeOutputTokens,
    });
  }
}

export {
  UpstashRatelimitHandler,
  UpstashRatelimitError,
  UpstashRatelimitHandlerOptions,
};
