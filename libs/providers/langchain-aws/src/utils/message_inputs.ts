import type {
  MessageContentComplex,
  BaseMessage,
  SystemMessage,
  HumanMessage,
  StandardContentBlockConverter,
  ContentBlock,
} from "@langchain/core/messages";
import {
  AIMessage,
  ToolMessage,
  parseBase64DataUrl,
  parseMimeType,
  convertToProviderContentBlock,
  isDataContentBlock,
} from "@langchain/core/messages";
import type {
  Message as BedrockMessage,
  SystemContentBlock as BedrockSystemContentBlock,
  ContentBlock as BedrockContentBlock,
  ImageFormat,
  ReasoningContentBlock,
  ReasoningTextBlock,
  DocumentFormat,
  ToolResultContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType as __DocumentType } from "@smithy/types";
import {
  MessageContentReasoningBlock,
  MessageContentReasoningBlockReasoningText,
  MessageContentReasoningBlockRedacted,
} from "../types.js";

function isDefaultCachePoint(block: unknown): boolean {
  return Boolean(
    typeof block === "object" &&
      block !== null &&
      "cachePoint" in block &&
      block.cachePoint &&
      typeof block.cachePoint === "object" &&
      block.cachePoint !== null &&
      "type" in block.cachePoint &&
      block.cachePoint.type === "default"
  );
}

export function extractImageInfo(
  base64: string
): BedrockContentBlock.ImageMember {
  // Extract the format from the base64 string
  const formatMatch = base64.match(/^data:image\/(\w+);base64,/);
  let format: ImageFormat | undefined;
  if (formatMatch) {
    const extractedFormat = formatMatch[1].toLowerCase();
    if (["gif", "jpeg", "png", "webp"].includes(extractedFormat)) {
      format = extractedFormat as ImageFormat;
    }
  }

  // Remove the data URL prefix if present
  const base64Data = base64.replace(/^data:image\/\w+;base64,/, "");

  // Convert base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i += 1) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return {
    image: {
      format,
      source: {
        bytes,
      },
    },
  };
}

const standardContentBlockConverter: StandardContentBlockConverter<{
  text: BedrockContentBlock.TextMember;
  image: BedrockContentBlock.ImageMember;
  file: BedrockContentBlock.DocumentMember;
}> = {
  providerName: "ChatBedrockConverse",

  fromStandardTextBlock(
    block: ContentBlock.Data.StandardTextBlock
  ): BedrockContentBlock.TextMember {
    return {
      text: block.text,
    };
  },

  fromStandardImageBlock(
    block: ContentBlock.Data.StandardImageBlock
  ): BedrockContentBlock.ImageMember {
    let format: ImageFormat | undefined;

    if (block.source_type === "url") {
      const parsedData = parseBase64DataUrl({
        dataUrl: block.url,
        asTypedArray: true,
      });
      if (parsedData) {
        const parsedMimeType = parseMimeType(parsedData.mime_type);
        format = parsedMimeType.type as ImageFormat;
        return {
          image: {
            format,
            source: {
              bytes: parsedData.data,
            },
          },
        };
      } else {
        throw new Error(
          "Only base64 data URLs are supported for image blocks with source type 'url' with ChatBedrockConverse."
        );
      }
    } else if (block.source_type === "base64") {
      if (block.mime_type) {
        const parsedMimeType = parseMimeType(block.mime_type);
        format = parsedMimeType.subtype as ImageFormat;
      }

      if (format && !["gif", "jpeg", "png", "webp"].includes(format)) {
        throw new Error(
          `Unsupported image mime type: "${block.mime_type}" ChatBedrockConverse only supports "image/gif", "image/jpeg", "image/png", and "image/webp" formats.`
        );
      }
      return {
        image: {
          format,
          source: {
            bytes: Uint8Array.from(atob(block.data), (c) => c.charCodeAt(0)),
          },
        },
      };
    } else if (block.source_type === "id") {
      throw new Error(
        "Image source type 'id' not supported with ChatBedrockConverse."
      );
    } else {
      throw new Error(
        `Unsupported image source type: "${
          (block as { source_type: string }).source_type
        }" with ChatBedrockConverse.`
      );
    }
  },

  fromStandardFileBlock(
    block: ContentBlock.Data.StandardFileBlock
  ): BedrockContentBlock.DocumentMember {
    const mimeTypeToDocumentFormat = {
      "text/csv": "csv",
      "application/msword": "doc",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
        "docx",
      "text/html": "html",
      "text/markdown": "md",
      "application/pdf": "pdf",
      "text/plain": "txt",
      "application/vnd.ms-excel": "xls",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
        "xlsx",
    };
    const name: string | undefined = (block.metadata?.name ??
      block.metadata?.filename ??
      block.metadata?.title) as string | undefined;

    if (block.source_type === "text") {
      return {
        document: {
          name,
          format: "txt",
          source: {
            bytes: new TextEncoder().encode(block.text),
          },
        },
      };
    }

    if (block.source_type === "url") {
      const parsedData = parseBase64DataUrl({
        dataUrl: block.url,
        asTypedArray: true,
      });

      if (parsedData) {
        const parsedMimeType = parseMimeType(
          parsedData.mime_type ?? block.mime_type
        );
        const mimeType = `${parsedMimeType.type}/${parsedMimeType.subtype}`;
        const format = mimeTypeToDocumentFormat[
          mimeType as keyof typeof mimeTypeToDocumentFormat
        ] as DocumentFormat | undefined;
        return {
          document: {
            name,
            format,
            source: {
              bytes: parsedData.data,
            },
          },
        };
      }
      throw new Error(
        "Only base64 data URLs are supported for file blocks with source type 'url' with ChatBedrockConverse."
      );
    }

    if (block.source_type === "base64") {
      let format: DocumentFormat | undefined;

      if (block.mime_type) {
        const parsedMimeType = parseMimeType(block.mime_type);
        const mimeType = `${parsedMimeType.type}/${parsedMimeType.subtype}`;
        format = mimeTypeToDocumentFormat[
          mimeType as keyof typeof mimeTypeToDocumentFormat
        ] as DocumentFormat | undefined;
        if (format === undefined) {
          throw new Error(
            `Unsupported file mime type: "${
              block.mime_type
            }" ChatBedrockConverse only supports ${Object.keys(
              mimeTypeToDocumentFormat
            ).join(", ")} formats.`
          );
        }
      }

      return {
        document: {
          name,
          format,
          source: {
            bytes: Uint8Array.from(atob(block.data), (c) => c.charCodeAt(0)),
          },
        },
      };
    }

    if (block.source_type === "id") {
      throw new Error(
        "File source type 'id' not supported with ChatBedrockConverse."
      );
    }

    throw new Error(
      `Unsupported file source type: "${
        (block as { source_type: string }).source_type
      }" with ChatBedrockConverse.`
    );
  },
};

