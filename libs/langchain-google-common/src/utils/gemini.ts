import { v4 as uuidv4 } from "uuid";
import {
  AIMessage,
  AIMessageChunk,
  AIMessageFields,
  BaseMessage,
  BaseMessageChunk,
  BaseMessageFields,
  MessageContent,
  MessageContentComplex,
  MessageContentImageUrl,
  MessageContentText,
  SystemMessage,
  ToolMessage,
  isAIMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
  Generation,
} from "@langchain/core/outputs";
import type {
  GoogleLLMResponse,
  GoogleAIModelParams,
  GeminiPartText,
  GeminiPartInlineData,
  GeminiPartFileData,
  GeminiPart,
  GeminiRole,
  GeminiContent,
  GenerateContentResponseData,
  GoogleAISafetyHandler,
  GeminiPartFunctionCall,
} from "../types.js";
import { GoogleAISafetyError } from "./safety.js";

const extractMimeType = (
  str: string
): { mimeType: string; data: string } | null => {
  if (str.startsWith("data:")) {
    return {
      mimeType: str.split(":")[1].split(";")[0],
      data: str.split(",")[1],
    };
  }
  return null;
};

function messageContentText(
  content: MessageContentText
): GeminiPartText | null {
  if (content?.text && content?.text.length > 0) {
    return {
      text: content.text,
    };
  } else {
    return null;
  }
}

function messageContentImageUrl(
  content: MessageContentImageUrl
): GeminiPartInlineData | GeminiPartFileData {
  const url: string =
    typeof content.image_url === "string"
      ? content.image_url
      : content.image_url.url;
  if (!url) {
    throw new Error("Missing Image URL");
  }

  const mineTypeAndData = extractMimeType(url);
  if (mineTypeAndData) {
    return {
      inlineData: mineTypeAndData,
    };
  } else {
    // FIXME - need some way to get mime type
    return {
      fileData: {
        mimeType: "image/png",
        fileUri: url,
      },
    };
  }
}

function messageContentMedia(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  content: Record<string, any>
): GeminiPartInlineData | GeminiPartFileData {
  if ("mimeType" in content && "data" in content) {
    return {
      inlineData: {
        mimeType: content.mimeType,
        data: content.data,
      },
    };
  } else if ("mimeType" in content && "fileUri" in content) {
    return {
      fileData: {
        mimeType: content.mimeType,
        fileUri: content.fileUri,
      },
    };
  }

  throw new Error("Invalid media content");
}

export function messageContentToParts(content: MessageContent): GeminiPart[] {
  // Convert a string to a text type MessageContent if needed
  const messageContent: MessageContent =
    typeof content === "string"
      ? [
          {
            type: "text",
            text: content,
          },
        ]
      : content;

  // eslint-disable-next-line array-callback-return
  const parts: GeminiPart[] = messageContent
    .map((content) => {
      switch (content.type) {
        case "text":
          if ("text" in content) {
            return messageContentText(content as MessageContentText);
          }
          break;
        case "image_url":
          if ("image_url" in content) {
            // Type guard for MessageContentImageUrl
            return messageContentImageUrl(content as MessageContentImageUrl);
          }
          break;
        case "media":
          return messageContentMedia(content);
        default:
          throw new Error(
            `Unsupported type received while converting message to message parts`
          );
      }
      throw new Error(
        `Cannot coerce "${content.type}" message part into a string.`
      );
    })
    .reduce((acc: GeminiPart[], val: GeminiPart | null | undefined) => {
      if (val) {
        return [...acc, val];
      } else {
        return acc;
      }
    }, []);

  return parts;
}

function messageToolCallsToParts(toolCalls: ToolCall[]): GeminiPart[] {
  if (!toolCalls || toolCalls.length === 0) {
    return [];
  }

  return toolCalls.map((tool: ToolCall) => {
    let args = {};
    if (tool?.function?.arguments) {
      const argStr = tool.function.arguments;
      args = JSON.parse(argStr);
    }
    return {
      functionCall: {
        name: tool.function.name,
        args,
      },
    };
  });
}

function messageKwargsToParts(kwargs: Record<string, unknown>): GeminiPart[] {
  const ret: GeminiPart[] = [];

  if (kwargs?.tool_calls) {
    ret.push(...messageToolCallsToParts(kwargs.tool_calls as ToolCall[]));
  }

  return ret;
}

