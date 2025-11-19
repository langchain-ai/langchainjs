import {
  AIMessage,
  ToolMessage,
  type BaseMessage,
} from "@langchain/core/messages";
import {
  AfterModelHook,
  AfterAgentHook,
  BeforeAgentHook,
  BeforeModelHook,
} from "./types.js";
import { JumpToTarget } from "../constants.js";

/**
 * Default token counter that approximates based on character count
 * @param messages Messages to count tokens for
 * @returns Approximate token count
 */
export function countTokensApproximately(messages: BaseMessage[]): number {
  let totalChars = 0;
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

    totalChars += textContent.length;
  }
  // Approximate 1 token = 4 characters
  return Math.ceil(totalChars / 4);
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