function convertLangChainContentBlockToConverseContentBlock<
  BlockT extends
    | MessageContentComplex
    | ContentBlock.Data.DataContentBlock
    | string
>({
  block,
  onUnknown,
}: {
  block: BlockT;
  onUnknown?: "returnUnmodified";
}): ContentBlock | BlockT;

function convertLangChainContentBlockToConverseContentBlock<
  BlockT extends
    | MessageContentComplex
    | ContentBlock.Data.DataContentBlock
    | string
>({ block, onUnknown }: { block: BlockT; onUnknown?: "throw" }): ContentBlock;

function convertLangChainContentBlockToConverseContentBlock<
  BlockT extends
    | MessageContentComplex
    | ContentBlock.Data.DataContentBlock
    | string
>({
  block,
  onUnknown = "throw",
}: {
  block: BlockT;
  onUnknown?: "throw" | "returnUnmodified";
}): ContentBlock | BlockT {
  if (typeof block === "string") {
    return { text: block };
  }

  if (isDataContentBlock(block)) {
    return convertToProviderContentBlock(block, standardContentBlockConverter);
  }

  if (block.type === "text") {
    return { text: block.text };
  }

  if (block.type === "image_url") {
    return extractImageInfo(
      typeof block.image_url === "string"
        ? block.image_url
        : block.image_url.url
    );
  }

  if (block.type === "document" && block.document !== undefined) {
    return {
      document: block.document,
    };
  }

  if (block.type === "image" && block.image !== undefined) {
    return {
      image: block.image,
    };
  }

  if (isDefaultCachePoint(block)) {
    return {
      cachePoint: {
        type: "default",
      },
    };
  }

  if (onUnknown === "throw") {
    throw new Error(`Unsupported content block type: ${block.type}`);
  } else {
    return block;
  }
}

function convertSystemMessageToConverseMessage(
  msg: SystemMessage
): BedrockSystemContentBlock[] {
  if (typeof msg.content === "string") {
    return [{ text: msg.content }];
  } else if (Array.isArray(msg.content) && msg.content.length > 0) {
    const contentBlocks: BedrockSystemContentBlock[] = [];
    for (const block of msg.content) {
      if (block.type === "text" && typeof block.text === "string") {
        contentBlocks.push({
          text: block.text,
        });
      } else if (isDefaultCachePoint(block)) {
        contentBlocks.push({
          cachePoint: {
            type: "default",
          },
        });
      } else break;
    }
    if (msg.content.length === contentBlocks.length) return contentBlocks;
  }
  throw new Error(
    "System message content must be either a string, or an array of text blocks, optionally including a cache point."
  );
}

