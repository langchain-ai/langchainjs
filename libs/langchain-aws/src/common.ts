import type {
  MessageContentComplex,
  BaseMessage,
  UsageMetadata,
  SystemMessage,
  HumanMessage,
  DataContentBlock,
  StandardContentBlockConverter,
  StandardTextBlock,
  StandardImageBlock,
  StandardFileBlock,
} from "@langchain/core/messages";
import {
  AIMessage,
  AIMessageChunk,
  ToolMessage,
  parseBase64DataUrl,
  parseMimeType,
  convertToProviderContentBlock,
  isDataContentBlock,
} from "@langchain/core/messages";
import type { ToolCall } from "@langchain/core/messages/tool";
import { isOpenAITool } from "@langchain/core/language_models/base";
import type {
  Message as BedrockMessage,
  SystemContentBlock as BedrockSystemContentBlock,
  Tool as BedrockTool,
  ContentBlock,
  ImageFormat,
  ConverseResponse,
  ContentBlockDeltaEvent,
  ConverseStreamMetadataEvent,
  ContentBlockStartEvent,
  ReasoningContentBlock,
  ReasoningContentBlockDelta,
  ReasoningTextBlock,
  DocumentFormat,
  ToolResultContentBlock,
} from "@aws-sdk/client-bedrock-runtime";
import type { DocumentType as __DocumentType } from "@smithy/types";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { isInteropZodSchema } from "@langchain/core/utils/types";
import { toJsonSchema } from "@langchain/core/utils/json_schema";
import {
  ChatBedrockConverseToolType,
  BedrockToolChoice,
  MessageContentReasoningBlock,
  MessageContentReasoningBlockReasoningText,
  MessageContentReasoningBlockReasoningTextPartial,
  MessageContentReasoningBlockRedacted,
} from "./types.js";

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

