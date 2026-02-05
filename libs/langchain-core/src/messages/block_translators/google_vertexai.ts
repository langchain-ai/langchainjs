import { AIMessage } from "../ai.js";
import { ContentBlock } from "../content/index.js";
import type { StandardContentBlockTranslator } from "./index.js";
import { _isArray, _isContentBlock, _isString, iife } from "./utils.js";

function convertToV1FromChatVertexMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  // see `/libs/providers/langchain-google-common/src/utils/gemini.ts:partsToMessageContent`
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    const content =
      typeof message.content === "string"
        ? [{ type: "text", text: message.content }]
        : message.content;
    for (const block of content) {
      if (_isContentBlock(block, "reasoning") && _isString(block.reasoning)) {
        const signature = iife(() => {
          const reasoningIndex = content.indexOf(block);
          if (
            _isArray(message.additional_kwargs?.signatures) &&
            reasoningIndex >= 0
          ) {
            return message.additional_kwargs.signatures.at(reasoningIndex);
          }
          return undefined;
        });
        if (_isString(signature)) {
          yield {
            type: "reasoning",
            reasoning: block.reasoning,
            signature,
          };
        } else {
          yield {
            type: "reasoning",
            reasoning: block.reasoning,
          };
        }
        continue;
      } else if (
        _isContentBlock(block, "thinking") &&
        _isString(block.thinking)
      ) {
        // Handle thinking blocks (Anthropic-style format used in some Google models)
        yield {
          type: "reasoning",
          reasoning: block.thinking,
          ...(block.signature ? { signature: block.signature } : {}),
        };
        continue;
      } else if (_isContentBlock(block, "text") && _isString(block.text)) {
        yield { type: "text", text: block.text };
        continue;
      } else if (_isContentBlock(block, "image_url")) {
        if (_isString(block.image_url)) {
          if (block.image_url.startsWith("data:")) {
            const dataUrlRegex = /^data:([^;]+);base64,(.+)$/;
            const match = block.image_url.match(dataUrlRegex);
            if (match) {
              yield { type: "image", data: match[2], mimeType: match[1] };
            } else {
              yield { type: "image", url: block.image_url };
            }
          } else {
            yield { type: "image", url: block.image_url };
          }
        }
        continue;
      } else if (
        _isContentBlock(block, "media") &&
        _isString(block.mimeType) &&
        _isString(block.data)
      ) {
        yield { type: "file", mimeType: block.mimeType, data: block.data };
        continue;
      }
      yield { type: "non_standard", value: block };
    }
  }
  return Array.from(iterateContent());
}

export const ChatVertexTranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromChatVertexMessage,
  translateContentChunk: convertToV1FromChatVertexMessage,
};