function convertAIMessageToConverseMessage(msg: AIMessage): BedrockMessage {
  const assistantMsg: BedrockMessage = {
    role: "assistant",
    content: [],
  };

  if (typeof msg.content === "string" && msg.content !== "") {
    assistantMsg.content?.push({
      text: msg.content,
    });
  } else if (Array.isArray(msg.content)) {
    const concatenatedBlocks = concatenateLangchainReasoningBlocks(msg.content);
    const contentBlocks: ContentBlock[] = [];
    concatenatedBlocks.forEach((block) => {
      if (block.type === "text" && block.text !== "") {
        // Merge whitespace/newlines with previous text blocks to avoid validation errors.
        const cleanedText = block.text?.replace(/\n/g, "").trim();
        if (cleanedText === "") {
          if (contentBlocks.length > 0) {
            const mergedTextContent = `${
              contentBlocks[contentBlocks.length - 1].text
            }${block.text}`;
            contentBlocks[contentBlocks.length - 1].text = mergedTextContent;
          }
        } else {
          contentBlocks.push({
            text: block.text,
          });
        }
      } else if (block.type === "reasoning_content") {
        contentBlocks.push({
          reasoningContent: langchainReasoningBlockToBedrockReasoningBlock(
            block as MessageContentReasoningBlock
          ),
        });
      } else if (isDefaultCachePoint(block)) {
        contentBlocks.push({
          cachePoint: {
            type: "default",
          },
        });
      } else {
        const blockValues = Object.fromEntries(
          Object.entries(block).filter(([key]) => key !== "type")
        );
        throw new Error(
          `Unsupported content block type: ${
            block.type
          } with content of ${JSON.stringify(blockValues, null, 2)}`
        );
      }
    });

    assistantMsg.content = [
      ...(assistantMsg.content ? assistantMsg.content : []),
      ...contentBlocks,
    ];
  }

  // Important: this must be placed after any reasoning content blocks, else claude models will return an error.
  if (msg.tool_calls && msg.tool_calls.length) {
    assistantMsg.content = [
      ...(assistantMsg.content ? assistantMsg.content : []),
      ...msg.tool_calls.map((tc) => ({
        toolUse: {
          toolUseId: tc.id,
          name: tc.name,
          input: tc.args,
        },
      })),
    ];
  }

  return assistantMsg;
}

function convertHumanMessageToConverseMessage(
  msg: HumanMessage
): BedrockMessage {
  if (msg.content === "") {
    throw new Error(
      `Invalid message content: empty string. '${msg.getType()}' must contain non-empty content.`
    );
  }

  const content: ContentBlock[] = Array.isArray(msg.content)
    ? msg.content.map((c) =>
        convertLangChainContentBlockToConverseContentBlock({
          block: c,
          onUnknown: "throw",
        })
      )
    : [
        convertLangChainContentBlockToConverseContentBlock({
          block: msg.content,
          onUnknown: "throw",
        }),
      ];

  return {
    role: "user" as const,
    content,
  };
}

function convertToolMessageToConverseMessage(msg: ToolMessage): BedrockMessage {
  const castMsg = msg as ToolMessage;
  if (typeof castMsg.content === "string") {
    return {
      // Tool use messages are always from the user
      role: "user" as const,
      content: [
        {
          toolResult: {
            toolUseId: castMsg.tool_call_id,
            content: [
              {
                text: castMsg.content,
              },
            ],
          },
        },
      ],
    };
  } else {
    return {
      // Tool use messages are always from the user
      role: "user" as const,
      content: [
        {
          toolResult: {
            toolUseId: castMsg.tool_call_id,
            content: (
              msg.content as (
                | MessageContentComplex
                | ContentBlock.Data.DataContentBlock
              )[]
            ).map((c) => {
              const converted =
                convertLangChainContentBlockToConverseContentBlock({
                  block: c,
                  onUnknown: "returnUnmodified",
                });
              if (converted !== c) {
                return converted as ToolResultContentBlock;
              }
              return { json: c } as ToolResultContentBlock.JsonMember;
            }),
          },
        },
      ],
    };
  }
}