const standardContentBlockConverter: StandardContentBlockConverter<{
  text: ContentBlock.TextMember;
  image: ContentBlock.ImageMember;
  file: ContentBlock.DocumentMember;
}> = {
  providerName: "ChatBedrockConverse",

  fromStandardTextBlock(block: StandardTextBlock): ContentBlock.TextMember {
    return {
      text: block.text,
    };
  },

  fromStandardImageBlock(block: StandardImageBlock): ContentBlock.ImageMember {
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

  fromStandardFileBlock(block: StandardFileBlock): ContentBlock.DocumentMember {
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

export function extractImageInfo(base64: string): ContentBlock.ImageMember {
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

function convertLangChainContentBlockToConverseContentBlock<
  BlockT extends MessageContentComplex | DataContentBlock | string
>({
  block,
  onUnknown,
}: {
  block: BlockT;
  onUnknown?: "returnUnmodified";
}): ContentBlock | BlockT;

function convertLangChainContentBlockToConverseContentBlock<
  BlockT extends MessageContentComplex | DataContentBlock | string
>({ block, onUnknown }: { block: BlockT; onUnknown?: "throw" }): ContentBlock;

function convertLangChainContentBlockToConverseContentBlock<
  BlockT extends MessageContentComplex | DataContentBlock | string
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
              msg.content as (MessageContentComplex | DataContentBlock)[]
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

export function isBedrockTool(tool: unknown): tool is BedrockTool {
  if (typeof tool === "object" && tool && "toolSpec" in tool) {
    return true;
  }
  return false;
}

export function convertToConverseTools(
  tools: ChatBedrockConverseToolType[]
): BedrockTool[] {
  if (tools.every(isOpenAITool)) {
    return tools.map((tool) => ({
      toolSpec: {
        name: tool.function.name,
        description: tool.function.description,
        inputSchema: {
          json: tool.function.parameters as __DocumentType,
        },
      },
    }));
  } else if (tools.every(isLangChainTool)) {
    return tools.map((tool) => ({
      toolSpec: {
        name: tool.name,
        description: tool.description,
        inputSchema: {
          json: (isInteropZodSchema(tool.schema)
            ? toJsonSchema(tool.schema)
            : tool.schema) as __DocumentType,
        },
      },
    }));
  } else if (tools.every(isBedrockTool)) {
    return tools;
  }

  throw new Error(
    "Invalid tools passed. Must be an array of StructuredToolInterface, ToolDefinition, or BedrockTool."
  );
}

export type BedrockConverseToolChoice =
  | "any"
  | "auto"
  | string
  | BedrockToolChoice;

export function convertToBedrockToolChoice(
  toolChoice: BedrockConverseToolChoice,
  tools: BedrockTool[],
  fields: {
    model: string;
    supportsToolChoiceValues?: Array<"auto" | "any" | "tool">;
  }
): BedrockToolChoice {
  const supportsToolChoiceValues = fields.supportsToolChoiceValues ?? [];

  let bedrockToolChoice: BedrockToolChoice;
  if (typeof toolChoice === "string") {
    switch (toolChoice) {
      case "any":
        bedrockToolChoice = {
          any: {},
        };
        break;
      case "auto":
        bedrockToolChoice = {
          auto: {},
        };
        break;
      default: {
        const foundTool = tools.find(
          (tool) => tool.toolSpec?.name === toolChoice
        );
        if (!foundTool) {
          throw new Error(
            `Tool with name ${toolChoice} not found in tools list.`
          );
        }
        bedrockToolChoice = {
          tool: {
            name: toolChoice,
          },
        };
      }
    }
  } else {
    bedrockToolChoice = toolChoice;
  }

  const toolChoiceType = Object.keys(bedrockToolChoice)[0] as
    | "auto"
    | "any"
    | "tool";
  if (!supportsToolChoiceValues.includes(toolChoiceType)) {
    let supportedTxt = "";
    if (supportsToolChoiceValues.length) {
      supportedTxt =
        `Model ${fields.model} does not currently support 'tool_choice' ` +
        `of type ${toolChoiceType}. The following 'tool_choice' types ` +
        `are supported: ${supportsToolChoiceValues.join(", ")}.`;
    } else {
      supportedTxt = `Model ${fields.model} does not currently support 'tool_choice'.`;
    }

    throw new Error(
      `${supportedTxt} Please see` +
        "https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ToolChoice.html" +
        "for the latest documentation on models that support tool choice."
    );
  }

  return bedrockToolChoice;
}

export function convertConverseMessageToLangChainMessage(
  message: BedrockMessage,
  responseMetadata: Omit<ConverseResponse, "output">
): BaseMessage {
  if (!message.content) {
    throw new Error("No message content found in response.");
  }
  if (message.role !== "assistant") {
    throw new Error(
      `Unsupported message role received in ChatBedrockConverse response: ${message.role}`
    );
  }
  let requestId: string | undefined;
  if (
    "$metadata" in responseMetadata &&
    responseMetadata.$metadata &&
    typeof responseMetadata.$metadata === "object" &&
    "requestId" in responseMetadata.$metadata
  ) {
    requestId = responseMetadata.$metadata.requestId as string;
  }
  let tokenUsage: UsageMetadata | undefined;
  if (responseMetadata.usage) {
    const input_tokens = responseMetadata.usage.inputTokens ?? 0;
    const output_tokens = responseMetadata.usage.outputTokens ?? 0;
    tokenUsage = {
      input_tokens,
      output_tokens,
      total_tokens:
        responseMetadata.usage.totalTokens ?? input_tokens + output_tokens,
    };
  }

  if (
    message.content?.length === 1 &&
    "text" in message.content[0] &&
    typeof message.content[0].text === "string"
  ) {
    return new AIMessage({
      content: message.content[0].text,
      response_metadata: responseMetadata,
      usage_metadata: tokenUsage,
      id: requestId,
    });
  } else {
    const toolCalls: ToolCall[] = [];
    const content: MessageContentComplex[] = [];
    message.content.forEach((c) => {
      if (
        "toolUse" in c &&
        c.toolUse &&
        c.toolUse.name &&
        c.toolUse.input &&
        typeof c.toolUse.input === "object"
      ) {
        toolCalls.push({
          id: c.toolUse.toolUseId,
          name: c.toolUse.name,
          args: c.toolUse.input,
          type: "tool_call",
        });
      } else if ("text" in c && typeof c.text === "string") {
        content.push({ type: "text", text: c.text });
      } else if ("reasoningContent" in c) {
        content.push(
          bedrockReasoningBlockToLangchainReasoningBlock(
            c.reasoningContent as ReasoningContentBlock
          )
        );
      } else {
        content.push(c);
      }
    });
    return new AIMessage({
      content: content.length ? content : "",
      tool_calls: toolCalls.length ? toolCalls : undefined,
      response_metadata: responseMetadata,
      usage_metadata: tokenUsage,
      id: requestId,
    });
  }
}

export function handleConverseStreamContentBlockDelta(
  contentBlockDelta: ContentBlockDeltaEvent
): ChatGenerationChunk {
  if (!contentBlockDelta.delta) {
    throw new Error("No delta found in content block.");
  }
  if (typeof contentBlockDelta.delta.text === "string") {
    return new ChatGenerationChunk({
      text: contentBlockDelta.delta.text,
      message: new AIMessageChunk({
        content: contentBlockDelta.delta.text,
      }),
    });
  } else if (contentBlockDelta.delta.toolUse) {
    const index = contentBlockDelta.contentBlockIndex;
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            args: contentBlockDelta.delta.toolUse.input,
            index,
            type: "tool_call_chunk",
          },
        ],
      }),
    });
  } else if (contentBlockDelta.delta.reasoningContent) {
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: [
          bedrockReasoningDeltaToLangchainPartialReasoningBlock(
            contentBlockDelta.delta.reasoningContent
          ),
        ],
      }),
    });
  } else {
    throw new Error(
      `Unsupported content block type(s): ${JSON.stringify(
        contentBlockDelta.delta,
        null,
        2
      )}`
    );
  }
}

