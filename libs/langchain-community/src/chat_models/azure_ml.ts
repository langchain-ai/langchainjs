import {
  SimpleChatModel,
  BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { BaseMessage } from "@langchain/core/messages";
import { AzureMLHttpClient } from "../llms/azure_ml.js";

export interface ChatContentFormatter {
  /**
   * Formats the request payload for the AzureML endpoint. It takes a
   * prompt and a dictionary of model arguments as input and returns a
   * string representing the formatted request payload.
   * @param messages A list of messages for the chat so far.
   * @param modelArgs A dictionary of model arguments.
   * @returns A string representing the formatted request payload.
   */
  formatRequestPayload: (
    messages: BaseMessage[],
    modelArgs: Record<string, unknown>
  ) => string;
  /**
   * Formats the response payload from the AzureML endpoint. It takes a
   * response payload as input and returns a string representing the
   * formatted response.
   * @param responsePayload The response payload from the AzureML endpoint.
   * @returns A string representing the formatted response.
   */
  formatResponsePayload: (output: string) => string;
}

export class LlamaContentFormatter implements ChatContentFormatter {
  _convertMessageToRecord(message: BaseMessage): Record<string, unknown> {
    if (message._getType() === "human") {
      return { role: "user", content: message.content };
    } else if (message._getType() === "ai") {
      return { role: "assistant", content: message.content };
    } else {
      return { role: message._getType(), content: message.content };
    }
  }

  formatRequestPayload(
    messages: BaseMessage[],
    modelArgs: Record<string, unknown>
  ): string {
    const msgs = messages.map((message) =>
      this._convertMessageToRecord(message)
    );
    return JSON.stringify({
      input_data: {
        input_string: msgs,
        parameters: modelArgs,
      },
    });
  }

  formatResponsePayload(responsePayload: string) {
    const response = JSON.parse(responsePayload);
    return response.output;
  }
}

/**
 * Type definition for the input parameters of the AzureMLChatOnlineEndpoint class.
 */
export interface AzureMLChatParams extends BaseChatModelParams {
  endpointUrl?: string;
  endpointApiKey?: string;
  modelArgs?: Record<string, unknown>;
  contentFormatter?: ChatContentFormatter;
}

/**
 * Class that represents the chat model. It extends the SimpleChatModel class and implements the AzureMLChatParams interface.
 */
export class AzureMLChatOnlineEndpoint
  extends SimpleChatModel
  implements AzureMLChatParams
{
  static lc_name() {
    return "AzureMLChatOnlineEndpoint";
  }

  static lc_description() {
    return "A class for interacting with AzureML Chat models.";
  }

  endpointUrl: string;

  endpointApiKey: string;

  modelArgs?: Record<string, unknown>;

  contentFormatter: ChatContentFormatter;

  httpClient: AzureMLHttpClient;

  constructor(fields?: AzureMLChatParams) {
    super(fields ?? {});
    if (!fields?.endpointUrl && !getEnvironmentVariable("AZUREML_URL")) {
      throw new Error("No Azure ML Url found.");
    }
    if (!fields?.endpointApiKey && !getEnvironmentVariable("AZUREML_API_KEY")) {
      throw new Error("No Azure ML ApiKey found.");
    }

    this.endpointUrl =
      fields?.endpointUrl ?? `${getEnvironmentVariable("AZUREML_URL")}`;
    this.endpointApiKey =
      fields?.endpointApiKey ?? `${getEnvironmentVariable("AZUREML_API_KEY")}`;
    this.httpClient = new AzureMLHttpClient(
      this.endpointUrl,
      this.endpointApiKey
    );
    this.contentFormatter = fields?.contentFormatter
      ? fields?.contentFormatter
      : new LlamaContentFormatter();
    this.modelArgs = fields?.modelArgs;
  }

  get _identifying_params() {
    const modelKwargs = this.modelArgs ?? {};
    return {
      ...super._identifyingParams,
      modelKwargs,
    };
  }

  _llmType() {
    return "azureml_chat";
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }

  async _call(
    messages: BaseMessage[],
    modelArgs: Record<string, unknown>
  ): Promise<string> {
    const requestPayload = this.contentFormatter.formatRequestPayload(
      messages,
      modelArgs
    );
    const responsePayload = await this.httpClient.call(requestPayload);
    const generatedText =
      this.contentFormatter.formatResponsePayload(responsePayload);
    return generatedText;
  }
}