export function convertToConverseMessages(messages: BaseMessage[]): {
  converseMessages: BedrockMessage[];
  converseSystem: BedrockSystemContentBlock[];
} {
  const converseSystem: BedrockSystemContentBlock[] = messages
    .filter((msg) => msg.getType() === "system")
    .flatMap((msg) => convertSystemMessageToConverseMessage(msg));

  const converseMessages: BedrockMessage[] = messages
    .filter((msg) => msg.getType() !== "system")
    .map((msg) => {
      if (msg.getType() === "ai") {
        return convertAIMessageToConverseMessage(msg as AIMessage);
      } else if (msg.getType() === "human" || msg.getType() === "generic") {
        return convertHumanMessageToConverseMessage(msg as HumanMessage);
      } else if (msg.getType() === "tool") {
        return convertToolMessageToConverseMessage(msg as ToolMessage);
      } else {
        throw new Error(`Unsupported message type: ${msg.getType()}`);
      }
    });

  // Combine consecutive user tool result messages into a single message
  const combinedConverseMessages = converseMessages.reduce<BedrockMessage[]>(
    (acc, curr) => {
      const lastMessage = acc[acc.length - 1];

      if (
        lastMessage &&
        lastMessage.role === "user" &&
        lastMessage.content?.some((c) => "toolResult" in c) &&
        curr.role === "user" &&
        curr.content?.some((c) => "toolResult" in c)
      ) {
        lastMessage.content = lastMessage.content.concat(curr.content);
      } else {
        acc.push(curr);
      }

      return acc;
    },
    []
  );

  return { converseMessages: combinedConverseMessages, converseSystem };
}

export function langchainReasoningBlockToBedrockReasoningBlock(
  content: MessageContentReasoningBlock
): ReasoningContentBlock {
  if (content.type !== "reasoning_content") {
    throw new Error("Invalid reasoning content");
  }
  if ("reasoningText" in content) {
    return {
      reasoningText: content.reasoningText as ReasoningTextBlock,
    };
  }
  if ("redactedContent" in content) {
    return {
      redactedContent: Buffer.from(content.redactedContent, "base64"),
    };
  }
  throw new Error("Invalid reasoning content");
}

export function concatenateLangchainReasoningBlocks(
  content: Array<MessageContentComplex | MessageContentReasoningBlock>
): MessageContentComplex[] {
  const concatenatedBlocks: MessageContentComplex[] = [];
  let concatenatedBlock: Partial<MessageContentReasoningBlock> = {};

  for (const block of content) {
    if (block.type !== "reasoning_content") {
      // if it's some other block type, end the current block, but keep it so we preserve order
      if (Object.keys(concatenatedBlock).length > 0) {
        concatenatedBlocks.push(
          concatenatedBlock as MessageContentReasoningBlock
        );
        concatenatedBlock = {};
      }
      concatenatedBlocks.push(block);
      continue;
    }

    // non-redacted block
    if ("reasoningText" in block && typeof block.reasoningText === "object") {
      if ("redactedContent" in concatenatedBlock) {
        // new type of block, so end the previous one
        concatenatedBlocks.push(
          concatenatedBlock as MessageContentReasoningBlock
        );
        concatenatedBlock = {};
      }
      const { text, signature } = block.reasoningText as Partial<
        MessageContentReasoningBlockReasoningText["reasoningText"]
      >;
      const { text: prevText, signature: prevSignature } = (
        "reasoningText" in concatenatedBlock
          ? concatenatedBlock.reasoningText
          : {}
      ) as Partial<MessageContentReasoningBlockReasoningText["reasoningText"]>;

      concatenatedBlock = {
        type: "reasoning_content",
        reasoningText: {
          ...((concatenatedBlock as MessageContentReasoningBlockReasoningText)
            .reasoningText ?? {}),
          ...(prevText !== undefined || text !== undefined
            ? { text: (prevText ?? "") + (text ?? "") }
            : {}),
          ...(prevSignature !== undefined || signature !== undefined
            ? { signature: (prevSignature ?? "") + (signature ?? "") }
            : {}),
        },
      };
      // if a partial block chunk has a signature, the next one will begin a new reasoning block.
      // full blocks always have signatures, so we start one now, anyway
      if ("signature" in block.reasoningText) {
        concatenatedBlocks.push(
          concatenatedBlock as MessageContentReasoningBlock
        );
        concatenatedBlock = {};
      }
    }

    if ("redactedContent" in block) {
      if ("reasoningText" in concatenatedBlock) {
        // New type of block, so end the previous one. We should't really hit
        // this, as we'll have created a new block upon encountering the
        // signature above, but better safe than sorry.
        concatenatedBlocks.push(
          concatenatedBlock as MessageContentReasoningBlock
        );
        concatenatedBlock = {};
      }
      const { redactedContent } = block;
      const prevRedactedContent = (
        "redactedContent" in concatenatedBlock
          ? concatenatedBlock.redactedContent!
          : ""
      ) as Partial<MessageContentReasoningBlockRedacted["redactedContent"]>;
      concatenatedBlock = {
        type: "reasoning_content",
        redactedContent: prevRedactedContent + redactedContent,
      };
    }
  }
  if (Object.keys(concatenatedBlock).length > 0) {
    concatenatedBlocks.push(concatenatedBlock as MessageContentReasoningBlock);
  }
  return concatenatedBlocks;
}
