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
 * Characters that typically map to far more than 1 token / 4 chars under
 * modern BPE tokenizers (e.g. o200k_base). Using a Latin-only density here
 * under-counts Korean/Japanese/Chinese/Thai/Emoji text by ~40–66%, which
 * delays summarization and context-editing budget triggers (see #11304).
 */
function isHighTokenDensityCodePoint(code: number): boolean {
  return (
    // CJK Unified Ideographs + Extension A
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    // Hiragana / Katakana
    (code >= 0x3040 && code <= 0x30ff) ||
    // Hangul Jamo + Hangul Syllables
    (code >= 0x1100 && code <= 0x11ff) ||
    (code >= 0xac00 && code <= 0xd7af) ||
    // Thai
    (code >= 0x0e00 && code <= 0x0e7f) ||
    // Hebrew / Arabic (right-to-left scripts with dense tokenization)
    (code >= 0x0590 && code <= 0x05ff) ||
    (code >= 0x0600 && code <= 0x06ff) ||
    // Common emoji blocks
    (code >= 0x1f300 && code <= 0x1faff) ||
    (code >= 0x1f600 && code <= 0x1f64f)
  );
}

/**
 * Approximate token weight for a string, accounting for script density.
 *
 * Latin / code-like text ≈ 4 chars per token; CJK / Hangul / Kana / Thai /
 * emoji ≈ 1.5 chars per token (≈ measured o200k_base density for those scripts).
 */
function approximateTokenWeight(text: string): number {
  const DENSE_CHARS_PER_TOKEN = 1.5;
  const SPARSE_CHARS_PER_TOKEN = 4;
  let denseChars = 0;
  let sparseChars = 0;

  for (const char of text) {
    const code = char.codePointAt(0);
    if (code === undefined) continue;
    // Skip the trail surrogate pair half when iterating by code unit via for-of
    // — `for…of` yields full code points for astral-plane chars.
    if (isHighTokenDensityCodePoint(code)) {
      denseChars += 1;
    } else {
      sparseChars += 1;
    }
  }

  return (
    denseChars / DENSE_CHARS_PER_TOKEN + sparseChars / SPARSE_CHARS_PER_TOKEN
  );
}

/**
 * Default token counter that approximates based on character count.
 *
 * Script-aware: non-Latin scripts (CJK, Hangul, Kana, Thai, emoji, etc.)
 * are counted at a higher density so summarization / context-editing budgets
 * still fire on multilingual histories. Tools, when provided, contribute
 * their stringified schemas under the same estimator.
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
  let totalWeight = 0;

  // Count tokens for tools if provided
  if (tools && tools.length > 0) {
    for (const tool of tools) {
      const toolDict = isLangChainTool(tool) ? convertToOpenAITool(tool) : tool;
      totalWeight += approximateTokenWeight(JSON.stringify(toolDict));
    }
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

    totalWeight += approximateTokenWeight(textContent);
  }

  return Math.ceil(totalWeight);
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
  retryNumber: number
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

  return delay;
}
