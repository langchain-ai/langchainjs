import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import {
  BaseMessage,
  BaseMessageChunk,
  AIMessageChunk,
  MessageContentComplex,
  MessageContentText,
  MessageContent,
  MessageContentImageUrl,
  AIMessageFields,
  AIMessageChunkFields,
  AIMessage,
  StandardContentBlockConverter,
  StandardImageBlock,
  StandardTextBlock,
  StandardFileBlock,
  DataContentBlock,
  isDataContentBlock,
  convertToProviderContentBlock,
  parseBase64DataUrl,
  UsageMetadata,
} from "@langchain/core/messages";
import {
  ToolCall,
  ToolCallChunk,
  ToolMessage,
} from "@langchain/core/messages/tool";
import {
  AnthropicAPIConfig,
  AnthropicCacheControl,
  AnthropicContent,
  AnthropicContentRedactedThinking,
  AnthropicContentText,
  AnthropicContentThinking,
  AnthropicContentToolUse,
  AnthropicMessage,
  AnthropicMessageContent,
  AnthropicMessageContentDocument,
  AnthropicMessageContentImage,
  AnthropicMessageContentRedactedThinking,
  AnthropicMessageContentText,
  AnthropicMessageContentThinking,
  AnthropicMessageContentToolResult,
  AnthropicMessageContentToolResultContent,
  AnthropicMessageContentToolUse,
  AnthropicRequest,
  AnthropicRequestSettings,
  AnthropicResponseData,
  AnthropicResponseMessage,
  AnthropicStreamContentBlockDeltaEvent,
  AnthropicStreamContentBlockStartEvent,
  AnthropicStreamInputJsonDelta,
  AnthropicStreamMessageDeltaEvent,
  AnthropicStreamMessageStartEvent,
  AnthropicStreamTextDelta,
  AnthropicTool,
  AnthropicToolChoice,
  GeminiTool,
  GoogleAIAPI,
  GoogleAIModelParams,
  GoogleAIModelRequestParams,
  GoogleAIToolType,
  GoogleLLMResponse,
} from "../types.js";

