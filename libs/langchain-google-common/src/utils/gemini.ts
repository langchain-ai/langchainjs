import { v4 as uuidv4 } from "uuid";
import {
  AIMessage,
  AIMessageChunk,
  AIMessageChunkFields,
  BaseMessage,
  BaseMessageChunk,
  BaseMessageFields,
  MessageContent,
  MessageContentComplex,
  MessageContentImageUrl,
  MessageContentText,
  SystemMessage,
  ToolMessage,
  UsageMetadata,
  isAIMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { ToolCallChunk } from "@langchain/core/messages/tool";
import { StructuredToolParams } from "@langchain/core/tools";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
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
  GoogleAIAPI,
  GeminiAPIConfig,
} from "../types.js";
import { GoogleAISafetyError } from "./safety.js";
import { MediaBlob } from "../experimental/utils/media_core.js";
import {
  GeminiFunctionDeclaration,
  GeminiGenerationConfig,
  GeminiRequest,
  GeminiSafetySetting,
  GeminiTool,
  GoogleAIModelRequestParams,
  GoogleAIToolType,
} from "../types.js";
import { zodToGeminiParameters } from "./zod_to_gemini_parameters.js";

export interface FunctionCall {
  name: string;
  arguments: string;
}

export interface ToolCall {
  id: string;
  type: "function";
  function: FunctionCall;
}

export interface FunctionCallRaw {
  name: string;
  arguments: object;
}

export interface ToolCallRaw {
  id: string;
  type: "function";
  function: FunctionCallRaw;
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

export function getGeminiAPI(config?: GeminiAPIConfig): GoogleAIAPI {
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

  async function blobToFileData(blob: MediaBlob): Promise<GeminiPartFileData> {
    return {
      fileData: {
        fileUri: blob.path!,
        mimeType: blob.mimetype,
      },
    };
  }

  async function fileUriContentToBlob(
    uri: string
  ): Promise<MediaBlob | undefined> {
    return config?.mediaManager?.getMediaBlob(uri);
  }

  async function messageContentMedia(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: Record<string, any>
  ): Promise<GeminiPartInlineData | GeminiPartFileData> {
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
    } else {
      const uri = content.fileUri;
      const blob = await fileUriContentToBlob(uri);
      if (blob) {
        return await blobToFileData(blob);
      }
    }

    throw new Error(
      `Invalid media content: ${JSON.stringify(content, null, 1)}`
    );
  }

