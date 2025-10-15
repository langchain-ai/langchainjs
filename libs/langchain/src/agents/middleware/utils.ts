import type { BaseMessage } from "@langchain/core/messages";

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
    totalChars += textContent.length;
  }
  // Approximate 1 token = 4 characters
  return Math.ceil(totalChars / 4);
}
