import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import { isLangChainTool } from "@langchain/core/tools";
import { convertToOpenAITool } from "@langchain/core/utils/function_calling";
import {
  AfterModelHook,
  AfterAgentHook,
  BeforeAgentHook,
  BeforeModelHook,
} from "./types.js";
import { JumpToTarget } from "../constants.js";

/**
 * Default token counter that approximates based on character count.
 *
 * Uses different character-to-token ratios for Latin vs CJK scripts:
 * - Latin/ASCII: ~4 characters per token
 * - CJK (Chinese, Japanese, Korean): ~1.5 characters per token
 *
 * If tools are provided, the token count also includes stringified tool schemas.
 *
 * @param messages Messages to count tokens for
 * @param tools Optional list of tools to include in the token count. Each tool
 *   can be either a LangChain tool instance or a dict representing a tool schema.
 *   LangChain tool instances are converted to OpenAI tool format before counting.
 * @returns Approximate token count
 */
export function countTokensApproximately(
  messages: BaseMessage[],
  // oxlint-disable-next-line @typescript-eslint/no-explicit-any
  tools?: Array<Record<string, any>> | null
): number {
  const latinCharsPerToken = 4;
  const cjkCharsPerToken = 1.5;
  let latinChars = 0;
  let cjkChars = 0;

  // Count tokens for tools if provided
  if (tools && tools.length > 0) {
    let toolsChars = 0;
    for (const tool of tools) {
      const toolDict = isLangChainTool(tool) ? convertToOpenAITool(tool) : tool;
      toolsChars += JSON.stringify(toolDict).length;
    }
    latinChars += toolsChars;
  }

  for (const msg of messages) {
    let textContent: string;
    if (typeof msg.content === "string") {
      textContent = msg.content;
    } else if (Array.isArray(msg.content)) {
      textContent = msg.content
        .map((item) => {
          if (typeof item === "string") return item;
          if (item.type === "text" && "text" in item) return item.text;
          return "";
        })
        .join("");
    } else {
      textContent = "";
    }

    if (
      AIMessage.isInstance(msg) &&
      Array.isArray(msg.tool_calls) &&
      msg.tool_calls.length > 0
    ) {
      textContent += JSON.stringify(msg.tool_calls);
    }

    if (ToolMessage.isInstance(msg)) {
      textContent += msg.tool_call_id ?? "";
    }

    // Split text into CJK and non-CJK characters for more accurate counting
    for (const char of textContent) {
      const code = char.codePointAt(0)!;
      // CJK Unified Ideographs and extensions, Hangul, Katakana, Hiragana
      if (
        (code >= 0x4e00 && code <= 0x9fff) || // CJK Unified Ideographs
        (code >= 0x3400 && code <= 0x4dbf) || // CJK Extension A
        (code >= 0xf900 && code <= 0xfaff) || // CJK Compatibility Ideographs
        (code >= 0xac00 && code <= 0xd7af) || // Hangul Syllables
        (code >= 0x3040 && code <= 0x309f) || // Hiragana
        (code >= 0x30a0 && code <= 0x30ff) // Katakana
      ) {
        cjkChars += 1;
      } else {
        latinChars += 1;
      }
    }
  }

  const latinTokens = latinChars / latinCharsPerToken;
  const cjkTokens = cjkChars / cjkCharsPerToken;
  return Math.ceil(latinTokens + cjkTokens);
}

export function getHookConstraint(
  hook:
    | BeforeAgentHook
    | BeforeModelHook
    | AfterAgentHook
    | AfterModelHook
    | undefined
): JumpToTarget[] | undefined {
  if (!hook || typeof hook === "function") {
    return undefined;
  }
  return hook.canJumpTo;
}

export function getHookFunction(
  arg: BeforeAgentHook | BeforeModelHook | AfterAgentHook | AfterModelHook
) {
  if (typeof arg === "function") {
    return arg;
  }
  return arg.hook;
}

/**
 * Sleep for the specified number of milliseconds.
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate delay for a retry attempt with exponential backoff and jitter.
 *
 * @param retryNumber - The retry attempt number (0-indexed)
 * @param config - Configuration for backoff calculation
 * @param retryAfterMs - A provider-supplied wait hint, e.g. from a `Retry-After`
 *   header. Used as a floor so we never retry sooner than the server asked.
 * @returns Delay in milliseconds before next retry
 *
 * @internal Exported for testing purposes
 */
export function calculateRetryDelay(
  config: {
    backoffFactor: number;
    initialDelayMs: number;
    maxDelayMs: number;
    jitter: boolean;
  },
  retryNumber: number,
  retryAfterMs?: number
): number {
  const { backoffFactor, initialDelayMs, maxDelayMs, jitter } = config;

  let delay: number;
  if (backoffFactor === 0.0) {
    delay = initialDelayMs;
  } else {
    delay = initialDelayMs * backoffFactor ** retryNumber;
  }

  // Cap at maxDelayMs
  delay = Math.min(delay, maxDelayMs);

  if (jitter && delay > 0) {
    const jitterAmount = delay * 0.25;
    delay = delay + (Math.random() * 2 - 1) * jitterAmount;
    // Ensure delay is not negative after jitter
    delay = Math.max(0, delay);
  }

  return Math.max(delay, retryAfterMs ?? 0);
}

export function getRetryAfterMs(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) {
    return undefined;
  }
  const { retryAfterMs } = error as { retryAfterMs?: unknown };
  return typeof retryAfterMs === "number" && retryAfterMs >= 0
    ? retryAfterMs
    : undefined;
}
