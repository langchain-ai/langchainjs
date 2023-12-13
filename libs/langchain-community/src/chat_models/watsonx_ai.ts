import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";
import {
  type BaseChatModelParams,
  SimpleChatModel,
} from "@langchain/core/language_models/chat_models";
import {
  AIMessageChunk,
  BaseMessage,
  ChatMessage,
} from "@langchain/core/messages";
import { ChatGenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";
import type {
  WatsonModelParameters,
  WatsonxAIParams,
} from "../types/watsonx-types.js";
import { WatsonApiClient } from "../utils/watsonx-client.js";

export class WatsonxAIChat extends SimpleChatModel {
  private readonly watsonApiClient: WatsonApiClient;

  readonly modelId!: string;

  readonly modelParameters?: WatsonModelParameters;

  readonly projectId!: string;

  constructor(fields: WatsonxAIParams & BaseChatModelParams) {
    super(fields);

    const {
      clientConfig = {},
      modelId = "meta-llama/llama-2-70b-chat",
      modelParameters,
      projectId = getEnvironmentVariable("WATSONX_PROJECT_ID") ?? "",
    } = fields;

    this.modelId = modelId;
    this.modelParameters = modelParameters;
    this.projectId = projectId;

    const {
      apiKey = getEnvironmentVariable("IBM_CLOUD_API_KEY"),
      apiVersion = "2023-05-29",
      region = "us-south",
    } = clientConfig;

    if (!apiKey) {
      throw new Error("Missing IBM Cloud API Key");
    }

    if (!this.projectId) {
      throw new Error("Missing WatsonX AI Project ID");
    }

    this.watsonApiClient = new WatsonApiClient({
      apiKey,
      apiVersion,
      region,
    });
  }

  protected _formatMessagesAsPrompt(messages: BaseMessage[]): string {
    return messages
      .map((message) => {
        let messageText;
        if (message._getType() === "human") {
          messageText = `[INST] ${message.content} [/INST]`;
        } else if (message._getType() === "ai") {
          messageText = message.content;
        } else if (message._getType() === "system") {
          messageText = `<<SYS>> ${message.content} <</SYS>>`;
        } else if (ChatMessage.isInstance(message)) {
          messageText = `\n\n${message.role[0].toUpperCase()}${message.role.slice(
            1
          )}: ${message.content}`;
        } else {
          console.warn(
            `Unsupported message type passed to Watson: "${message._getType()}"`
          );
          messageText = "";
        }
        return messageText;
      })
      .join("\n");
  }

  _combineLLMOutput() {
    return {};
  }

  async _call(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    runManager: CallbackManagerForLLMRun | undefined
  ): Promise<string> {
    const chunks = [];
    const stream = this._streamResponseChunks(messages, options, runManager);
    for await (const chunk of stream) {
      chunks.push(chunk.message.content);
    }
    return chunks.join("");
  }

  override async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    const formattedMessages = this._formatMessagesAsPrompt(_messages);
    const stream = await this.caller.call(async () =>
      this.watsonApiClient.generateTextStream(
        formattedMessages,
        this.projectId,
        this.modelId,
        this.modelParameters
      )
    );

    for await (const data of stream) {
      const [
        {
          generated_text,
          generated_token_count,
          input_token_count,
          stop_reason,
        },
      ] = data.results;
      const generationChunk = new ChatGenerationChunk({
        text: generated_text,
        message: new AIMessageChunk({ content: generated_text }),
        generationInfo: {
          generated_token_count,
          input_token_count,
          stop_reason,
        },
      });
      yield generationChunk;
      await _runManager?.handleLLMNewToken(generated_text);
    }
  }

  static lc_name() {
    return "WatsonxAIChat";
  }

  _llmType(): string {
    return "watsonx_ai";
  }

  get lc_secrets(): { [key: string]: string } | undefined {
    return {
      ibmCloudApiKey: "IBM_CLOUD_API_KEY",
      projectId: "WATSONX_PROJECT_ID",
    };
  }
}
