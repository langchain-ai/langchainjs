import { v4 as uuidv4 } from "uuid";
import {
  AIMessage,
  AIMessageChunk,
  AIMessageChunkFields,
  BaseMessage,
  BaseMessageChunk,
  BaseMessageFields,
  DataContentBlock,
  MessageContent,
  MessageContentComplex,
  MessageContentImageUrl,
  MessageContentText,
  type StandardContentBlockConverter,
  SystemMessage,
  ToolMessage,
  UsageMetadata,
  isAIMessage,
  parseBase64DataUrl,
  isDataContentBlock,
  convertToProviderContentBlock,
  InputTokenDetails,
  OutputTokenDetails,
  ModalitiesTokenDetails,
} from "@langchain/core/messages";
import {
  ChatGeneration,
  ChatGenerationChunk,
  ChatResult,
} from "@langchain/core/outputs";
import { StructuredToolParams } from "@langchain/core/tools";
import { isLangChainTool } from "@langchain/core/utils/function_calling";
import { concat } from "@langchain/core/utils/stream";
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
  GeminiGroundingSupport,
  GeminiResponseCandidate,
  GeminiLogprobsResult,
  GeminiLogprobsResultCandidate,
  GeminiLogprobsTopCandidate,
  ModalityTokenCount,
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
  GeminiSearchToolAttributes,
} from "../types.js";
import { schemaToGeminiParameters } from "./zod_to_gemini_parameters.js";

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

    const mimeTypeAndData = extractMimeType(url);
    if (mimeTypeAndData) {
      return {
        inlineData: mimeTypeAndData,
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

  const standardContentBlockConverter: StandardContentBlockConverter<{
    text: GeminiPartText;
    image: GeminiPartFileData | GeminiPartInlineData;
    audio: GeminiPartFileData | GeminiPartInlineData;
    file: GeminiPartFileData | GeminiPartInlineData | GeminiPartText;
  }> = {
    providerName: "Google Gemini",

    fromStandardTextBlock(block) {
      return {
        text: block.text,
      };
    },

    fromStandardImageBlock(block): GeminiPartFileData | GeminiPartInlineData {
      if (block.source_type === "url") {
        const data = parseBase64DataUrl({ dataUrl: block.url });
        if (data) {
          return {
            inlineData: {
              mimeType: data.mime_type,
              data: data.data,
            },
          };
        } else {
          return {
            fileData: {
              mimeType: block.mime_type ?? "",
              fileUri: block.url,
            },
          };
        }
      }

      if (block.source_type === "base64") {
        return {
          inlineData: {
            mimeType: block.mime_type ?? "",
            data: block.data,
          },
        };
      }

      throw new Error(`Unsupported source type: ${block.source_type}`);
    },

    fromStandardAudioBlock(block): GeminiPartFileData | GeminiPartInlineData {
      if (block.source_type === "url") {
        const data = parseBase64DataUrl({ dataUrl: block.url });
        if (data) {
          return {
            inlineData: {
              mimeType: data.mime_type,
              data: data.data,
            },
          };
        } else {
          return {
            fileData: {
              mimeType: block.mime_type ?? "",
              fileUri: block.url,
            },
          };
        }
      }

      if (block.source_type === "base64") {
        return {
          inlineData: {
            mimeType: block.mime_type ?? "",
            data: block.data,
          },
        };
      }

      throw new Error(`Unsupported source type: ${block.source_type}`);
    },

    fromStandardFileBlock(
      block
    ): GeminiPartFileData | GeminiPartInlineData | GeminiPartText {
      if (block.source_type === "text") {
        return {
          text: block.text,
        };
      }
      if (block.source_type === "url") {
        const data = parseBase64DataUrl({ dataUrl: block.url });
        if (data) {
          return {
            inlineData: {
              mimeType: data.mime_type,
              data: data.data,
            },
          };
        } else {
          return {
            fileData: {
              mimeType: block.mime_type ?? "",
              fileUri: block.url,
            },
          };
        }
      }

      if (block.source_type === "base64") {
        return {
          inlineData: {
            mimeType: block.mime_type ?? "",
            data: block.data,
          },
        };
      }
      throw new Error(`Unsupported source type: ${block.source_type}`);
    },
  };

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
    const contents = content.map((m) =>
      isDataContentBlock(m)
        ? convertToProviderContentBlock(m, standardContentBlockConverter)
        : messageContentComplexToPart(m)
    );
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
        : (
            message.content as (MessageContentComplex | DataContentBlock)[]
          ).reduce(
            (
              acc: string,
              content: MessageContentComplex | DataContentBlock
            ) => {
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

  type Logprob = {
    token: string;
    logprob: number;
    bytes: number[];
    top_logprobs?: Omit<Logprob, "top_logprobs">[];
  };

  type LogprobContent = {
    content: Logprob[];
  };

  function logprobResultToLogprob(
    result: GeminiLogprobsResultCandidate
  ): Omit<Logprob, "top_logprobs"> {
    const token = result?.token;
    const logprob = result?.logProbability;
    const encoder = new TextEncoder();
    const bytes = Array.from(encoder.encode(token));
    return {
      token,
      logprob,
      bytes,
    };
  }

  function candidateToLogprobs(
    candidate: GeminiResponseCandidate
  ): LogprobContent | undefined {
    const logprobs: GeminiLogprobsResult = candidate?.logprobsResult;
    const chosenTokens: GeminiLogprobsResultCandidate[] =
      logprobs?.chosenCandidates ?? [];
    const topTokens: GeminiLogprobsTopCandidate[] =
      logprobs?.topCandidates ?? [];
    const content: Logprob[] = [];
    for (let co = 0; co < chosenTokens.length; co += 1) {
      const chosen = chosenTokens[co];
      const top = topTokens[co]?.candidates ?? [];
      const logprob: Logprob = logprobResultToLogprob(chosen);
      logprob.top_logprobs = top.map((l) => logprobResultToLogprob(l));
      content.push(logprob);
    }
    return {
      content,
    };
  }

  function addModalityCounts(
    modalityTokenCounts: ModalityTokenCount[],
    details: InputTokenDetails | OutputTokenDetails
  ): void {
    modalityTokenCounts?.forEach((modalityTokenCount) => {
      const { modality, tokenCount } = modalityTokenCount;
      const modalityLc: keyof ModalitiesTokenDetails =
        modality.toLowerCase() as keyof ModalitiesTokenDetails;
      const currentCount = details[modalityLc] ?? 0;
      // eslint-disable-next-line no-param-reassign
      details[modalityLc] = currentCount + tokenCount;
    });
  }

  function responseToUsageMetadata(
    response: GoogleLLMResponse
  ): UsageMetadata | undefined {
    if ("usageMetadata" in response.data) {
      const data: GenerateContentResponseData = response?.data;
      const usageMetadata = data?.usageMetadata;

      const input_tokens = usageMetadata.promptTokenCount ?? 0;
      const candidatesTokenCount = usageMetadata.candidatesTokenCount ?? 0;
      const thoughtsTokenCount = usageMetadata.thoughtsTokenCount ?? 0;
      const output_tokens = candidatesTokenCount + thoughtsTokenCount;
      const total_tokens =
        usageMetadata.totalTokenCount ?? input_tokens + output_tokens;

      const input_token_details: InputTokenDetails = {};
      addModalityCounts(usageMetadata.promptTokensDetails, input_token_details);
      if (typeof usageMetadata?.cachedContentTokenCount === "number") {
        input_token_details.cache_read = usageMetadata.cachedContentTokenCount;
      }

      const output_token_details: OutputTokenDetails = {};
      addModalityCounts(
        usageMetadata?.candidatesTokensDetails,
        output_token_details
      );
      if (typeof usageMetadata?.thoughtsTokenCount === "number") {
        output_token_details.reasoning = usageMetadata.thoughtsTokenCount;
      }

      const ret: UsageMetadata = {
        input_tokens,
        output_tokens,
        total_tokens,
        input_token_details,
        output_token_details,
      };
      return ret;
    }
    return undefined;
  }

  function responseToGenerationInfo(response: GoogleLLMResponse) {
    const data =
      // eslint-disable-next-line no-nested-ternary
      Array.isArray(response.data) && response.data[0]
        ? response.data[0]
        : response.data &&
          (response.data as GenerateContentResponseData).candidates
        ? (response.data as GenerateContentResponseData)
        : undefined;
    if (!data) {
      return {};
    }

    const finish_reason = data.candidates[0]?.finishReason;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ret: Record<string, any> = {
      safety_ratings: data.candidates[0]?.safetyRatings?.map((rating) => ({
        category: rating.category,
        probability: rating.probability,
        probability_score: rating.probabilityScore,
        severity: rating.severity,
        severity_score: rating.severityScore,
      })),
      citation_metadata: data.candidates[0]?.citationMetadata,
      grounding_metadata: data.candidates[0]?.groundingMetadata,
      finish_reason,
      finish_message: data.candidates[0]?.finishMessage,
      avgLogprobs: data.candidates[0]?.avgLogprobs,
      logprobs: candidateToLogprobs(data.candidates[0]),
    };

    // Only add the usage_metadata on the last chunk
    // sent while streaming (see issue 8102).
    if (typeof finish_reason === "string") {
      ret.usage_metadata = responseToUsageMetadata(response);
    }

    return ret;
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const generationInfo: Record<string, any> = {};

    return new ChatGenerationChunk({
      text,
      message,
      generationInfo,
    });
  }

  function groundingSupportByPart(
    groundingSupports?: GeminiGroundingSupport[]
  ): GeminiGroundingSupport[][] {
    const ret: GeminiGroundingSupport[][] = [];

    if (!groundingSupports || groundingSupports.length === 0) {
      return [];
    }

    groundingSupports?.forEach((groundingSupport) => {
      const segment = groundingSupport?.segment;
      const partIndex = segment?.partIndex ?? 0;
      if (ret[partIndex]) {
        ret[partIndex].push(groundingSupport);
      } else {
        ret[partIndex] = [groundingSupport];
      }
    });

    return ret;
  }

  function responseToGroundedChatGenerations(
    response: GoogleLLMResponse
  ): ChatGeneration[] {
    const parts = responseToParts(response);

    if (parts.length === 0) {
      return [];
    }

    // Citation and grounding information connected to each part / ChatGeneration
    // to make sure they are available in downstream filters.
    const candidate = (response?.data as GenerateContentResponseData)
      ?.candidates?.[0];
    const groundingMetadata = candidate?.groundingMetadata;
    const citationMetadata = candidate?.citationMetadata;
    const groundingParts = groundingSupportByPart(
      groundingMetadata?.groundingSupports
    );

    const ret = parts.map((part, index) => {
      const gen = partToChatGeneration(part);
      if (!gen.generationInfo) {
        gen.generationInfo = {};
      }
      if (groundingMetadata) {
        gen.generationInfo.groundingMetadata = groundingMetadata;
        const groundingPart = groundingParts[index];
        if (groundingPart) {
          gen.generationInfo.groundingSupport = groundingPart;
        }
      }
      if (citationMetadata) {
        gen.generationInfo.citationMetadata = citationMetadata;
      }
      return gen;
    });

    return ret;
  }

  type GenerationTypes = {
    content: ChatGeneration[];
    reasoning: ChatGeneration[];
  };

  function combineContent(
    gen: ChatGeneration[],
    forceComplex: boolean = false
  ): MessageContent {
    const allString = gen.every(
      (item) => typeof item.message.content === "string"
    );
    if (allString && !forceComplex) {
      // Everything is a string, and we don't want to force it to return
      // MessageContentComplex[], so concatenate the content into one string
      return gen.map((item) => item.message.content).join("");
    } else {
      // We either have complex types, or we want to force them, so turn
      // it into an array of complex types.
      const ret: MessageContentComplex[] = [];
      gen.forEach((item) => {
        if (typeof item.message.content === "string") {
          // If this is a string, turn it into a text type
          ret.push({
            text: item.message.content,
          });
        } else {
          // Otherwise, add all the complex types to what we're returning
          item.message.content.forEach((c) => {
            ret.push(c);
          });
        }
      });
      return ret;
    }
  }

  function combineText(gen: ChatGeneration[]): string {
    return gen.map((item) => item.text ?? "").join("");
  }

  /*
   * We don't really need the entire AIMessageChunk here, but it is
   * a conventient way to combine all the Tool Calling information.
   */
  function combineToolCalls(gen: ChatGeneration[]): AIMessageChunk {
    let ret = new AIMessageChunk("");

    gen.forEach((item: ChatGeneration) => {
      const message: AIMessageChunk = item?.message as AIMessageChunk;
      ret = concat(ret, message);
    });

    return ret;
  }

  function combineAdditionalKwargs(
    gen: ChatGeneration[]
  ): Record<string, unknown> {
    const ret: Record<string, unknown> = {};

    gen.forEach((item: ChatGeneration) => {
      const message: AIMessageChunk = item?.message as AIMessageChunk;
      const kwargs = message?.additional_kwargs ?? {};
      const keys = Object.keys(kwargs);
      keys.forEach((key) => {
        const value = kwargs[key];
        if (
          Object.hasOwn(ret, key) &&
          Array.isArray(ret[key]) &&
          Array.isArray(value)
        ) {
          (ret[key] as Array<unknown>).push(...value);
        } else {
          ret[key] = value;
        }
      });
    });

    return ret;
  }

  function combineGenerations(
    generations: ChatGeneration[],
    response: GoogleLLMResponse
  ): ChatGeneration[] {
    const gen: GenerationTypes = splitGenerationTypes(generations, response);
    const combinedContent: MessageContent = combineContent(gen.content);
    const combinedText = combineText(gen.content);
    const combinedToolCalls = combineToolCalls(gen.content);
    const kwargs = combineAdditionalKwargs(gen.content);
    const lastContent = gen.content[gen.content.length - 1];

    // Add usage metadata
    const usage_metadata = responseToUsageMetadata(response);

    // Add thinking / reasoning
    // if (gen.reasoning && gen.reasoning.length > 0) {
    //   kwargs.reasoning_content = combineContent(gen.reasoning, true);
    // }

    // Build the message and the generation chunk to return
    const message = new AIMessageChunk({
      content: combinedContent,
      additional_kwargs: kwargs,
      usage_metadata,
      tool_calls: combinedToolCalls.tool_calls,
      invalid_tool_calls: combinedToolCalls.invalid_tool_calls,
    });
    return [
      new ChatGenerationChunk({
        message,
        text: combinedText,
        generationInfo: lastContent.generationInfo,
      }),
    ];
  }

  function splitGenerationTypes(
    generations: ChatGeneration[],
    _response: GoogleLLMResponse
  ): GenerationTypes {
    const content: ChatGeneration[] = [];
    const reasoning: ChatGeneration[] = [];

    generations.forEach((gen) => {
      if (gen?.generationInfo?.thought) {
        reasoning.push(gen);
      } else {
        content.push(gen);
      }
    });

    return {
      content,
      reasoning,
    };
  }

  /**
   * Although this returns an array, only the first (or maybe last)
   * element in the array is used. So we need to combine them into
   * just one element that contains everything we need.
   * @param response
   */
  function responseToChatGenerations(
    response: GoogleLLMResponse
  ): ChatGeneration[] {
    const generations = responseToGroundedChatGenerations(response);

    if (generations.length === 0) {
      return [];
    }

    const ret = combineGenerations(generations, response);

    // Add logprobs information to the message
    const candidate = (response?.data as GenerateContentResponseData)
      ?.candidates?.[0];
    const avgLogprobs = candidate?.avgLogprobs;
    const logprobs = candidateToLogprobs(candidate);
    if (logprobs) {
      ret[0].message.response_metadata = {
        ...ret[0].message.response_metadata,
        logprobs,
        avgLogprobs,
      };
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
    const ret: GeminiGenerationConfig = {
      temperature: parameters.temperature,
      topK: parameters.topK,
      topP: parameters.topP,
      seed: parameters.seed,
      presencePenalty: parameters.presencePenalty,
      frequencyPenalty: parameters.frequencyPenalty,
      maxOutputTokens: parameters.maxOutputTokens,
      stopSequences: parameters.stopSequences,
      responseMimeType: parameters.responseMimeType,
      responseModalities: parameters.responseModalities,
    };

    // Add the logprobs if explicitly set
    if (typeof parameters.logprobs !== "undefined") {
      ret.responseLogprobs = parameters.logprobs;
      if (
        parameters.logprobs &&
        typeof parameters.topLogprobs !== "undefined"
      ) {
        ret.logprobs = parameters.topLogprobs;
      }
    }

    // Add thinking configuration if explicitly set
    // Note that you cannot have thinkingBudget set to 0 and includeThoughts true
    if (typeof parameters.maxReasoningTokens !== "undefined") {
      ret.thinkingConfig = {
        thinkingBudget: parameters.maxReasoningTokens,
        // TODO: Expose this configuration to the user once google fully supports it
        includeThoughts: false,
      };
    }

    // Remove any undefined properties, so we don't send them
    let attribute: keyof GeminiGenerationConfig;
    for (attribute in ret) {
      if (ret[attribute] === undefined) {
        delete ret[attribute];
      }
    }

    return ret;
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
    const jsonSchema = schemaToGeminiParameters(tool.schema);
    return {
      name: tool.name,
      description: tool.description ?? `A function available to call.`,
      parameters: jsonSchema,
    };
  }

  function searchToolName(tool: GeminiTool): string | undefined {
    for (const name of GeminiSearchToolAttributes) {
      if (name in tool) {
        return name;
      }
    }
    return undefined;
  }

  function cleanGeminiTool(tool: GeminiTool): GeminiTool {
    const orig = searchToolName(tool);
    const adj = config?.googleSearchToolAdjustment;
    if (orig && adj && adj !== orig) {
      return {
        [adj as string]: {},
      };
    } else {
      return tool;
    }
  }

  function formatTools(parameters: GoogleAIModelRequestParams): GeminiTool[] {
    const tools: GoogleAIToolType[] | undefined = parameters?.tools;
    if (!tools || tools.length === 0) {
      return [];
    }

    // Group all LangChain tools into a single functionDeclarations array.
    // Gemini Tools may be normalized to different tool names
    const langChainTools: StructuredToolParams[] = [];
    const otherTools: GeminiTool[] = [];
    tools.forEach((tool) => {
      if (isLangChainTool(tool)) {
        langChainTools.push(tool);
      } else {
        otherTools.push(cleanGeminiTool(tool as GeminiTool));
      }
    });

    const result: GeminiTool[] = [...otherTools];

    if (langChainTools.length > 0) {
      result.push({
        functionDeclarations: langChainTools.map(
          structuredToolToFunctionDeclaration
        ),
      });
    }

    return result;
  }

  function formatToolConfig(
    parameters: GoogleAIModelRequestParams
  ): GeminiRequest["toolConfig"] | undefined {
    if (!parameters.tool_choice || typeof parameters.tool_choice !== "string") {
      return undefined;
    }

    if (["auto", "any", "none"].includes(parameters.tool_choice)) {
      return {
        functionCallingConfig: {
          mode: parameters.tool_choice as "auto" | "any" | "none",
          allowedFunctionNames: parameters.allowed_function_names,
        },
      };
    }

    // force tool choice to be a single function name in case of structured output
    return {
      functionCallingConfig: {
        mode: "any",
        allowedFunctionNames: [parameters.tool_choice],
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
    if (parameters.cachedContent) {
      ret.cachedContent = parameters.cachedContent;
    }
    if (parameters.labels && Object.keys(parameters.labels).length > 0) {
      ret.labels = parameters.labels;
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
  if (typeof params.maxReasoningTokens !== "undefined") {
    if (params.maxReasoningTokens < 0) {
      throw new Error("`maxReasoningTokens` must be non-negative integer");
    }
    if (typeof params.maxOutputTokens !== "undefined") {
      if (params.maxReasoningTokens >= params.maxOutputTokens) {
        throw new Error(
          "`maxOutputTokens` must be greater than `maxReasoningTokens`"
        );
      }
    }
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

export function isModelGemma(modelName: string): boolean {
  return modelName.toLowerCase().startsWith("gemma");
}
