import type { BaseMessage, ContentBlock } from "@langchain/core/messages";

/**
 * Returns the message's refusal block, if any.
 *
 * A translator error is treated as no refusal, so it cannot break parsing that
 * worked before refusals were checked.
 */
export function findRefusal(
  message: BaseMessage
): ContentBlock.Refusal | undefined {
  try {
    return message.contentBlocks.find(
      (block): block is ContentBlock.Refusal => block.type === "refusal"
    );
  } catch {
    return undefined;
  }
}
