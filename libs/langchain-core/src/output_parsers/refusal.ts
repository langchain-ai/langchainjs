import { ModelRefusalError } from "../errors/index.js";
import { isBaseMessage } from "../messages/base.js";
import type { ContentBlock } from "../messages/content/index.js";
import type { ChatGeneration, Generation } from "../outputs.js";

/**
 * Throws {@link ModelRefusalError} if the generation's message is a refusal.
 *
 * @internal
 */
export function throwIfRefused(
  generation: Generation | ChatGeneration | undefined
): void {
  if (!generation || !("message" in generation)) return;
  const { message } = generation;
  if (!isBaseMessage(message)) return;
  for (const block of message.contentBlocks) {
    if (block.type === "refusal") {
      throw ModelRefusalError.fromRefusal(
        block as ContentBlock.Refusal,
        message
      );
    }
  }
}