function roleMessageToContent(
  role: GeminiRole,
  message: BaseMessage
): GeminiContent[] {
  const contentParts: GeminiPart[] = messageContentToParts(message.content);
  let toolParts: GeminiPart[];
  if (isAIMessage(message) && !!message.tool_calls?.length) {
    toolParts = message.tool_calls.map(
      (toolCall): GeminiPart => ({
        functionCall: {
          name: toolCall.name,
          args: toolCall.args,
        },
      })
    );
  } else {
    toolParts = messageKwargsToParts(message.additional_kwargs);
  }
  const parts: GeminiPart[] = [...contentParts, ...toolParts];
  return [
    {
      role,
      parts,
    },
  ];
}

function systemMessageToContent(
  message: SystemMessage,
  useSystemInstruction: boolean
): GeminiContent[] {
  return useSystemInstruction
    ? roleMessageToContent("system", message)
    : [
        ...roleMessageToContent("user", message),
        ...roleMessageToContent("model", new AIMessage("Ok")),
      ];
}

function toolMessageToContent(
  message: ToolMessage,
  prevMessage: BaseMessage
): GeminiContent[] {
  const contentStr =
    typeof message.content === "string"
      ? message.content
      : message.content.reduce(
          (acc: string, content: MessageContentComplex) => {
            if (content.type === "text") {
              return acc + content.text;
            } else {
              return acc;
            }
          },
          ""
        );
  // Hacky :(
  const responseName =
    (isAIMessage(prevMessage) && !!prevMessage.tool_calls?.length
      ? prevMessage.tool_calls[0].name
      : prevMessage.name) ?? message.tool_call_id;
  try {
    const content = JSON.parse(contentStr);
    return [
      {
        role: "function",
        parts: [
          {
            functionResponse: {
              name: responseName,
              response: { content },
            },
          },
        ],
      },
    ];
  } catch (_) {
    return [
      {
        role: "function",
        parts: [
          {
            functionResponse: {
              name: responseName,
              response: { content: contentStr },
            },
          },
        ],
      },
    ];
  }
}

export function baseMessageToContent(
  message: BaseMessage,
  prevMessage: BaseMessage | undefined,
  useSystemInstruction: boolean
): GeminiContent[] {
  const type = message._getType();
  switch (type) {
    case "system":
      return systemMessageToContent(
        message as SystemMessage,
        useSystemInstruction
      );
    case "human":
      return roleMessageToContent("user", message);
    case "ai":
      return roleMessageToContent("model", message);
    case "tool":
      if (!prevMessage) {
        throw new Error(
          "Tool messages cannot be the first message passed to the model."
        );
      }
      return toolMessageToContent(message as ToolMessage, prevMessage);
    default:
      console.log(`Unsupported message type: ${type}`);
      return [];
  }
}

function textPartToMessageContent(part: GeminiPartText): MessageContentText {
  return {
    type: "text",
    text: part.text,
  };
}

function inlineDataPartToMessageContent(
  part: GeminiPartInlineData
): MessageContentImageUrl {
  return {
    type: "image_url",
    image_url: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
  };
}

function fileDataPartToMessageContent(
  part: GeminiPartFileData
): MessageContentImageUrl {
  return {
    type: "image_url",
    image_url: part.fileData.fileUri,
  };
}

export function partsToMessageContent(parts: GeminiPart[]): MessageContent {
  return parts
    .map((part) => {
      if (part === undefined || part === null) {
        return null;
      } else if ("text" in part) {
        return textPartToMessageContent(part);
      } else if ("inlineData" in part) {
        return inlineDataPartToMessageContent(part);
      } else if ("fileData" in part) {
        return fileDataPartToMessageContent(part);
      } else {
        return null;
      }
    })
    .reduce((acc, content) => {
      if (content) {
        acc.push(content);
      }
      return acc;
    }, [] as MessageContentComplex[]);
}

interface FunctionCall {
  name: string;
  arguments: string;
}

interface ToolCall {
  id: string;
  type: "function";
  function: FunctionCall;
}

interface FunctionCallRaw {
  name: string;
  arguments: object;
}

interface ToolCallRaw {
  id: string;
  type: "function";
  function: FunctionCallRaw;
}

