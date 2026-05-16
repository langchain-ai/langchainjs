import { AIMessage } from "../ai.js";
import { ContentBlock } from "../content/index.js";
import type { StandardContentBlockTranslator } from "./index.js";
import { iife, _isContentBlock, _isObject, _isString } from "./utils.js";

function convertToV1FromChatGoogleMessage(
  message: AIMessage
): Array<ContentBlock.Standard> {
  function* iterateContent(): Iterable<ContentBlock.Standard> {
    const content = iife(() => {
      if (typeof message.content === "string") {
        if (message.additional_kwargs.originalTextContentBlock) {
          return [
            {
              ...message.additional_kwargs.originalTextContentBlock,
              type: "text",
            },
          ];
        } else {
          return [{ type: "text", text: message.content }];
        }
      } else {
        const originalBlock = message.additional_kwargs
          ?.originalTextContentBlock as Record<string, unknown> | undefined;
        if (originalBlock?.thoughtSignature) {
          // During streaming with thinking models, thoughtSignature arrives in
          // a metadata-only chunk and is stored in originalTextContentBlock.
          // When content is an array (due to thinking parts), this signature
          // isn't carried into the content array by mergeContent().
          // Merge it into the last non-thinking text block.
          const hasSignatureInContent = message.content.some(
            (b: Record<string, unknown>) => "thoughtSignature" in b
          );
          if (!hasSignatureInContent) {
            const result = [...message.content];
            for (let i = result.length - 1; i >= 0; i--) {
              const block = result[i] as Record<string, unknown>;
              if (block.type === "text" && !block.thought) {
                block.thoughtSignature = originalBlock.thoughtSignature;
                return result;
              }
            }
          }
        }
        return message.content;
      }
    });
    for (const block of content) {
      const contentBlockBase: ContentBlock.Standard = iife(() => {
        if (_isContentBlock(block, "text") && _isString(block.text)) {
          return {
            type: "text",
            text: block.text,
          };
        } else if (
          _isContentBlock(block, "inlineData") &&
          _isObject(block.inlineData) &&
          _isString(block.inlineData.mimeType) &&
          _isString(block.inlineData.data)
        ) {
          return {
            type: "file",
            mimeType: block.inlineData.mimeType,
            data: block.inlineData.data,
          };
        } else if (
          _isContentBlock(block, "functionCall") &&
          _isObject(block.functionCall) &&
          _isString(block.functionCall.name) &&
          _isObject(block.functionCall.args)
        ) {
          return {
            type: "tool_call",
            id: message.id,
            name: block.functionCall.name,
            args: block.functionCall.args,
          };
        } else if (_isContentBlock(block, "functionResponse")) {
          return { type: "non_standard", value: block };
        } else if (
          _isContentBlock(block, "fileData") &&
          _isObject(block.fileData) &&
          _isString(block.fileData.mimeType) &&
          _isString(block.fileData.fileUri)
        ) {
          return {
            type: "file",
            mimeType: block.fileData.mimeType,
            fileId: block.fileData.fileUri,
          };
        } else if (_isContentBlock(block, "executableCode")) {
          return { type: "non_standard", value: block };
        } else if (_isContentBlock(block, "codeExecutionResult")) {
          return { type: "non_standard", value: block };
        }
        return { type: "non_standard", value: block };
      });
      const contentBlock: ContentBlock.Standard = iife(() => {
        if ("thought" in block && block.thought) {
          const reasoning: string =
            contentBlockBase.type === "text" ? contentBlockBase.text : "";
          return {
            type: "reasoning",
            reasoning,
            reasoningContentBlock: contentBlockBase,
          };
        } else {
          return contentBlockBase;
        }
      });

      const ret: ContentBlock.Standard = {
        thought: block.thought,
        thoughtSignature: block.thoughtSignature,
        partMetadata: block.partMetadata,
        ...contentBlock,
      };
      for (const attribute in ret) {
        if (ret[attribute] === undefined) {
          delete ret[attribute];
        }
      }

      yield ret;
      continue;
    }
  }
  return Array.from(iterateContent());
}

export const ChatGoogleTranslator: StandardContentBlockTranslator = {
  translateContent: convertToV1FromChatGoogleMessage,
  translateContentChunk: convertToV1FromChatGoogleMessage,
};
