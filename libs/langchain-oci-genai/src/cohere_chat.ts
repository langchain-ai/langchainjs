import {
  CohereChatBotMessage,
  CohereChatRequest,
  CohereChatResponse,
  CohereMessage,
  CohereSystemMessage,
  CohereUserMessage,
} from "oci-generativeaiinference/lib/model";

import { BaseMessage } from "@langchain/core/messages";
import { LangSmithParams } from "@langchain/core/language_models/chat_models";
import { OciGenAiBaseChat } from "./chat_models.js";

interface HistoryMessageInfo {
  chatHistory: CohereMessage[];
  message: string;
}

interface CohereStreamedResponseChunkData {
  apiFormat: string;
  text: string;
}

export type CohereCallOptions = Omit<
  CohereChatRequest,
  "apiFormat" | "message" | "chatHistory" | "isStream" | "stopSequences"
>;

export class OciGenAiCohereChat extends OciGenAiBaseChat<CohereCallOptions> {
  override _createRequest(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    stream?: boolean
  ): CohereChatRequest {
    const historyMessage: HistoryMessageInfo =
      OciGenAiCohereChat._splitMessageAndHistory(messages);

    return <CohereChatRequest>{
      apiFormat: CohereChatRequest.apiFormat,
      message: historyMessage.message,
      chatHistory: historyMessage.chatHistory,
      ...options.requestParams,
      isStream: !!stream,
      stopSequences: options.stop,
    };
  }

  override _parseResponse(response: CohereChatResponse | undefined): string {
    if (!OciGenAiCohereChat._isCohereResponse(response)) {
      throw new Error("Invalid CohereResponse object");
    }

    return response.text;
  }

  override _parseStreamedResponseChunk(chunk: unknown): string {
    if (OciGenAiCohereChat._isCohereChunkData(chunk)) {
      return chunk.text;
    }

    throw new Error("Invalid streamed response chunk data");
  }

  static _splitMessageAndHistory(messages: BaseMessage[]): HistoryMessageInfo {
    const chatHistory: CohereMessage[] = [];
    let lastUserMessage = "";
    let lastUserMessageIndex = -1;

    for (let i = 0; i < messages.length; i += 1) {
      const cohereMessage: CohereMessage =
        this._convertBaseMessageToCohereMessage(messages[i]);
      chatHistory.push(cohereMessage);

      if (cohereMessage.role === CohereUserMessage.role) {
        lastUserMessage = (<CohereUserMessage>cohereMessage).message;
        lastUserMessageIndex = i;
      }
    }

    if (lastUserMessageIndex !== -1) {
      chatHistory.splice(lastUserMessageIndex, 1);
    }

    return {
      chatHistory,
      message: lastUserMessage,
    };
  }

  static _convertBaseMessageToCohereMessage(
    baseMessage: BaseMessage
  ): CohereMessage {
    const messageType: string = baseMessage.getType();
    const message: string = baseMessage.content as string;

    switch (messageType) {
      case "ai":
        return <CohereChatBotMessage>{
          role: CohereChatBotMessage.role,
          message,
        };

      case "system":
        return <CohereSystemMessage>{
          role: CohereSystemMessage.role,
          message,
        };

      case "human":
        return <CohereUserMessage>{
          role: CohereUserMessage.role,
          message,
        };

      default:
        throw new Error(`Message type '${messageType}' is not supported`);
    }
  }

  static _isCohereResponse(response: unknown): response is CohereChatResponse {
    return (
      response !== null &&
      typeof response === "object" &&
      typeof (<CohereChatResponse>response).text === "string"
    );
  }

  static _isCohereChunkData(
    chunkData: unknown
  ): chunkData is CohereStreamedResponseChunkData {
    return (
      chunkData !== null &&
      typeof chunkData === "object" &&
      typeof (<CohereStreamedResponseChunkData>chunkData).text === "string" &&
      (<CohereStreamedResponseChunkData>chunkData).apiFormat ===
        CohereChatRequest.apiFormat
    );
  }

  override getLsParams(options: this["ParsedCallOptions"]): LangSmithParams {
    return {
      ls_provider: "oci_genai_cohere",
      ls_model_name:
        this._params.onDemandModelId || this._params.dedicatedEndpointId || "",
      ls_model_type: "chat",
      ls_temperature: options.requestParams?.temperature || 0,
      ls_max_tokens: options.requestParams?.maxTokens || 0,
      ls_stop: options.stop || [],
    };
  }
}