function toolRawToTool(raw: ToolCallRaw): ToolCall {
  return {
    id: raw.id,
    type: raw.type,
    function: {
      name: raw.function.name,
      arguments: JSON.stringify(raw.function.arguments),
    },
  };
}

function functionCallPartToToolRaw(part: GeminiPartFunctionCall): ToolCallRaw {
  return {
    id: uuidv4().replace(/-/g, ""),
    type: "function",
    function: {
      name: part.functionCall.name,
      arguments: part.functionCall.args ?? {},
    },
  };
}

export function partsToToolsRaw(parts: GeminiPart[]): ToolCallRaw[] {
  return parts
    .map((part: GeminiPart) => {
      if (part === undefined || part === null) {
        return null;
      } else if ("functionCall" in part) {
        return functionCallPartToToolRaw(part);
      } else {
        return null;
      }
    })
    .reduce((acc, content) => {
      if (content) {
        acc.push(content);
      }
      return acc;
    }, [] as ToolCallRaw[]);
}

export function toolsRawToTools(raws: ToolCallRaw[]): ToolCall[] {
  return raws.map((raw) => toolRawToTool(raw));
}

export function responseToGenerateContentResponseData(
  response: GoogleLLMResponse
): GenerateContentResponseData {
  if ("nextChunk" in response.data) {
    throw new Error("Cannot convert Stream to GenerateContentResponseData");
  } else if (Array.isArray(response.data)) {
    // Collapse the array of response data as if it was a single one
    return response.data.reduce(
      (
        acc: GenerateContentResponseData,
        val: GenerateContentResponseData
      ): GenerateContentResponseData => {
        // Add all the parts
        // FIXME: Handle other candidates?
        const valParts = val?.candidates?.[0]?.content?.parts ?? [];
        acc.candidates[0].content.parts.push(...valParts);

        // FIXME: Merge promptFeedback and safety settings
        acc.promptFeedback = val.promptFeedback;
        return acc;
      }
    );
  } else {
    return response.data as GenerateContentResponseData;
  }
}

export function responseToParts(response: GoogleLLMResponse): GeminiPart[] {
  const responseData = responseToGenerateContentResponseData(response);
  const parts = responseData?.candidates?.[0]?.content?.parts ?? [];
  return parts;
}

export function partToText(part: GeminiPart): string {
  return "text" in part ? part.text : "";
}

export function responseToString(response: GoogleLLMResponse): string {
  const parts = responseToParts(response);
  const ret: string = parts.reduce((acc, part) => {
    const val = partToText(part);
    return acc + val;
  }, "");
  return ret;
}

function safeResponseTo<RetType>(
  response: GoogleLLMResponse,
  safetyHandler: GoogleAISafetyHandler,
  responseTo: (response: GoogleLLMResponse) => RetType
): RetType {
  try {
    const safeResponse = safetyHandler.handle(response);
    return responseTo(safeResponse);
  } catch (xx) {
    // eslint-disable-next-line no-instanceof/no-instanceof
    if (xx instanceof GoogleAISafetyError) {
      const ret = responseTo(xx.response);
      xx.reply = ret;
    }
    throw xx;
  }
}

export function safeResponseToString(
  response: GoogleLLMResponse,
  safetyHandler: GoogleAISafetyHandler
): string {
  return safeResponseTo(response, safetyHandler, responseToString);
}

export function responseToGenerationInfo(response: GoogleLLMResponse) {
  if (!Array.isArray(response.data)) {
    return {};
  }
  const data = response.data[0];
  return {
    usage_metadata: {
      prompt_token_count: data.usageMetadata?.promptTokenCount,
      candidates_token_count: data.usageMetadata?.candidatesTokenCount,
      total_token_count: data.usageMetadata?.totalTokenCount,
    },
    safety_ratings: data.candidates[0]?.safetyRatings?.map((rating) => ({
      category: rating.category,
      probability: rating.probability,
      probability_score: rating.probabilityScore,
      severity: rating.severity,
      severity_score: rating.severityScore,
    })),
    finish_reason: data.candidates[0]?.finishReason,
  };
}

export function responseToGeneration(response: GoogleLLMResponse): Generation {
  return {
    text: responseToString(response),
    generationInfo: responseToGenerationInfo(response),
  };
}

export function safeResponseToGeneration(
  response: GoogleLLMResponse,
  safetyHandler: GoogleAISafetyHandler
): Generation {
  return safeResponseTo(response, safetyHandler, responseToGeneration);
}

