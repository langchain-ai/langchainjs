import {
  CallbackManagerForLLMRun,
  Callbacks,
} from "@langchain/core/callbacks/manager";
import { LLM } from "@langchain/core/language_models/llms";
import { type BaseLanguageModelCallOptions } from "@langchain/core/language_models/base";
import { BaseMessage, MessageContent } from "@langchain/core/messages";
import { GenerationChunk } from "@langchain/core/outputs";
import { getEnvironmentVariable } from "@langchain/core/utils/env";

import { AbstractGoogleLLMConnection } from "./connection.js";
import {
  GoogleAIBaseLLMInput,
  GoogleAIModelParams,
  GoogleAISafetySetting,
  GooglePlatformType,
  GeminiContent,
} from "./types.js";
import {
  copyAIModelParams,
  copyAndValidateModelParamsInto,
} from "./utils/common.js";
import {
  messageContentToParts,
  responseToBaseMessage,
  responseToGeneration,
  responseToString,
} from "./utils/gemini.js";
import { JsonStream } from "./utils/stream.js";
import { ApiKeyGoogleAuth, GoogleAbstractedClient } from "./auth.js";

class GoogleLLMConnection<AuthOptions> extends AbstractGoogleLLMConnection<
  MessageContent,
  AuthOptions
> {
  formatContents(
    input: MessageContent,
    _parameters: GoogleAIModelParams
  ): GeminiContent[] {
    const parts = messageContentToParts(input);
    const contents: GeminiContent[] = [
      {
        role: "user", // Required by Vertex AI
        parts,
      },
    ];
    return contents;
  }
}

/**
 * Input to LLM class.
 */
export interface GoogleBaseLLMInput<AuthOptions>
  extends GoogleAIBaseLLMInput<AuthOptions> {}

/**
 * Integration with an LLM.
 */
export abstract class GoogleBaseLLM<AuthOptions>
  extends LLM<BaseLanguageModelCallOptions>
  implements GoogleBaseLLMInput<AuthOptions>
{
  // Used for tracing, replace with the same name as your class
  static lc_name() {
    return "GoogleLLM";
  }

  lc_serializable = true;

  model = "gemini-pro";

  temperature = 0.7;

  maxOutputTokens = 1024;

  topP = 0.8;

  topK = 40;

  stopSequences: string[] = [];

  safetySettings: GoogleAISafetySetting[] = [];

  protected connection: GoogleLLMConnection<AuthOptions>;

  protected streamedConnection: GoogleLLMConnection<AuthOptions>;

  constructor(fields?: GoogleBaseLLMInput<AuthOptions>) {
    super(fields ?? {});

    copyAndValidateModelParamsInto(fields, this);

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
    this.connection = new GoogleLLMConnection(
      { ...fields, ...this },
      this.caller,
      client,
      false
    );

    this.streamedConnection = new GoogleLLMConnection(
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
    return "googlellm";
  }

  formatPrompt(prompt: string): MessageContent {
    return prompt;
  }

  /**
   * For some given input string and options, return a string output.
   */
  async _call(
    _prompt: string,
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): Promise<string> {
    const parameters = copyAIModelParams(this);
    const result = await this.connection.request(_prompt, parameters, _options);
    const ret = responseToString(result);
    return ret;
  }

  async *_streamResponseChunks(
    _prompt: string,
    _options: this["ParsedCallOptions"],
    _runManager?: CallbackManagerForLLMRun
  ): AsyncGenerator<GenerationChunk> {
    // Make the call as a streaming request
    const parameters = copyAIModelParams(this);
    const result = await this.streamedConnection.request(
      _prompt,
      parameters,
      _options
    );

    // Get the streaming parser of the response
    const stream = result.data as JsonStream;

    // Loop until the end of the stream
    // During the loop, yield each time we get a chunk from the streaming parser
    // that is either available or added to the queue
    while (!stream.streamDone) {
      const output = await stream.nextChunk();
      const chunk =
        output !== null
          ? new GenerationChunk(responseToGeneration({ data: output }))
          : new GenerationChunk({
              text: "",
              generationInfo: { finishReason: "stop" },
            });
      yield chunk;
    }
  }

  async predictMessages(
    messages: BaseMessage[],
    options?: string[] | BaseLanguageModelCallOptions,
    _callbacks?: Callbacks
  ): Promise<BaseMessage> {
    const { content } = messages[0];
    const result = await this.connection.request(
      content,
      {},
      options as BaseLanguageModelCallOptions
    );
    const ret = responseToBaseMessage(result);
    return ret;
  }
}
