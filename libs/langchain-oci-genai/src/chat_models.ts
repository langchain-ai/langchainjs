import { AIMessageChunk, BaseMessage } from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { SimpleChatModel } from "@langchain/core/language_models/chat_models";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import { ChatResponse } from "oci-generativeaiinference/lib/response";
import { ChatRequest } from "oci-generativeaiinference/lib/request";
import {
  DedicatedServingMode,
  OnDemandServingMode,
} from "oci-generativeaiinference/lib/model";

import {
  OciGenAiChatCallResponseType,
  OciGenAiModelBaseParams,
  OciGenAiModelCallOptions,
  OciGenAiSupportedRequestType,
  OciGenAiSupportedResponseType,
} from "./types.js";

import { OciGenAiSdkClient } from "./oci_genai_sdk_client.js";
import { JsonServerEventsIterator } from "./server_events_iterator.js";

export abstract class OciGenAiBaseChat<RequestType> extends SimpleChatModel<
  OciGenAiModelCallOptions<RequestType>
> {
  _sdkClient: OciGenAiSdkClient | undefined;

  _params: Partial<OciGenAiModelBaseParams>;

  constructor(params?: Partial<OciGenAiModelBaseParams>) {
    super(params ?? {});
    this._params = params ?? {};
  }

  abstract _createRequest(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    stream?: boolean
  ): OciGenAiSupportedRequestType;

  abstract _parseResponse(
    response: OciGenAiSupportedResponseType | undefined
  ): string;

  abstract _parseStreamedResponseChunk(chunk: unknown): string | undefined;

  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"]
  ): Promise<string> {
    const response: ChatResponse = await this._makeRequest(messages, options);
    return this._parseResponse(response?.chatResult?.chatResponse);
  }

  override async *_streamResponseChunks(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const response: ReadableStream<Uint8Array> = await this._makeRequest(
      messages,
      options,
      true
    );
    const responseChunkIterator = new JsonServerEventsIterator(response);

    for await (const responseChunk of responseChunkIterator) {
      yield* this._streamResponseChunk(responseChunk, runManager);
    }
  }

  async *_streamResponseChunk(
    responseChunkData: unknown,
    runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const text: string | undefined =
      this._parseStreamedResponseChunk(responseChunkData);

    if (text === undefined) {
      return;
    }

    yield this._createStreamResponse(text);
    await runManager?.handleLLMNewToken(text);
  }

  async _makeRequest<ResponseType>(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    stream?: boolean
  ): Promise<ResponseType> {
    const request: OciGenAiSupportedRequestType = this._prepareRequest(
      messages,
      options,
      stream
    );
    await this._setupClient();
    return <ResponseType> await this._chat(request);
  }

  async _setupClient() {
    if (this._sdkClient) {
      return;
    }

    this._sdkClient = await OciGenAiSdkClient.create(this._params);
  }

  _createStreamResponse(text: string) {
    return new ChatGenerationChunk({
      message: new AIMessageChunk({ content: text }),
      text,
    });
  }

  _prepareRequest(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    stream?: boolean
  ): OciGenAiSupportedRequestType {
    this._assertMessages(messages);
    return this._createRequest(messages, options, stream);
  }

  _assertMessages(messages: BaseMessage[]) {
    if (messages.length === 0) {
      throw new Error("No messages provided");
    }

    for (const message of messages) {
      if (typeof message.content !== "string") {
        throw new Error("Only text messages are supported");
      }
    }
  }

  async _chat(
    chatRequest: OciGenAiSupportedRequestType
  ): Promise<OciGenAiChatCallResponseType> {
    try {
      return await this._callChat(chatRequest);
    } catch (error) {
      throw new Error(
        `Error executing chat API, error: ${(<Error>error)?.message}`
      );
    }
  }

  async _callChat(
    chatRequest: OciGenAiSupportedRequestType
  ): Promise<OciGenAiChatCallResponseType> {
    if (!OciGenAiBaseChat._isSdkClient(this._sdkClient)) {
      throw new Error("OCI SDK client not initialized");
    }

    const fullChatRequest: ChatRequest = this._composeFullRequest(chatRequest);
    return await this._sdkClient.client.chat(fullChatRequest);
  }

  _composeFullRequest(chatRequest: OciGenAiSupportedRequestType): ChatRequest {
    return {
      chatDetails: {
        chatRequest,
        compartmentId: this._getCompartmentId(),
        servingMode: this._getServingMode(),
      },
    };
  }

  static _isSdkClient(sdkClient: unknown): sdkClient is OciGenAiSdkClient {
    return (
      sdkClient !== null &&
      typeof sdkClient === "object" &&
      typeof (<OciGenAiSdkClient>sdkClient).client === "object"
    );
  }

  _getServingMode(): OnDemandServingMode | DedicatedServingMode {
    this._assertServingMode();

    if (typeof this._params?.onDemandModelId === "string") {
      return <OnDemandServingMode>{
        servingType: OnDemandServingMode.servingType,
        modelId: this._params.onDemandModelId,
      };
    }

    return <DedicatedServingMode>{
      servingType: DedicatedServingMode.servingType,
      endpointId: this._params.dedicatedEndpointId,
    };
  }

  _getCompartmentId(): string {
    if (!OciGenAiBaseChat._isValidString(this._params.compartmentId)) {
      throw new Error("Invalid compartmentId");
    }

    return this._params.compartmentId;
  }

  _assertServingMode() {
    if (
      !OciGenAiBaseChat._isValidString(this._params.onDemandModelId) &&
      !OciGenAiBaseChat._isValidString(this._params.dedicatedEndpointId)
    ) {
      throw new Error(
        "Either onDemandModelId or dedicatedEndpointId must be supplied"
      );
    }
  }

  static _isValidString(value: unknown): value is string {
    return typeof value === "string" && value.length > 0;
  }

  _llmType() {
    return "custom";
  }
}
