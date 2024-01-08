import {
  AIMessage,
  AIMessageChunk,
  BaseMessage,
  BaseMessageChunk,
  MessageContent,
  MessageContentComplex,
  MessageContentImageUrl,
  MessageContentText,
  SystemMessage,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
  Generation,
} from "@langchain/core/outputs";
import { GoogleLLMResponse } from "./connection.js";
import { GoogleAIModelParams } from "./types.js";

export interface GeminiPartText {
  text: string;
}

export interface GeminiPartInlineData {
  mimeType: string;
  data: string;
}

// Vertex AI only
export interface GeminiPartFileData {
  mimeType: string;
  fileUri: string;
}

// AI Studio only?
export interface GeminiPartFunctionCall {
  name: string;
  args?: object;
}

// AI Studio Only?
export interface GeminiPartFunctionResponse {
  name: string;
  response: object;
}

export type GeminiPart =
  | GeminiPartText
  | GeminiPartInlineData
  | GeminiPartFileData
  | GeminiPartFunctionCall
  | GeminiPartFunctionResponse;

export interface GeminiSafetySetting {
  category: string;
  threshold: string;
}

export interface GeminiSafetyRating {
  category: string;
  probability: string;
}

export type GeminiRole = "user" | "model";

// Vertex AI requires the role

export interface GeminiContent {
  parts: GeminiPart[];
  role: GeminiRole; // Vertex AI requires the role
}

export interface GeminiTool {
  // TODO: Implement
}

export interface GeminiGenerationConfig {
  stopSequences?: string[];
  candidateCount?: number;
  maxOutputTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
}

export interface GeminiRequest {
  contents?: GeminiContent[];
  tools?: GeminiTool[];
  safetySettings?: GeminiSafetySetting[];
  generationConfig?: GeminiGenerationConfig;
}

interface GeminiResponseCandidate {
  content: {
    parts: GeminiPart[];
    role: string;
  };
  finishReason: string;
  index: number;
  tokenCount?: number;
  safetyRatings: GeminiSafetyRating[];
}

interface GeminiResponsePromptFeedback {
  safetyRatings: GeminiSafetyRating[];
}

export interface GenerateContentResponseData {
  candidates: GeminiResponseCandidate[];
  promptFeedback: GeminiResponsePromptFeedback;
}

function messageContentText(content: MessageContentText): GeminiPartText {
  return {
    text: content.text,
  };
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

  if (url.startsWith("data:")) {
    return {
      mimeType: url.split(":")[1].split(";")[0],
      data: url.split(",")[1],
    };
  } else {
    // FIXME - need some way to get mime type
    return {
      mimeType: "image/png",
      fileUri: url,
    };
  }
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
  const parts: GeminiPart[] = messageContent.map((content) => {
    // eslint-disable-next-line default-case
    switch (content.type) {
      case "text":
        return messageContentText(content);
      case "image_url":
        return messageContentImageUrl(content);
    }
  });

  return parts;
}

function roleMessageToContent(
  role: GeminiRole,
  message: BaseMessage
): GeminiContent[] {
  return [
    {
      role,
      parts: messageContentToParts(message.content),
    },
  ];
}

function systemMessageToContent(message: SystemMessage): GeminiContent[] {
  return [
    ...roleMessageToContent("user", message),
    ...roleMessageToContent("model", new AIMessage("Ok")),
  ];
}

export function baseMessageToContent(message: BaseMessage): GeminiContent[] {
  const type = message._getType();
  switch (type) {
    case "system":
      return systemMessageToContent(message as SystemMessage);
    case "human":
      return roleMessageToContent("user", message);
    case "ai":
      return roleMessageToContent("model", message);
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
    image_url: `data:${part.mimeType};base64,${part.data}`,
  };
}

function fileDataPartToMessageContent(
  part: GeminiPartFileData
): MessageContentImageUrl {
  return {
    type: "image_url",
    image_url: part.fileUri,
  };
}

export function partsToMessageContent(parts: GeminiPart[]): MessageContent {
  return parts
    .map((part) => {
      if ("text" in part) {
        return textPartToMessageContent(part);
      } else if ("mimeType" in part && "data" in part) {
        return inlineDataPartToMessageContent(part);
      } else if ("mimeType" in part && "fileUri" in part) {
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

export function responseToGeneration(response: GoogleLLMResponse): Generation {
  return {
    text: responseToString(response),
    generationInfo: response,
  };
}

export function responseToChatGeneration(
  response: GoogleLLMResponse
): ChatGenerationChunk {
  return new ChatGenerationChunk({
    text: responseToString(response),
    message: partToMessage(responseToParts(response)[0]),
    generationInfo: response,
  });
}

export function partToMessage(part: GeminiPart): BaseMessageChunk {
  const content = partsToMessageContent([part]);
  return new AIMessageChunk({ content });
}

export function partToChatGeneration(part: GeminiPart): ChatGeneration {
  const message = partToMessage(part);
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
  const ret = parts.map((part) => partToChatGeneration(part));
  return ret;
}

export function responseToMessageContent(
  response: GoogleLLMResponse
): MessageContent {
  const parts = responseToParts(response);
  return partsToMessageContent(parts);
}

export function responseToBaseMessage(
  response: GoogleLLMResponse
): BaseMessage {
  return new AIMessage({
    content: responseToMessageContent(response),
  });
}

export function responseToChatResult(response: GoogleLLMResponse): ChatResult {
  const generations = responseToChatGenerations(response);
  return {
    generations,
    llmOutput: response,
  };
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
