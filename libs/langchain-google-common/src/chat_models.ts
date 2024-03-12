import { getEnvironmentVariable } from "@langchain/core/utils/env";
import { type BaseMessage } from "@langchain/core/messages";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { CallbackManagerForLLMRun } from "@langchain/core/callbacks/manager";

import {
  BaseChatModel,
  type BaseChatModelParams,
} from "@langchain/core/language_models/chat_models";
import { ChatGenerationChunk, ChatResult } from "@langchain/core/outputs";
import { AIMessageChunk } from "@langchain/core/messages";
import {
  GoogleAIBaseLLMInput,
  GoogleAIModelParams,
  GoogleAISafetySetting,
  GoogleConnectionParams,
  GooglePlatformType,
  GeminiContent,
} from "./types.js";
import {
  copyAIModelParams,
  copyAndValidateModelParamsInto,
} from "./utils/common.js";
import { AbstractGoogleLLMConnection } from "./connection.js";
import {
  baseMessageToContent,
  safeResponseToChatGeneration,
  safeResponseToChatResult,
  DefaultGeminiSafetyHandler,
} from "./utils/gemini.js";
import { ApiKeyGoogleAuth, GoogleAbstractedClient } from "./auth.js";
import { JsonStream } from "./utils/stream.js";
import { ensureParams } from "./utils/failed_handler.js";
import type {
  GoogleBaseLLMInput,
  GoogleAISafetyHandler,
  GoogleAISafetyParams,
} from "./types.js";

class ChatConnection<AuthOptions> extends AbstractGoogleLLMConnection<
  BaseMessage[],
  AuthOptions
> {
  formatContents(
    input: BaseMessage[],
    _parameters: GoogleAIModelParams
  ): GeminiContent[] {
    return input
      .map((msg) => baseMessageToContent(msg))
      .reduce((acc, cur) => [...acc, ...cur]);
  }
}

/**
 * Input to chat model class.
 */
export interface ChatGoogleBaseInput<AuthOptions>
  extends BaseChatModelParams,
    GoogleConnectionParams<AuthOptions>,
    GoogleAIModelParams,
    GoogleAISafetyParams {}

/**
 * Integration with a chat model.
 */
export abstract class ChatGoogleBase<AuthOptions>
  extends BaseChatModel<BaseLanguageModelCallOptions>
  implements ChatGoogleBaseInput<AuthOptions>
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "ChatGoogle";
  }

  lc_serializable = true;

  model = "gemini-pro";

  temperature = 0.7;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  stopSequences: string[] = [];

  safetySettings: GoogleAISafetySetting[] = [];

  safetyHandler: GoogleAISafetyHandler;

  protected connection: ChatConnection<AuthOptions>;

  protected streamedConnection: ChatConnection<AuthOptions>;

  constructor(fields?: ChatGoogleBaseInput<AuthOptions>) {
    super(ensureParams(fields));

    copyAndValidateModelParamsInto(fields, this);
    this.safetyHandler =
      fields?.safetyHandler ?? new DefaultGeminiSafetyHandler();

    const client = this.buildClient(fields);
    this.buildConnection(fields ?? {}, client);
  }

  abstract buildAbstractedClient(
    fields?: GoogleAIBaseLLMInput<AuthOptions>
  ): GoogleAbstractedClient;

  buildApiKeyClient(apiKey: string): GoogleAbstractedClient {
    return new ApiKeyGoogleAuth(apiKey);
  }

  buildApiKey(fields?: GoogleAIBaseLLMInput<AuthOptions>): string | undefined {
    return fields?.apiKey ?? getEnvironmentVariable("GOOGLE_API_KEY");
  }

  buildClient(
    fields?: GoogleAIBaseLLMInput<AuthOptions>
  ): GoogleAbstractedClient {
    const apiKey = this.buildApiKey(fields);
    if (apiKey) {
      return this.buildApiKeyClient(apiKey);
    } else {
      return this.buildAbstractedClient(fields);
    }
  }

  buildConnection(
    fields: GoogleBaseLLMInput<AuthOptions>,
    client: GoogleAbstractedClient
  ) {
    this.connection = new ChatConnection(
      { ...fields, ...this },
      this.caller,
      client,
      false
    );

    this.streamedConnection = new ChatConnection(
      { ...fields, ...this },
      this.caller,
      client,
      true
    );
  }

  get platform(): GooglePlatformType {
    return this.connection.platform;
  }

  // Replace
  _llmType() {
    return "chat_integration";
  }

  async _generate(
    messages: BaseMessage[],
    options: this["ParsedCallOptions"],
    _runManager: CallbackManagerForLLMRun | undefined
  ): Promise<ChatResult> {
    const parameters = copyAIModelParams(this);
    const response = await this.connection.request(
      messages,
      parameters,
      options
    );
    const ret = safeResponseToChatResult(response, this.safetyHandler);
    return ret;
  }

  async *_streamResponseChunks(
    _messages: BaseMessage[],
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<ChatGenerationChunk> {
    // Make the call as a streaming request
    const parameters = copyAIModelParams(this);
    const response = await this.streamedConnection.request(
      _messages,
      parameters,
      _options
    );

    // Get the streaming parser of the response
    const stream = response.data as JsonStream;

    // Loop until the end of the stream
    // During the loop, yield each time we get a chunk from the streaming parser
    // that is either available or added to the queue
    while (!stream.streamDone) {
      const output = await stream.nextChunk();
      const chunk =
        output !== null
          ? safeResponseToChatGeneration({ data: output }, this.safetyHandler)
          : new ChatGenerationChunk({
              text: "",
              generationInfo: { finishReason: "stop" },
              message: new AIMessageChunk({
                content: "",
              }),
            });
      yield chunk;
    }
  }

  /** @ignore */
  _combineLLMOutput() {
    return [];
  }
}
