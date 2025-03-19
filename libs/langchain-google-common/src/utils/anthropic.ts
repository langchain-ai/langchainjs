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
} from "@langchain/core/messages";
import {
  ToolCall,
  ToolCallChunk,
  ToolMessage,
} from "@langchain/core/messages/tool";
import {
  AnthropicAPIConfig,
  AnthropicContent,
  AnthropicContentText,
  AnthropicContentToolUse,
  AnthropicMessage,
  AnthropicMessageContent,
  AnthropicMessageContentImage,
  AnthropicMessageContentText,
  AnthropicMessageContentToolResult,
  AnthropicMessageContentToolResultContent,
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

  function anthropicContentToMessageFields(
    anthropicContent: AnthropicContent
  ): AIMessageFields | undefined {
    const type = anthropicContent?.type;
    switch (type) {
      case "text":
        return textContentToMessageFields(anthropicContent);
      case "tool_use":
        return toolUseContentToMessageFields(anthropicContent);
      default:
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

  function messageToGenerationInfo(message: AnthropicResponseMessage) {
    const usage = message?.usage;
    const usageMetadata: Record<string, number> = {
      input_tokens: usage?.input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
      total_tokens: (usage?.input_tokens ?? 0) + (usage?.output_tokens ?? 0),
    };
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
    const message = contentToMessage([content]);
    if (!message) {
      return null;
    }

    const text = "text" in content ? content.text : "";
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
    const message = newAIMessageChunk(text);
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
  ): AnthropicMessageContentText {
    return content;
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
      default:
        console.warn(`Unexpected content type: ${type}`);
        return undefined;
    }
  }

  function contentToAnthropicContent(
    content: MessageContent
  ): AnthropicMessageContent[] {
    const ret: AnthropicMessageContent[] = [];

    const ca =
      typeof content === "string" ? [{ type: "text", text: content }] : content;
    ca.forEach((complex) => {
      const ac = contentComplexToAnthropicContent(complex);
      if (ac) {
        ret.push(ac);
      }
    });

    return ret;
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
        return baseRoleToAnthropicMessage(base, "assistant");
      case "tool":
        return toolMessageToAnthropicMessage(base as ToolMessage);
      default:
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