  async function messageContentComplexToPart(
    content: MessageContentComplex
  ): Promise<GeminiPart | null> {
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
        return await messageContentMedia(content);
      default:
        throw new Error(
          `Unsupported type "${content.type}" received while converting message to message parts: ${content}`
        );
    }
    throw new Error(
      `Cannot coerce "${content.type}" message part into a string.`
    );
  }

  async function messageContentComplexToParts(
    content: MessageContentComplex[]
  ): Promise<(GeminiPart | null)[]> {
    const contents = content.map(messageContentComplexToPart);
    return Promise.all(contents);
  }

  async function messageContentToParts(
    content: MessageContent
  ): Promise<GeminiPart[]> {
    // Convert a string to a text type MessageContent if needed
    const messageContent: MessageContentComplex[] =
      typeof content === "string"
        ? [
            {
              type: "text",
              text: content,
            },
          ]
        : content;

    // Get all of the parts, even those that don't correctly resolve
    const allParts = await messageContentComplexToParts(messageContent);

    // Remove any invalid parts
    const parts: GeminiPart[] = allParts.reduce(
      (acc: GeminiPart[], val: GeminiPart | null | undefined) => {
        if (val) {
          return [...acc, val];
        } else {
          return acc;
        }
      },
      []
    );

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

  async function roleMessageToContent(
    role: GeminiRole,
    message: BaseMessage
  ): Promise<GeminiContent[]> {
    const contentParts: GeminiPart[] = await messageContentToParts(
      message.content
    );
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

  async function systemMessageToContent(
    message: SystemMessage
  ): Promise<GeminiContent[]> {
    return config?.useSystemInstruction
      ? roleMessageToContent("system", message)
      : [
          ...(await roleMessageToContent("user", message)),
          ...(await roleMessageToContent("model", new AIMessage("Ok"))),
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

  async function baseMessageToContent(
    message: BaseMessage,
    prevMessage: BaseMessage | undefined
  ): Promise<GeminiContent[]> {
    const type = message._getType();
    switch (type) {
      case "system":
        return systemMessageToContent(message as SystemMessage);
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

  function partsToMessageContent(parts: GeminiPart[]): MessageContent {
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

  function functionCallPartToToolRaw(
    part: GeminiPartFunctionCall
  ): ToolCallRaw {
    return {
      id: uuidv4().replace(/-/g, ""),
      type: "function",
      function: {
        name: part.functionCall.name,
        arguments: part.functionCall.args ?? {},
      },
    };
  }

  function partsToToolsRaw(parts: GeminiPart[]): ToolCallRaw[] {
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

  function toolsRawToTools(raws: ToolCallRaw[]): ToolCall[] {
    return raws.map((raw) => toolRawToTool(raw));
  }

  function responseToGenerateContentResponseData(
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

  function responseToParts(response: GoogleLLMResponse): GeminiPart[] {
    const responseData = responseToGenerateContentResponseData(response);
    const parts = responseData?.candidates?.[0]?.content?.parts ?? [];
    return parts;
  }

  function partToText(part: GeminiPart): string {
    return "text" in part ? part.text : "";
  }

  function responseToString(response: GoogleLLMResponse): string {
    const parts = responseToParts(response);
    const ret: string = parts.reduce((acc, part) => {
      const val = partToText(part);
      return acc + val;
    }, "");
    return ret;
  }

  function safeResponseTo<RetType>(
    response: GoogleLLMResponse,
    responseTo: (response: GoogleLLMResponse) => RetType
  ): RetType {
    const safetyHandler =
      config?.safetyHandler ?? new DefaultGeminiSafetyHandler();
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

  function safeResponseToString(response: GoogleLLMResponse): string {
    return safeResponseTo(response, responseToString);
  }

  function responseToGenerationInfo(response: GoogleLLMResponse) {
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

  function responseToChatGeneration(
    response: GoogleLLMResponse
  ): ChatGenerationChunk {
    return new ChatGenerationChunk({
      text: responseToString(response),
      message: partToMessageChunk(responseToParts(response)[0]),
      generationInfo: responseToGenerationInfo(response),
    });
  }

  function safeResponseToChatGeneration(
    response: GoogleLLMResponse
  ): ChatGenerationChunk {
    return safeResponseTo(response, responseToChatGeneration);
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

  function partToMessageChunk(part: GeminiPart): BaseMessageChunk {
    const fields = partsToBaseMessageChunkFields([part]);
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

  function partToChatGeneration(part: GeminiPart): ChatGeneration {
    const message = partToMessageChunk(part);
    const text = partToText(part);
    return new ChatGenerationChunk({
      text,
      message,
    });
  }

  function responseToChatGenerations(
    response: GoogleLLMResponse
  ): ChatGeneration[] {
    const parts = responseToParts(response);

    if (parts.length === 0) {
      return [];
    }

    let ret = parts.map((part) => partToChatGeneration(part));
    if (ret.every((item) => typeof item.message.content === "string")) {
      const combinedContent = ret.map((item) => item.message.content).join("");
      const combinedText = ret.map((item) => item.text).join("");
      const toolCallChunks: ToolCallChunk[] | undefined = ret[
        ret.length - 1
      ]?.message.additional_kwargs?.tool_calls?.map((toolCall, i) => ({
        name: toolCall.function.name,
        args: toolCall.function.arguments,
        id: toolCall.id,
        index: i,
        type: "tool_call_chunk",
      }));
      let usageMetadata: UsageMetadata | undefined;
      if ("usageMetadata" in response.data) {
        usageMetadata = {
          input_tokens: response.data.usageMetadata.promptTokenCount as number,
          output_tokens: response.data.usageMetadata
            .candidatesTokenCount as number,
          total_tokens: response.data.usageMetadata.totalTokenCount as number,
        };
      }
      ret = [
        new ChatGenerationChunk({
          message: new AIMessageChunk({
            content: combinedContent,
            additional_kwargs: ret[ret.length - 1]?.message.additional_kwargs,
            tool_call_chunks: toolCallChunks,
            usage_metadata: usageMetadata,
          }),
          text: combinedText,
          generationInfo: ret[ret.length - 1].generationInfo,
        }),
      ];
    }
    return ret;
  }

  function responseToBaseMessageFields(
    response: GoogleLLMResponse
  ): BaseMessageFields {
    const parts = responseToParts(response);
    return partsToBaseMessageChunkFields(parts);
  }

  function partsToBaseMessageChunkFields(
    parts: GeminiPart[]
  ): AIMessageChunkFields {
    const fields: AIMessageChunkFields = {
      content: partsToMessageContent(parts),
      tool_call_chunks: [],
      tool_calls: [],
      invalid_tool_calls: [],
    };

    const rawTools = partsToToolsRaw(parts);
    if (rawTools.length > 0) {
      const tools = toolsRawToTools(rawTools);
      for (const tool of tools) {
        fields.tool_call_chunks?.push({
          name: tool.function.name,
          args: tool.function.arguments,
          id: tool.id,
          type: "tool_call_chunk",
        });

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
            args: tool.function.arguments,
            id: tool.id,
            error: e.message,
            type: "invalid_tool_call",
          });
        }
      }
      fields.additional_kwargs = {
        tool_calls: tools,
      };
    }
    return fields;
  }

  function responseToBaseMessage(response: GoogleLLMResponse): BaseMessage {
    const fields = responseToBaseMessageFields(response);
    return new AIMessage(fields);
  }

  function safeResponseToBaseMessage(response: GoogleLLMResponse): BaseMessage {
    return safeResponseTo(response, responseToBaseMessage);
  }

  function responseToChatResult(response: GoogleLLMResponse): ChatResult {
    const generations = responseToChatGenerations(response);
    return {
      generations,
      llmOutput: responseToGenerationInfo(response),
    };
  }

  function safeResponseToChatResult(response: GoogleLLMResponse): ChatResult {
    return safeResponseTo(response, responseToChatResult);
  }

  function inputType(
    input: MessageContent | BaseMessage[]
  ): "MessageContent" | "BaseMessageArray" {
    if (typeof input === "string") {
      return "MessageContent";
    } else {
      const firstItem: BaseMessage | MessageContentComplex = input[0];
      if (Object.hasOwn(firstItem, "content")) {
        return "BaseMessageArray";
      } else {
        return "MessageContent";
      }
    }
  }

  async function formatMessageContents(
    input: MessageContent,
    _parameters: GoogleAIModelParams
  ): Promise<GeminiContent[]> {
    const parts = await messageContentToParts!(input);
    const contents: GeminiContent[] = [
      {
        role: "user", // Required by Vertex AI
        parts,
      },
    ];
    return contents;
  }

  async function formatBaseMessageContents(
    input: BaseMessage[],
    _parameters: GoogleAIModelParams
  ): Promise<GeminiContent[]> {
    const inputPromises: Promise<GeminiContent[]>[] = input.map((msg, i) =>
      baseMessageToContent!(msg, input[i - 1])
    );
    const inputs = await Promise.all(inputPromises);

    return inputs.reduce((acc, cur) => {
      // Filter out the system content
      if (cur.every((content) => content.role === "system")) {
        return acc;
      }

      // Combine adjacent function messages
      if (
        cur[0]?.role === "function" &&
        acc.length > 0 &&
        acc[acc.length - 1].role === "function"
      ) {
        acc[acc.length - 1].parts = [
          ...acc[acc.length - 1].parts,
          ...cur[0].parts,
        ];
      } else {
        acc.push(...cur);
      }

      return acc;
    }, [] as GeminiContent[]);
  }

  async function formatContents(
    input: MessageContent | BaseMessage[],
    parameters: GoogleAIModelRequestParams
  ): Promise<GeminiContent[]> {
    const it = inputType(input);
    switch (it) {
      case "MessageContent":
        return formatMessageContents(input as MessageContent, parameters);
      case "BaseMessageArray":
        return formatBaseMessageContents(input as BaseMessage[], parameters);
      default:
        throw new Error(`Unknown input type "${it}": ${input}`);
    }
  }

  function formatGenerationConfig(
    parameters: GoogleAIModelRequestParams
  ): GeminiGenerationConfig {
    return {
      temperature: parameters.temperature,
      topK: parameters.topK,
      topP: parameters.topP,
      maxOutputTokens: parameters.maxOutputTokens,
      stopSequences: parameters.stopSequences,
      responseMimeType: parameters.responseMimeType,
    };
  }

  function formatSafetySettings(
    parameters: GoogleAIModelRequestParams
  ): GeminiSafetySetting[] {
    return parameters.safetySettings ?? [];
  }

  async function formatBaseMessageSystemInstruction(
    input: BaseMessage[]
  ): Promise<GeminiContent> {
    let ret = {} as GeminiContent;
    for (let index = 0; index < input.length; index += 1) {
      const message = input[index];
      if (message._getType() === "system") {
        // For system types, we only want it if it is the first message,
        // if it appears anywhere else, it should be an error.
        if (index === 0) {
          // eslint-disable-next-line prefer-destructuring
          ret = (await baseMessageToContent!(message, undefined))[0];
        } else {
          throw new Error(
            "System messages are only permitted as the first passed message."
          );
        }
      }
    }

    return ret;
  }

  async function formatSystemInstruction(
    input: MessageContent | BaseMessage[]
  ): Promise<GeminiContent> {
    if (!config?.useSystemInstruction) {
      return {} as GeminiContent;
    }

    const it = inputType(input);
    switch (it) {
      case "BaseMessageArray":
        return formatBaseMessageSystemInstruction(input as BaseMessage[]);
      default:
        return {} as GeminiContent;
    }
  }

  function structuredToolToFunctionDeclaration(
    tool: StructuredToolParams
  ): GeminiFunctionDeclaration {
    const jsonSchema = zodToGeminiParameters(tool.schema);
    return {
      name: tool.name,
      description: tool.description ?? `A function available to call.`,
      parameters: jsonSchema,
    };
  }

  function structuredToolsToGeminiTools(
    tools: StructuredToolParams[]
  ): GeminiTool[] {
    return [
      {
        functionDeclarations: tools.map(structuredToolToFunctionDeclaration),
      },
    ];
  }

  function formatTools(parameters: GoogleAIModelRequestParams): GeminiTool[] {
    const tools: GoogleAIToolType[] | undefined = parameters?.tools;
    if (!tools || tools.length === 0) {
      return [];
    }

    if (tools.every(isLangChainTool)) {
      return structuredToolsToGeminiTools(tools);
    } else {
      if (
        tools.length === 1 &&
        (!("functionDeclarations" in tools[0]) ||
          !tools[0].functionDeclarations?.length)
      ) {
        return [];
      }
      return tools as GeminiTool[];
    }
  }

  function formatToolConfig(
    parameters: GoogleAIModelRequestParams
  ): GeminiRequest["toolConfig"] | undefined {
    if (!parameters.tool_choice || typeof parameters.tool_choice !== "string") {
      return undefined;
    }

    return {
      functionCallingConfig: {
        mode: parameters.tool_choice as "auto" | "any" | "none",
        allowedFunctionNames: parameters.allowed_function_names,
      },
    };
  }

  async function formatData(
    input: unknown,
    parameters: GoogleAIModelRequestParams
  ): Promise<GeminiRequest> {
    const typedInput = input as MessageContent | BaseMessage[];
    const contents = await formatContents(typedInput, parameters);
    const generationConfig = formatGenerationConfig(parameters);
    const tools = formatTools(parameters);
    const toolConfig = formatToolConfig(parameters);
    const safetySettings = formatSafetySettings(parameters);
    const systemInstruction = await formatSystemInstruction(typedInput);

    const ret: GeminiRequest = {
      contents,
      generationConfig,
    };
    if (tools && tools.length) {
      ret.tools = tools;
    }
    if (toolConfig) {
      ret.toolConfig = toolConfig;
    }
    if (safetySettings && safetySettings.length) {
      ret.safetySettings = safetySettings;
    }
    if (
      systemInstruction?.role &&
      systemInstruction?.parts &&
      systemInstruction?.parts?.length
    ) {
      ret.systemInstruction = systemInstruction;
    }
    return ret;
  }

  return {
    messageContentToParts,
    baseMessageToContent,
    responseToString: safeResponseToString,
    responseToChatGeneration: safeResponseToChatGeneration,
    chunkToString,
    responseToBaseMessage: safeResponseToBaseMessage,
    responseToChatResult: safeResponseToChatResult,
    formatData,
  };
}

export function validateGeminiParams(params: GoogleAIModelParams): void {
  if (params.maxOutputTokens && params.maxOutputTokens < 0) {
    throw new Error("`maxOutputTokens` must be a positive integer");
  }

  if (
    params.temperature &&
    (params.temperature < 0 || params.temperature > 2)
  ) {
    throw new Error("`temperature` must be in the range of [0.0,2.0]");
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