export function getAnthropicAPI(config?: AnthropicAPIConfig): GoogleAIAPI {
  function partToString(part: AnthropicContent): string {
    return "text" in part ? part.text : "";
  }

  function messageToString(message: AnthropicResponseMessage): string {
    const content: AnthropicContent[] = message?.content ?? [];
    const ret = content.reduce((acc, part) => {
      const str = partToString(part);
      return acc + str;
    }, "");
    return ret;
  }

  function responseToString(response: GoogleLLMResponse): string {
    const data = response.data as AnthropicResponseData;
    switch (data?.type) {
      case "message":
        return messageToString(data as AnthropicResponseMessage);
      default:
        throw Error(`Unknown type: ${data?.type}`);
    }
  }

  /**
   * Normalize the AIMessageChunk.
   * If the fields are just a string - use that as content.
   * If the content is an array of just text fields, turn them into a string.
   * @param fields
   */
  function newAIMessageChunk(fields: string | AIMessageFields): AIMessageChunk {
    if (typeof fields === "string") {
      return new AIMessageChunk(fields);
    }
    const ret: AIMessageFields = {
      ...fields,
    };

    if (Array.isArray(fields?.content)) {
      let str: string | undefined = "";
      fields.content.forEach((val) => {
        if (str !== undefined && val.type === "text") {
          str = `${str}${val.text}`;
        } else {
          str = undefined;
        }
      });
      if (str) {
        ret.content = str;
      }
    }

    return new AIMessageChunk(ret);
  }

  function textContentToMessageFields(
    textContent: AnthropicContentText
  ): AIMessageFields {
    return {
      content: [textContent],
    };
  }

  function toolUseContentToMessageFields(
    toolUseContent: AnthropicContentToolUse
  ): AIMessageFields {
    const tool: ToolCall = {
      id: toolUseContent.id,
      name: toolUseContent.name,
      type: "tool_call",
      args: toolUseContent.input,
    };
    return {
      content: [],
      tool_calls: [tool],
    };
  }

  function thinkingContentToMessageFields(
    thinkingContent: AnthropicContentThinking
  ): AIMessageFields {
    // TODO: Once a reasoning/thinking type is defined in LangChain, use it
    return {
      content: [thinkingContent],
    };
  }

  function redactedThinkingContentToMessageFields(
    thinkingContent: AnthropicContentRedactedThinking
  ): AIMessageFields {
    // TODO: Once a reasoning/thinking type is defined in LangChain, use it
    return {
      content: [thinkingContent],
    };
  }

  function anthropicContentToMessageFields(
    anthropicContent: AnthropicContent
  ): AIMessageFields | undefined {
    const type = anthropicContent?.type;
    switch (type) {
      case "text":
        return textContentToMessageFields(anthropicContent);
      case "tool_use":
        return toolUseContentToMessageFields(anthropicContent);
      case "thinking":
        return thinkingContentToMessageFields(anthropicContent);
      case "redacted_thinking":
        return redactedThinkingContentToMessageFields(anthropicContent);
      default:
        console.error(`Unknown message type: ${type}`, anthropicContent);
        return undefined;
    }
  }

  function contentToMessage(
    anthropicContent: AnthropicContent[]
  ): BaseMessageChunk {
    const complexContent: MessageContentComplex[] = [];
    const toolCalls: ToolCall[] = [];
    anthropicContent.forEach((ac) => {
      const messageFields = anthropicContentToMessageFields(ac);
      if (messageFields?.content) {
        complexContent.push(
          ...(messageFields.content as MessageContentComplex[])
        );
      }
      if (messageFields?.tool_calls) {
        toolCalls.push(...messageFields.tool_calls);
      }
    });

    const ret: AIMessageFields = {
      content: complexContent,
      tool_calls: toolCalls,
    };
    return newAIMessageChunk(ret);
  }

  function messageToUsageMetadata(
    message: AnthropicResponseMessage
  ): UsageMetadata {
    const usage = message?.usage;
    const inputTokens = usage?.input_tokens ?? 0;
    const outputTokens = usage?.output_tokens ?? 0;
    const usageMetadata: UsageMetadata = {
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
      input_token_details: {
        cache_read: usage?.cache_read_input_tokens ?? 0,
        cache_creation: usage?.cache_creation_input_tokens ?? 0,
      },
    };
    return usageMetadata;
  }

  function messageToGenerationInfo(message: AnthropicResponseMessage) {
    const usageMetadata = messageToUsageMetadata(message);

    return {
      usage_metadata: usageMetadata,
      finish_reason: message.stop_reason,
    };
  }

  function messageToChatGeneration(
    responseMessage: AnthropicResponseMessage
  ): ChatGenerationChunk {
    const content: AnthropicContent[] = responseMessage?.content ?? [];
    const text = messageToString(responseMessage);
    const message = contentToMessage(content);
    const generationInfo = messageToGenerationInfo(responseMessage);
    return new ChatGenerationChunk({
      text,
      message,
      generationInfo,
    });
  }

  function messageStartToChatGeneration(
    event: AnthropicStreamMessageStartEvent
  ): ChatGenerationChunk {
    const responseMessage = event.message;
    return messageToChatGeneration(responseMessage);
  }

  function messageDeltaToChatGeneration(
    event: AnthropicStreamMessageDeltaEvent
  ): ChatGenerationChunk {
    const responseMessage = event.delta;
    return messageToChatGeneration(responseMessage as AnthropicResponseMessage);
  }

  function contentBlockStartTextToChatGeneration(
    event: AnthropicStreamContentBlockStartEvent
  ): ChatGenerationChunk | null {
    const content = event.content_block;
    const text = "text" in content ? content.text : "";
    const message = new AIMessageChunk({
      content: [{ index: event.index, ...content }],
    });
    return new ChatGenerationChunk({
      message,
      text,
    });
  }

  function contentBlockStartToolUseToChatGeneration(
    event: AnthropicStreamContentBlockStartEvent
  ): ChatGenerationChunk | null {
    const contentBlock = event.content_block as AnthropicContentToolUse;
    const text: string = "";
    const toolChunk: ToolCallChunk = {
      type: "tool_call_chunk",
      index: event.index,
      name: contentBlock.name,
      id: contentBlock.id,
    };
    if (
      typeof contentBlock.input === "object" &&
      Object.keys(contentBlock.input).length > 0
    ) {
      toolChunk.args = JSON.stringify(contentBlock.input);
    }
    const toolChunks: ToolCallChunk[] = [toolChunk];

    const content: MessageContentComplex[] = [
      {
        index: event.index,
        ...contentBlock,
      },
    ];
    const messageFields: AIMessageChunkFields = {
      content,
      tool_call_chunks: toolChunks,
    };
    const message = newAIMessageChunk(messageFields);
    return new ChatGenerationChunk({
      message,
      text,
    });
  }

  function contentBlockStartToChatGeneration(
    event: AnthropicStreamContentBlockStartEvent
  ): ChatGenerationChunk | null {
    switch (event.content_block.type) {
      case "text":
        return contentBlockStartTextToChatGeneration(event);
      case "tool_use":
        return contentBlockStartToolUseToChatGeneration(event);
      default:
        console.warn(
          `Unexpected start content_block type: ${JSON.stringify(event)}`
        );
        return null;
    }
  }

  function contentBlockDeltaTextToChatGeneration(
    event: AnthropicStreamContentBlockDeltaEvent
  ): ChatGenerationChunk {
    const delta = event.delta as AnthropicStreamTextDelta;
    const text = delta?.text;
    const message = new AIMessageChunk({
      content: [{ index: event.index, type: "text", text }],
    });
    return new ChatGenerationChunk({
      message,
      text,
    });
  }

  function contentBlockDeltaInputJsonDeltaToChatGeneration(
    event: AnthropicStreamContentBlockDeltaEvent
  ): ChatGenerationChunk {
    const delta = event.delta as AnthropicStreamInputJsonDelta;
    const text: string = "";
    const toolChunks: ToolCallChunk[] = [
      {
        index: event.index,
        args: delta.partial_json,
      },
    ];
    const content: MessageContentComplex[] = [
      {
        index: event.index,
        ...delta,
      },
    ];
    const messageFields: AIMessageChunkFields = {
      content,
      tool_call_chunks: toolChunks,
    };
    const message = newAIMessageChunk(messageFields);
    return new ChatGenerationChunk({
      message,
      text,
    });
  }

  function contentBlockDeltaToChatGeneration(
    event: AnthropicStreamContentBlockDeltaEvent
  ): ChatGenerationChunk | null {
    switch (event.delta.type) {
      case "text_delta":
        return contentBlockDeltaTextToChatGeneration(event);
      case "input_json_delta":
        return contentBlockDeltaInputJsonDeltaToChatGeneration(event);
      default:
        console.warn(
          `Unexpected delta content_block type: ${JSON.stringify(event)}`
        );
        return null;
    }
  }

  function responseToChatGeneration(
    response: GoogleLLMResponse
  ): ChatGenerationChunk | null {
    const data = response.data as AnthropicResponseData;
    switch (data.type) {
      case "message":
        return messageToChatGeneration(data as AnthropicResponseMessage);
      case "message_start":
        return messageStartToChatGeneration(
          data as AnthropicStreamMessageStartEvent
        );
      case "message_delta":
        return messageDeltaToChatGeneration(
          data as AnthropicStreamMessageDeltaEvent
        );
      case "content_block_start":
        return contentBlockStartToChatGeneration(
          data as AnthropicStreamContentBlockStartEvent
        );
      case "content_block_delta":
        return contentBlockDeltaToChatGeneration(
          data as AnthropicStreamContentBlockDeltaEvent
        );

      case "ping":
      case "message_stop":
      case "content_block_stop":
        // These are ignorable
        return null;

      case "error":
        throw new Error(
          `Error while streaming results: ${JSON.stringify(data)}`
        );

      default:
        // We don't know what type this is, but Anthropic may have added
        // new ones without telling us. Don't error, but don't use them.
        console.warn("Unknown data for responseToChatGeneration", data);
        // throw new Error(`Unknown response type: ${data.type}`);
        return null;
    }
  }

  function chunkToString(chunk: BaseMessageChunk): string {
    if (chunk === null) {
      return "";
    } else if (typeof chunk.content === "string") {
      return chunk.content;
    } else if (chunk.content.length === 0) {
      return "";
    } else if (chunk.content[0].type === "text") {
      return chunk.content[0].text;
    } else {
      throw new Error(`Unexpected chunk: ${chunk}`);
    }
  }

  function responseToBaseMessage(response: GoogleLLMResponse): BaseMessage {
    const data = response.data as AnthropicResponseMessage;
    const content: AnthropicContent[] = data?.content ?? [];
    return contentToMessage(content);
  }

  function responseToChatResult(response: GoogleLLMResponse): ChatResult {
    const message = response.data as AnthropicResponseMessage;
    const generations: ChatGeneration[] = [];
    const gen = responseToChatGeneration(response);
    if (gen) {
      generations.push(gen);
    }
    const llmOutput = messageToGenerationInfo(message);
    return {
      generations,
      llmOutput,
    };
  }

  function formatAnthropicVersion(): string {
    return config?.version ?? "vertex-2023-10-16";
  }

  function textContentToAnthropicContent(
    content: MessageContentText
  ): AnthropicMessageContentText | undefined {
    if (!content.text) {
      return undefined;
    }
    return { type: "text", text: content.text };
  }

  function extractMimeType(
    str: string
  ): { media_type: string; data: string } | null {
    if (str.startsWith("data:")) {
      return {
        media_type: str.split(":")[1].split(";")[0],
        data: str.split(",")[1],
      };
    }
    return null;
  }

  function imageContentToAnthropicContent(
    content: MessageContentImageUrl
  ): AnthropicMessageContentImage | undefined {
    const dataUrl = content.image_url;
    const url = typeof dataUrl === "string" ? dataUrl : dataUrl?.url;
    const urlInfo = extractMimeType(url);

    if (!urlInfo) {
      return undefined;
    }

    return {
      type: "image",
      source: {
        type: "base64",
        ...urlInfo,
      },
    };
  }

  function toolUseContentToAnthropicContent(
    content: Record<string, unknown>
  ): AnthropicMessageContentToolUse {
    return {
      type: "tool_use",
      id: content.id as string,
      name: content.name as string,
      input: content.input as Record<string, unknown>,
    };
  }

  function thinkingContentToAnthropicContent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: Record<string, any>
  ): AnthropicMessageContentThinking | undefined {
    // TODO: Once a Langchain Thinking type is defined, use it
    return {
      type: "thinking",
      thinking: content.thinking,
      signature: content.signature,
    };
  }

  function redactedThinkingContentToAnthropicContent(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: Record<string, any>
  ): AnthropicMessageContentRedactedThinking | undefined {
    // TODO: Once a Langchain Thinking type is defined, use it
    return {
      type: "redacted_thinking",
      data: content.data,
    };
  }

  function contentComplexToAnthropicContent(
    content: MessageContentComplex
  ): AnthropicMessageContent | undefined {
    const type = content?.type;
    switch (type) {
      case "text":
        return textContentToAnthropicContent(content as MessageContentText);
      case "image_url":
        return imageContentToAnthropicContent(
          content as MessageContentImageUrl
        );
      case "tool_use":
        return toolUseContentToAnthropicContent(content);
      case "thinking":
        return thinkingContentToAnthropicContent(
          content as Record<string, unknown>
        );
      case "redacted_thinking":
        return redactedThinkingContentToAnthropicContent(
          content as Record<string, unknown>
        );
      default:
        if (type === "tool_call") {
          return undefined;
        }
        console.warn(`Unexpected content type: ${type}`, content);
        return undefined;
    }
  }

  const anthropicContentConverter: StandardContentBlockConverter<{
    text: AnthropicMessageContentText;
    image: AnthropicMessageContentImage;
    file: AnthropicMessageContentDocument;
  }> = {
    providerName: "anthropic",

    fromStandardTextBlock(
      block: StandardTextBlock
    ): AnthropicMessageContentText {
      return {
        type: "text",
        text: block.text,
        ...("cache_control" in (block.metadata ?? {})
          ? {
              cache_control: block.metadata!
                .cache_control as AnthropicCacheControl,
            }
          : {}),
      };
    },

    fromStandardImageBlock(
      block: StandardImageBlock
    ): AnthropicMessageContentImage {
      if (block.source_type === "url") {
        const data = parseBase64DataUrl({
          dataUrl: block.url,
          asTypedArray: false,
        });
        if (data) {
          return {
            type: "image",
            source: {
              type: "base64",
              data: data.data,
              media_type: data.mime_type,
            },
            ...("cache_control" in (block.metadata ?? {})
              ? { cache_control: block.metadata!.cache_control }
              : {}),
          } as AnthropicMessageContentImage;
        } else {
          return {
            type: "image",
            source: {
              type: "url",
              url: block.url,
              media_type: block.mime_type ?? "",
            },
            ...("cache_control" in (block.metadata ?? {})
              ? { cache_control: block.metadata!.cache_control }
              : {}),
          } as AnthropicMessageContentImage;
        }
      } else {
        if (block.source_type === "base64") {
          return {
            type: "image",
            source: {
              type: "base64",
              data: block.data,
              media_type: block.mime_type ?? "",
            },
            ...("cache_control" in (block.metadata ?? {})
              ? { cache_control: block.metadata!.cache_control }
              : {}),
          } as AnthropicMessageContentImage;
        } else {
          throw new Error(
            `Unsupported image source type: ${block.source_type}`
          );
        }
      }
    },

    fromStandardFileBlock(
      block: StandardFileBlock
    ): AnthropicMessageContentDocument {
      const mime_type = (block.mime_type ?? "").split(";")[0];

      if (block.source_type === "url") {
        if (mime_type === "application/pdf" || mime_type === "") {
          return {
            type: "document",
            source: {
              type: "url",
              url: block.url,
              media_type: block.mime_type ?? "",
            },
            ...("cache_control" in (block.metadata ?? {})
              ? {
                  cache_control: block.metadata!
                    .cache_control as AnthropicCacheControl,
                }
              : {}),
            ...("citations" in (block.metadata ?? {})
              ? {
                  citations: block.metadata!.citations as { enabled?: boolean },
                }
              : {}),
            ...("context" in (block.metadata ?? {})
              ? { context: block.metadata!.context as string }
              : {}),
            ...(block.metadata?.title ||
            block.metadata?.filename ||
            block.metadata?.name
              ? {
                  title: (block.metadata?.title ||
                    block.metadata?.filename ||
                    block.metadata?.name) as string,
                }
              : {}),
          };
        }
        throw new Error(
          `Unsupported file mime type for file url source: ${block.mime_type}`
        );
      } else if (block.source_type === "text") {
        if (mime_type === "text/plain" || mime_type === "") {
          return {
            type: "document",
            source: {
              type: "text",
              data: block.text,
              media_type: block.mime_type ?? "",
            },
            ...("cache_control" in (block.metadata ?? {})
              ? {
                  cache_control: block.metadata!
                    .cache_control as AnthropicCacheControl,
                }
              : {}),
            ...("citations" in (block.metadata ?? {})
              ? {
                  citations: block.metadata!.citations as { enabled?: boolean },
                }
              : {}),
            ...("context" in (block.metadata ?? {})
              ? { context: block.metadata!.context as string }
              : {}),
            ...("title" in (block.metadata ?? {})
              ? { title: block.metadata!.title as string }
              : {}),
          };
        } else {
          throw new Error(
            `Unsupported file mime type for file text source: ${block.mime_type}`
          );
        }
      } else if (block.source_type === "base64") {
        if (mime_type === "application/pdf" || mime_type === "") {
          return {
            type: "document",
            source: {
              type: "base64",
              data: block.data,
              media_type: "application/pdf",
            },
            ...("cache_control" in (block.metadata ?? {})
              ? {
                  cache_control: block.metadata!
                    .cache_control as AnthropicCacheControl,
                }
              : {}),
            ...("citations" in (block.metadata ?? {})
              ? {
                  citations: block.metadata!.citations as { enabled?: boolean },
                }
              : {}),
            ...("context" in (block.metadata ?? {})
              ? { context: block.metadata!.context as string }
              : {}),
            ...("title" in (block.metadata ?? {})
              ? { title: block.metadata!.title as string }
              : {}),
          };
        } else if (
          ["image/jpeg", "image/png", "image/gif", "image/webp"].includes(
            mime_type
          )
        ) {
          return {
            type: "document",
            source: {
              type: "content",
              content: [
                {
                  type: "image",
                  source: {
                    type: "base64",
                    data: block.data,
                    media_type: mime_type as
                      | "image/jpeg"
                      | "image/png"
                      | "image/gif"
                      | "image/webp",
                  },
                },
              ],
            },
            ...("cache_control" in (block.metadata ?? {})
              ? {
                  cache_control: block.metadata!
                    .cache_control as AnthropicCacheControl,
                }
              : {}),
            ...("citations" in (block.metadata ?? {})
              ? {
                  citations: block.metadata!.citations as { enabled?: boolean },
                }
              : {}),
            ...("context" in (block.metadata ?? {})
              ? { context: block.metadata!.context as string }
              : {}),
            ...("title" in (block.metadata ?? {})
              ? { title: block.metadata!.title as string }
              : {}),
          };
        } else {
          throw new Error(
            `Unsupported file mime type for file base64 source: ${block.mime_type}`
          );
        }
      } else {
        throw new Error(`Unsupported file source type: ${block.source_type}`);
      }
    },
  };

  function contentToAnthropicContent(
    content: MessageContent | DataContentBlock[]
  ): AnthropicMessageContent[] {
    const ca =
      typeof content === "string" ? [{ type: "text", text: content }] : content;
    return ca
      .map((complex) =>
        isDataContentBlock(complex)
          ? convertToProviderContentBlock(complex, anthropicContentConverter)
          : contentComplexToAnthropicContent(complex)
      )
      .filter(Boolean) as AnthropicMessageContent[];
  }

  function toolCallToAnthropicContent(
    toolCall: ToolCall
  ): AnthropicMessageContentToolUse {
    return {
      type: "tool_use",
      id: toolCall.id!,
      name: toolCall.name,
      input: toolCall.args,
    };
  }

  function toolCallsToAnthropicContent(
    toolCalls: ToolCall[] | undefined
  ): AnthropicMessageContentToolUse[] {
    if (toolCalls === undefined) {
      return [];
    }
    return toolCalls.map(toolCallToAnthropicContent);
  }

  function baseRoleToAnthropicMessage(
    base: BaseMessage,
    role: string
  ): AnthropicMessage {
    const content = contentToAnthropicContent(base.content);
    return {
      role,
      content,
    };
  }

  function aiMessageToAnthropicMessage(base: AIMessage): AnthropicMessage {
    const ret = baseRoleToAnthropicMessage(base, "assistant");

    const content = ret.content as AnthropicMessageContent[];
    const existingToolUseIds = new Set(
      content
        .filter(
          (block): block is AnthropicMessageContentToolUse =>
            block.type === "tool_use"
        )
        .map((block) => block.id)
    );

    const toolContent = toolCallsToAnthropicContent(base.tool_calls).filter(
      (block) => !existingToolUseIds.has(block.id)
    );
    if (toolContent.length > 0) {
      ret.content = [...content, ...toolContent];
    }

    return ret;
  }

  function toolMessageToAnthropicMessage(base: ToolMessage): AnthropicMessage {
    const role = "user";
    const toolUseId = base.tool_call_id;
    const toolContent = contentToAnthropicContent(
      base.content
    ) as AnthropicMessageContentToolResultContent[];
    const content: AnthropicMessageContentToolResult[] = [
      {
        type: "tool_result",
        tool_use_id: toolUseId,
        content: toolContent,
      },
    ];
    return {
      role,
      content,
    };
  }

  function baseToAnthropicMessage(
    base: BaseMessage
  ): AnthropicMessage | undefined {
    const type = base._getType();
    switch (type) {
      case "human":
        return baseRoleToAnthropicMessage(base, "user");
      case "ai":
        return aiMessageToAnthropicMessage(base as AIMessage);
      case "tool":
        return toolMessageToAnthropicMessage(base as ToolMessage);
      case "system":
        //  System messages are handled in formatSystem()
        return undefined;
      default:
        console.warn(`Unknown BaseMessage type: ${type}`, base);
        return undefined;
    }
  }

  function formatMessages(input: BaseMessage[]): AnthropicMessage[] {
    const ret: AnthropicMessage[] = [];

    input.forEach((baseMessage) => {
      const anthropicMessage = baseToAnthropicMessage(baseMessage);
      if (anthropicMessage) {
        ret.push(anthropicMessage);
      }
    });

    return ret;
  }

  function formatSettings(
    parameters: GoogleAIModelRequestParams
  ): AnthropicRequestSettings {
    const ret: AnthropicRequestSettings = {
      stream: parameters?.streaming ?? false,
      max_tokens: parameters?.maxOutputTokens ?? 8192,
    };

    if (parameters.topP) {
      ret.top_p = parameters.topP;
    }
    if (parameters.topK) {
      ret.top_k = parameters.topK;
    }
    if (parameters.temperature) {
      ret.temperature = parameters.temperature;
    }
    if (parameters.stopSequences) {
      ret.stop_sequences = parameters.stopSequences;
    }

    return ret;
  }

  function contentComplexArrayToText(
    contentArray: MessageContentComplex[]
  ): string {
    let ret = "";

    contentArray.forEach((content) => {
      const contentType = content?.type;
      if (contentType === "text") {
        const textContent = content as MessageContentText;
        ret = `${ret}\n${textContent.text}`;
      }
    });

    return ret;
  }

  function formatSystem(input: BaseMessage[]): string {
    let ret = "";

    input.forEach((message) => {
      if (message._getType() === "system") {
        const content = message?.content;
        const contentString =
          typeof content === "string"
            ? (content as string)
            : contentComplexArrayToText(content as MessageContentComplex[]);
        ret = `${ret}\n${contentString}`;
      }
    });

    return ret;
  }

  function formatGeminiTool(tool: GeminiTool): AnthropicTool[] {
    if (Object.hasOwn(tool, "functionDeclarations")) {
      const funcs = tool?.functionDeclarations ?? [];
      return funcs.map((func) => {
        const inputSchema = func.parameters!;
        return {
          // type: "tool",  // This may only be valid for models 20241022+
          name: func.name,
          description: func.description,
          input_schema: inputSchema,
        };
      });
    } else {
      console.warn(
        `Unable to format GeminiTool: ${JSON.stringify(tool, null, 1)}`
      );
      return [];
    }
  }

  function formatTool(tool: GoogleAIToolType): AnthropicTool[] {
    if (Object.hasOwn(tool, "name")) {
      return [tool as AnthropicTool];
    } else {
      return formatGeminiTool(tool as GeminiTool);
    }
  }

  function formatTools(
    parameters: GoogleAIModelRequestParams
  ): AnthropicTool[] {
    const tools: GoogleAIToolType[] = parameters?.tools ?? [];
    const ret: AnthropicTool[] = [];
    tools.forEach((tool) => {
      const anthropicTools = formatTool(tool);
      anthropicTools.forEach((anthropicTool) => {
        if (anthropicTool) {
          ret.push(anthropicTool);
        }
      });
    });
    return ret;
  }

  function formatToolChoice(
    parameters: GoogleAIModelRequestParams
  ): AnthropicToolChoice | undefined {
    const choice = parameters?.tool_choice;
    if (!choice) {
      return undefined;
    } else if (typeof choice === "object") {
      return choice as AnthropicToolChoice;
    } else {
      switch (choice) {
        case "any":
        case "auto":
          return {
            type: choice,
          };
        case "none":
          return undefined;
        default:
          return {
            type: "tool",
            name: choice,
          };
      }
    }
  }

  async function formatData(
    input: unknown,
    parameters: GoogleAIModelRequestParams
  ): Promise<AnthropicRequest> {
    const typedInput = input as BaseMessage[];
    const anthropicVersion = formatAnthropicVersion();
    const messages = formatMessages(typedInput);
    const settings = formatSettings(parameters);
    const system = formatSystem(typedInput);
    const tools = formatTools(parameters);
    const toolChoice = formatToolChoice(parameters);
    const ret: AnthropicRequest = {
      anthropic_version: anthropicVersion,
      messages,
      ...settings,
    };
    if (tools && tools.length && parameters?.tool_choice !== "none") {
      ret.tools = tools;
    }
    if (toolChoice) {
      ret.tool_choice = toolChoice;
    }
    if (system?.length) {
      ret.system = system;
    }
    if (config?.thinking) {
      ret.thinking = config?.thinking;
    }

    return ret;
  }

  return {
    responseToString,
    responseToChatGeneration,
    chunkToString,
    responseToBaseMessage,
    responseToChatResult,
    formatData,
  };
}

export function validateClaudeParams(_params: GoogleAIModelParams): void {
  // FIXME - validate the parameters
}

export function isModelClaude(modelName: string): boolean {
  return modelName.toLowerCase().startsWith("claude");
}
