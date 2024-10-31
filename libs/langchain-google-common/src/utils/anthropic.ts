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
} from "@langchain/core/messages";
import {
  AnthropicAPIConfig,
  AnthropicContent,
  AnthropicContentText,
  AnthropicContentToolUse,
  AnthropicMessage,
  AnthropicMessageContent,
  AnthropicMessageContentImage,
  AnthropicMessageContentText,
  AnthropicRequest,
  AnthropicRequestSettings,
  AnthropicResponseData,
  AnthropicResponseMessage,
  AnthropicStreamContentBlockDeltaEvent,
  AnthropicStreamContentBlockStartEvent,
  AnthropicStreamMessageDeltaEvent,
  AnthropicStreamMessageStartEvent,
  AnthropicStreamTextDelta,
  GoogleAIAPI,
  GoogleAIModelParams,
  GoogleAIModelRequestParams,
  GoogleLLMResponse,
} from "../types.js";

export function getAnthropicAPI(config?: AnthropicAPIConfig): GoogleAIAPI {
  // function notImplemented(): never {
  //   throw new Error("Not implemented");
  // }

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

  function textContentToContent(
    textContent: AnthropicContentText
  ): MessageContentText {
    return textContent;
  }

  function toolUseContentToContent(
    _toolUseContent: AnthropicContentToolUse
  ): undefined {
    // FIXME: implement
    return undefined;
  }

  function anthropicContentToContent(
    anthropicContent: AnthropicContent
  ): MessageContentComplex | undefined {
    const type = anthropicContent?.type;
    switch (type) {
      case "text":
        return textContentToContent(anthropicContent);
      case "tool_use":
        return toolUseContentToContent(anthropicContent);
      default:
        return undefined;
    }
  }

  function contentToMessage(
    anthropicContent: AnthropicContent[]
  ): BaseMessageChunk {
    let isComplex = false;
    const complexContent: MessageContentComplex[] = [];
    let textContext = "";
    anthropicContent.forEach((ac) => {
      const c = anthropicContentToContent(ac);
      if (c) {
        complexContent.push(c);
        if (c.type === "text") {
          textContext = `${textContext}${c.text}`;
        } else {
          isComplex = true;
        }
      }
    });

    if (isComplex) {
      return new AIMessageChunk({
        content: complexContent,
      });
    } else {
      return new AIMessageChunk(textContext);
    }
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
  ): ChatGenerationChunk {
    const content = event.content_block as AnthropicContentText;
    const message = contentToMessage([content]);
    const text = content?.text;
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
      // TODO: case "tool_use": return contentBlockStartToolUseToChatGeneration(event);
      default:
        console.warn(`Unexpected content_block type: ${JSON.stringify(event)}`);
        return null;
    }
  }

  function contentBlockDeltaTextToChatGeneration(
    event: AnthropicStreamContentBlockDeltaEvent
  ): ChatGenerationChunk {
    const content = event.delta as AnthropicStreamTextDelta;
    const text = content?.text;
    const message = new AIMessageChunk(text);
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
      // TODO: case "tool_use": return contentBlockDeltaToolUseToChatGeneration(event);
      default:
        console.warn(`Unexpected content_block type: ${JSON.stringify(event)}`);
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
      // TODO - Handle Tool Use and Tool Result
      default:
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

  function baseToAnthropicMessage(
    base: BaseMessage
  ): AnthropicMessage | undefined {
    const type = base._getType();
    switch (type) {
      case "human":
        return baseRoleToAnthropicMessage(base, "user");
      case "ai":
        return baseRoleToAnthropicMessage(base, "assistant");
      // TODO - Handle "function" and "tool"?
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

  async function formatData(
    input: unknown,
    parameters: GoogleAIModelRequestParams
  ): Promise<AnthropicRequest> {
    const typedInput = input as BaseMessage[];
    const anthropicVersion = formatAnthropicVersion();
    const messages = formatMessages(typedInput);
    const settings = formatSettings(parameters);
    const system = formatSystem(typedInput);
    // TODO: Tools
    const ret: AnthropicRequest = {
      anthropic_version: anthropicVersion,
      messages,
      ...settings,
    };
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