export function handleConverseStreamContentBlockStart(
  contentBlockStart: ContentBlockStartEvent
): ChatGenerationChunk {
  const index = contentBlockStart.contentBlockIndex;
  if (contentBlockStart.start?.toolUse) {
    return new ChatGenerationChunk({
      text: "",
      message: new AIMessageChunk({
        content: "",
        tool_call_chunks: [
          {
            name: contentBlockStart.start.toolUse.name,
            id: contentBlockStart.start.toolUse.toolUseId,
            index,
            type: "tool_call_chunk",
          },
        ],
      }),
    });
  }
  throw new Error("Unsupported content block start event.");
}

export function handleConverseStreamMetadata(
  metadata: ConverseStreamMetadataEvent,
  extra: {
    streamUsage: boolean;
  }
): ChatGenerationChunk {
  const inputTokens = metadata.usage?.inputTokens ?? 0;
  const outputTokens = metadata.usage?.outputTokens ?? 0;
  const usage_metadata: UsageMetadata = {
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_tokens: metadata.usage?.totalTokens ?? inputTokens + outputTokens,
  };
  return new ChatGenerationChunk({
    text: "",
    message: new AIMessageChunk({
      content: "",
      usage_metadata: extra.streamUsage ? usage_metadata : undefined,
      response_metadata: {
        // Use the same key as returned from the Converse API
        metadata,
      },
    }),
  });
}

export function bedrockReasoningDeltaToLangchainPartialReasoningBlock(
  reasoningContent: ReasoningContentBlockDelta
):
  | MessageContentReasoningBlockReasoningTextPartial
  | MessageContentReasoningBlockRedacted {
  const { text, redactedContent, signature } = reasoningContent;
  if (typeof text === "string") {
    return {
      type: "reasoning_content",
      reasoningText: { text },
    };
  }
  if (signature) {
    return {
      type: "reasoning_content",
      reasoningText: { signature },
    };
  }
  if (redactedContent) {
    return {
      type: "reasoning_content",
      redactedContent: Buffer.from(redactedContent).toString("base64"),
    };
  }
  throw new Error("Invalid reasoning content");
}

export function bedrockReasoningBlockToLangchainReasoningBlock(
  reasoningContent: ReasoningContentBlock
): MessageContentReasoningBlock {
  const { reasoningText, redactedContent } = reasoningContent;
  if (reasoningText) {
    return {
      type: "reasoning_content",
      reasoningText: reasoningText as Required<ReasoningTextBlock>,
    };
  }

  if (redactedContent) {
    return {
      type: "reasoning_content",
      redactedContent: Buffer.from(redactedContent).toString("base64"),
    };
  }
  throw new Error("Invalid reasoning content");
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

export function supportedToolChoiceValuesForModel(
  model: string
): Array<"auto" | "any" | "tool"> | undefined {
  if (
    model.includes("claude-3") ||
    model.includes("claude-4") ||
    model.includes("claude-opus-4") ||
    model.includes("claude-sonnet-4")
  ) {
    return ["auto", "any", "tool"];
  }
  if (model.includes("mistral-large")) {
    return ["auto", "any"];
  }
  return undefined;
}