export function responseToChatGeneration(
  response: GoogleLLMResponse
): ChatGenerationChunk {
  return new ChatGenerationChunk({
    text: responseToString(response),
    message: partToMessageChunk(responseToParts(response)[0]),
    generationInfo: responseToGenerationInfo(response),
  });
}

export function safeResponseToChatGeneration(
  response: GoogleLLMResponse,
  safetyHandler: GoogleAISafetyHandler
): ChatGenerationChunk {
  return safeResponseTo(response, safetyHandler, responseToChatGeneration);
}

export function chunkToString(chunk: BaseMessageChunk): string {
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

export function partToMessageChunk(part: GeminiPart): BaseMessageChunk {
  const fields = partsToBaseMessageFields([part]);
  if (typeof fields.content === "string") {
    return new AIMessageChunk(fields);
  } else if (fields.content.every((item) => item.type === "text")) {
    const newContent = fields.content
      .map((item) => ("text" in item ? item.text : ""))
      .join("");
    return new AIMessageChunk({
      ...fields,
      content: newContent,
    });
  }
  return new AIMessageChunk(fields);
}

export function partToChatGeneration(part: GeminiPart): ChatGeneration {
  const message = partToMessageChunk(part);
  const text = partToText(part);
  return new ChatGenerationChunk({
    text,
    message,
  });
}

export function responseToChatGenerations(
  response: GoogleLLMResponse
): ChatGeneration[] {
  const parts = responseToParts(response);
  let ret = parts.map((part) => partToChatGeneration(part));
  if (ret.every((item) => typeof item.message.content === "string")) {
    const combinedContent = ret.map((item) => item.message.content).join("");
    const combinedText = ret.map((item) => item.text).join("");
    const toolCallChunks = ret[
      ret.length - 1
    ]?.message.additional_kwargs?.tool_calls?.map((toolCall, i) => ({
      name: toolCall.function.name,
      args: toolCall.function.arguments,
      id: toolCall.id,
      index: i,
    }));
    ret = [
      new ChatGenerationChunk({
        message: new AIMessageChunk({
          content: combinedContent,
          additional_kwargs: ret[ret.length - 1]?.message.additional_kwargs,
          tool_call_chunks: toolCallChunks,
        }),
        text: combinedText,
        generationInfo: ret[ret.length - 1].generationInfo,
      }),
    ];
  }
  return ret;
}

export function responseToBaseMessageFields(
  response: GoogleLLMResponse
): BaseMessageFields {
  const parts = responseToParts(response);
  return partsToBaseMessageFields(parts);
}

export function partsToBaseMessageFields(parts: GeminiPart[]): AIMessageFields {
  const fields: AIMessageFields = {
    content: partsToMessageContent(parts),
    tool_calls: [],
    invalid_tool_calls: [],
  };

  const rawTools = partsToToolsRaw(parts);
  if (rawTools.length > 0) {
    const tools = toolsRawToTools(rawTools);
    for (const tool of tools) {
      try {
        fields.tool_calls?.push({
          name: tool.function.name,
          args: JSON.parse(tool.function.arguments),
          id: tool.id,
        });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (e: any) {
        fields.invalid_tool_calls?.push({
          name: tool.function.name,
          args: JSON.parse(tool.function.arguments),
          id: tool.id,
          error: e.message,
        });
      }
    }
    fields.additional_kwargs = {
      tool_calls: tools,
    };
  }
  return fields;
}

export function responseToBaseMessage(
  response: GoogleLLMResponse
): BaseMessage {
  const fields = responseToBaseMessageFields(response);
  return new AIMessage(fields);
}

export function safeResponseToBaseMessage(
  response: GoogleLLMResponse,
  safetyHandler: GoogleAISafetyHandler
): BaseMessage {
  return safeResponseTo(response, safetyHandler, responseToBaseMessage);
}

export function responseToChatResult(response: GoogleLLMResponse): ChatResult {
  const generations = responseToChatGenerations(response);
  return {
    generations,
    llmOutput: responseToGenerationInfo(response),
  };
}

export function safeResponseToChatResult(
  response: GoogleLLMResponse,
  safetyHandler: GoogleAISafetyHandler
): ChatResult {
  return safeResponseTo(response, safetyHandler, responseToChatResult);
}

export function validateGeminiParams(params: GoogleAIModelParams): void {
  if (params.maxOutputTokens && params.maxOutputTokens < 0) {
    throw new Error("`maxOutputTokens` must be a positive integer");
  }

  if (
    params.temperature &&
    (params.temperature < 0 || params.temperature > 1)
  ) {
    throw new Error("`temperature` must be in the range of [0.0,1.0]");
  }

  if (params.topP && (params.topP < 0 || params.topP > 1)) {
    throw new Error("`topP` must be in the range of [0.0,1.0]");
  }

  if (params.topK && params.topK < 0) {
    throw new Error("`topK` must be a positive integer");
  }
}

export function isModelGemini(modelName: string): boolean {
  return modelName.toLowerCase().startsWith("gemini");
}

export interface DefaultGeminiSafetySettings {
  errorFinish?: string[];
}

export class DefaultGeminiSafetyHandler implements GoogleAISafetyHandler {
  errorFinish = ["SAFETY", "RECITATION", "OTHER"];

  constructor(settings?: DefaultGeminiSafetySettings) {
    this.errorFinish = settings?.errorFinish ?? this.errorFinish;
  }

  handleDataPromptFeedback(
    response: GoogleLLMResponse,
    data: GenerateContentResponseData
  ): GenerateContentResponseData {
    // Check to see if our prompt was blocked in the first place
    const promptFeedback = data?.promptFeedback;
    const blockReason = promptFeedback?.blockReason;
    if (blockReason) {
      throw new GoogleAISafetyError(response, `Prompt blocked: ${blockReason}`);
    }
    return data;
  }

  handleDataFinishReason(
    response: GoogleLLMResponse,
    data: GenerateContentResponseData
  ): GenerateContentResponseData {
    const firstCandidate = data?.candidates?.[0];
    const finishReason = firstCandidate?.finishReason;
    if (this.errorFinish.includes(finishReason)) {
      throw new GoogleAISafetyError(response, `Finish reason: ${finishReason}`);
    }
    return data;
  }

  handleData(
    response: GoogleLLMResponse,
    data: GenerateContentResponseData
  ): GenerateContentResponseData {
    let ret = data;
    ret = this.handleDataPromptFeedback(response, ret);
    ret = this.handleDataFinishReason(response, ret);
    return ret;
  }

  handle(response: GoogleLLMResponse): GoogleLLMResponse {
    let newdata;

    if ("nextChunk" in response.data) {
      // TODO: This is a stream. How to handle?
      newdata = response.data;
    } else if (Array.isArray(response.data)) {
      // If it is an array, try to handle every item in the array
      try {
        newdata = response.data.map((item) => this.handleData(response, item));
      } catch (xx) {
        // eslint-disable-next-line no-instanceof/no-instanceof
        if (xx instanceof GoogleAISafetyError) {
          throw new GoogleAISafetyError(response, xx.message);
        } else {
          throw xx;
        }
      }
    } else {
      const data = response.data as GenerateContentResponseData;
      newdata = this.handleData(response, data);
    }

    return {
      ...response,
      data: newdata,
    };
  }
}

export interface MessageGeminiSafetySettings
  extends DefaultGeminiSafetySettings {
  msg?: string;
  forceNewMessage?: boolean;
}

export class MessageGeminiSafetyHandler extends DefaultGeminiSafetyHandler {
  msg: string = "";

  forceNewMessage = false;

  constructor(settings?: MessageGeminiSafetySettings) {
    super(settings);
    this.msg = settings?.msg ?? this.msg;
    this.forceNewMessage = settings?.forceNewMessage ?? this.forceNewMessage;
  }

  setMessage(data: GenerateContentResponseData): GenerateContentResponseData {
    const ret = data;
    if (
      this.forceNewMessage ||
      !data?.candidates?.[0]?.content?.parts?.length
    ) {
      ret.candidates = data.candidates ?? [];
      ret.candidates[0] = data.candidates[0] ?? {};
      ret.candidates[0].content = data.candidates[0].content ?? {};
      ret.candidates[0].content = {
        role: "model",
        parts: [{ text: this.msg }],
      };
    }
    return ret;
  }

  handleData(
    response: GoogleLLMResponse,
    data: GenerateContentResponseData
  ): GenerateContentResponseData {
    try {
      return super.handleData(response, data);
    } catch (xx) {
      return this.setMessage(data);
    }
  }
}
